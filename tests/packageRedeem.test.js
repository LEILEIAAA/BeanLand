const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STATUS,
  DEFAULT_VALIDITY_DAYS,
  DAY_MS,
  buildPackageSnapshot,
  attachFulfillmentEntitlement,
  canRedeemPackageOrder,
  applyRedeemPackageOrder,
  isPackageOrderExpired,
  beginExpirePackageRefund,
  completeExpirePackageRefund,
  canUserRefundPackageOrder,
  beginUserPackageRefund,
  completeUserPackageRefund,
  markUserPackageRefundPending,
  buildBalancePackageDraft,
  CHANNEL,
  PAY_METHOD,
} = require('../miniprogram/utils/packagePurchase');

const pkg = {
  id: 'weekend-solo',
  name: '单人无限时',
  price: 49.9,
  targetAudience: '单人到店畅拼',
  overtimeRule: '当日不限时',
  includedItems: ['拼豆材料', '图纸任选'],
};

test('DEFAULT_VALIDITY_DAYS is 30', () => {
  assert.equal(DEFAULT_VALIDITY_DAYS, 30);
});

test('buildPackageSnapshot keeps catalog fields at purchase time', () => {
  const snap = buildPackageSnapshot(pkg);
  assert.equal(snap.id, 'weekend-solo');
  assert.equal(snap.name, '单人无限时');
  assert.equal(snap.targetAudience, '单人到店畅拼');
  assert.equal(snap.overtimeRule, '当日不限时');
  assert.deepEqual(snap.includedItems, ['拼豆材料', '图纸任选']);
});

test('attachFulfillmentEntitlement sets expiresAt from fulfilledAt + validityDays', () => {
  const fulfilledAt = Date.UTC(2026, 6, 1, 4, 0, 0);
  const order = attachFulfillmentEntitlement(
    { status: STATUS.FULFILLED, packageId: pkg.id },
    { pkg, fulfilledAt, validityDays: 30 },
  );
  assert.equal(order.validityDays, 30);
  assert.equal(order.fulfilledAt, fulfilledAt);
  assert.equal(order.expiresAt, fulfilledAt + 30 * DAY_MS);
  assert.equal(order.packageSnapshot.name, '单人无限时');
});

test('buildBalancePackageDraft includes entitlement fields', () => {
  const now = 1_720_000_000_000;
  const draft = buildBalancePackageDraft({
    openid: 'o1',
    memberId: 'm1',
    pkg,
    quote: { listPrice: 49.9, couponId: '', couponAmount: 0, payAmountFen: 4990, payAmount: 49.9 },
    now,
    outTradeNo: 'P1',
    validityDays: 30,
    principalPaid: 40,
    bonusPaid: 9.9,
  });
  assert.equal(draft.status, STATUS.FULFILLED);
  assert.equal(draft.validityDays, 30);
  assert.equal(draft.expiresAt, now + 30 * DAY_MS);
  assert.equal(draft.payAmountYuan, 49.9);
  assert.equal(draft.principalPaid, 40);
  assert.equal(draft.bonusPaid, 9.9);
  assert.equal(draft.packageSnapshot.id, 'weekend-solo');
});

test('canRedeemPackageOrder only for fulfilled and not expired', () => {
  const now = 1_720_000_000_000;
  const ok = {
    status: STATUS.FULFILLED,
    expiresAt: now + DAY_MS,
  };
  assert.equal(canRedeemPackageOrder(ok, now), true);

  assert.equal(
    canRedeemPackageOrder({ status: STATUS.FULFILLED, expiresAt: now }, now),
    false,
  );
  assert.equal(
    canRedeemPackageOrder({ status: STATUS.REDEEMED, expiresAt: now + DAY_MS }, now),
    false,
  );
  assert.equal(
    canRedeemPackageOrder({ status: STATUS.FULFILLED }, now),
    true,
  );
});

test('applyRedeemPackageOrder marks redeemed', () => {
  const now = 1_720_000_000_000;
  const order = {
    status: STATUS.FULFILLED,
    expiresAt: now + DAY_MS,
  };
  const next = applyRedeemPackageOrder(order, { now, redeemedBy: 'admin-openid' });
  assert.equal(next.status, STATUS.REDEEMED);
  assert.equal(next.redeemedAt, now);
  assert.equal(next.redeemedBy, 'admin-openid');
  assert.throws(() => applyRedeemPackageOrder(next, { now, redeemedBy: 'x' }));
});

