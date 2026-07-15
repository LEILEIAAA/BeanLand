const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STATUS,
  TAB,
  CATEGORY,
  BENEFIT_TYPE,
  isPastExpire,
  isBeforeValid,
  promoteIfExpired,
  withEffectiveAvailability,
  formatValidRange,
  formatBenefitText,
  buildCouponName,
  filterCouponsForTab,
  countAvailable,
  canRedeem,
  buildIssueCouponPayload,
} = require('../miniprogram/utils/coupons');

const now = 1_000_000;

function coupon(overrides) {
  return {
    _id: 'c1',
    name: '打卡奖励 · 赠送 2 小时',
    category: CATEGORY.CHECKIN,
    benefitType: BENEFIT_TYPE.HOURS,
    benefitValue: 2,
    status: STATUS.UNUSED,
    available: true,
    unavailableReason: '',
    validFrom: 0,
    expireAt: now + 10_000,
    ...overrides,
  };
}

test('isPastExpire is true when now > expireAt', () => {
  assert.equal(isPastExpire(coupon({ expireAt: now - 1 }), now), true);
  assert.equal(isPastExpire(coupon({ expireAt: now + 1 }), now), false);
});

test('promoteIfExpired flips unused past expire to expired', () => {
  const { coupon: next, changed } = promoteIfExpired(
    coupon({ expireAt: now - 1 }),
    now,
  );
  assert.equal(changed, true);
  assert.equal(next.status, STATUS.EXPIRED);
});

test('promoteIfExpired leaves used alone', () => {
  const { coupon: next, changed } = promoteIfExpired(
    coupon({ status: STATUS.USED, expireAt: now - 1 }),
    now,
  );
  assert.equal(changed, false);
  assert.equal(next.status, STATUS.USED);
});

test('filterCouponsForTab unused excludes expired and promotes them', () => {
  const rows = [
    coupon({ _id: 'a', available: true }),
    coupon({ _id: 'b', available: false, unavailableReason: '未到使用期' }),
    coupon({ _id: 'c', expireAt: now - 1 }),
    coupon({ _id: 'd', status: STATUS.USED }),
  ];
  const { list, expiredIds } = filterCouponsForTab(rows, TAB.UNUSED, now);
  assert.deepEqual(
    list.map((item) => item._id),
    ['a', 'b'],
  );
  assert.deepEqual(expiredIds, ['c']);
});

test('filterCouponsForTab used and expired only return matching status', () => {
  const rows = [
    coupon({ _id: 'u', status: STATUS.USED }),
    coupon({ _id: 'e', status: STATUS.EXPIRED }),
    coupon({ _id: 'n' }),
  ];
  assert.deepEqual(
    filterCouponsForTab(rows, TAB.USED, now).list.map((item) => item._id),
    ['u'],
  );
  assert.deepEqual(
    filterCouponsForTab(rows, TAB.EXPIRED, now).list.map((item) => item._id),
    ['e'],
  );
});

test('countAvailable counts unused within date window', () => {
  const rows = [
    coupon({ available: true }),
    coupon({ available: false, unavailableReason: '未到使用期', validFrom: now + 1 }),
    coupon({ status: STATUS.USED, available: true }),
    coupon({ expireAt: now - 1, available: true }),
  ];
  assert.equal(countAvailable(rows, now), 1);
});

test('canRedeem allows unused in date window', () => {
  assert.equal(canRedeem(coupon(), now), true);
  assert.equal(canRedeem(coupon({ status: STATUS.USED }), now), false);
  assert.equal(canRedeem(coupon({ expireAt: now - 1 }), now), false);
});

test('isBeforeValid is true when now < validFrom', () => {
  assert.equal(isBeforeValid(coupon({ validFrom: now + 1 }), now), true);
  assert.equal(isBeforeValid(coupon({ validFrom: now }), now), false);
  assert.equal(isBeforeValid(coupon({ validFrom: 0 }), now), false);
});

test('formatValidRange renders date range', () => {
  const from = new Date(2026, 6, 1).getTime();
  const to = new Date(2026, 6, 31).getTime();
  assert.equal(
    formatValidRange({ validFrom: from, expireAt: to }),
    '2026-07-01 至 2026-07-31',
  );
});

test('withEffectiveAvailability marks not-yet-valid as unavailable', () => {
  const next = withEffectiveAvailability(
    coupon({ validFrom: now + 1000, available: true }),
    now,
  );
  assert.equal(next.available, false);
  assert.equal(next.unavailableReason, '未到使用期');
  assert.equal(next.status, STATUS.UNUSED);
});

test('canRedeem rejects before validFrom even if available true', () => {
  assert.equal(
    canRedeem(coupon({ validFrom: now + 1000, available: true }), now),
    false,
  );
});

