const assert = require('node:assert/strict');
const test = require('node:test');

const {
  areWallClockAdjacent,
  formatSlotSpan,
  calculateExpectedEndFromSlots,
  toggleContiguousSelection,
} = require('../miniprogram/utils/timeSlots');

const SLOTS = [
  '10:00-12:00',
  '12:00-14:00',
  '14:00-16:00',
  '16:00-18:00',
  '18:00-20:00',
  '20:00-22:00',
];

test('areWallClockAdjacent requires previous end equals next start', () => {
  assert.equal(areWallClockAdjacent('12:00-14:00', '14:00-16:00'), true);
  assert.equal(areWallClockAdjacent('12:00-14:00', '16:00-18:00'), false);
  assert.equal(areWallClockAdjacent('13:00-15:00', '15:30-17:30'), false);
});

test('formatSlotSpan joins first start and last end', () => {
  assert.equal(formatSlotSpan(['14:00-16:00']), '14:00-16:00');
  assert.equal(formatSlotSpan(['14:00-16:00', '16:00-18:00']), '14:00-18:00');
});

test('calculateExpectedEndFromSlots uses last slot end', () => {
  const result = calculateExpectedEndFromSlots('2026-07-15', [
    '14:00-16:00',
    '16:00-18:00',
  ]);
  assert.equal(result.display, '2026-07-15 18:00');
  assert.equal(result.iso, '2026-07-15T18:00:00.000+08:00');
});

test('toggleContiguousSelection grows and shrinks only at ends', () => {
  let selected = [];

  let result = toggleContiguousSelection(SLOTS, selected, 2);
  assert.equal(result.ok, true);
  assert.deepEqual(result.next, [2]);
  selected = result.next;

  result = toggleContiguousSelection(SLOTS, selected, 4);
  assert.equal(result.ok, false);
  assert.match(result.reason, /连续/);

  result = toggleContiguousSelection(SLOTS, selected, 3);
  assert.equal(result.ok, true);
  assert.deepEqual(result.next, [2, 3]);
  selected = result.next;

  result = toggleContiguousSelection(SLOTS, selected, 1);
  assert.equal(result.ok, true);
  assert.deepEqual(result.next, [1, 2, 3]);
  selected = result.next;

  result = toggleContiguousSelection(SLOTS, selected, 2);
  assert.equal(result.ok, false);

  result = toggleContiguousSelection(SLOTS, selected, 1);
  assert.equal(result.ok, true);
  assert.deepEqual(result.next, [2, 3]);
  selected = result.next;

  result = toggleContiguousSelection(SLOTS, selected, 3);
  assert.equal(result.ok, true);
  assert.deepEqual(result.next, [2]);
  selected = result.next;

  result = toggleContiguousSelection(SLOTS, selected, 2);
  assert.equal(result.ok, false);
  assert.deepEqual(result.next, [2]);
});
