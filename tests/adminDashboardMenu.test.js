const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAdminDashboardMenu,
  formatDashboardBadgeCount,
  applyAdminDashboardBadges,
} = require('../miniprogram/utils/adminDashboardMenu');

test('buildAdminDashboardMenu returns five weighted sections', () => {
  const sections = buildAdminDashboardMenu();
  assert.deepEqual(
    sections.map((section) => section.key),
    ['ops', 'booking', 'marketing', 'member', 'content'],
  );
  assert.deepEqual(
    sections.map((section) => section.title),
    ['现场运营', '预约活动', '营销核销', '会员资金', '内容配置'],
  );
  assert.equal(sections[0].emphasis, true);
  assert.equal(sections[1].emphasis, false);
  assert.equal(sections[2].emphasis, false);
  assert.equal(sections[3].emphasis, false);
  assert.equal(sections[4].emphasis, false);
});

test('buildAdminDashboardMenu places entries by section', () => {
  const sections = buildAdminDashboardMenu();
  const bySection = Object.fromEntries(
    sections.map((section) => [section.key, section.items.map((item) => item.key)]),
  );
  assert.deepEqual(bySection.ops, ['timer', 'timerHistory']);
  assert.deepEqual(bySection.booking, ['appointments', 'activityRegs']);
  assert.deepEqual(bySection.marketing, ['packages', 'coupons']);
  assert.deepEqual(bySection.member, ['members', 'transactions']);
  assert.deepEqual(bySection.content, ['activityConfig', 'packageConfig']);
});

test('buildAdminDashboardMenu provides labels and navigate urls', () => {
  const items = buildAdminDashboardMenu().flatMap((section) => section.items);
  const byKey = Object.fromEntries(items.map((item) => [item.key, item]));

  assert.equal(byKey.timer.label, '座位管理');
  assert.equal(byKey.timer.url, '/pages/admin/timer/index');
  assert.equal(byKey.timerHistory.label, '订单管理');
  assert.equal(byKey.timerHistory.url, '/pages/admin/timer-history/index');
  assert.equal(byKey.appointments.label, '预约管理');
  assert.equal(byKey.appointments.url, '/pages/admin/appointments/index');
  assert.equal(byKey.activityRegs.label, '活动管理');
  assert.equal(byKey.activityRegs.url, '/pages/admin/activity-registrations/index');
  assert.equal(byKey.packages.label, '套餐核销');
  assert.equal(byKey.packages.url, '/pages/admin/package-redeem/index');
  assert.equal(byKey.coupons.label, '优惠券管理');
  assert.equal(byKey.coupons.url, '/pages/admin/coupons/index');
  assert.equal(byKey.members.label, '会员管理');
  assert.equal(byKey.members.url, '/pages/admin/members/index');
  assert.equal(byKey.transactions.label, '储值流水');
  assert.equal(byKey.transactions.url, '/pages/admin/transactions/index');
  assert.equal(byKey.activityConfig.label, '活动配置');
  assert.equal(byKey.activityConfig.url, '/pages/admin/activities/index');
  assert.equal(byKey.packageConfig.label, '套餐配置');
  assert.equal(byKey.packageConfig.url, '/pages/admin/packages/index');
});

test('formatDashboardBadgeCount hides zero and caps at 99+', () => {
  assert.equal(formatDashboardBadgeCount(0), '');
  assert.equal(formatDashboardBadgeCount(-1), '');
  assert.equal(formatDashboardBadgeCount(1), '1');
  assert.equal(formatDashboardBadgeCount(99), '99');
  assert.equal(formatDashboardBadgeCount(100), '99+');
});

test('applyAdminDashboardBadges attaches pending badges to booking entries', () => {
  const sections = applyAdminDashboardBadges(buildAdminDashboardMenu(), {
    appointmentsPending: 3,
    activityRegsPending: 12,
  });
  const byKey = Object.fromEntries(
    sections.flatMap((section) => section.items).map((item) => [item.key, item]),
  );
  assert.equal(byKey.appointments.badge, '3');
  assert.equal(byKey.activityRegs.badge, '12');
  assert.equal(byKey.timer.badge, '');
  assert.equal(byKey.packages.badge, '');
});
