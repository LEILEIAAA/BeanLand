const cloud = require('wx-server-sdk');
const { creditMemberRecharge } = require('./memberCredit');
const {
  STATUS,
  isCreditIdempotent,
  assertPayAmountMatch,
  CHANNEL,
} = require('./rechargeOrder');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 云开发支付结果回调。
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

  const found = await db
    .collection('recharge_orders')
    .where({ outTradeNo })
    .limit(1)
    .get();

  if (!found.data || !found.data.length) {
    return { errcode: 0, errmsg: 'ok' };
  }

  const order = found.data[0];
  const orderId = order._id;

  if (isCreditIdempotent(order)) {
    return { errcode: 0, errmsg: 'ok' };
  }

  if (!assertPayAmountMatch(order, totalFee)) {
    await db.collection('recharge_orders').doc(orderId).update({
      data: {
        status: STATUS.FAILED,
        updatedAt: Date.now(),
        failReason: 'amount_mismatch',
      },
    });
    return { errcode: 0, errmsg: 'ok' };
  }

  const now = Date.now();
  if (order.status === STATUS.PAYING || order.status === STATUS.CREATED) {
    await db.collection('recharge_orders').doc(orderId).update({
      data: {
        status: STATUS.PAID,
        transactionId,
        paidAt: now,
        updatedAt: now,
      },
    });
  }

  const memberRes = await db.collection('members').doc(order.memberId).get();
  const member = memberRes.data;
  if (!member) {
    return { errcode: 0, errmsg: 'ok' };
  }

  // re-read for race
  const latest = await db.collection('recharge_orders').doc(orderId).get();
  if (isCreditIdempotent(latest.data)) {
    return { errcode: 0, errmsg: 'ok' };
  }

  const credited = await creditMemberRecharge(db, {
    member,
    memberId: order.memberId,
    rechargeAmount: order.rechargeAmount,
    bonusAmount: order.bonusAmount,
    title: `充 ${order.rechargeAmount} 送 ${order.bonusAmount}`,
    channel: CHANNEL.WECHAT_JSAPI,
    planId: order.planId,
    operatorOpenid: '',
    orderId,
    outTradeNo,
    now: Date.now(),
  });

  await db.collection('recharge_orders').doc(orderId).update({
    data: {
      status: STATUS.CREDITED,
      transactionId,
      balanceTxId: credited.transactionId,
      creditedAt: credited.appliedAt,
      paidAt: order.paidAt || now,
      updatedAt: credited.appliedAt,
    },
  });

  return { errcode: 0, errmsg: 'ok' };
};
