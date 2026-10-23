const STATUS = {
  PAID: 'paid',
  CANCELLED: 'cancelled',
  REFUND_PENDING: 'refund_pending',
  REFUNDED: 'refunded',
  EXPIRED: 'expired',
  FAILED: 'failed',
};

const PAY_ORDER_STATUS = {
  PAYING: 'paying',
  PAID: 'paid',
  FAILED: 'failed',
};

const PAY_CHANNEL = {
  BALANCE: 'balance',
  WECHAT: 'wechat',
};

const ACTIVE_STATUSES = [
  STATUS.PAID,
  STATUS.REFUND_PENDING,
];

const USER_LIST_STATUSES = [
  STATUS.PAID,
  STATUS.REFUND_PENDING,
];

const STATUS_LABEL = {
  [STATUS.PAID]: '已报名',
  [STATUS.CANCELLED]: '已取消',
  [STATUS.REFUND_PENDING]: '退款失败',
  [STATUS.REFUNDED]: '已退款',
  [STATUS.EXPIRED]: '已过期',
  [STATUS.FAILED]: '失败',
};

/** Admin「已取消」筛：含余额取消、微信已退、微信退款失败待重试 */
const ADMIN_CANCELLED_STATUSES = [
  STATUS.CANCELLED,
  STATUS.REFUNDED,
  STATUS.REFUND_PENDING,
];

function resolveAdminListStatusFilter(status) {
  const key = status == null ? '' : String(status);
  if (!key) return null;
  if (key === 'cancelled') {
    return { op: 'in', values: ADMIN_CANCELLED_STATUSES.slice() };
  }
  if (key === 'effective') {
    return { op: 'eq', value: STATUS.PAID, refine: 'effective' };
  }
  return { op: 'eq', value: key };
}

/** 已支付且活动开场时间已到 → 管理侧「已生效」（票务制，无核销态） */
function isActivityRegistrationEffective(registration, startAt, now = Date.now()) {
  if (!registration || registration.status !== STATUS.PAID) return false;
  const start = Number(startAt || 0);
  if (!(start > 0)) return false;
  return Number(now || Date.now()) >= start;
}

const CANCEL_TIER = {
  FULL: 'full',
  FEE: 'fee',
  BLOCKED_STARTED: 'blocked_started',
  BLOCKED_NO_START: 'blocked_no_start',
};

const FREE_CANCEL_HOURS = 24;
const LATE_CANCEL_FEE_RATE = 0.3;

const UNIVERSAL_SCOPE_MARKERS = [
  '到店体验可用',
  '美团用户到店后注册会员',
  '生日月会员',
];

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
  return `A${stamp}${mid}${rand}`.slice(0, 32);
}

function canRegisterActivity(activity) {
  if (!activity) return false;
  if (activity.status !== 'recruiting') return false;
  const capacity = Number(activity.capacity || 0);
  const registered = Number(activity.registeredCount || 0);
  return registered < capacity;
}

function hasActiveRegistration(rows, openid, activityId) {
  return (rows || []).some(
    (row) =>
      String(row._openid) === String(openid) &&
      String(row.activityId) === String(activityId) &&
      ACTIVE_STATUSES.includes(row.status),
  );
}

function hasOpenPayOrder(rows, openid, activityId) {
  return (rows || []).some(
    (row) =>
      String(row._openid) === String(openid) &&
      String(row.activityId) === String(activityId) &&
      row.status === PAY_ORDER_STATUS.PAYING,
  );
}

function isUserVisibleRegistration(row) {
  return !!(row && USER_LIST_STATUSES.includes(row.status));
}

function applyPaidSeat(activity) {
  const capacity = Number(activity.capacity || 0);
  const registeredCount = Number(activity.registeredCount || 0) + 1;
  const status =
    capacity > 0 && registeredCount >= capacity ? 'full' : activity.status || 'recruiting';
  return {
    ...activity,
    registeredCount,
    status: status === 'full' ? 'full' : 'recruiting',
  };
}

function applyReleaseSeat(activity) {
  const registeredCount = Math.max(0, Number(activity.registeredCount || 0) - 1);
  const capacity = Number(activity.capacity || 0);
  let status = activity.status;
  if (status === 'full' && registeredCount < capacity) {
    status = 'recruiting';
  }
  return {
    ...activity,
    registeredCount,
    status,
  };
}

function isCouponAvailable(coupon) {
  if (!coupon) return false;
  if (coupon.holdOrderId) return false;
  const status = coupon.status || 'available';
  if (status === 'available') return true;
  if (status === 'unused') return coupon.available !== false;
  return false;
}

