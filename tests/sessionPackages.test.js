const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SESSION_TYPES,
  buildHourSlots,
  allDaySlots,
  toggleHour,
  slotsFromIndexes,
  spanLabel,
  durationHours,
  resolveSession,
  hourTimelineStates,
  isHourSelectable,
  isAllDayAvailable,
  buildRedemptionCode,
  buildOrderNo,
  isValidSessionType,
} = require('../miniprogram/utils/sessionPackages');

test('buildHourSlots makes 1-hour slots across business hours', () => {
  const slots = buildHourSlots('10:00', '22:00');
  assert.equal(slots.length, 12);
  assert.equal(slots[0], '10:00-11:00');
  assert.equal(slots[11], '21:00-22:00');
});

test('allDaySlots equals full business-hour slots', () => {
  assert.deepEqual(allDaySlots('10:00', '13:00'), ['10:00-11:00', '11:00-12:00', '12:00-13:00']);
});

test('allDaySlots on the current day keeps every hour that has not ended yet', () => {
  // 11:10 -> 10-11 已结束，11-12 进行中仍可锁，12-13 未开始
  assert.deepEqual(allDaySlots('10:00', '13:00', 11 * 60 + 10), ['11:00-12:00', '12:00-13:00']);
  assert.deepEqual(allDaySlots('10:00', '13:00', 13 * 60), []);
});

test('toggleHour grows contiguously and slotsFromIndexes maps back', () => {
  const slots = buildHourSlots('10:00', '22:00');
  let sel = [];
  let r = toggleHour(slots, sel, 4); // 14:00-15:00
  assert.equal(r.ok, true);
  sel = r.next;
  r = toggleHour(slots, sel, 5);
  assert.equal(r.ok, true);
  sel = r.next;
  assert.deepEqual(slotsFromIndexes(slots, sel), ['14:00-15:00', '15:00-16:00']);
  assert.equal(spanLabel(slotsFromIndexes(slots, sel)), '14:00-16:00');
});

test('toggleHour rejects a non-adjacent gap', () => {
  const slots = buildHourSlots('10:00', '22:00');
  const r = toggleHour(slots, [0], 3);
  assert.equal(r.ok, false);
});

test('resolveSession all_day returns whole business span', () => {
  const r = resolveSession(SESSION_TYPES.ALL_DAY, { open: '10:00', close: '22:00' });
  assert.equal(r.ok, true);
  assert.equal(r.label, '全天畅玩');
  assert.equal(r.span, '10:00-22:00');
  assert.equal(r.slots.length, 12);
});

test('resolveSession all_day today locks from now until closing', () => {
  const r = resolveSession(SESSION_TYPES.ALL_DAY, { open: '10:00', close: '22:00', nowMin: 15 * 60 + 20 });
  assert.equal(r.ok, true);
  assert.equal(r.span, '15:00-22:00');
  assert.equal(r.slots.length, 7);
  assert.equal(r.slots[0], '15:00-16:00');
  assert.equal(resolveSession(SESSION_TYPES.ALL_DAY, { open: '10:00', close: '22:00', nowMin: 22 * 60 }).ok, false);
});

test('resolveSession custom needs slots', () => {
  assert.equal(resolveSession(SESSION_TYPES.CUSTOM, { customSlots: [] }).ok, false);
  const r = resolveSession(SESSION_TYPES.CUSTOM, { customSlots: ['14:00-15:00', '15:00-16:00'] });
  assert.equal(r.ok, true);
  assert.equal(r.span, '14:00-16:00');
});

test('durationHours counts slots', () => {
  assert.equal(durationHours(['14:00-15:00', '15:00-16:00']), 2);
  assert.equal(durationHours([]), 0);
});

test('hourTimelineStates marks booked and ended', () => {
  const slots = buildHourSlots('10:00', '13:00'); // 10-11,11-12,12-13
  const states = hourTimelineStates(slots, {
    bookedSlotSet: new Set(['11:00-12:00']),
    nowMin: 11 * 60 + 30, // 11:30 -> 10-11 ended
  });
  assert.equal(states[0].state, 'ended');
  assert.equal(states[1].state, 'booked');
  assert.equal(states[2].state, 'free');
});

test('isHourSelectable rejects booked and ended', () => {
  const booked = new Set(['11:00-12:00']);
  assert.equal(isHourSelectable('11:00-12:00', { bookedSlotSet: booked }), false);
  assert.equal(isHourSelectable('10:00-11:00', { bookedSlotSet: booked, nowMin: 11 * 60 }), false);
  assert.equal(isHourSelectable('12:00-13:00', { bookedSlotSet: booked, nowMin: 11 * 60 }), true);
});

test('isAllDayAvailable false when any hour booked', () => {
  const slots = buildHourSlots('10:00', '13:00');
  assert.equal(isAllDayAvailable(slots, new Set()), true);
  assert.equal(isAllDayAvailable(slots, new Set(['12:00-13:00'])), false);
});

test('isAllDayAvailable ignores hours that already ended today', () => {
  const slots = buildHourSlots('10:00', '13:00');
  // 10-11 被占但已结束 → 不影响全天
  assert.equal(isAllDayAvailable(slots, new Set(['10:00-11:00']), 11 * 60 + 5), true);
  // 剩余整点里有被占的 → 不可
  assert.equal(isAllDayAvailable(slots, new Set(['12:00-13:00']), 11 * 60 + 5), false);
  // 已打烊 → 不可
  assert.equal(isAllDayAvailable(slots, new Set(), 13 * 60), false);
});

test('buildRedemptionCode and buildOrderNo format', () => {
  assert.equal(buildRedemptionCode('BEAN', 5435), 'BEAN-5435');
  assert.equal(buildRedemptionCode('BEAN', 12345), 'BEAN-2345');
  assert.equal(buildOrderNo('2026-10-24', 1), 'BK202610240001');
});

test('isValidSessionType', () => {
  assert.equal(isValidSessionType('all_day'), true);
  assert.equal(isValidSessionType('custom'), true);
  assert.equal(isValidSessionType('x'), false);
});
