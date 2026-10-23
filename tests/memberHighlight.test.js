const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMemberHighlight } = require('../miniprogram/utils/memberHighlight');

test('prefers active seat session over schedule/packages/coupons', () => {
  const card = buildMemberHighlight({
    activeSession: {
      tableCode: 'F1-A',
      seatLabel: 'F1-A1',
      durationLabel: '已进行 45分钟',
    },
    scheduleCount: 2,
    packageCount: 1,
    availableCount: 3,
  });
  assert.equal(card.key, 'seatSessions');
  assert.equal(card.title, '到店进行中');
  assert.equal(card.kicker, '进行中');
  assert.equal(card.tone, 'active');
  assert.equal(card.detail, 'F1-A · F1-A1');
  assert.equal(card.metric, '45分钟');
  assert.equal(card.metricUnit, '已进行');
  assert.equal(card.showMetric, true);
  assert.equal(card.cta, '查看详情');
  assert.match(card.sub, /F1-A/);
  assert.equal(card.routeKey, 'seatSessions');
});

test('falls back to schedule when no active session', () => {
  const card = buildMemberHighlight({
    activeSession: null,
    scheduleCount: 2,
    packageCount: 1,
    availableCount: 3,
  });
  assert.equal(card.key, 'schedule');
  assert.equal(card.title, '我的预约');
  assert.equal(card.kicker, '预约');
  assert.equal(card.tone, 'schedule');
  assert.equal(card.count, '2');
  assert.equal(card.metric, '2');
  assert.equal(card.metricUnit, '条');
  assert.equal(card.showMetric, true);
  assert.equal(card.detail, '开拼预约与活动报名');
  assert.equal(card.routeKey, 'schedule');
});

test('falls back to packages then coupons', () => {
  const packages = buildMemberHighlight({
    activeSession: null,
    scheduleCount: 0,
    packageCount: 2,
    availableCount: 5,
  });
  assert.equal(packages.key, 'packages');
  assert.equal(packages.kicker, '套餐');
  assert.equal(packages.tone, 'asset');
  assert.equal(packages.metric, '2');
  assert.equal(packages.metricUnit, '张');
  assert.equal(packages.count, '2');

  const coupons = buildMemberHighlight({
    activeSession: null,
    scheduleCount: 0,
    packageCount: 0,
    availableCount: 5,
  });
  assert.equal(coupons.key, 'coupons');
  assert.equal(coupons.kicker, '优惠券');
  assert.equal(coupons.tone, 'coupon');
  assert.equal(coupons.metric, '5');
  assert.equal(coupons.metricUnit, '张');
  assert.equal(coupons.count, '5');
});

test('empty state guides to book schedule', () => {
  const card = buildMemberHighlight({
    activeSession: null,
    scheduleCount: 0,
    packageCount: 0,
    availableCount: 0,
  });
  assert.equal(card.key, 'schedule');
  assert.equal(card.title, '去开一局');
  assert.equal(card.kicker, '推荐');
  assert.equal(card.tone, 'empty');
  assert.equal(card.routeKey, 'schedule');
  assert.equal(card.count, '');
  assert.equal(card.showMetric, false);
  assert.equal(card.cta, '去预约');
  assert.match(card.sub, /预约/);
  assert.match(card.detail, /预约/);
});
