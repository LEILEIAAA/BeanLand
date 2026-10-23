const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ADMIN_ACTIVITY_REG_FILTER_TABS,
  DEFAULT_ADMIN_ACTIVITY_REG_FILTER,
  filterAdminActivityRegistrations,
} = require('../miniprogram/utils/adminActivityRegistrationFilter');
const {
  STATUS,
  ADMIN_CANCELLED_STATUSES,
  resolveAdminListStatusFilter,
  isActivityRegistrationEffective,
} = require('../miniprogram/utils/activityRegistration');

test('admin activity reg filter tabs: all / paid / effective / cancelled', () => {
  assert.deepEqual(
    ADMIN_ACTIVITY_REG_FILTER_TABS.map((item) => item.key),
    ['', 'paid', 'effective', 'cancelled'],
  );
  assert.deepEqual(
    ADMIN_ACTIVITY_REG_FILTER_TABS.map((item) => item.label),
    ['全部', '已报名', '已生效', '已取消'],
  );
  assert.equal(DEFAULT_ADMIN_ACTIVITY_REG_FILTER, '');
  assert.ok(!ADMIN_ACTIVITY_REG_FILTER_TABS.some((item) => item.key === 'refund_pending'));
});

test('ADMIN_CANCELLED_STATUSES covers cancel + refunded + refund fail', () => {
  assert.deepEqual(ADMIN_CANCELLED_STATUSES, [
    STATUS.CANCELLED,
    STATUS.REFUNDED,
    STATUS.REFUND_PENDING,
  ]);
});

test('resolveAdminListStatusFilter: empty / paid / effective / cancelled group', () => {
  assert.equal(resolveAdminListStatusFilter(''), null);
  assert.equal(resolveAdminListStatusFilter(undefined), null);
  assert.deepEqual(resolveAdminListStatusFilter('paid'), {
    op: 'eq',
    value: STATUS.PAID,
  });
  assert.deepEqual(resolveAdminListStatusFilter('effective'), {
    op: 'eq',
    value: STATUS.PAID,
    refine: 'effective',
  });
  assert.deepEqual(resolveAdminListStatusFilter('cancelled'), {
    op: 'in',
    values: ADMIN_CANCELLED_STATUSES,
  });
  assert.deepEqual(resolveAdminListStatusFilter('refund_pending'), {
    op: 'eq',
    value: STATUS.REFUND_PENDING,
  });
});

test('isActivityRegistrationEffective: paid and startAt reached', () => {
  const now = 1_000_000;
  assert.equal(isActivityRegistrationEffective({ status: STATUS.PAID }, 900_000, now), true);
  assert.equal(isActivityRegistrationEffective({ status: STATUS.PAID }, now, now), true);
  assert.equal(isActivityRegistrationEffective({ status: STATUS.PAID }, 1_100_000, now), false);
  assert.equal(isActivityRegistrationEffective({ status: STATUS.PAID }, 0, now), false);
  assert.equal(isActivityRegistrationEffective({ status: STATUS.CANCELLED }, 900_000, now), false);
});

test('filterAdminActivityRegistrations groups cancelled statuses', () => {
  const list = [
    { _id: '1', status: STATUS.PAID },
    { _id: '2', status: STATUS.CANCELLED },
    { _id: '3', status: STATUS.REFUNDED },
    { _id: '4', status: STATUS.REFUND_PENDING },
  ];
  assert.deepEqual(
    filterAdminActivityRegistrations(list, '').map((row) => row._id),
    ['1', '2', '3', '4'],
  );
  assert.deepEqual(
    filterAdminActivityRegistrations(list, 'paid').map((row) => row._id),
    ['1'],
  );
  assert.deepEqual(
    filterAdminActivityRegistrations(list, 'cancelled').map((row) => row._id),
    ['2', '3', '4'],
  );
});

test('filterAdminActivityRegistrations effective keeps started paid only', () => {
  const now = 2_000_000;
  const list = [
    { _id: 'soon', status: STATUS.PAID, activityStartAt: 2_500_000 },
    { _id: 'live', status: STATUS.PAID, activityStartAt: 1_500_000 },
    { _id: 'nostart', status: STATUS.PAID, activityStartAt: 0 },
    { _id: 'cancel', status: STATUS.CANCELLED, activityStartAt: 1_500_000 },
  ];
  assert.deepEqual(
    filterAdminActivityRegistrations(list, 'effective', now).map((row) => row._id),
    ['live'],
  );
});