function resolveCouponOffAmount(listPrice, coupon) {
  if (!coupon) return 0;
  if (coupon.benefitType === 'discount') {
    const rate = Number(coupon.benefitValue || 0);
    if (!(rate > 0 && rate < 10)) return 0;
    const payRate = rate / 10;
    return Math.max(0, Number((listPrice * (1 - payRate)).toFixed(2)));
  }
  return Math.max(0, Number(coupon.amount || 0));
}

function normalizeRegistrationCoupon(raw) {
  if (!raw) return null;
  const id = raw.id || raw._id;
  if (!id) return null;
  if (raw.benefitType === 'hours') return null;
  if (!isCouponAvailable(raw)) return null;

  const amount = Number(raw.amount || 0);
  const benefitType = raw.benefitType || '';
  if (benefitType === 'discount') {
    const rate = Number(raw.benefitValue || 0);
    if (!(rate > 0 && rate < 10)) return null;
  } else if (benefitType) {
    return null;
  } else if (!(amount > 0)) {
    return null;
  }

  return {
    id: String(id),
    name: raw.name || '优惠券',
    amount,
    benefitType,
    benefitValue: Number(raw.benefitValue || 0),
    scope: raw.scope || '',
    status: raw.status === 'unused' ? 'available' : (raw.status || 'available'),
    holdOrderId: raw.holdOrderId || '',
  };
}

function scopeMatchesActivity(scope, activityName) {
  const raw = String(scope || '').trim();
  const name = String(activityName || '').trim();
  if (!raw) return true;
  if (!name) return false;
  if (UNIVERSAL_SCOPE_MARKERS.some((marker) => raw.includes(marker))) {
    return true;
  }
  if (raw.includes(name) || name.includes(raw)) {
    return true;
  }
  const parts = raw.split(/[\/、,，]/).map((part) => part.trim()).filter(Boolean);
  return parts.some((part) => name.includes(part) || part.includes(name));
}

function isCouponApplicable(coupon, activity) {
  if (!isCouponAvailable(coupon)) return false;
  return scopeMatchesActivity(coupon.scope, activity && activity.name);
}

function listApplicableCoupons(coupons, activity) {
  return (coupons || [])
    .map((coupon) => normalizeRegistrationCoupon(coupon))
    .filter((coupon) => coupon && isCouponApplicable(coupon, activity));
}

function pickBestCoupon(coupons, activity) {
  const list = listApplicableCoupons(coupons, activity);
  if (!list.length) return null;
  const listPrice = Number((activity && activity.price) || 0);
  return list.reduce((best, current) => {
    const bestAmount = resolveCouponOffAmount(listPrice, best);
    const currentAmount = resolveCouponOffAmount(listPrice, current);
    if (currentAmount > bestAmount) return current;
    if (currentAmount === bestAmount && String(current.id) < String(best.id)) return current;
    return best;
  });
}

function calcActivityQuote(activity, coupon) {
  const listPrice = Number((activity && activity.price) || 0);
  const normalized = normalizeRegistrationCoupon(coupon) || (
    coupon && isCouponApplicable(coupon, activity) ? coupon : null
  );
  const applicable = normalized && isCouponApplicable(normalized, activity) ? normalized : null;
  const rawOff = applicable ? resolveCouponOffAmount(listPrice, applicable) : 0;
  const couponAmount = applicable ? Math.min(rawOff, listPrice) : 0;
  const payAmount = Math.max(0, Number((listPrice - couponAmount).toFixed(2)));
  return {
    listPrice,
    couponId: applicable ? String(applicable.id || '') : '',
    couponAmount,
    payAmount,
    payAmountFen: yuanToFen(payAmount),
    needPayment: payAmount > 0,
  };
}

function buildBaseDraft({
  openid,
  memberId,
  activity,
  name,
  phone,
  now,
  outTradeNo,
  quote,
}) {
  const ts = now || Date.now();
  const listPrice = Number((activity && activity.price) || 0);
  const resolved = quote || {
    listPrice,
    couponId: '',
    couponAmount: 0,
    payAmount: listPrice,
    payAmountFen: yuanToFen(listPrice),
    needPayment: listPrice > 0,
  };
  return {
    _openid: openid,
    memberId,
    activityId: (activity && (activity.id || activity._id)) || '',
    activityName: (activity && activity.name) || '',
    name: name || '',
    phone: phone || '',
    amount: resolved.listPrice,
    couponId: resolved.couponId || '',
    couponAmount: resolved.couponAmount || 0,
    payAmountFen: resolved.payAmountFen,
    outTradeNo: outTradeNo || buildOutTradeNo(memberId),
    transactionId: '',
    balanceTxId: '',
    principalPaid: 0,
    bonusPaid: 0,
    createdAt: ts,
    paidAt: 0,
    cancelledAt: 0,
    refundedAt: 0,
    updatedAt: ts,
  };
}

