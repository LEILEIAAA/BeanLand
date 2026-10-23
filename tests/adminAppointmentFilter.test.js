const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ADMIN_APPOINTMENT_FILTER_TABS,
  DEFAULT_ADMIN_APPOINTMENT_FILTER,
  filterAdminAppointments,
} = require('../miniprogram/utils/adminAppointmentFilter');

test('admin appointment filter tabs are all/pending/confirmed/ended', () => {
  assert.deepEqual(
    ADMIN_APPOINTMENT_FILTER_TABS.map((item) => item.key),
    ['all', 'pending', 'confirmed', 'ended'],
  );
  assert.equal(DEFAULT_ADMIN_APPOINTMENT_FILTER, 'pending');
});

test('filterAdminAppointments keeps pending and confirmed by exact status', () => {
  const list = [
    { id: '1', status: 'pending' },
    { id: '2', status: 'confirmed' },
    { id: '3', status: 'arrived' },
  ];
  assert.deepEqual(
    filterAdminAppointments(list, 'pending').map((item) => item.id),
    ['1'],
  );
  assert.deepEqual(
    filterAdminAppointments(list, 'confirmed').map((item) => item.id),
    ['2'],
  );
});

test('filterAdminAppointments ended covers closed statuses', () => {
  const list = [
    { id: 'p', status: 'pending' },
    { id: 'c', status: 'confirmed' },
    { id: 'r', status: 'rejected' },
    { id: 'x', status: 'cancelled' },
    { id: 'a', status: 'arrived' },
    { id: 'n', status: 'no_show' },
    { id: 'd', status: 'completed' },
  ];
  assert.deepEqual(
    filterAdminAppointments(list, 'ended').map((item) => item.id),
    ['r', 'x', 'a', 'n', 'd'],
  );
});

test('filterAdminAppointments all returns original order', () => {
  const list = [
    { id: '1', status: 'arrived' },
    { id: '2', status: 'pending' },
  ];
  assert.deepEqual(
    filterAdminAppointments(list, 'all').map((item) => item.id),
    ['1', '2'],
  );
});
