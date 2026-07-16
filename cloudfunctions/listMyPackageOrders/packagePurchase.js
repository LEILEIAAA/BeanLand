const CHANNEL = {
  WECHAT_JSAPI: 'wechat_jsapi',
  BALANCE: 'balance',
};

const PAY_METHOD = {
  WECHAT: 'wechat',
  BALANCE: 'balance',
};

const STATUS = {
  CREATED: 'created',
  PAYING: 'paying',
  PAID: 'paid',
  FULFILLED: 'fulfilled',
  REDEEMED: 'redeemed',
  EXPIRED_REFUNDING: 'expired_refunding',
  EXPIRED_REFUNDED: 'expired_refunded',
  EXPIRED_REFUND_PENDING: 'expired_refund_pending',
  USER_REFUNDING: 'user_refunding',
  USER_REFUNDED: 'user_refunded',
  USER_REFUND_PENDING: 'user_refund_pending',
  CLOSED: 'closed',
  FAILED: 'failed',
};

const DEFAULT_VALIDITY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const UNIVERSAL_SCOPE_MARKERS = [
  '到店体验可用',
  '美团用户到店后注册会员',
  '生日月会员',
];

function yuanToFen(yuan) {
  return Math.round(Number(yuan || 0) * 100);
}

/** China calendar weekend: Sat/Sun in UTC+8 */
function isChinaWeekend(now = Date.now()) {
  const china = new Date(Number(now) + 8 * 60 * 60 * 1000);
  const day = china.getUTCDay();
  return day === 0 || day === 6;
}

function resolveDayPrice(pkg, now = Date.now()) {
  const weekend = Number((pkg && pkg.weekendPrice) || 0);
  const weekday = Number((pkg && pkg.weekdayPrice) || 0);
  if (weekend > 0 || weekday > 0) {
    return isChinaWeekend(now) ? (weekend || weekday) : (weekday || weekend);
  }
  return Number((pkg && pkg.price) || 0);
}

function applyOpeningDiscount(amount, promo) {
  const base = Number(amount || 0);
  if (!promo || !promo.active) {
    return { price: base, basePrice: base, promoActive: false, discountRate: 10 };
  }
  const rate = Number(promo.discountRate || 0);
  if (!(rate > 0 && rate < 10)) {
    return { price: base, basePrice: base, promoActive: false, discountRate: 10 };
  }
  return {
    price: Number(((base * rate) / 10).toFixed(2)),
    basePrice: base,
    promoActive: true,
    discountRate: rate,
  };
}

function resolvePackageForSale(pkg, promo, now = Date.now()) {
  const dayType = isChinaWeekend(now) ? 'weekend' : 'weekday';
  const dayPrice = resolveDayPrice(pkg, now);
  const skipPromo = !!(pkg && (pkg.skipOpeningDiscount || pkg.id === 'opening-trio'));
  const discounted = skipPromo
    ? { price: dayPrice, basePrice: dayPrice, promoActive: false, discountRate: 10 }
    : applyOpeningDiscount(dayPrice, promo);
  return {
    ...pkg,
    price: discounted.price,
    dayType,
    dayPrice,
    basePrice: discounted.basePrice,
    promoActive: discounted.promoActive,
    promoDiscountRate: discounted.discountRate,
  };
}

/** 开业优惠进行中时，套餐购买不可叠加优惠券 */
function isOpeningCouponBlocked(promo) {
  return !!(promo && promo.active);
}

function buildOutTradeNo(memberId) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const mid = String(memberId || 'X')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  return `P${stamp}${mid}${rand}`.slice(0, 32);
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

