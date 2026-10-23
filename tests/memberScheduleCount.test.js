const test = require('node:test');
const assert = require('node:assert/strict');
const {
  countActiveAppointments,
  countActiveActivities,
  countActiveSchedule,
  buildScheduleHeaderCounts,
} = require('../miniprogram/utils/memberScheduleCount');

test('countActiveAppointments keeps pending, confirmed and arrived', () => {
  const list = [
    { status: 'pending' },
    { status: 'confirmed' },
    { status: 'arrived' },
    { status: 'cancelled' },
    { status: 'rejected' },
    { status: 'completed' },
    { status: 'no_show' },
  ];
  assert.equal(countActiveAppointments(list), 3);
});

test('countActiveActivities keeps paid only', () => {
  const list = [
    { status: 'paid' },
    { status: 'paid' },
    { status: 'cancelled' },
    { status: 'refunded' },
    { status: 'refund_pending' },
    { status: 'expired' },
  ];
  assert.equal(countActiveActivities(list), 2);
});

test('countActiveSchedule sums active appointments and activities', () => {
  assert.equal(
    countActiveSchedule({
      appointments: [
        { status: 'pending' },
        { status: 'arrived' },
        { status: 'completed' },
      ],
      activities: [{ status: 'paid' }, { status: 'cancelled' }],
    }),
    3,
  );
  assert.equal(countActiveSchedule({}), 0);
  assert.equal(countActiveSchedule(null), 0);
});

test('buildScheduleHeaderCounts matches external active rules per tab', () => {
  const counts = buildScheduleHeaderCounts({
    appointments: [
      { status: 'pending' },
      { status: 'confirmed' },
      { status: 'completed' },
      { status: 'cancelled' },
    ],
    activities: [
      { status: 'paid' },
      { status: 'cancelled' },
      { status: 'refunded' },
    ],
  });
  assert.equal(counts.appointmentActiveCount, 2);
  assert.equal(counts.activityActiveCount, 1);
  assert.deepEqual(buildScheduleHeaderCounts(null), {
    appointmentActiveCount: 0,
    activityActiveCount: 0,
  });
});
