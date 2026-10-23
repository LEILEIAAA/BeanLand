const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STATUS,
  PAY_ORDER_STATUS,
  PAY_CHANNEL,
  ACTIVE_STATUSES,
  USER_LIST_STATUSES,
  CANCEL_TIER,
  FREE_CANCEL_HOURS,
  LATE_CANCEL_FEE_RATE,
  canRegisterActivity,
  hasActiveRegistration,
  hasOpenPayOrder,
  isUserVisibleRegistration,
  applyPaidSeat,
  applyReleaseSeat,
  buildBalanceDraft,
  buildWechatPayOrderDraft,
  buildPaidRegistrationFromPayOrder,
  canUserCancel,
  applyUserCancel,
  applyAdminConfirmRefund,
  markActivityRefundFailed,
  resolveCancelPolicy,
  calcCancelRefund,
  assertUserCancelAllowed,
  buildCancelConfirmContent,
  resolveWechatRefundFeeFen,
  yuanToFen,
  buildOutTradeNo,
  countPaidSince,
  STATUS_LABEL,
  isCouponApplicable,
  listApplicableCoupons,
  pickBestCoupon,
  calcActivityQuote,
  normalizeRegistrationCoupon,
} = require('../miniprogram/utils/activityRegistration');

const recruiting = {
  id: 'summer-partner',
  name: '暑期拼豆搭子计划',
  price: 49,
  capacity: 24,
  status: 'recruiting',
  registeredCount: 0,
};

test('canRegisterActivity requires recruiting and free seats', () => {
  assert.equal(canRegisterActivity(recruiting), true);
  assert.equal(canRegisterActivity({ ...recruiting, status: 'consulting' }), false);
  assert.equal(canRegisterActivity({ ...recruiting, status: 'full' }), false);
  assert.equal(
    canRegisterActivity({ ...recruiting, registeredCount: 24, capacity: 24 }),
    false,
  );
});

test('hasActiveRegistration blocks duplicate openid+activity', () => {
  const rows = [
    { _openid: 'o1', activityId: 'summer-partner', status: STATUS.PAID },
    { _openid: 'o2', activityId: 'summer-partner', status: STATUS.CANCELLED },
  ];
  assert.equal(hasActiveRegistration(rows, 'o1', 'summer-partner'), true);
  assert.equal(hasActiveRegistration(rows, 'o2', 'summer-partner'), false);
  assert.equal(hasActiveRegistration(rows, 'o1', 'mayday'), false);
  assert.ok(!ACTIVE_STATUSES.includes('pending_pay'));
  assert.ok(ACTIVE_STATUSES.includes(STATUS.REFUND_PENDING));
});

test('hasOpenPayOrder blocks checkout while paying', () => {
  const rows = [
    { _openid: 'o1', activityId: 'summer-partner', status: PAY_ORDER_STATUS.PAYING },
    { _openid: 'o1', activityId: 'mayday', status: PAY_ORDER_STATUS.FAILED },
  ];
  assert.equal(hasOpenPayOrder(rows, 'o1', 'summer-partner'), true);
  assert.equal(hasOpenPayOrder(rows, 'o1', 'mayday'), false);
});

test('isUserVisibleRegistration only exposes purchased rows', () => {
  assert.equal(isUserVisibleRegistration({ status: STATUS.PAID }), true);
  assert.equal(isUserVisibleRegistration({ status: STATUS.REFUND_PENDING }), true);
  assert.equal(isUserVisibleRegistration({ status: STATUS.CANCELLED }), false);
  assert.equal(isUserVisibleRegistration({ status: STATUS.FAILED }), false);
  assert.deepEqual(USER_LIST_STATUSES, [STATUS.PAID, STATUS.REFUND_PENDING]);
});

test('applyPaidSeat increments and may mark full', () => {
  const next = applyPaidSeat({ ...recruiting, registeredCount: 23, capacity: 24 });
  assert.equal(next.registeredCount, 24);
  assert.equal(next.status, 'full');

  const mid = applyPaidSeat({ ...recruiting, registeredCount: 1 });
  assert.equal(mid.registeredCount, 2);
  assert.equal(mid.status, 'recruiting');
});

test('applyReleaseSeat decrements and may reopen recruiting', () => {
  const next = applyReleaseSeat({
    ...recruiting,
    status: 'full',
    registeredCount: 24,
    capacity: 24,
  });
  assert.equal(next.registeredCount, 23);
  assert.equal(next.status, 'recruiting');

  const zero = applyReleaseSeat({ ...recruiting, registeredCount: 0 });
  assert.equal(zero.registeredCount, 0);
});