function buildBalanceDraft(params) {
  const ts = params.now || Date.now();
  return {
    ...buildBaseDraft(params),
    payChannel: PAY_CHANNEL.BALANCE,
    status: STATUS.PAID,
    paidAt: ts,
  };
}

function buildWechatPayOrderDraft(params) {
  return {
    ...buildBaseDraft(params),
    payChannel: PAY_CHANNEL.WECHAT,
    status: PAY_ORDER_STATUS.PAYING,
    registrationId: '',
  };
}

function buildPaidRegistrationFromPayOrder(order, now) {
  const ts = now || Date.now();
  return {
    _openid: order._openid,
    memberId: order.memberId,
    activityId: order.activityId,
    activityName: order.activityName,
    name: order.name,
    phone: order.phone,
    amount: order.amount,
    couponId: order.couponId || '',
    couponAmount: order.couponAmount || 0,
    payAmountFen: order.payAmountFen,
    outTradeNo: order.outTradeNo,
    transactionId: order.transactionId || '',
    balanceTxId: '',
    principalPaid: 0,
    bonusPaid: 0,
    payChannel: PAY_CHANNEL.WECHAT,
    status: STATUS.PAID,
    createdAt: order.createdAt || ts,
    paidAt: ts,
    cancelledAt: 0,
    refundedAt: 0,
    updatedAt: ts,
  };
}

function canUserCancel(registration) {
  return !!(registration && registration.status === STATUS.PAID);
}

function resolveCancelPolicy(startAt, now = Date.now()) {
  const start = Number(startAt || 0);
  if (!(start > 0)) {
    return {
      tier: CANCEL_TIER.BLOCKED_NO_START,
      canCancel: false,
      feeRate: 0,
      hoursLeft: null,
    };
  }
  const ts = Number(now || Date.now());
  if (ts >= start) {
    return {
      tier: CANCEL_TIER.BLOCKED_STARTED,
      canCancel: false,
      feeRate: 0,
      hoursLeft: 0,
    };
  }
  const hoursLeft = (start - ts) / (3600 * 1000);
  if (hoursLeft > FREE_CANCEL_HOURS) {
    return {
      tier: CANCEL_TIER.FULL,
      canCancel: true,
      feeRate: 0,
      hoursLeft,
    };
  }
  return {
    tier: CANCEL_TIER.FEE,
    canCancel: true,
    feeRate: LATE_CANCEL_FEE_RATE,
    hoursLeft,
  };
}

function resolvePaidFen(registration) {
  const fen = Number((registration && registration.payAmountFen) || 0);
  if (fen > 0) return fen;
  const yuan =
    Number((registration && registration.principalPaid) || 0) +
    Number((registration && registration.bonusPaid) || 0);
  return yuanToFen(yuan);
}

function calcCancelRefund(registration, policy) {
  const paidFen = resolvePaidFen(registration);
  const canCancel = !!(policy && policy.canCancel);
  const feeRate = canCancel ? Number(policy.feeRate || 0) : 0;
  const feeFen = Math.round(paidFen * feeRate);
  const refundFen = Math.max(0, paidFen - feeFen);

  const principal = Number((registration && registration.principalPaid) || 0);
  const bonus = Number((registration && registration.bonusPaid) || 0);
  const totalYuan = principal + bonus;
  if (!(totalYuan > 0) || !(paidFen > 0)) {
    return {
      paidFen,
      feeFen,
      refundFen,
      principalRefund: 0,
      bonusRefund: 0,
    };
  }
  const refundYuan = refundFen / 100;
  const principalRefund = Number(((principal / totalYuan) * refundYuan).toFixed(2));
  const bonusRefund = Number((refundYuan - principalRefund).toFixed(2));
  return {
    paidFen,
    feeFen,
    refundFen,
    principalRefund,
    bonusRefund,
  };
}

function assertUserCancelAllowed(registration, startAt, now = Date.now()) {
  if (!canUserCancel(registration)) {
    return { ok: false, code: 'CANNOT_CANCEL', message: '当前状态不可取消' };
  }
  const policy = resolveCancelPolicy(startAt, now);
  if (!policy.canCancel) {
    if (policy.tier === CANCEL_TIER.BLOCKED_NO_START) {
      return {
        ok: false,
        code: 'NO_START_AT',
        message: '活动时间未定，请联系店主',
        policy,
      };
    }
    return {
      ok: false,
      code: 'ALREADY_STARTED',
      message: '活动已开始，不可取消',
      policy,
    };
  }
  return { ok: true, policy };
}

function fenToYuanText(fen) {
  return `¥${(Number(fen || 0) / 100).toFixed(2)}`;
}

