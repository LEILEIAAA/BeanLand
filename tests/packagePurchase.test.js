const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isCouponApplicable,
  isCouponAvailable,
  listApplicableCoupons,
  pickBestCoupon,
  calcPackageQuote,
  normalizePurchaseCoupon,
  yuanToFen,
  buildOutTradeNo,
  buildWechatPackageDraft,
  buildBalancePackageDraft,
  CHANNEL,
  STATUS,
  PAY_METHOD,
  isFulfillIdempotent,
  assertPayAmountMatch,
  markCouponUsed,
  holdCoupon,
  releaseCoupon,
  isChinaWeekend,
  resolveDayPrice,
  resolvePackageForSale,
} = require('../miniprogram/utils/packagePurchase');

const doublePkg = { id: 'double-theme', name: '双人主题套餐', price: 149 };
const studentPkg = { id: 'student-light', name: '学生轻体验', price: 49 };
const standardPkg = { id: 'standard', name: '标准拼豆体验', price: 89 };

const coupons = [
  { id: 'c1', name: '美团转会员 10 元券', amount: 10, scope: '到店体验可用', status: 'available' },
  { id: 'c2', name: '双人同行 20 元券', amount: 20, scope: '双人主题套餐', status: 'available' },
  { id: 'c3', name: '学生暑期 10 元券', amount: 10, scope: '学生轻体验 / 暑期复购', status: 'available' },
  { id: 'c4', name: '已用券', amount: 15, scope: '到店体验可用', status: 'used' },
];

test('isCouponApplicable matches scope and rejects used', () => {
  assert.equal(isCouponApplicable(coupons[1], doublePkg), true);
  assert.equal(isCouponApplicable(coupons[1], standardPkg), false);
  assert.equal(isCouponApplicable(coupons[2], studentPkg), true);
  assert.equal(isCouponApplicable(coupons[2], doublePkg), false);
  assert.equal(isCouponApplicable(coupons[0], standardPkg), true);
  assert.equal(isCouponApplicable(coupons[3], standardPkg), false);
});

test('listApplicableCoupons filters and pickBestCoupon prefers larger amount', () => {
  const list = listApplicableCoupons(coupons, doublePkg);
  assert.deepEqual(
    list.map((c) => c.id),
    ['c1', 'c2'],
  );
  const best = pickBestCoupon(coupons, doublePkg);
  assert.equal(best.id, 'c2');
  assert.equal(pickBestCoupon([], doublePkg), null);
  assert.equal(pickBestCoupon([coupons[3]], standardPkg), null);
});

test('calcPackageQuote applies coupon and floors at zero', () => {
  const withCoupon = calcPackageQuote(doublePkg, coupons[1]);
  assert.equal(withCoupon.listPrice, 149);
  assert.equal(withCoupon.couponAmount, 20);
  assert.equal(withCoupon.payAmount, 129);
  assert.equal(withCoupon.payAmountFen, 12900);
  assert.equal(withCoupon.needPayment, true);
  assert.equal(withCoupon.couponId, 'c2');

  const full = calcPackageQuote({ id: 'p', name: '小价', price: 10 }, { id: 'c', amount: 20, status: 'available' });
  assert.equal(full.payAmount, 0);
  assert.equal(full.payAmountFen, 0);
  assert.equal(full.needPayment, false);

  const none = calcPackageQuote(standardPkg, null);
  assert.equal(none.payAmount, 89);
  assert.equal(none.couponId, '');
  assert.equal(none.couponAmount, 0);
});

test('yuanToFen and buildOutTradeNo for package orders', () => {
  assert.equal(yuanToFen(129), 12900);
  const a = buildOutTradeNo('m1');
  const b = buildOutTradeNo('m1');
  assert.notEqual(a, b);
  assert.ok(a.length <= 32);
  assert.match(a, /^P/);
});

test('buildWechatPackageDraft and buildBalancePackageDraft', () => {
  const quote = calcPackageQuote(doublePkg, coupons[1]);
  const wechat = buildWechatPackageDraft({
    openid: 'o1',
    memberId: 'm1',
    pkg: doublePkg,
    quote,
    now: 1000,
    outTradeNo: 'PTEST1',
  });
  assert.equal(wechat.channel, CHANNEL.WECHAT_JSAPI);
  assert.equal(wechat.payMethod, PAY_METHOD.WECHAT);
  assert.equal(wechat.status, STATUS.CREATED);
  assert.equal(wechat.payAmountFen, 12900);
  assert.equal(wechat.packageId, 'double-theme');
  assert.equal(wechat.couponId, 'c2');

  const balance = buildBalancePackageDraft({
    openid: 'o1',
    memberId: 'm1',
    pkg: doublePkg,
    quote,
    now: 2000,
    outTradeNo: 'PBAL1',
  });
  assert.equal(balance.channel, CHANNEL.BALANCE);
  assert.equal(balance.payMethod, PAY_METHOD.BALANCE);
  assert.equal(balance.status, STATUS.FULFILLED);
  assert.equal(balance.fulfilledAt, 2000);
});