test('buildBalanceDraft is paid immediately; wechat pay order stays paying', () => {
  const balance = buildBalanceDraft({
    openid: 'o1',
    memberId: 'm1',
    activity: recruiting,
    name: '小豆',
    phone: '13800138000',
    now: 1000,
    outTradeNo: 'ATEST1',
  });
  assert.equal(balance.payChannel, PAY_CHANNEL.BALANCE);
  assert.equal(balance.status, STATUS.PAID);
  assert.equal(balance.amount, 49);
  assert.equal(balance.payAmountFen, 4900);
  assert.equal(balance.paidAt, 1000);
  assert.equal(balance.activityId, 'summer-partner');

  const wechat = buildWechatPayOrderDraft({
    openid: 'o1',
    memberId: 'm1',
    activity: recruiting,
    name: '小豆',
    phone: '13800138000',
    now: 1000,
    outTradeNo: 'ATEST2',
  });
  assert.equal(wechat.payChannel, PAY_CHANNEL.WECHAT);
  assert.equal(wechat.status, PAY_ORDER_STATUS.PAYING);
  assert.equal(wechat.paidAt, 0);
  assert.equal(wechat.registrationId, '');
});

test('buildPaidRegistrationFromPayOrder creates paid registration after notify', () => {
  const order = buildWechatPayOrderDraft({
    openid: 'o1',
    memberId: 'm1',
    activity: recruiting,
    name: '小豆',
    phone: '13800138000',
    now: 1000,
    outTradeNo: 'ATEST5',
  });
  const reg = buildPaidRegistrationFromPayOrder({ ...order, transactionId: 'wx1' }, 2000);
  assert.equal(reg.status, STATUS.PAID);
  assert.equal(reg.paidAt, 2000);
  assert.equal(reg.transactionId, 'wx1');
  assert.equal(reg.payChannel, PAY_CHANNEL.WECHAT);
});

test('cancel: balance -> cancelled; wechat -> refund_pending; refund success -> refunded', () => {
  const paidBalance = {
    status: STATUS.PAID,
    payChannel: PAY_CHANNEL.BALANCE,
  };
  const paidWechat = {
    status: STATUS.PAID,
    payChannel: PAY_CHANNEL.WECHAT,
  };

  assert.equal(canUserCancel(paidBalance), true);
  assert.equal(canUserCancel({ status: PAY_ORDER_STATUS.PAYING }), false);
  assert.equal(canUserCancel({ status: STATUS.CANCELLED }), false);

  const bal = applyUserCancel(paidBalance, 2000, {
    tier: CANCEL_TIER.FULL,
    feeFen: 0,
    refundFen: 4900,
  });
  assert.equal(bal.status, STATUS.CANCELLED);
  assert.equal(bal.cancelledAt, 2000);
  assert.equal(bal.seatReleased, true);
  assert.equal(bal.cancelTier, CANCEL_TIER.FULL);
  assert.equal(bal.cancelFeeFen, 0);
  assert.equal(bal.refundFeeFen, 4900);

  const wx = applyUserCancel(paidWechat, 2000, {
    tier: CANCEL_TIER.FEE,
    feeFen: 1470,
    refundFen: 3430,
  });
  assert.equal(wx.status, STATUS.REFUND_PENDING);
  assert.equal(wx.seatReleased, true);
  assert.equal(wx.cancelTier, CANCEL_TIER.FEE);
  assert.equal(wx.cancelFeeFen, 1470);
  assert.equal(wx.refundFeeFen, 3430);

  const done = applyAdminConfirmRefund(wx, 3000);
  assert.equal(done.status, STATUS.REFUNDED);
  assert.equal(done.refundedAt, 3000);
  assert.equal(done.refundFailReason, '');
});

test('resolveCancelPolicy: full / fee / started / missing startAt', () => {
  assert.equal(FREE_CANCEL_HOURS, 24);
  assert.equal(LATE_CANCEL_FEE_RATE, 0.3);

  const startAt = 1_000_000;
  const full = resolveCancelPolicy(startAt, startAt - (25 * 3600 * 1000));
  assert.equal(full.tier, CANCEL_TIER.FULL);
  assert.equal(full.canCancel, true);
  assert.equal(full.feeRate, 0);

  const fee = resolveCancelPolicy(startAt, startAt - (12 * 3600 * 1000));
  assert.equal(fee.tier, CANCEL_TIER.FEE);
  assert.equal(fee.canCancel, true);
  assert.equal(fee.feeRate, 0.3);

  const boundary = resolveCancelPolicy(startAt, startAt - (24 * 3600 * 1000));
  assert.equal(boundary.tier, CANCEL_TIER.FEE);

  const started = resolveCancelPolicy(startAt, startAt);
  assert.equal(started.tier, CANCEL_TIER.BLOCKED_STARTED);
  assert.equal(started.canCancel, false);

  const missing = resolveCancelPolicy(0, Date.now());
  assert.equal(missing.tier, CANCEL_TIER.BLOCKED_NO_START);
  assert.equal(missing.canCancel, false);
});