function buildCancelConfirmContent(policy, refund) {
  if (!policy || !policy.canCancel) {
    if (policy && policy.tier === CANCEL_TIER.BLOCKED_NO_START) {
      return '活动时间未定，请联系店主取消';
    }
    return '活动已开始，不可取消';
  }
  const refundText = fenToYuanText(refund && refund.refundFen);
  if (policy.tier === CANCEL_TIER.FULL) {
    return `将全额退回 ${refundText}（优惠券不退回）`;
  }
  const feeText = fenToYuanText(refund && refund.feeFen);
  return `距开始不足${FREE_CANCEL_HOURS}小时，将扣除手续费 ${feeText}，退回 ${refundText}（优惠券不退回）`;
}

function resolveWechatRefundFeeFen(registration) {
  if (registration && registration.refundFeeFen != null && registration.refundFeeFen !== '') {
    return Math.max(0, Number(registration.refundFeeFen));
  }
  return Math.max(0, Number((registration && registration.payAmountFen) || 0));
}

function applyUserCancel(registration, now, cancelMeta = {}) {
  const ts = now || Date.now();
  if (!canUserCancel(registration)) {
    return { ...registration };
  }
  const isBalance = registration.payChannel === PAY_CHANNEL.BALANCE;
  return {
    ...registration,
    status: isBalance ? STATUS.CANCELLED : STATUS.REFUND_PENDING,
    cancelledAt: ts,
    updatedAt: ts,
    seatReleased: true,
    cancelTier: cancelMeta.tier || '',
    cancelFeeFen: Number(cancelMeta.feeFen || 0),
    refundFeeFen: Number(cancelMeta.refundFen || 0),
  };
}

function applyAdminConfirmRefund(registration, now) {
  const ts = now || Date.now();
  if (!registration || registration.status !== STATUS.REFUND_PENDING) {
    return { ...registration };
  }
  return {
    ...registration,
    status: STATUS.REFUNDED,
    refundedAt: ts,
    refundFailReason: '',
    updatedAt: ts,
  };
}

function markActivityRefundFailed(registration, { now, refundFailReason } = {}) {
  if (!registration || registration.status !== STATUS.REFUND_PENDING) {
    throw new Error('registration not refund_pending');
  }
  const ts = now || Date.now();
  return {
    ...registration,
    status: STATUS.REFUND_PENDING,
    refundFailReason: refundFailReason || '',
    updatedAt: ts,
  };
}

function applyRefundBalances(member, { principalPaid, bonusPaid }) {
  const principal = Number(principalPaid || 0);
  const bonus = Number(bonusPaid || 0);
  const principalBalance = Number(member.principalBalance || 0) + principal;
  const bonusBalance = Number(member.bonusBalance || 0) + bonus;
  const refundTotal = principal + bonus;
  const totalSpent = Math.max(0, Number(member.totalSpent || 0) - refundTotal);
  return {
    ...member,
    principalBalance,
    bonusBalance,
    totalBalance: principalBalance + bonusBalance,
    totalSpent,
  };
}

function countPaidSince(rows, sinceTs) {
  const since = Number(sinceTs || 0);
  return (rows || []).filter(
    (row) => row.status === STATUS.PAID && Number(row.paidAt || 0) >= since,
  ).length;
}

function splitSpendSnapshot(member, amount) {
  const spendAmount = Number(amount || 0);
  const bonusBalance = Number(member.bonusBalance || 0);
  const bonusPaid = Math.min(bonusBalance, spendAmount);
  const principalPaid = spendAmount - bonusPaid;
  return { principalPaid, bonusPaid };
}

module.exports = {
  STATUS,
  PAY_ORDER_STATUS,
  PAY_CHANNEL,
  ACTIVE_STATUSES,
  USER_LIST_STATUSES,
  STATUS_LABEL,
  ADMIN_CANCELLED_STATUSES,
  resolveAdminListStatusFilter,
  isActivityRegistrationEffective,
  CANCEL_TIER,
  FREE_CANCEL_HOURS,
  LATE_CANCEL_FEE_RATE,
  UNIVERSAL_SCOPE_MARKERS,
  yuanToFen,
  buildOutTradeNo,
  canRegisterActivity,
  hasActiveRegistration,
  hasOpenPayOrder,
  isUserVisibleRegistration,
  applyPaidSeat,
  applyReleaseSeat,
  isCouponAvailable,
  isCouponApplicable,
  normalizeRegistrationCoupon,
  resolveCouponOffAmount,
  listApplicableCoupons,
  pickBestCoupon,
  calcActivityQuote,
  buildBalanceDraft,
  buildWechatPayOrderDraft,
  buildPaidRegistrationFromPayOrder,
  canUserCancel,
  resolveCancelPolicy,
  calcCancelRefund,
  assertUserCancelAllowed,
  buildCancelConfirmContent,
  resolveWechatRefundFeeFen,
  applyUserCancel,
  applyAdminConfirmRefund,
  markActivityRefundFailed,
  applyRefundBalances,
  countPaidSince,
  splitSpendSnapshot,
};