test('isFulfillIdempotent and assertPayAmountMatch', () => {
  assert.equal(isFulfillIdempotent({ status: STATUS.FULFILLED }), true);
  assert.equal(isFulfillIdempotent({ status: STATUS.PAID }), false);
  assert.equal(assertPayAmountMatch({ payAmountFen: 12900 }, 12900), true);
  assert.equal(assertPayAmountMatch({ payAmountFen: 12900 }, 1), false);
});

test('holdCoupon releaseCoupon markCouponUsed', () => {
  const list = [
    { id: 'c1', status: 'available' },
    { id: 'c2', status: 'available' },
  ];
  const held = holdCoupon(list, 'c1', 'order1');
  assert.equal(held.find((c) => c.id === 'c1').status, 'held');
  assert.equal(held.find((c) => c.id === 'c1').holdOrderId, 'order1');

  const released = releaseCoupon(held, 'c1', 'order1');
  assert.equal(released.find((c) => c.id === 'c1').status, 'available');

  const used = markCouponUsed(list, 'c2');
  assert.equal(used.find((c) => c.id === 'c2').status, 'used');
});

test('isCouponAvailable accepts cloud unused and rejects unavailable', () => {
  assert.equal(isCouponAvailable({ status: 'available' }), true);
  assert.equal(isCouponAvailable({ status: 'unused', available: true }), true);
  assert.equal(isCouponAvailable({ status: 'unused' }), true);
  assert.equal(isCouponAvailable({ status: 'unused', available: false }), false);
  assert.equal(isCouponAvailable({ status: 'unused', holdOrderId: 'o1' }), false);
  assert.equal(isCouponAvailable({ status: 'used' }), false);
  assert.equal(isCouponAvailable({ status: 'expired' }), false);
});

test('normalizePurchaseCoupon maps cloud discount and drops hours', () => {
  const discount = normalizePurchaseCoupon({
    _id: 'uc1',
    name: '老师专属 · 8 折',
    status: 'unused',
    available: true,
    benefitType: 'discount',
    benefitValue: 8,
    scope: '到店体验可用',
  });
  assert.equal(discount.id, 'uc1');
  assert.equal(discount.benefitType, 'discount');
  assert.equal(discount.benefitValue, 8);
  assert.equal(isCouponApplicable(discount, standardPkg), true);

  const hours = normalizePurchaseCoupon({
    _id: 'uc2',
    name: '打卡奖励 · 赠送 2 小时',
    status: 'unused',
    available: true,
    benefitType: 'hours',
    benefitValue: 2,
  });
  assert.equal(hours, null);

  const legacy = normalizePurchaseCoupon({
    id: 'c1',
    name: '美团转会员 10 元券',
    amount: 10,
    scope: '到店体验可用',
    status: 'available',
  });
  assert.equal(legacy.amount, 10);
  assert.equal(isCouponApplicable(legacy, standardPkg), true);
});

test('calcPackageQuote applies discount benefitType as percentage off', () => {
  const discount = normalizePurchaseCoupon({
    _id: 'uc1',
    status: 'unused',
    available: true,
    benefitType: 'discount',
    benefitValue: 8,
    scope: '',
  });
  const quote = calcPackageQuote(standardPkg, discount);
  assert.equal(quote.listPrice, 89);
  assert.equal(quote.couponAmount, 17.8);
  assert.equal(quote.payAmount, 71.2);
  assert.equal(quote.needPayment, true);
  assert.equal(quote.couponId, 'uc1');
});

test('listApplicableCoupons works on normalized cloud rows', () => {
  const rows = [
    {
      _id: 'uc1',
      status: 'unused',
      available: true,
      benefitType: 'discount',
      benefitValue: 8,
      scope: '双人主题套餐',
      name: '双人 8 折',
    },
    {
      _id: 'uc2',
      status: 'unused',
      available: true,
      benefitType: 'hours',
      benefitValue: 2,
      name: '小时券',
    },
    {
      _id: 'uc3',
      status: 'unused',
      available: false,
      benefitType: 'discount',
      benefitValue: 9,
      name: '未到期',
    },
  ].map(normalizePurchaseCoupon).filter(Boolean);

  const forDouble = listApplicableCoupons(rows, doublePkg);
  assert.deepEqual(forDouble.map((c) => c.id), ['uc1']);
  assert.equal(listApplicableCoupons(rows, standardPkg).length, 0);
});