test('calcCancelRefund: full and 30% fee with balance split', () => {
  const reg = {
    payAmountFen: 4900,
    principalPaid: 30,
    bonusPaid: 19,
  };
  const full = calcCancelRefund(reg, { canCancel: true, feeRate: 0, tier: CANCEL_TIER.FULL });
  assert.equal(full.paidFen, 4900);
  assert.equal(full.feeFen, 0);
  assert.equal(full.refundFen, 4900);
  assert.equal(full.principalRefund, 30);
  assert.equal(full.bonusRefund, 19);

  const fee = calcCancelRefund(reg, { canCancel: true, feeRate: 0.3, tier: CANCEL_TIER.FEE });
  assert.equal(fee.feeFen, 1470);
  assert.equal(fee.refundFen, 3430);
  assert.equal(fee.principalRefund, 21);
  assert.equal(fee.bonusRefund, 13.3);
});

test('assertUserCancelAllowed and confirm copy', () => {
  const paid = { status: STATUS.PAID, payChannel: PAY_CHANNEL.WECHAT, payAmountFen: 1000 };
  const startAt = Date.now() + 48 * 3600 * 1000;
  const ok = assertUserCancelAllowed(paid, startAt, Date.now());
  assert.equal(ok.ok, true);
  assert.equal(ok.policy.tier, CANCEL_TIER.FULL);

  const blocked = assertUserCancelAllowed(paid, Date.now() - 1000, Date.now());
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'ALREADY_STARTED');

  const noStart = assertUserCancelAllowed(paid, 0, Date.now());
  assert.equal(noStart.ok, false);
  assert.equal(noStart.code, 'NO_START_AT');

  const refund = calcCancelRefund(paid, { canCancel: true, feeRate: 0.3, tier: CANCEL_TIER.FEE });
  const tip = buildCancelConfirmContent(
    { canCancel: true, tier: CANCEL_TIER.FEE },
    refund,
  );
  assert.match(tip, /手续费/);
  assert.match(tip, /¥3\.00/);
});

test('resolveWechatRefundFeeFen prefers stored refundFeeFen', () => {
  assert.equal(resolveWechatRefundFeeFen({ payAmountFen: 4900, refundFeeFen: 3430 }), 3430);
  assert.equal(resolveWechatRefundFeeFen({ payAmountFen: 4900 }), 4900);
});

test('markActivityRefundFailed keeps refund_pending and records reason', () => {
  const pending = {
    status: STATUS.REFUND_PENDING,
    cancelledAt: 2000,
  };
  const failed = markActivityRefundFailed(pending, { now: 2500, refundFailReason: 'wechat refund failed' });
  assert.equal(failed.status, STATUS.REFUND_PENDING);
  assert.equal(failed.refundFailReason, 'wechat refund failed');
  assert.equal(failed.updatedAt, 2500);
  assert.throws(() => markActivityRefundFailed({ status: STATUS.PAID }, { now: 1, refundFailReason: 'x' }));
});

test('yuanToFen buildOutTradeNo and countPaidSince', () => {
  assert.equal(yuanToFen(49), 4900);
  const a = buildOutTradeNo('m1');
  const b = buildOutTradeNo('m1');
  assert.notEqual(a, b);
  assert.match(a, /^A/);
  assert.ok(a.length <= 32);

  const dayStart = Date.parse('2026-07-16T00:00:00+08:00');
  const list = [
    { status: STATUS.PAID, paidAt: dayStart + 1000 },
    { status: STATUS.PAID, paidAt: dayStart - 1000 },
    { status: STATUS.CANCELLED, paidAt: dayStart + 2000 },
  ];
  assert.equal(countPaidSince(list, dayStart), 1);
  assert.equal(STATUS_LABEL[STATUS.PAID], '已报名');
  assert.equal(STATUS_LABEL[STATUS.REFUND_PENDING], '退款失败');
  assert.equal(STATUS_LABEL[STATUS.CANCELLED], '已取消');
});