test('countAvailable excludes not-yet-valid coupons', () => {
  const rows = [
    coupon({ _id: 'ok', available: true }),
    coupon({ _id: 'soon', available: true, validFrom: now + 1000 }),
  ];
  assert.equal(countAvailable(rows, now), 1);
});

test('buildCouponName and formatBenefitText', () => {
  assert.equal(
    buildCouponName(CATEGORY.CHECKIN, BENEFIT_TYPE.HOURS, 2),
    '打卡奖励 · 赠送 2 小时',
  );
  assert.equal(
    buildCouponName(CATEGORY.TEACHER, BENEFIT_TYPE.DISCOUNT, 8),
    '老师专属 · 8 折',
  );
  assert.equal(
    buildCouponName(CATEGORY.BEST_WORK, BENEFIT_TYPE.HOURS, 3),
    '最佳作品 · 赠送 3 小时',
  );
  assert.equal(
    formatBenefitText({ benefitType: BENEFIT_TYPE.HOURS, benefitValue: 2 }),
    '2小时',
  );
  assert.equal(
    formatBenefitText({ benefitType: BENEFIT_TYPE.DISCOUNT, benefitValue: 8 }),
    '8折',
  );
});

test('buildIssueCouponPayload builds hours coupon with date range', () => {
  const result = buildIssueCouponPayload(
    {
      memberId: 'm1',
      openid: 'o1',
      category: CATEGORY.CHECKIN,
      benefitType: BENEFIT_TYPE.HOURS,
      benefitValue: 2,
      validFromDate: '2026-07-01',
      expireAtDate: '2026-07-31',
      issuedBy: 'admin-openid',
    },
    now,
  );
  assert.equal(result.ok, true);
  assert.equal(result.coupon.name, '打卡奖励 · 赠送 2 小时');
  assert.equal(result.coupon.category, CATEGORY.CHECKIN);
  assert.equal(result.coupon.benefitType, BENEFIT_TYPE.HOURS);
  assert.equal(result.coupon.benefitValue, 2);
  assert.equal(result.coupon.status, STATUS.UNUSED);
  assert.equal(result.coupon.available, true);
  assert.equal(result.coupon.issuedBy, 'admin-openid');
  assert.equal(result.coupon.createdAt, now);
  assert.equal(result.coupon.validFrom, new Date(2026, 6, 1).getTime());
  assert.equal(
    result.coupon.expireAt,
    new Date(2026, 6, 31, 23, 59, 59, 999).getTime(),
  );
  assert.equal(Object.prototype.hasOwnProperty.call(result.coupon, 'amount'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.coupon, 'scope'), false);
});

test('buildIssueCouponPayload builds discount coupon', () => {
  const result = buildIssueCouponPayload(
    {
      memberId: 'm1',
      openid: 'o1',
      category: CATEGORY.TEACHER,
      benefitType: BENEFIT_TYPE.DISCOUNT,
      benefitValue: 8,
      validFromDate: '2026-08-01',
      expireAtDate: '2026-08-15',
    },
    now,
  );
  assert.equal(result.ok, true);
  assert.equal(result.coupon.name, '老师专属 · 8 折');
  assert.equal(result.coupon.benefitType, BENEFIT_TYPE.DISCOUNT);
  assert.equal(result.coupon.benefitValue, 8);
});

test('buildIssueCouponPayload rejects missing member or bad structured fields', () => {
  assert.equal(
    buildIssueCouponPayload(
      {
        openid: 'o1',
        category: CATEGORY.CHECKIN,
        benefitType: BENEFIT_TYPE.HOURS,
        benefitValue: 2,
        validFromDate: '2026-07-01',
        expireAtDate: '2026-07-31',
      },
      now,
    ).ok,
    false,
  );
  assert.equal(
    buildIssueCouponPayload(
      {
        memberId: 'm1',
        openid: 'o1',
        category: 'other',
        benefitType: BENEFIT_TYPE.HOURS,
        benefitValue: 2,
        validFromDate: '2026-07-01',
        expireAtDate: '2026-07-31',
      },
      now,
    ).code,
    'INVALID_PAYLOAD',
  );
  assert.equal(
    buildIssueCouponPayload(
      {
        memberId: 'm1',
        openid: 'o1',
        category: CATEGORY.CHECKIN,
        benefitType: BENEFIT_TYPE.HOURS,
        benefitValue: 0,
        validFromDate: '2026-07-01',
        expireAtDate: '2026-07-31',
      },
      now,
    ).code,
    'INVALID_PAYLOAD',
  );
  assert.equal(
    buildIssueCouponPayload(
      {
        memberId: 'm1',
        openid: 'o1',
        category: CATEGORY.CHECKIN,
        benefitType: BENEFIT_TYPE.HOURS,
        benefitValue: 2,
        validFromDate: '2026-07-31',
        expireAtDate: '2026-07-01',
      },
      now,
    ).code,
    'INVALID_PAYLOAD',
  );
});