test('isPackageOrderExpired respects expiresAt; legacy without expiresAt is not expired', () => {
  const now = 1_720_000_000_000;
  assert.equal(isPackageOrderExpired({ status: STATUS.FULFILLED, expiresAt: now - 1 }, now), true);
  assert.equal(isPackageOrderExpired({ status: STATUS.FULFILLED, expiresAt: now + 1 }, now), false);
  assert.equal(isPackageOrderExpired({ status: STATUS.FULFILLED }, now), false);
  assert.equal(isPackageOrderExpired({ status: STATUS.REDEEMED, expiresAt: now - 1 }, now), false);
});

test('beginExpirePackageRefund and completeExpirePackageRefund', () => {
  const now = 1_720_000_000_000;
  const order = {
    status: STATUS.FULFILLED,
    expiresAt: now - 1,
    payMethod: PAY_METHOD.BALANCE,
    channel: CHANNEL.BALANCE,
  };
  const pending = beginExpirePackageRefund(order, now);
  assert.equal(pending.status, STATUS.EXPIRED_REFUNDING);
  assert.equal(pending.refundChannel, PAY_METHOD.BALANCE);

  const done = completeExpirePackageRefund(pending, {
    now: now + 10,
    refundTxId: 'tx1',
  });
  assert.equal(done.status, STATUS.EXPIRED_REFUNDED);
  assert.equal(done.refundTxId, 'tx1');
  assert.equal(done.refundedAt, now + 10);

  assert.throws(() => beginExpirePackageRefund(done, now + 20));
});

test('beginExpirePackageRefund for wechat sets wechat refund channel', () => {
  const now = 1_720_000_000_000;
  const order = {
    status: STATUS.FULFILLED,
    expiresAt: now - 1,
    payMethod: PAY_METHOD.WECHAT,
    channel: CHANNEL.WECHAT_JSAPI,
  };
  const pending = beginExpirePackageRefund(order, now);
  assert.equal(pending.refundChannel, PAY_METHOD.WECHAT);
});

test('canUserRefundPackageOrder only fulfilled and not expired', () => {
  const now = 1_720_000_000_000;
  assert.equal(
    canUserRefundPackageOrder({ status: STATUS.FULFILLED, expiresAt: now + DAY_MS }, now),
    true,
  );
  assert.equal(
    canUserRefundPackageOrder({ status: STATUS.FULFILLED, expiresAt: now }, now),
    false,
  );
  assert.equal(
    canUserRefundPackageOrder({ status: STATUS.REDEEMED, expiresAt: now + DAY_MS }, now),
    false,
  );
  assert.equal(
    canUserRefundPackageOrder({ status: STATUS.FULFILLED }, now),
    true,
  );
});

test('beginUserPackageRefund and completeUserPackageRefund', () => {
  const now = 1_720_000_000_000;
  const order = {
    status: STATUS.FULFILLED,
    expiresAt: now + DAY_MS,
    payMethod: PAY_METHOD.BALANCE,
    channel: CHANNEL.BALANCE,
  };
  const pending = beginUserPackageRefund(order, now);
  assert.equal(pending.status, STATUS.USER_REFUNDING);
  assert.equal(pending.refundChannel, PAY_METHOD.BALANCE);
  assert.equal(pending.refundReason, 'user_cancel');

  const done = completeUserPackageRefund(pending, { now: now + 10, refundTxId: 'utx1' });
  assert.equal(done.status, STATUS.USER_REFUNDED);
  assert.equal(done.refundTxId, 'utx1');
  assert.equal(done.refundedAt, now + 10);

  assert.throws(() => beginUserPackageRefund(done, now + 20));
  assert.throws(() => beginUserPackageRefund({
    status: STATUS.FULFILLED,
    expiresAt: now - 1,
    payMethod: PAY_METHOD.BALANCE,
  }, now));
});

test('markUserPackageRefundPending after wechat failure', () => {
  const now = 1_720_000_000_000;
  const refunding = {
    status: STATUS.USER_REFUNDING,
    refundChannel: PAY_METHOD.WECHAT,
  };
  const pending = markUserPackageRefundPending(refunding, {
    now: now + 5,
    refundFailReason: 'boom',
  });
  assert.equal(pending.status, STATUS.USER_REFUND_PENDING);
  assert.equal(pending.refundFailReason, 'boom');
});
