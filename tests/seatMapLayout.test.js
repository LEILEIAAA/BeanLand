const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SEAT_W,
  SEAT_H,
  DEFAULT_ASPECT,
  getFloors,
  getFloor,
  allSeatIds,
  getSeatMeta,
  resolveSeatStatus,
  buildFloorView,
} = require('../miniprogram/utils/seatMapLayout');

test('getFloors returns F1 and F2', () => {
  const floors = getFloors();
  assert.deepEqual(floors.map((f) => f.key), ['F1', 'F2']);
});

test('all seats have in-range coords and real ids', () => {
  const ids = allSeatIds();
  // F1: 6 + 2 + 6 = 14; F2: 6 + 7 + 8 = 21 -> 35
  assert.equal(ids.length, 35);
  assert.equal(new Set(ids).size, ids.length, 'seat ids are unique');
  assert.ok(ids.includes('F1-A1'));
  assert.ok(ids.includes('F2-B7'));
  assert.ok(ids.includes('F2-C8'));
  for (const floor of ['F1', 'F2']) {
    const view = buildFloorView({ floorKey: floor });
    for (const table of view.tables) {
      for (const seat of table.seats) {
        assert.ok(seat.x >= 0 && seat.x + seat.w <= 100, `${seat.id} x in range`);
        assert.ok(seat.y >= 0 && seat.y + seat.h <= 100, `${seat.id} y in range`);
      }
    }
  }
});

test('F1 is drawn with blocks: no image, default aspect, uniform seat size', () => {
  const view = buildFloorView({ floorKey: 'F1' });
  assert.equal(view.image, '');
  assert.equal(view.aspect, DEFAULT_ASPECT);
  assert.ok(view.decor.length > 0);
  assert.ok(view.seats.every((s) => s.w === SEAT_W && s.h === SEAT_H));
});

test('F2 is drawn on the hand-drawn plan: 3+3 / 8 / 3+4 hotspots that never overlap', () => {
  const view = buildFloorView({ floorKey: 'F2' });
  assert.equal(view.image, '/assets/map/f2-room.jpg');
  // 容器高宽比必须跟底图 981×1416 一致，否则热区对不上图
  assert.ok(Math.abs(view.aspect - (1416 / 981) * 100) < 0.1);
  assert.equal(view.decor.length, 0);

  const byCode = Object.fromEntries(view.tables.map((t) => [t.code, t]));
  assert.equal(byCode['F2-A'].seats.length, 6);
  assert.equal(byCode['F2-B'].seats.length, 7);
  assert.equal(byCode['F2-C'].seats.length, 8);

  // 墙边座位按 index 从上到下；大桌左侧 1-4、右侧 5-8
  for (const code of ['F2-A', 'F2-B']) {
    const ys = byCode[code].seats.map((s) => s.y);
    assert.deepEqual(ys, [...ys].sort((a, b) => a - b), `${code} seats ordered top-down`);
  }
  const big = byCode['F2-C'].seats;
  assert.ok(big.slice(0, 4).every((s) => s.x + s.w <= 50), 'F2-C1..C4 on the left side');
  assert.ok(big.slice(4).every((s) => s.x >= 50), 'F2-C5..C8 on the right side');

  const seats = view.seats;
  for (let i = 0; i < seats.length; i += 1) {
    for (let j = i + 1; j < seats.length; j += 1) {
      const a = seats[i];
      const b = seats[j];
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      assert.ok(apart, `${a.id} overlaps ${b.id}`);
    }
  }
});

test('getSeatMeta resolves floor and table', () => {
  const meta = getSeatMeta('F1-B2');
  assert.equal(meta.floorKey, 'F1');
  assert.equal(meta.tableCode, 'F1-B');
  assert.equal(meta.type, 'double');
  assert.equal(meta.index, 2);
  const b7 = getSeatMeta('F2-B7');
  assert.equal(b7.floorKey, 'F2');
  assert.equal(b7.tableCode, 'F2-B');
  assert.equal(b7.index, 7);
  assert.equal(getSeatMeta('nope'), null);
  assert.equal(getFloor('F2').key, 'F2');
});

test('resolveSeatStatus priority selected > maintenance > full > available', () => {
  const base = { fullSet: new Set(['F1-A1']), maintenanceSet: new Set(['F1-A1']), selectedSet: new Set(['F1-A1']) };
  assert.equal(resolveSeatStatus('F1-A1', base), 'selected');
  assert.equal(resolveSeatStatus('F1-A1', { fullSet: new Set(['F1-A1']), maintenanceSet: new Set(['F1-A1']), selectedSet: new Set() }), 'maintenance');
  assert.equal(resolveSeatStatus('F1-A1', { fullSet: new Set(['F1-A1']), maintenanceSet: new Set(), selectedSet: new Set() }), 'full');
  assert.equal(resolveSeatStatus('F1-A1', { fullSet: new Set(), maintenanceSet: new Set(), selectedSet: new Set() }), 'available');
});

test('buildFloorView marks status and selection for current floor only', () => {
  const view = buildFloorView({
    floorKey: 'F1',
    fullSet: new Set(['F1-A1']),
    selectedSet: new Set(['F1-C3']),
  });
  const seats = view.tables.flatMap((t) => t.seats);
  const a1 = seats.find((s) => s.id === 'F1-A1');
  const c3 = seats.find((s) => s.id === 'F1-C3');
  assert.equal(a1.status, 'full');
  assert.equal(c3.status, 'selected');
  assert.equal(c3.selected, true);
  assert.equal(seats.every((s) => s.w === SEAT_W && s.h === SEAT_H), true);
  // F2 seat not present in an F1 view
  assert.equal(seats.find((s) => s.id === 'F2-A1'), undefined);
});
