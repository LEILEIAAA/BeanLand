const test = require('node:test');
const assert = require('node:assert/strict');
const { buildActions } = require('../miniprogram/utils/memberActions');

test('buildActions places admin entry after activityRegs for admins', () => {
  const actions = buildActions(
    { appointments: [{ id: 1 }] },
    { isAdmin: true, availableCount: 2, packageCount: 1 },
  );
  const keys = actions.map((item) => item.key);
  assert.deepEqual(keys, [
    'packages',
    'coupons',
    'records',
    'seatSessions',
    'appointments',
    'activityRegs',
    'admin',
  ]);
  assert.equal(actions[0].badge, '1 张');
  assert.equal(actions[1].badge, '2 张');
  assert.equal(actions[3].label, '到店记录');
  assert.equal(actions[4].badge, '1 条');
  assert.equal(actions[5].label, '我的活动报名');
  assert.equal(actions[6].label, '店主后台');
});

test('buildActions hides admin entry for non-admins', () => {
  const actions = buildActions({}, { isAdmin: false });
  assert.ok(!actions.some((item) => item.key === 'admin'));
  assert.deepEqual(
    actions.map((item) => item.key),
    ['packages', 'coupons', 'records', 'seatSessions', 'appointments', 'activityRegs'],
  );
});

test('buildActions coupon badge uses availableCount not member.coupons length', () => {
  const actions = buildActions(
    { coupons: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    { availableCount: 0 },
  );
  const coupons = actions.find((item) => item.key === 'coupons');
  assert.equal(coupons.badge, '');

  const withCount = buildActions({ coupons: [] }, { availableCount: 1 });
  assert.equal(withCount.find((item) => item.key === 'coupons').badge, '1 张');
});
