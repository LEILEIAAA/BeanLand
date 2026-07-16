const cloud = require('wx-server-sdk');
const { creditMemberRecharge } = require('./memberCredit');
const { buildManualRechargeDraft, CHANNEL } = require('./rechargeOrder');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const isAdmin = await assertAdmin(OPENID).catch(() => false);
  if (!isAdmin) {
    return { ok: false, code: 'FORBIDDEN', message: 'admin only' };
  }

  const memberId = event && event.memberId;
  const rechargeAmount = Number(event && event.rechargeAmount);
  const bonusAmount = Number((event && event.bonusAmount) || 0);
  const planId = (event && event.planId) || '';
  const title = (event && event.title) || `充 ${rechargeAmount} 送 ${bonusAmount}`;

  if (!memberId || !(rechargeAmount > 0)) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'memberId and rechargeAmount required',
    };
  }

  const memberRes = await db.collection('members').doc(memberId).get();
  const member = memberRes.data;
  if (!member) {
    return { ok: false, code: 'NOT_FOUND', message: 'member not found' };
  }

  const now = Date.now();
  const draft = buildManualRechargeDraft({
    openid: member._openid,
    memberId,
    planId,
    rechargeAmount,
    bonusAmount,
    operatorOpenid: OPENID,
    now,
  });

  const orderRes = await db.collection('recharge_orders').add({ data: draft });
  const orderId = orderRes._id;

  const credited = await creditMemberRecharge(db, {
    member,
    memberId,
    rechargeAmount,
    bonusAmount,
    title,
    channel: CHANNEL.TRANSFER_MANUAL,
    planId,
    operatorOpenid: OPENID,
    orderId,
    outTradeNo: draft.outTradeNo,
    now,
  });

  await db.collection('recharge_orders').doc(orderId).update({
    data: {
      balanceTxId: credited.transactionId,
      updatedAt: credited.appliedAt,
    },
  });

  return {
    ok: true,
    member: credited.member,
    transactionId: credited.transactionId,
    orderId,
    outTradeNo: draft.outTradeNo,
    tier: credited.tier,
  };
};
