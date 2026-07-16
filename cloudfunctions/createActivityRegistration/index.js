const cloud = require('wx-server-sdk');
const payConfig = require('./payConfig');
const { debitMemberSpend } = require('./memberCredit');
const {
  STATUS,
  PAY_ORDER_STATUS,
  PAY_CHANNEL,
  canRegisterActivity,
  hasActiveRegistration,
  hasOpenPayOrder,
  applyPaidSeat,
  buildBalanceDraft,
  buildWechatPayOrderDraft,
  buildOutTradeNo,
  splitSpendSnapshot,
  yuanToFen,
  calcActivityQuote,
  normalizeRegistrationCoupon,
  isCouponApplicable,
} = require('./activityRegistration');
const { buildSeatSnapshot } = require('./activityList');

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

async function loadActivity(activityId) {
  const col = db.collection('activities');
  try {
    const byId = await col.doc(activityId).get();
    if (byId && byId.data) return { _docId: activityId, id: activityId, ...byId.data };
  } catch (error) {
    // try where
  }
  const found = await col.where({ id: activityId }).limit(1).get();
  if (found.data && found.data.length) {
    const row = found.data[0];
    return { _docId: row._id, id: row.id || row._id, ...row };
  }
  return null;
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

async function assertNoActive(openid, activityId) {
  const found = await db
    .collection('activity_registrations')
    .where({ _openid: openid, activityId })
    .limit(20)
    .get();
  if (hasActiveRegistration(found.data || [], openid, activityId)) {
    return true;
  }

  const paying = await db
    .collection('activity_pay_orders')
    .where({ _openid: openid, activityId })
    .limit(20)
    .get();
  return hasOpenPayOrder(paying.data || [], openid, activityId);
}

async function bumpActivitySeat(activity) {
  const next = applyPaidSeat(activity);
  await db.collection('activities').doc(activity._docId).update({
    data: {
      registeredCount: next.registeredCount,
      status: next.status,
      updatedAt: Date.now(),
    },
  });
  return next;
}

function withSeatFields(payload, activity) {
  return {
    ...payload,
    ...buildSeatSnapshot(activity),
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const activityId = event && event.activityId;
  let payChannel = (event && event.payChannel) || PAY_CHANNEL.BALANCE;
  const couponId = (event && event.couponId) || '';
  if (!activityId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'activityId required' };
  }
  if (payChannel !== PAY_CHANNEL.BALANCE && payChannel !== PAY_CHANNEL.WECHAT) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'payChannel invalid' };
  }

  const memberFound = await db.collection('members').where({ _openid: OPENID }).limit(1).get();
  if (!memberFound.data || !memberFound.data.length) {
    return { ok: false, code: 'NOT_FOUND', message: 'member not found' };
  }
  const member = memberFound.data[0];
  if (!isValidPhone(member.phone)) {
    return { ok: false, code: 'PHONE_REQUIRED', message: 'phone required before registration' };
  }

  const activity = await loadActivity(activityId);
  if (!activity) {
    return { ok: false, code: 'ACTIVITY_NOT_FOUND', message: 'activity not found' };
  }
  if (!canRegisterActivity(activity)) {
    const code = activity.status === 'recruiting' ? 'FULL' : 'NOT_RECRUITING';
    return { ok: false, code, message: code === 'FULL' ? '活动已满员' : '活动未开放报名' };
  }

  if (await assertNoActive(OPENID, activity.id)) {
    return { ok: false, code: 'ALREADY_REGISTERED', message: '已报名该活动' };
  }

  let coupon = null;
  if (couponId) {
    const raw = await loadUserCoupon(couponId, OPENID);
    coupon = normalizeRegistrationCoupon(raw);
    if (!coupon || !isCouponApplicable(coupon, activity)) {
      return { ok: false, code: 'COUPON_INVALID', message: 'coupon not applicable' };
    }
  }

  const quote = calcActivityQuote(activity, coupon);
  if (!quote.needPayment) {
    payChannel = PAY_CHANNEL.BALANCE;
  }

  const name = member.name || member.nickname || member.nickName || '';
  const phone = normalizePhone(member.phone);
  const now = Date.now();
  const outTradeNo = buildOutTradeNo(member._id);

  if (payChannel === PAY_CHANNEL.BALANCE) {
    const payYuan = quote.payAmount;
    if (payYuan > 0 && Number(member.totalBalance || 0) < payYuan) {
      return { ok: false, code: 'BALANCE_INSUFFICIENT', message: '余额不足' };
    }

    const snapshot = splitSpendSnapshot(member, payYuan);
    const draft = buildBalanceDraft({
      openid: OPENID,
      memberId: member._id,
      activity,
      name,
      phone,
      now,
      outTradeNo,
      quote,
    });
    draft.principalPaid = snapshot.principalPaid;
    draft.bonusPaid = snapshot.bonusPaid;

    const addRes = await db.collection('activity_registrations').add({ data: draft });
    const registrationId = addRes._id;

    try {
      let balanceTxId = '';
      let nextMember = member;
      if (payYuan > 0) {
        const debited = await debitMemberSpend(db, {
          member,
          memberId: member._id,
          amount: payYuan,
          title: `活动报名 · ${activity.name}`,
          reason: `活动报名 · ${activity.name}`,
          channel: PAY_CHANNEL.BALANCE,
          packageId: '',
          couponId: quote.couponId,
          orderId: registrationId,
          outTradeNo,
          now,
        });
        balanceTxId = debited.transactionId;
        nextMember = debited.member;
      } else if (quote.couponId) {
        const txRes = await db.collection('member_transactions').add({
          data: {
            _openid: OPENID,
            type: 'consume',
            title: `活动报名 · ${activity.name}`,
            reason: `活动报名 · ${activity.name} · 优惠券全额抵扣`,
            amount: 0,
            principalDelta: 0,
            bonusDelta: 0,
            principalBalanceAfter: Number(member.principalBalance || 0),
            bonusBalanceAfter: Number(member.bonusBalance || 0),
            totalBalanceAfter: Number(member.totalBalance || 0),
            channel: PAY_CHANNEL.BALANCE,
            packageId: '',
            couponId: quote.couponId,
            orderId: registrationId,
            outTradeNo,
            createdAt: now,
          },
        });
        balanceTxId = txRes._id;
      }

      if (quote.couponId) {
        await markUserCouponUsed(quote.couponId, now);
      }

      const seated = await bumpActivitySeat(activity);
      await db.collection('activity_registrations').doc(registrationId).update({
        data: { balanceTxId, updatedAt: now },
      });

      return withSeatFields(
        {
          ok: true,
          registrationId,
          outTradeNo,
          payChannel: PAY_CHANNEL.BALANCE,
          status: STATUS.PAID,
          amount: quote.listPrice,
          couponId: quote.couponId,
          couponAmount: quote.couponAmount,
          payAmount: payYuan,
          member: nextMember,
        },
        seated,
      );
    } catch (error) {
      await db.collection('activity_registrations').doc(registrationId).update({
        data: {
          status: STATUS.FAILED,
          updatedAt: Date.now(),
          failReason: (error && error.message) || 'balance register failed',
        },
      });
      return {
        ok: false,
        code: 'REGISTER_FAILED',
        message: (error && error.message) || 'register failed',
      };
    }
  }

  // wechat
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

  const draft = buildWechatPayOrderDraft({
    openid: OPENID,
    memberId: member._id,
    activity,
    name,
    phone,
    now,
    outTradeNo,
    quote,
  });

  const addRes = await db.collection('activity_pay_orders').add({ data: draft });
  const payOrderId = addRes._id;

  if (quote.couponId) {
    await holdUserCoupon(quote.couponId, payOrderId, now);
  }

  try {
    const payRes = await cloud.cloudPay.unifiedOrder({
      body: `Bean活动${activity.name}`.slice(0, 127),
      outTradeNo: draft.outTradeNo,
      spbillCreateIp: '127.0.0.1',
      subMchId,
      totalFee: draft.payAmountFen || yuanToFen(quote.payAmount),
      envId: payConfig.envId,
      functionName: payConfig.notifyFunctionName || 'payActivityNotify',
      tradeType: 'JSAPI',
      nonceStr: Math.random().toString(36).slice(2),
    });

    const payment = payRes && (payRes.payment || payRes);
    if (!payment || !payment.paySign) {
      await db.collection('activity_pay_orders').doc(payOrderId).update({
        data: { status: PAY_ORDER_STATUS.FAILED, updatedAt: Date.now() },
      });
      if (quote.couponId) {
        await releaseUserCoupon(quote.couponId, payOrderId, Date.now());
      }
      return {
        ok: false,
        code: 'UNIFIED_ORDER_FAILED',
        message: 'unifiedOrder missing payment',
        raw: payRes,
      };
    }

    return {
      ok: true,
      payOrderId,
      outTradeNo,
      payChannel: PAY_CHANNEL.WECHAT,
      amount: quote.listPrice,
      couponId: quote.couponId,
      couponAmount: quote.couponAmount,
      payAmount: quote.payAmount,
      payAmountFen: draft.payAmountFen || yuanToFen(quote.payAmount),
      payment: {
        timeStamp: String(payment.timeStamp),
        nonceStr: payment.nonceStr,
        package: payment.package,
        signType: payment.signType || 'MD5',
        paySign: payment.paySign,
      },
    };
  } catch (error) {
    await db.collection('activity_pay_orders').doc(payOrderId).update({
      data: {
        status: PAY_ORDER_STATUS.FAILED,
        updatedAt: Date.now(),
        failReason: (error && error.message) || 'wechat order failed',
      },
    });
    if (quote.couponId) {
      await releaseUserCoupon(quote.couponId, payOrderId, Date.now());
    }
    return {
      ok: false,
      code: 'UNIFIED_ORDER_FAILED',
      message: (error && error.errMsg) || (error && error.message) || 'unifiedOrder failed',
    };
  }
};