test('isChinaWeekend uses China calendar day', () => {
  // 2026-07-17 Friday 12:00 UTC+8
  assert.equal(isChinaWeekend(Date.UTC(2026, 6, 17, 4, 0, 0)), false);
  // 2026-07-18 Saturday 12:00 UTC+8
  assert.equal(isChinaWeekend(Date.UTC(2026, 6, 18, 4, 0, 0)), true);
  // 2026-07-19 Sunday 12:00 UTC+8
  assert.equal(isChinaWeekend(Date.UTC(2026, 6, 19, 4, 0, 0)), true);
});

test('resolveDayPrice picks weekend or weekday', () => {
  const pkg = { weekendPrice: 69.9, weekdayPrice: 49.9, price: 69.9 };
  assert.equal(resolveDayPrice(pkg, Date.UTC(2026, 6, 18, 4, 0, 0)), 69.9);
  assert.equal(resolveDayPrice(pkg, Date.UTC(2026, 6, 17, 4, 0, 0)), 49.9);
  assert.equal(resolveDayPrice({ price: 89 }, Date.UTC(2026, 6, 18, 4, 0, 0)), 89);
});

test('resolvePackageForSale applies opening 8折 on day price', () => {
  const pkg = {
    id: 'weekend-solo',
    name: '周末单人无限体验',
    weekendPrice: 69.9,
    weekdayPrice: 49.9,
    price: 69.9,
  };
  const promo = { active: true, discountRate: 8, label: '开业七天' };
  const weekend = resolvePackageForSale(pkg, promo, Date.UTC(2026, 6, 18, 4, 0, 0));
  assert.equal(weekend.dayType, 'weekend');
  assert.equal(weekend.dayPrice, 69.9);
  assert.equal(weekend.basePrice, 69.9);
  assert.equal(weekend.price, 55.92);
  assert.equal(weekend.promoActive, true);

  const weekday = resolvePackageForSale(pkg, promo, Date.UTC(2026, 6, 17, 4, 0, 0));
  assert.equal(weekday.dayType, 'weekday');
  assert.equal(weekday.price, 39.92);

  const off = resolvePackageForSale(pkg, { active: false, discountRate: 8 }, Date.UTC(2026, 6, 18, 4, 0, 0));
  assert.equal(off.price, 69.9);
  assert.equal(off.promoActive, false);
});

test('opening-trio does not stack opening 8折', () => {
  const trio = {
    id: 'opening-trio',
    name: '开业限时 · 三人同行一人免单',
    weekendPrice: 139.8,
    weekdayPrice: 99.8,
    price: 139.8,
    skipOpeningDiscount: true,
  };
  const promo = { active: true, discountRate: 8, label: '开业七天' };
  const weekend = resolvePackageForSale(trio, promo, Date.UTC(2026, 6, 18, 4, 0, 0));
  assert.equal(weekend.dayPrice, 139.8);
  assert.equal(weekend.price, 139.8);
  assert.equal(weekend.promoActive, false);

  const weekday = resolvePackageForSale(trio, promo, Date.UTC(2026, 6, 17, 4, 0, 0));
  assert.equal(weekday.price, 99.8);
  assert.equal(weekday.promoActive, false);
});

test('1-2h solo/duo packages get opening 8折 when not skipped', () => {
  const promo = { active: true, discountRate: 8, label: '开业七天', tip: '全场8折' };
  const ids = ['solo-1h', 'solo-2h', 'duo-1h', 'duo-2h'];
  ids.forEach((id) => {
    const pkg = {
      id,
      weekendPrice: 50,
      weekdayPrice: 40,
      price: 50,
    };
    const weekend = resolvePackageForSale(pkg, promo, Date.UTC(2026, 6, 18, 4, 0, 0));
    assert.equal(weekend.promoActive, true, `${id} weekend promo`);
    assert.equal(weekend.price, 40, `${id} weekend 8折`);
    const weekday = resolvePackageForSale(pkg, promo, Date.UTC(2026, 6, 17, 4, 0, 0));
    assert.equal(weekday.promoActive, true, `${id} weekday promo`);
    assert.equal(weekday.price, 32, `${id} weekday 8折`);
  });
});

test('seed hourly packages participate in opening 8折 and tip is 全场8折', () => {
  const seed = require('../miniprogram/data/seed');
  const hourlyIds = ['solo-1h', 'solo-2h', 'duo-1h', 'duo-2h'];
  hourlyIds.forEach((id) => {
    const pkg = seed.packages.find((item) => item.id === id);
    assert.ok(pkg, `missing ${id}`);
    assert.equal(!!pkg.skipOpeningDiscount, false, `${id} should not skip`);
  });
  assert.equal(seed.store.packagePromo.tip, '全场8折');
});

test('isOpeningCouponBlocked when opening promo active', () => {
  const { isOpeningCouponBlocked } = require('../miniprogram/utils/packagePurchase');
  assert.equal(isOpeningCouponBlocked({ active: true, discountRate: 8 }), true);
  assert.equal(isOpeningCouponBlocked({ active: false, discountRate: 8 }), false);
  assert.equal(isOpeningCouponBlocked(null), false);
});