test('applyRefundBalances restores principal then bonus from snapshot', () => {
  const {
    applyRefundBalances,
  } = require('../miniprogram/utils/activityRegistration');
  const member = {
    principalBalance: 100,
    bonusBalance: 20,
    totalBalance: 120,
    totalSpent: 50,
  };
  const next = applyRefundBalances(member, { principalPaid: 30, bonusPaid: 19 });
  assert.equal(next.principalBalance, 130);
  assert.equal(next.bonusBalance, 39);
  assert.equal(next.totalBalance, 169);
  assert.equal(next.totalSpent, 1);
});

const activityCoupons = [
  { id: 'ac1', name: '通用 10 元', amount: 10, scope: '到店体验可用', status: 'available' },
  { id: 'ac2', name: '搭子 20 元', amount: 20, scope: '暑期拼豆搭子计划', status: 'available' },
  { id: 'ac3', name: '已用券', amount: 15, scope: '到店体验可用', status: 'used' },
];

test('activity coupons match scope against activity name', () => {
  assert.equal(isCouponApplicable(activityCoupons[1], recruiting), true);
  assert.equal(
    isCouponApplicable(activityCoupons[1], { ...recruiting, name: '五一拼豆局' }),
    false,
  );
  assert.equal(isCouponApplicable(activityCoupons[0], recruiting), true);
  assert.equal(isCouponApplicable(activityCoupons[2], recruiting), false);
});

test('listApplicableCoupons and pickBestCoupon for activity', () => {
  const list = listApplicableCoupons(activityCoupons, recruiting);
  assert.deepEqual(
    list.map((c) => c.id),
    ['ac1', 'ac2'],
  );
  assert.equal(pickBestCoupon(activityCoupons, recruiting).id, 'ac2');
  assert.equal(pickBestCoupon([], recruiting), null);
});

test('calcActivityQuote applies coupon and floors at zero', () => {
  const withCoupon = calcActivityQuote(recruiting, activityCoupons[1]);
  assert.equal(withCoupon.listPrice, 49);
  assert.equal(withCoupon.couponAmount, 20);
  assert.equal(withCoupon.payAmount, 29);
  assert.equal(withCoupon.payAmountFen, 2900);
  assert.equal(withCoupon.needPayment, true);
  assert.equal(withCoupon.couponId, 'ac2');

  const full = calcActivityQuote(
    { ...recruiting, price: 10 },
    { id: 'c', amount: 20, status: 'available' },
  );
  assert.equal(full.payAmount, 0);
  assert.equal(full.needPayment, false);

  const none = calcActivityQuote(recruiting, null);
  assert.equal(none.payAmount, 49);
  assert.equal(none.couponId, '');
});

test('normalizeRegistrationCoupon maps cloud discount and drops hours', () => {
  const discount = normalizeRegistrationCoupon({
    _id: 'uc1',
    name: '8折',
    status: 'unused',
    available: true,
    benefitType: 'discount',
    benefitValue: 8,
    scope: '到店体验可用',
  });
  assert.equal(discount.id, 'uc1');
  assert.equal(discount.benefitType, 'discount');
  const quote = calcActivityQuote(recruiting, discount);
  assert.equal(quote.payAmount, 39.2);
  assert.equal(quote.couponAmount, 9.8);

  assert.equal(
    normalizeRegistrationCoupon({
      _id: 'uc2',
      status: 'unused',
      available: true,
      benefitType: 'hours',
      benefitValue: 2,
    }),
    null,
  );
});

test('registration drafts store coupon quote fields', () => {
  const quote = calcActivityQuote(recruiting, activityCoupons[1]);
  const balance = buildBalanceDraft({
    openid: 'o1',
    memberId: 'm1',
    activity: recruiting,
    name: '小豆',
    phone: '13800138000',
    now: 1000,
    outTradeNo: 'ATEST3',
    quote,
  });
  assert.equal(balance.amount, 49);
  assert.equal(balance.couponId, 'ac2');
  assert.equal(balance.couponAmount, 20);
  assert.equal(balance.payAmountFen, 2900);

  const wechat = buildWechatPayOrderDraft({
    openid: 'o1',
    memberId: 'm1',
    activity: recruiting,
    name: '小豆',
    phone: '13800138000',
    now: 1000,
    outTradeNo: 'ATEST4',
    quote,
  });
  assert.equal(wechat.couponId, 'ac2');
  assert.equal(wechat.payAmountFen, 2900);
  assert.equal(wechat.status, PAY_ORDER_STATUS.PAYING);
});
