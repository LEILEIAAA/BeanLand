const cloud = require('wx-server-sdk');
const payConfig = require('./payConfig');
const {
  calcPackageQuote,
  normalizePurchaseCoupon,
  isCouponApplicable,
  buildWechatPackageDraft,
  buildOutTradeNo,
  resolvePackageForSale,
  isOpeningCouponBlocked,
  STATUS,
} = require('./packagePurchase');
const { assertMemberRegistered } = require('./memberRegistration');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function normalizePhone(phone) {
  let digits = String(phone || '')
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, '');
  if (digits.length >= 13 && digits.startsWith('86')) {
    const local = digits.slice(2);
    if (/^1[3-9]\d{9}$/.test(local)) digits = local;
  }
  return digits;
}

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(normalizePhone(phone));
}

async function loadSubMchId() {
  if (payConfig.subMchId) return payConfig.subMchId;
  try {
    const doc = await db.collection('pay_config').doc('main').get();
    if (doc && doc.data && doc.data.subMchId) return String(doc.data.subMchId);
  } catch (error) {
    // missing
  }
  return '';
}

async function loadPackagePromo() {
  try {
    const doc = await db.collection('store').doc('main').get();
    if (doc && doc.data && doc.data.packagePromo) return doc.data.packagePromo;
  } catch (error) {
    // missing
  }
  return { active: true, discountRate: 8, label: '开业七天', tip: '全场套餐打 8 折' };
}

async function loadPackageValidityDays() {
  try {
    const doc = await db.collection('store').doc('main').get();
    if (doc && doc.data && doc.data.packageValidityDays != null) {
      return Number(doc.data.packageValidityDays);
    }
  } catch (error) {
    // missing
  }
  return undefined;
}

async function loadPackage(packageId) {
  const col = db.collection('packages');
  try {
    const byId = await col.doc(packageId).get();
    if (byId && byId.data) return { id: packageId, ...byId.data };
  } catch (error) {
    // try where
  }
  const found = await col.where({ id: packageId }).limit(1).get();
  if (found.data && found.data.length) {
    const row = found.data[0];
    return { id: row.id || row._id, ...row };
  }
  return null;
}

async function loadUserCoupon(couponId, openid) {
  if (!couponId) return null;
  try {
    const doc = await db.collection('user_coupons').doc(couponId).get();
    if (!doc || !doc.data) return null;
    if (doc.data._openid && openid && doc.data._openid !== openid) return null;
    return { _id: couponId, id: couponId, ...doc.data };
  } catch (error) {
    return null;
  }
}

async function holdUserCoupon(couponId, orderId, now) {
  await db.collection('user_coupons').doc(couponId).update({
    data: {
      holdOrderId: orderId,
      updatedAt: now,
    },
  });
}

async function releaseUserCoupon(couponId, orderId, now) {
  try {
    const doc = await db.collection('user_coupons').doc(couponId).get();
    if (!doc || !doc.data) return;
    if (orderId && doc.data.holdOrderId && String(doc.data.holdOrderId) !== String(orderId)) {
      return;
    }
    await db.collection('user_coupons').doc(couponId).update({
      data: {
        holdOrderId: '',
        updatedAt: now,
      },
    });
  } catch (error) {
    // ignore
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const packageId = event && event.packageId;
  const couponId = (event && event.couponId) || '';
  if (!packageId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'packageId required' };
  }

  const memberFound = await db.collection('members').where({ _openid: OPENID }).limit(1).get();
  if (!memberFound.data || !memberFound.data.length) {
    return { ok: false, code: 'NOT_FOUND', message: 'member not found' };
  }
  const member = memberFound.data[0];
  const registered = assertMemberRegistered(member);
  if (!registered.ok) {
    return registered;
  }

  const rawPkg = await loadPackage(packageId);
  if (!rawPkg) {
    return { ok: false, code: 'PACKAGE_NOT_FOUND', message: 'package not found' };
  }
  const promo = await loadPackagePromo();
  const pkg = resolvePackageForSale(rawPkg, promo, Date.now());
  if (!(Number(pkg.price) >= 0)) {
    return { ok: false, code: 'PACKAGE_NOT_FOUND', message: 'package not found' };
  }

  let coupon = null;
  if (couponId) {
    if (isOpeningCouponBlocked(promo)) {
      return { ok: false, code: 'COUPON_BLOCKED', message: '开业优惠期间不可使用优惠券' };
    }
    const raw = await loadUserCoupon(couponId, OPENID);
    coupon = normalizePurchaseCoupon(raw);
    if (!coupon || !isCouponApplicable(coupon, pkg)) {
      return { ok: false, code: 'COUPON_INVALID', message: 'coupon not applicable' };
    }
  }

  const quote = calcPackageQuote(pkg, coupon);

  if (!quote.needPayment) {
    return {
      ok: false,
      code: 'ZERO_AMOUNT',
      message: '实付为 0，请使用余额通道完成核销',
    };
  }

  const subMchId = await loadSubMchId();
  if (!subMchId) {
    return {
      ok: false,
      code: 'PAY_CONFIG_MISSING',
      message: 'subMchId missing; set pay_config/main or payConfig.subMchId',
    };
  }

  const now = Date.now();
  const outTradeNo = buildOutTradeNo(member._id);
  const validityDays = await loadPackageValidityDays();
  const draft = buildWechatPackageDraft({
    openid: OPENID,
    memberId: member._id,
    pkg,
    quote,
    now,
    outTradeNo,
    validityDays,
  });

  const addRes = await db.collection('package_orders').add({ data: draft });
  const orderId = addRes._id;

  if (quote.couponId) {
    await holdUserCoupon(quote.couponId, orderId, now);
  }

  try {
    const payRes = await cloud.cloudPay.unifiedOrder({
      body: `Bean套餐${pkg.name}`.slice(0, 127),
      outTradeNo: draft.outTradeNo,
      spbillCreateIp: '127.0.0.1',
      subMchId,
      totalFee: draft.payAmountFen,
      envId: payConfig.envId,
      functionName: payConfig.notifyFunctionName || 'payPackageNotify',
      tradeType: 'JSAPI',
      nonceStr: Math.random().toString(36).slice(2),
    });

    const payment = payRes && (payRes.payment || payRes);
    if (!payment || !payment.paySign) {
      await db.collection('package_orders').doc(orderId).update({
        data: { status: STATUS.FAILED, updatedAt: Date.now() },
      });
      if (quote.couponId) {
        await releaseUserCoupon(quote.couponId, orderId, Date.now());
      }
      return {
        ok: false,
        code: 'UNIFIED_ORDER_FAILED',
        message: 'unifiedOrder missing payment',
        raw: payRes,
      };
    }

    await db.collection('package_orders').doc(orderId).update({
      data: { status: STATUS.PAYING, updatedAt: Date.now() },
    });

    return {
      ok: true,
      orderId,
      outTradeNo: draft.outTradeNo,
      payAmountFen: draft.payAmountFen,
      payment: {
        timeStamp: String(payment.timeStamp),
        nonceStr: payment.nonceStr,
        package: payment.package,
        signType: payment.signType || 'MD5',
        paySign: payment.paySign,
      },
    };
  } catch (error) {
    await db.collection('package_orders').doc(orderId).update({
      data: { status: STATUS.FAILED, updatedAt: Date.now() },
    });
    if (quote.couponId) {
      await releaseUserCoupon(quote.couponId, orderId, Date.now());
    }
    return {
      ok: false,
      code: 'UNIFIED_ORDER_FAILED',
      message: (error && error.errMsg) || (error && error.message) || 'unifiedOrder failed',
    };
  }
};
