const test = require('node:test');
const assert = require('node:assert/strict');
const { buildActions } = require('../miniprogram/utils/memberActions');

test('buildActions orders assets then schedule then history, admin last', () => {
  const actions = buildActions(
    { appointments: [{ id: 1 }] },
    { isAdmin: true, availableCount: 2, packageCount: 1, scheduleCount: 1 },
  );
  const keys = actions.map((item) => item.key);
  assert.deepEqual(keys, [
    'packages',
    'coupons',
    'schedule',
    'seatSessions',
    'records',
    'settings',
    'admin',
  ]);
  assert.equal(actions[0].badge, '1 张');
  assert.equal(actions[1].badge, '2 张');
  assert.equal(actions[2].label, '我的预约');
  assert.equal(actions[2].badge, '1 条');
  assert.equal(actions[3].label, '到店记录');
  assert.equal(actions[4].label, '消费明细');
  assert.equal(actions[5].label, '设置');
  assert.equal(actions[5].desc, '资料、协议与客服');
  assert.equal(actions[6].label, '店主后台');
  assert.ok(!actions.some((item) => item.key === 'appointments'));
  assert.ok(!actions.some((item) => item.key === 'activityRegs'));
});

test('buildActions schedule badge uses scheduleCount not appointments length', () => {
  const empty = buildActions(
    { appointments: [{ id: 1 }, { id: 2 }] },
    { scheduleCount: 0 },
  );
  assert.equal(empty.find((item) => item.key === 'schedule').badge, '');

  const withCount = buildActions(
    { appointments: [] },
    { scheduleCount: 3 },
  );
  assert.equal(withCount.find((item) => item.key === 'schedule').badge, '3 条');
});

test('buildActions hides admin entry for non-admins', () => {
  const actions = buildActions({}, { isAdmin: false });
  assert.ok(!actions.some((item) => item.key === 'admin'));
  assert.deepEqual(
    actions.map((item) => item.key),
    ['packages', 'coupons', 'schedule', 'seatSessions', 'records', 'settings'],
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

test('buildActions schedule badge empty when no appointments', () => {
  const actions = buildActions({ appointments: [] }, {});
  const schedule = actions.find((item) => item.key === 'schedule');
  assert.equal(schedule.badge, '');
});

test('buildActions seatSessions badge shows active elapsed with clock icon', () => {
  const actions = buildActions(
    {},
    { activeElapsedLabel: '已进行 45分钟' },
  );
  const seat = actions.find((item) => item.key === 'seatSessions');
  assert.equal(seat.desc, '开台座位、用时与消费记录');
  assert.equal(seat.badge, '已进行 45分钟');
  assert.equal(seat.badgeIcon, 'clock');
});

test('buildActions seatSessions badge empty without active elapsed', () => {
  const seat = buildActions({}, {}).find((item) => item.key === 'seatSessions');
  assert.equal(seat.desc, '开台座位、用时与消费记录');
  assert.equal(seat.badge, '');
  assert.equal(seat.badgeIcon, '');
});

test('buildActions assigns distinct icons per entry', () => {
  const actions = buildActions({}, { isAdmin: true });
  const byKey = Object.fromEntries(actions.map((item) => [item.key, item.icon]));
  assert.equal(byKey.packages, '/assets/icons/package.png');
  assert.equal(byKey.coupons, '/assets/icons/ticket.png');
  assert.equal(byKey.schedule, '/assets/icons/calendar.png');
  assert.equal(byKey.seatSessions, '/assets/icons/stamp.png');
  assert.equal(byKey.records, '/assets/icons/receipt.png');
  assert.equal(byKey.settings, '/assets/icons/settings.png');
  assert.equal(byKey.admin, '/assets/icons/users.png');
  const icons = actions.map((item) => item.icon);
  assert.equal(new Set(icons).size, icons.length);
});

test('buildActions soft-aligns highlighted entry badge and keeps seatSessions intro desc', () => {
  const actions = buildActions(
    { appointments: [] },
    {
      availableCount: 0,
      packageCount: 0,
      highlight: {
        key: 'seatSessions',
        actionDesc: 'F1-A · F1-A1 · 进行中',
        actionBadge: '已进行 45分钟',
        actionBadgeIcon: 'clock',
      },
    },
  );
  const keys = actions.map((item) => item.key);
  assert.deepEqual(keys, [
    'packages',
    'coupons',
    'schedule',
    'seatSessions',
    'records',
    'settings',
  ]);
  const seat = actions.find((item) => item.key === 'seatSessions');
  assert.equal(seat.desc, '开台座位、用时与消费记录');
  assert.equal(seat.badge, '已进行 45分钟');
  assert.equal(seat.badgeIcon, 'clock');
});

test('buildActions soft-aligns schedule badge from highlight count', () => {
  const actions = buildActions(
    { appointments: [{ id: 1 }] },
    {
      highlight: {
        key: 'schedule',
        actionDesc: '开拼预约与活动报名',
        actionBadge: '3 条',
        actionBadgeIcon: '',
      },
    },
  );
  const schedule = actions.find((item) => item.key === 'schedule');
  assert.equal(schedule.badge, '3 条');
  assert.equal(schedule.desc, '开拼预约与活动报名');
});
