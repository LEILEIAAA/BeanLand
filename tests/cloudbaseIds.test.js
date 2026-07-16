const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOccupancyId, parseOccupancyId } = require('../miniprogram/utils/cloudbaseIds');

test('buildOccupancyId joins date, timeSlot and seatId', () => {
  assert.equal(
    buildOccupancyId('2026-07-15', '13:00-15:00', 'W1-1'),
    '2026-07-15_13:00-15:00_W1-1',
  );
});

test('buildOccupancyId rejects empty parts', () => {
  assert.throws(() => buildOccupancyId('', '13:00-15:00', 'W1-1'), /date/);
  assert.throws(() => buildOccupancyId('2026-07-15', '', 'W1-1'), /timeSlot/);
  assert.throws(() => buildOccupancyId('2026-07-15', '13:00-15:00', ''), /seatId/);
});

test('parseOccupancyId round-trips buildOccupancyId', () => {
  const id = buildOccupancyId('2026-07-15', '13:00-15:00', 'A2-3');
  assert.deepEqual(parseOccupancyId(id), {
    date: '2026-07-15',
    timeSlot: '13:00-15:00',
    seatId: 'A2-3',
  });
});
