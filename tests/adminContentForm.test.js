const test = require('node:test');
const assert = require('node:assert/strict');
const {
  chinaDateTimeToMs,
  msToChinaDateTime,
} = require('../miniprogram/utils/adminContentForm');

test('miniprogram chinaDateTimeToMs matches cloud helper', () => {
  assert.equal(chinaDateTimeToMs('2026-07-18', '14:00'), Date.UTC(2026, 6, 18, 6, 0, 0));
});

test('miniprogram date/time round-trips', () => {
  const ms = chinaDateTimeToMs('2026-07-24', '19:30');
  assert.deepEqual(msToChinaDateTime(ms), { date: '2026-07-24', time: '19:30' });
});

test('msToChinaDateTime blank for non-positive', () => {
  assert.deepEqual(msToChinaDateTime(0), { date: '', time: '' });
});
