const assert = require('node:assert/strict');
const test = require('node:test');

const {
  chinaTodayIso,
  addDaysIso,
  weekdayOf,
  monthTitle,
  buildDateStrip,
} = require('../miniprogram/utils/bookingCalendar');

test('chinaTodayIso shifts to +08:00 date', () => {
  // 2026-10-23 20:00 UTC -> 2026-10-24 04:00 中国
  const ms = Date.UTC(2026, 9, 23, 20, 0, 0);
  assert.equal(chinaTodayIso(ms), '2026-10-24');
});

test('addDaysIso crosses month boundary', () => {
  assert.equal(addDaysIso('2026-10-30', 3), '2026-11-02');
  assert.equal(addDaysIso('2026-01-01', -1), '2025-12-31');
  assert.equal(addDaysIso('bad', 1), '');
});

test('weekdayOf returns getUTCDay index', () => {
  // 2026-10-24 是周六
  assert.equal(weekdayOf('2026-10-24'), 6);
  assert.equal(weekdayOf('2026-10-25'), 0);
});

test('monthTitle formats English month + year', () => {
  assert.equal(monthTitle('2026-10-24'), 'October 2026');
  assert.equal(monthTitle(''), '');
});

test('buildDateStrip marks today and rest weekdays', () => {
  const strip = buildDateStrip('2026-10-24', 4, [0]); // 周日店休
  assert.equal(strip.length, 4);
  assert.equal(strip[0].iso, '2026-10-24');
  assert.equal(strip[0].isToday, true);
  assert.equal(strip[0].monthDay, '10/24');
  assert.equal(strip[0].weekdayLabel, '六');
  // 2026-10-25 周日 -> 店休
  assert.equal(strip[1].iso, '2026-10-25');
  assert.equal(strip[1].isRest, true);
  assert.equal(strip[2].isRest, false);
});
