const cloud = require('wx-server-sdk');
const { debitMemberSpend } = require('./memberCredit');
const {
  calcPackageQuote,
  normalizePurchaseCoupon,
  isCouponApplicable,
  buildBalancePackageDraft,
  buildOutTradeNo,
  resolvePackageForSale,
  isOpeningCouponBlocked,
  CHANNEL,
} = require('./packagePurchase');

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

async function markUserCouponUsed(couponId, now) {
  await db.collection('user_coupons').doc(couponId).update({
    data: {
      status: 'used',
      usedAt: now,
      updatedAt: now,
      holdOrderId: '',
    },
  });
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
  if (!isValidPhone(member.phone)) {
    return { ok: false, code: 'PHONE_REQUIRED', message: 'phone required before purchase' };
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
  const payYuan = quote.payAmount;
  if (payYuan > 0 && Number(member.totalBalance || 0) < payYuan) {
    return { ok: false, code: 'INSUFFICIENT_BALANCE', message: '余额不足' };
  }

  const now = Date.now();
  const outTradeNo = buildOutTradeNo(member._id);
  const validityDays = await loadPackageValidityDays();
  const draft = buildBalancePackageDraft({
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

  try {
    let balanceTxId = '';
    let nextMember = member;
    let principalPaid = Number(draft.principalPaid || 0);
    let bonusPaid = Number(draft.bonusPaid || 0);

    if (payYuan > 0) {
      const debited = await debitMemberSpend(db, {
        member,
        memberId: member._id,
        amount: payYuan,
        title: pkg.name,
        reason: `${pkg.name} · 余额支付`,
        channel: CHANNEL.BALANCE,
        packageId: pkg.id,
        couponId: quote.couponId,
        orderId,
        outTradeNo,
        now,
      });
      balanceTxId = debited.transactionId;
      nextMember = debited.member;
      principalPaid = Number(debited.principalPaid || 0);
      bonusPaid = Number(debited.bonusPaid || 0);
    } else {
      const txRes = await db.collection('member_transactions').add({
        data: {
          _openid: OPENID,
          type: 'consume',
          title: pkg.name,
          reason: `${pkg.name} · 优惠券全额抵扣`,
          amount: 0,
          principalDelta: 0,
          bonusDelta: 0,
          principalBalanceAfter: Number(member.principalBalance || 0),
          bonusBalanceAfter: Number(member.bonusBalance || 0),
          totalBalanceAfter: Number(member.totalBalance || 0),
          channel: CHANNEL.BALANCE,
          packageId: pkg.id,
          couponId: quote.couponId,
          orderId,
          outTradeNo,
          createdAt: now,
        },
      });
      balanceTxId = txRes._id;
      principalPaid = 0;
      bonusPaid = 0;
    }

    if (quote.couponId) {
      await markUserCouponUsed(quote.couponId, now);
    }

    await db.collection('package_orders').doc(orderId).update({
      data: {
        balanceTxId,
        principalPaid,
        bonusPaid,
        payAmountYuan: payYuan,
        updatedAt: now,
      },
    });

    return {
      ok: true,
      orderId,
      outTradeNo,
      payAmount: payYuan,
      member: nextMember,
    };
  } catch (error) {
    await db.collection('package_orders').doc(orderId).update({
      data: {
        status: 'failed',
        updatedAt: Date.now(),
        failReason: (error && error.message) || 'balance purchase failed',
      },
    });
    return {
      ok: false,
      code: 'PURCHASE_FAILED',
      message: (error && error.message) || 'purchase failed',
    };
  }
};
