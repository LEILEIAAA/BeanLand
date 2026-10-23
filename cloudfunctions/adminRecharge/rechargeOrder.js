const CHANNEL = {
  WECHAT_JSAPI: 'wechat_jsapi',
  TRANSFER_MANUAL: 'transfer_manual',
};

const STATUS = {
  CREATED: 'created',
  PAYING: 'paying',
  PAID: 'paid',
  CREDITED: 'credited',
  CLOSED: 'closed',
  FAILED: 'failed',
};

const ALLOWED_TRANSITIONS = {
  [STATUS.CREATED]: [STATUS.PAYING, STATUS.FAILED, STATUS.CLOSED],
  [STATUS.PAYING]: [STATUS.PAID, STATUS.CLOSED, STATUS.FAILED],
  [STATUS.PAID]: [STATUS.CREDITED],
  [STATUS.CREDITED]: [],
  [STATUS.CLOSED]: [],
  [STATUS.FAILED]: [],
};

function yuanToFen(yuan) {
  return Math.round(Number(yuan || 0) * 100);
}

function buildOutTradeNo(memberId) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const mid = String(memberId || 'X')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  return `R${stamp}${mid}${rand}`.slice(0, 32);
}

function buildWechatRechargeDraft({ openid, memberId, plan, now, outTradeNo }) {
  const rechargeAmount = Number(plan.rechargeAmount || 0);
  const bonusAmount = Number(plan.bonusAmount || 0);
  const ts = now || Date.now();
  return {
    _openid: openid,
    memberId,
    planId: plan.id || plan._id || '',
    rechargeAmount,
    bonusAmount,
    payAmountFen: yuanToFen(rechargeAmount),
    channel: CHANNEL.WECHAT_JSAPI,
    status: STATUS.CREATED,
    outTradeNo: outTradeNo || buildOutTradeNo(memberId),
    transactionId: '',
    balanceTxId: '',
    operatorOpenid: '',
    createdAt: ts,
    paidAt: 0,
    creditedAt: 0,
    updatedAt: ts,
  };
}

function buildManualRechargeDraft({
  openid,
  memberId,
  planId,
  rechargeAmount,
  bonusAmount,
  operatorOpenid,
  now,
  outTradeNo,
}) {
  const ts = now || Date.now();
  const principal = Number(rechargeAmount || 0);
  const bonus = Number(bonusAmount || 0);
  return {
    _openid: openid,
    memberId,
    planId: planId || '',
    rechargeAmount: principal,
    bonusAmount: bonus,
    payAmountFen: yuanToFen(principal),
    channel: CHANNEL.TRANSFER_MANUAL,
    status: STATUS.CREDITED,
    outTradeNo: outTradeNo || buildOutTradeNo(memberId),
    transactionId: '',
    balanceTxId: '',
    operatorOpenid: operatorOpenid || '',
    createdAt: ts,
    paidAt: ts,
    creditedAt: ts,
    updatedAt: ts,
  };
}

function canTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function isCreditIdempotent(order) {
  return !!(order && order.status === STATUS.CREDITED);
}

function assertPayAmountMatch(order, paidFen) {
  return Number(order && order.payAmountFen) === Number(paidFen);
}

module.exports = {
  CHANNEL,
  STATUS,
  ALLOWED_TRANSITIONS,
  yuanToFen,
  buildOutTradeNo,
  buildWechatRechargeDraft,
  buildManualRechargeDraft,
  canTransition,
  isCreditIdempotent,
  assertPayAmountMatch,
};
