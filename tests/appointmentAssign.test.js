const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAssignTimerUrl,
  parseAssignQuery,
  assertCanPickAssignSeat,
  toggleAssignSeatSelection,
  syncAssignSelectionMeta,
  buildAssignBanner,
} = require('../miniprogram/utils/appointmentAssign');

describe('buildAssignTimerUrl', () => {
  it('routes confirm flow onto timer assign mode with slots', () => {
    const url = buildAssignTimerUrl({
      appointmentId: 'appt1',
      appointmentDate: '2026-07-17',
      peopleCount: 2,
      timeSlots: ['12:00-14:00', '14:00-16:00'],
    });
    assert.match(url, /\/pages\/admin\/timer\/index\?mode=assign/);
    assert.match(url, /appointmentId=appt1/);
    assert.match(url, /peopleCount=2/);
    assert.match(url, /timeSlots=/);
    assert.ok(url.includes(encodeURIComponent('12:00-14:00')));
  });
});

describe('parseAssignQuery', () => {
  it('parses assign query and builds slot label', () => {
    const parsed = parseAssignQuery({
      mode: 'assign',
      appointmentId: 'a1',
      appointmentDate: '2026-07-17',
      peopleCount: '3',
      timeSlots: `${encodeURIComponent('12:00-14:00')},${encodeURIComponent('14:00-16:00')}`,
    });
    assert.equal(parsed.mode, 'assign');
    assert.equal(parsed.peopleCount, 3);
    assert.deepEqual(parsed.timeSlots, ['12:00-14:00', '14:00-16:00']);
    assert.ok(parsed.slotLabel);
  });
});

describe('assertCanPickAssignSeat', () => {
  it('only idle seats are pickable', () => {
    assert.equal(assertCanPickAssignSeat('idle').ok, true);
    assert.equal(assertCanPickAssignSeat('in_use').ok, false);
    assert.equal(assertCanPickAssignSeat('reserved').ok, false);
  });
});

describe('toggleAssignSeatSelection', () => {
  it('caps by peopleCount and can replace last seat', () => {
    const first = toggleAssignSeatSelection({
      selectedSeatIds: [],
      seatId: 'F1-A1',
      peopleCount: 2,
    });
    assert.deepEqual(first.selectedSeatIds, ['F1-A1']);

    const full = toggleAssignSeatSelection({
      selectedSeatIds: ['F1-A1', 'F1-A2'],
      seatId: 'F1-A3',
      peopleCount: 2,
    });
    assert.equal(full.replaced, true);
    assert.deepEqual(full.selectedSeatIds, ['F1-A1', 'F1-A3']);
  });
});

describe('syncAssignSelectionMeta / banner', () => {
  it('marks confirm ready only when seat count matches people', () => {
    const notReady = syncAssignSelectionMeta({
      selectedSeatIds: ['F1-A1'],
      peopleCount: 2,
    });
    assert.equal(notReady.canConfirm, false);

    const ready = syncAssignSelectionMeta({
      selectedSeatIds: ['F1-A1', 'F1-A2'],
      peopleCount: 2,
    });
    assert.equal(ready.canConfirm, true);
    assert.equal(ready.selectedSeatLabel, 'F1-A1、F1-A2');

    const banner = buildAssignBanner({
      appointmentDate: '2026-07-17',
      peopleCount: 2,
      slotLabel: '12:00-16:00',
    });
    assert.equal(banner.title, '确认排座');
    assert.match(banner.subtitle, /2026-07-17/);
    assert.match(banner.subtitle, /2 人/);
    assert.match(banner.subtitle, /12:00-16:00/);
  });
});