function normalizePurchaseCoupon(raw) {
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

function scopeMatchesPackage(scope, packageName) {
  const raw = String(scope || '').trim();
  const name = String(packageName || '').trim();
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

function isCouponApplicable(coupon, pkg) {
  if (!isCouponAvailable(coupon)) return false;
  return scopeMatchesPackage(coupon.scope, pkg && pkg.name);
}

function listApplicableCoupons(coupons, pkg) {
  return (coupons || [])
    .map((coupon) => normalizePurchaseCoupon(coupon))
    .filter((coupon) => coupon && isCouponApplicable(coupon, pkg));
}

function pickBestCoupon(coupons, pkg) {
  const list = listApplicableCoupons(coupons, pkg);
  if (!list.length) return null;
  const listPrice = Number((pkg && pkg.price) || 0);
  return list.reduce((best, current) => {
    const bestAmount = resolveCouponOffAmount(listPrice, best);
    const currentAmount = resolveCouponOffAmount(listPrice, current);
    if (currentAmount > bestAmount) return current;
    if (currentAmount === bestAmount && String(current.id) < String(best.id)) return current;
    return best;
  });
}

function calcPackageQuote(pkg, coupon) {
  const listPrice = Number((pkg && pkg.price) || 0);
  const normalized = normalizePurchaseCoupon(coupon) || (
    coupon && isCouponApplicable(coupon, pkg) ? coupon : null
  );
  const applicable = normalized && isCouponApplicable(normalized, pkg) ? normalized : null;
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

function buildPackageSnapshot(pkg) {
  return {
    id: (pkg && (pkg.id || pkg._id)) || '',
    name: (pkg && pkg.name) || '',
    targetAudience: (pkg && pkg.targetAudience) || '',
    overtimeRule: (pkg && pkg.overtimeRule) || '',
    includedItems: Array.isArray(pkg && pkg.includedItems) ? pkg.includedItems.slice() : [],
  };
}

function resolveValidityDays(validityDays) {
  const days = Number(validityDays);
  if (Number.isFinite(days) && days > 0) return Math.floor(days);
  return DEFAULT_VALIDITY_DAYS;
}

function attachFulfillmentEntitlement(order, { pkg, fulfilledAt, validityDays, principalPaid, bonusPaid, payAmountYuan } = {}) {
  const ts = Number(fulfilledAt || (order && order.fulfilledAt) || Date.now());
  const days = resolveValidityDays(validityDays != null ? validityDays : order && order.validityDays);
  const quotePayYuan = payAmountYuan != null
    ? Number(payAmountYuan)
    : (order && order.payAmountYuan != null
      ? Number(order.payAmountYuan)
      : Number(order && order.payAmountFen ? order.payAmountFen / 100 : 0));
  return {
    ...order,
    status: STATUS.FULFILLED,
    fulfilledAt: ts,
    validityDays: days,
    expiresAt: ts + days * DAY_MS,
    packageSnapshot: (order && order.packageSnapshot) || buildPackageSnapshot(pkg || { id: order && order.packageId, name: order && order.packageName }),
    packageName: (order && order.packageName) || (pkg && pkg.name) || '',
    payAmountYuan: quotePayYuan,
    principalPaid: principalPaid != null ? Number(principalPaid) : Number((order && order.principalPaid) || 0),
    bonusPaid: bonusPaid != null ? Number(bonusPaid) : Number((order && order.bonusPaid) || 0),
    updatedAt: ts,
  };
}

function isPackageOrderExpired(order, now = Date.now()) {
  if (!order || order.status !== STATUS.FULFILLED) return false;
  const expiresAt = Number(order.expiresAt || 0);
  if (!expiresAt) return false;
  return Number(now) >= expiresAt;
}

function canRedeemPackageOrder(order, now = Date.now()) {
  if (!order || order.status !== STATUS.FULFILLED) return false;
  if (isPackageOrderExpired(order, now)) return false;
  return true;
}

function applyRedeemPackageOrder(order, { now, redeemedBy } = {}) {
  if (!canRedeemPackageOrder(order, now)) {
    throw new Error('package order not redeemable');
  }
  const ts = now || Date.now();
  return {
    ...order,
    status: STATUS.REDEEMED,
    redeemedAt: ts,
    redeemedBy: redeemedBy || '',
    updatedAt: ts,
  };
}

function resolveRefundChannel(order) {
  if (order && order.payMethod === PAY_METHOD.WECHAT) return PAY_METHOD.WECHAT;
  if (order && order.channel === CHANNEL.WECHAT_JSAPI) return PAY_METHOD.WECHAT;
  return PAY_METHOD.BALANCE;
}

function beginExpirePackageRefund(order, now = Date.now()) {
  if (!isPackageOrderExpired(order, now)) {
    throw new Error('package order not expired');
  }
  const ts = Number(now);
  return {
    ...order,
    status: STATUS.EXPIRED_REFUNDING,
    refundChannel: resolveRefundChannel(order),
    expireStartedAt: ts,
    updatedAt: ts,
  };
}

function completeExpirePackageRefund(order, { now, refundTxId } = {}) {
  if (!order || (order.status !== STATUS.EXPIRED_REFUNDING && order.status !== STATUS.EXPIRED_REFUND_PENDING)) {
    throw new Error('package order not in refunding state');
  }
  const ts = now || Date.now();
  return {
    ...order,
    status: STATUS.EXPIRED_REFUNDED,
    refundTxId: refundTxId || order.refundTxId || '',
    refundedAt: ts,
    updatedAt: ts,
  };
}

function markExpirePackageRefundPending(order, { now, refundFailReason } = {}) {
  if (!order || (order.status !== STATUS.EXPIRED_REFUNDING && order.status !== STATUS.EXPIRED_REFUND_PENDING)) {
    throw new Error('package order not in refunding state');
  }
  const ts = now || Date.now();
  return {
    ...order,
    status: STATUS.EXPIRED_REFUND_PENDING,
    refundFailReason: refundFailReason || '',
    updatedAt: ts,
  };
}

function canUserRefundPackageOrder(order, now = Date.now()) {
  return canRedeemPackageOrder(order, now);
}

function beginUserPackageRefund(order, now = Date.now()) {
  if (!canUserRefundPackageOrder(order, now)) {
    throw new Error('package order not refundable by user');
  }
  const ts = Number(now);
  return {
    ...order,
    status: STATUS.USER_REFUNDING,
    refundChannel: resolveRefundChannel(order),
    refundReason: 'user_cancel',
    updatedAt: ts,
  };
}

function completeUserPackageRefund(order, { now, refundTxId } = {}) {
  if (!order || (order.status !== STATUS.USER_REFUNDING && order.status !== STATUS.USER_REFUND_PENDING)) {
    throw new Error('package order not in user refunding state');
  }
  const ts = now || Date.now();
  return {
    ...order,
    status: STATUS.USER_REFUNDED,
    refundTxId: refundTxId || order.refundTxId || '',
    refundedAt: ts,
    refundFailReason: '',
    updatedAt: ts,
  };
}

function markUserPackageRefundPending(order, { now, refundFailReason } = {}) {
  if (!order || (order.status !== STATUS.USER_REFUNDING && order.status !== STATUS.USER_REFUND_PENDING)) {
    throw new Error('package order not in user refunding state');
  }
  const ts = now || Date.now();
  return {
    ...order,
    status: STATUS.USER_REFUND_PENDING,
    refundFailReason: refundFailReason || '',
    updatedAt: ts,
  };
}

function buildBaseDraft({ openid, memberId, pkg, quote, now, outTradeNo }) {
  const ts = now || Date.now();
  return {
    _openid: openid,
    memberId,
    packageId: (pkg && (pkg.id || pkg._id)) || '',
    packageName: (pkg && pkg.name) || '',
    listPrice: quote.listPrice,
    couponId: quote.couponId || '',
    couponAmount: quote.couponAmount || 0,
    payAmountFen: quote.payAmountFen,
    outTradeNo: outTradeNo || buildOutTradeNo(memberId),
    transactionId: '',
    balanceTxId: '',
    createdAt: ts,
    paidAt: 0,
    fulfilledAt: 0,
    updatedAt: ts,
  };
}

function buildWechatPackageDraft(params) {
  const days = resolveValidityDays(params.validityDays);
  const snapshot = buildPackageSnapshot(params.pkg);
  return {
    ...buildBaseDraft(params),
    channel: CHANNEL.WECHAT_JSAPI,
    payMethod: PAY_METHOD.WECHAT,
    status: STATUS.CREATED,
    validityDays: days,
    packageSnapshot: snapshot,
    payAmountYuan: Number((params.quote && params.quote.payAmount) != null
      ? params.quote.payAmount
      : (params.quote && params.quote.payAmountFen ? params.quote.payAmountFen / 100 : 0)),
    principalPaid: 0,
    bonusPaid: 0,
  };
}

function buildBalancePackageDraft(params) {
  const ts = params.now || Date.now();
  const quotePayYuan = Number((params.quote && params.quote.payAmount) != null
    ? params.quote.payAmount
    : (params.quote && params.quote.payAmountFen ? params.quote.payAmountFen / 100 : 0));
  const base = {
    ...buildBaseDraft(params),
    channel: CHANNEL.BALANCE,
    payMethod: PAY_METHOD.BALANCE,
    paidAt: ts,
  };
  return attachFulfillmentEntitlement(base, {
    pkg: params.pkg,
    fulfilledAt: ts,
    validityDays: params.validityDays,
    principalPaid: params.principalPaid != null ? params.principalPaid : quotePayYuan,
    bonusPaid: params.bonusPaid != null ? params.bonusPaid : 0,
    payAmountYuan: quotePayYuan,
  });
}

function isFulfillIdempotent(order) {
  if (!order) return false;
  return [
    STATUS.FULFILLED,
    STATUS.REDEEMED,
    STATUS.EXPIRED_REFUNDING,
    STATUS.EXPIRED_REFUNDED,
    STATUS.EXPIRED_REFUND_PENDING,
    STATUS.USER_REFUNDING,
    STATUS.USER_REFUNDED,
    STATUS.USER_REFUND_PENDING,
  ].includes(order.status);
}

function assertPayAmountMatch(order, paidFen) {
  return Number(order && order.payAmountFen) === Number(paidFen);
}

function mapCoupons(coupons, couponId, mapper) {
  return (coupons || []).map((coupon) => {
    if (String(coupon.id) !== String(couponId)) return coupon;
    return mapper(coupon);
  });
}

function holdCoupon(coupons, couponId, orderId) {
  if (!couponId) return coupons || [];
  return mapCoupons(coupons, couponId, (coupon) => ({
    ...coupon,
    status: 'held',
    holdOrderId: orderId || '',
  }));
}

function releaseCoupon(coupons, couponId, orderId) {
  if (!couponId) return coupons || [];
  return mapCoupons(coupons, couponId, (coupon) => {
    if (orderId && coupon.holdOrderId && String(coupon.holdOrderId) !== String(orderId)) {
      return coupon;
    }
    const next = { ...coupon, status: 'available' };
    delete next.holdOrderId;
    return next;
  });
}

function markCouponUsed(coupons, couponId) {
  if (!couponId) return coupons || [];
  return mapCoupons(coupons, couponId, (coupon) => {
    const next = { ...coupon, status: 'used' };
    delete next.holdOrderId;
    return next;
  });
}

function findCoupon(coupons, couponId) {
  if (!couponId) return null;
  return (coupons || []).find((coupon) => String(coupon.id) === String(couponId)) || null;
}

module.exports = {
  CHANNEL,
  PAY_METHOD,
  STATUS,
  DEFAULT_VALIDITY_DAYS,
  DAY_MS,
  UNIVERSAL_SCOPE_MARKERS,
  yuanToFen,
  buildOutTradeNo,
  isChinaWeekend,
  resolveDayPrice,
  applyOpeningDiscount,
  resolvePackageForSale,
  isOpeningCouponBlocked,
  isCouponAvailable,
  isCouponApplicable,
  normalizePurchaseCoupon,
  resolveCouponOffAmount,
  listApplicableCoupons,
  pickBestCoupon,
  calcPackageQuote,
  buildPackageSnapshot,
  resolveValidityDays,
  attachFulfillmentEntitlement,
  isPackageOrderExpired,
  canRedeemPackageOrder,
  applyRedeemPackageOrder,
  beginExpirePackageRefund,
  completeExpirePackageRefund,
  markExpirePackageRefundPending,
  canUserRefundPackageOrder,
  beginUserPackageRefund,
  completeUserPackageRefund,
  markUserPackageRefundPending,
  buildWechatPackageDraft,
  buildBalancePackageDraft,
  isFulfillIdempotent,
  assertPayAmountMatch,
  holdCoupon,
  releaseCoupon,
  markCouponUsed,
  findCoupon,
};
