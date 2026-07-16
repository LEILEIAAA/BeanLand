const cloud = require('wx-server-sdk');
const { recordPackageWechatConsume } = require('./memberCredit');
const {
  PAY_ORDER_STATUS,
  applyPaidSeat,
  canRegisterActivity,
  buildPaidRegistrationFromPayOrder,
} = require('./activityRegistration');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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

/**
 * 云开发支付结果回调（活动报名）。
 * 成功需返回 { errcode: 0, errmsg: 'ok' }。
 */
exports.main = async (event) => {
  const returnCode = event && (event.returnCode || event.return_code);
  const resultCode = event && (event.resultCode || event.result_code);
  const outTradeNo = event && (event.outTradeNo || event.out_trade_no);
  const totalFee = Number(event && (event.totalFee || event.total_fee));
  const transactionId = (event && (event.transactionId || event.transaction_id)) || '';

  if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
    return { errcode: 0, errmsg: 'ok' };
  }

  if (!outTradeNo) {
    return { errcode: 0, errmsg: 'ok' };
  }

  const found = await db.collection('activity_pay_orders').where({ outTradeNo }).limit(1).get();
  if (!found.data || !found.data.length) {
    return { errcode: 0, errmsg: 'ok' };
  }

  const order = found.data[0];
  const payOrderId = order._id;

  if (order.status === PAY_ORDER_STATUS.PAID) {
    return { errcode: 0, errmsg: 'ok' };
  }

  if (order.status !== PAY_ORDER_STATUS.PAYING) {
    return { errcode: 0, errmsg: 'ok' };
  }

  if (Number(order.payAmountFen) !== Number(totalFee)) {
    console.warn('[payActivityNotify] amount mismatch', outTradeNo, order.payAmountFen, totalFee);
    if (order.couponId) {
      await releaseUserCoupon(order.couponId, payOrderId, Date.now());
    }
    await db.collection('activity_pay_orders').doc(payOrderId).update({
      data: {
        status: PAY_ORDER_STATUS.FAILED,
        failReason: 'amount_mismatch',
        updatedAt: Date.now(),
      },
    });
    return { errcode: 0, errmsg: 'ok' };
  }

  const activity = await loadActivity(order.activityId);
  if (!activity || !canRegisterActivity(activity)) {
    await db.collection('activity_pay_orders').doc(payOrderId).update({
      data: {
        status: PAY_ORDER_STATUS.FAILED,
        failReason: 'activity full or closed on pay notify',
        updatedAt: Date.now(),
      },
    });
    if (order.couponId) {
      await releaseUserCoupon(order.couponId, payOrderId, Date.now());
    }
    return { errcode: 0, errmsg: 'ok' };
  }

  const now = Date.now();
  const memberFound = await db.collection('members').doc(order.memberId).get();
  const member = memberFound && memberFound.data ? { _id: order.memberId, ...memberFound.data } : null;
  const payYuan = Number(order.payAmountFen || 0) / 100;

  if (member) {
    await recordPackageWechatConsume(db, {
      member,
      memberId: order.memberId,
      payYuan,
      title: `活动报名 · ${order.activityName}`,
      channel: 'wechat_jsapi',
      packageId: order.activityId,
      couponId: order.couponId || '',
      orderId: payOrderId,
      outTradeNo,
      now,
    });
  }

  if (order.couponId) {
    await markUserCouponUsed(order.couponId, now);
  }

  const next = applyPaidSeat(activity);
  await db.collection('activities').doc(activity._docId).update({
    data: {
      registeredCount: next.registeredCount,
      status: next.status,
      updatedAt: now,
    },
  });

  const registration = buildPaidRegistrationFromPayOrder(
    { ...order, transactionId },
    now,
  );
  const addRes = await db.collection('activity_registrations').add({ data: registration });
  const registrationId = addRes._id;

  await db.collection('activity_pay_orders').doc(payOrderId).update({
    data: {
      status: PAY_ORDER_STATUS.PAID,
      registrationId,
      transactionId,
      paidAt: now,
      updatedAt: now,
    },
  });

  return { errcode: 0, errmsg: 'ok' };
};
