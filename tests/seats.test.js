const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSeatsFromTables,
  isContiguousSameTable,
  findContiguousCombos,
  getSeatUserStatus,
  getSeatAdminStatus,
  assertCanBookSeats,
  buildOccupancySets,
  buildOccupancyUnion,
  mergeOccupancyDocs,
} = require('../miniprogram/utils/seats');
const seed = require('../miniprogram/data/seed');

describe('shop floor layout seed', () => {
  it('matches F1/F2 zone codes: 6 zones / 32 seats as F*-A1..C6', () => {
    const byCode = Object.fromEntries(seed.tables.map((t) => [t.code, t]));
    const expected = [
      ['F1-A', 'F1一楼·左墙', 6],
      ['F1-B', 'F1一楼·窗边', 2],
      ['F1-C', 'F1一楼·长桌', 6],
      ['F2-A', 'F2二楼·左墙', 6],
      ['F2-B', 'F2二楼·右墙', 6],
      ['F2-C', 'F2二楼·长桌', 6],
    ];

    assert.equal(seed.tables.length, 6);
    assert.equal(seed.seats.length, 32);

    for (const [code, area, capacity] of expected) {
      assert.ok(byCode[code], `missing table ${code}`);
      assert.equal(byCode[code].area, area);
      assert.equal(byCode[code].capacity, capacity);
      assert.equal(byCode[code].bookable, true);
    }

    assert.deepEqual(
      seed.seats.filter((s) => s.tableCode === 'F1-A').map((s) => s.id),
      ['F1-A1', 'F1-A2', 'F1-A3', 'F1-A4', 'F1-A5', 'F1-A6'],
    );
    assert.deepEqual(
      seed.seats.filter((s) => s.tableCode === 'F1-B').map((s) => s.id),
      ['F1-B1', 'F1-B2'],
    );
    assert.deepEqual(
      seed.seats.filter((s) => s.tableCode === 'F2-C').map((s) => s.id),
      ['F2-C1', 'F2-C2', 'F2-C3', 'F2-C4', 'F2-C5', 'F2-C6'],
    );
  });

  it('buildSeatsFromTables supports compact zone seat ids', () => {
    const seats = buildSeatsFromTables(
      [{ code: 'F1-A', area: 'F1一楼·左墙', capacity: 3, bookable: true }],
      { seatIdSeparator: '' },
    );
    assert.deepEqual(
      seats.map((s) => s.id),
      ['F1-A1', 'F1-A2', 'F1-A3'],
    );
  });
});

describe('buildSeatsFromTables', () => {
  it('expands daily tables into ordered seats and skips activity tables', () => {
    const tables = [
      { code: 'W1', area: '窗边区', capacity: 4, bookable: true },
      { code: 'E1', area: '活动区', capacity: 12, bookable: false },
    ];
    const seats = buildSeatsFromTables(tables);
    assert.equal(seats.length, 4);
    assert.deepEqual(
      seats.map((s) => s.id),
      ['W1-1', 'W1-2', 'W1-3', 'W1-4'],
    );
    assert.equal(seats[0].tableCode, 'W1');
    assert.equal(seats[0].index, 1);
  });
});

describe('isContiguousSameTable', () => {
  it('accepts same-table contiguous seats', () => {
    const seats = buildSeatsFromTables([
      { code: 'A1', area: '日常体验区', capacity: 4, bookable: true },
    ]);
    const byId = Object.fromEntries(seats.map((s) => [s.id, s]));
    assert.equal(isContiguousSameTable(['A1-2', 'A1-3'], byId), true);
  });

  it('rejects wrap-around on four-top', () => {
    const seats = buildSeatsFromTables([
      { code: 'A1', area: '日常体验区', capacity: 4, bookable: true },
    ]);
    const byId = Object.fromEntries(seats.map((s) => [s.id, s]));
    assert.equal(isContiguousSameTable(['A1-1', 'A1-4'], byId), false);
  });

  it('rejects cross-table selection', () => {
    const more = buildSeatsFromTables([
      { code: 'A1', area: '日常体验区', capacity: 4, bookable: true },
      { code: 'A2', area: '日常体验区', capacity: 4, bookable: true },
    ]);
    const map = Object.fromEntries(more.map((s) => [s.id, s]));
    assert.equal(isContiguousSameTable(['A1-1', 'A2-1'], map), false);
  });
});

describe('findContiguousCombos', () => {
  it('returns contiguous available runs of requested size', () => {
    const tableSeats = [
      { id: 'L1-1', index: 1 },
      { id: 'L1-2', index: 2 },
      { id: 'L1-3', index: 3 },
      { id: 'L1-4', index: 4 },
    ];
    const available = new Set(['L1-1', 'L1-2', 'L1-4']);
    const combos = findContiguousCombos(tableSeats, 2, (id) => available.has(id));
    assert.deepEqual(combos, [['L1-1', 'L1-2']]);
  });
});

describe('seat status mapping', () => {
  const seat = { id: 'W1-1', tableCode: 'W1', index: 1, maintenance: false };

  it('maps user three-state', () => {
    assert.equal(
      getSeatUserStatus(seat, { bookedSeatIds: new Set(), inUseSeatIds: new Set() }),
      'available',
    );
    assert.equal(
      getSeatUserStatus(seat, { bookedSeatIds: new Set(['W1-1']), inUseSeatIds: new Set() }),
      'booked',
    );
    assert.equal(
      getSeatUserStatus(seat, { bookedSeatIds: new Set(), inUseSeatIds: new Set(['W1-1']) }),
      'unavailable',
    );
    assert.equal(
      getSeatUserStatus(
        { ...seat, maintenance: true },
        { bookedSeatIds: new Set(), inUseSeatIds: new Set() },
      ),
      'unavailable',
    );
  });

  it('maps admin four-state with remaining minutes', () => {
    assert.equal(
      getSeatAdminStatus(seat, {
        reservedSeatIds: new Set(),
        inUse: {},
        maintenanceIds: new Set(),
      }),
      'idle',
    );
    assert.equal(
      getSeatAdminStatus(seat, {
        reservedSeatIds: new Set(['W1-1']),
        inUse: {},
        maintenanceIds: new Set(),
      }),
      'reserved',
    );
    const inUse = getSeatAdminStatus(seat, {
      reservedSeatIds: new Set(),
      inUse: { 'W1-1': { remainingMinutes: 42 } },
      maintenanceIds: new Set(),
    });
    assert.deepEqual(inUse, { status: 'in_use', remainingMinutes: 42 });
    assert.equal(
      getSeatAdminStatus(seat, {
        reservedSeatIds: new Set(),
        inUse: {},
        maintenanceIds: new Set(['W1-1']),
      }),
      'maintenance',
    );
  });
});

describe('assertCanBookSeats', () => {
  const seats = buildSeatsFromTables([
    { code: 'W1', area: '窗边区', capacity: 4, bookable: true },
    { code: 'A1', area: '日常体验区', capacity: 4, bookable: true },
  ]);

  it('accepts any available seats matching peopleCount', () => {
    const contiguous = assertCanBookSeats({
      seats,
      seatIds: ['W1-1', 'W1-2'],
      peopleCount: 2,
      bookedSeatIds: new Set(),
      inUseSeatIds: new Set(),
      maintenanceIds: new Set(),
    });
    assert.equal(contiguous.ok, true);

    const freePick = assertCanBookSeats({
      seats,
      seatIds: ['W1-1', 'W1-3'],
      peopleCount: 2,
      bookedSeatIds: new Set(),
      inUseSeatIds: new Set(),
      maintenanceIds: new Set(),
    });
    assert.equal(freePick.ok, true);

    const crossTable = assertCanBookSeats({
      seats,
      seatIds: ['W1-1', 'A1-2'],
      peopleCount: 2,
      bookedSeatIds: new Set(),
      inUseSeatIds: new Set(),
      maintenanceIds: new Set(),
    });
    assert.equal(crossTable.ok, true);
  });

  it('rejects conflict and count mismatch', () => {
    assert.equal(
      assertCanBookSeats({
        seats,
        seatIds: ['W1-1', 'W1-2'],
        peopleCount: 2,
        bookedSeatIds: new Set(['W1-2']),
        inUseSeatIds: new Set(),
        maintenanceIds: new Set(),
      }).ok,
      false,
    );

    assert.equal(
      assertCanBookSeats({
        seats,
        seatIds: ['W1-1'],
        peopleCount: 2,
        bookedSeatIds: new Set(),
        inUseSeatIds: new Set(),
        maintenanceIds: new Set(),
      }).ok,
      false,
    );
  });
});

describe('buildOccupancyUnion', () => {
  it('unions booked/in_use/maintenance across selected slots', () => {
    const occupancies = [
      { date: '2026-07-15', timeSlot: '12:00-14:00', seatId: 'W1-1', type: 'reserved' },
      { date: '2026-07-15', timeSlot: '14:00-16:00', seatId: 'W1-2', type: 'in_use', remainingMinutes: 20 },
      { date: '2026-07-15', timeSlot: '14:00-16:00', seatId: 'A1-1', type: 'maintenance' },
      { date: '2026-07-15', timeSlot: '16:00-18:00', seatId: 'L1-1', type: 'reserved' },
    ];

    const occupancy = buildOccupancyUnion(occupancies, '2026-07-15', [
      '12:00-14:00',
      '14:00-16:00',
    ]);

    assert.equal(occupancy.bookedSeatIds.has('W1-1'), true);
    assert.equal(occupancy.inUseSeatIds.has('W1-2'), true);
    assert.equal(occupancy.maintenanceIds.has('A1-1'), true);
    assert.equal(occupancy.bookedSeatIds.has('L1-1'), false);
    assert.equal(occupancy.inUse['W1-2'].remainingMinutes, 20);
  });

  it('applies live floor in_use/maintenance without date or timeSlot', () => {
    const occupancies = [
      { _id: 'in_use_F1-A1', seatId: 'F1-A1', type: 'in_use', sessionId: 's1' },
      { _id: 'maint_F1-B1', seatId: 'F1-B1', type: 'maintenance' },
      { date: '2026-07-17', timeSlot: '16:00-18:00', seatId: 'F1-C1', type: 'reserved' },
    ];

    const occupancy = buildOccupancyUnion(occupancies, '2026-07-17', ['12:00-14:00']);

    assert.equal(occupancy.inUseSeatIds.has('F1-A1'), true);
    assert.equal(occupancy.maintenanceIds.has('F1-B1'), true);
    assert.equal(occupancy.bookedSeatIds.has('F1-C1'), false);

    const seat = { id: 'F1-A1', tableCode: 'F1-A', index: 1, maintenance: false };
    assert.equal(getSeatUserStatus(seat, occupancy), 'unavailable');
  });
});

describe('buildOccupancySets live floor', () => {
  it('keeps slot-scoped reserved filter while accepting undated in_use', () => {
    const sets = buildOccupancySets(
      [
        { seatId: 'F1-A1', type: 'in_use' },
        { date: '2026-07-17', timeSlot: '14:00-16:00', seatId: 'F1-A2', type: 'reserved' },
        { date: '2026-07-17', timeSlot: '12:00-14:00', seatId: 'F1-A3', type: 'reserved' },
      ],
      '2026-07-17',
      '12:00-14:00',
    );
    assert.equal(sets.inUseSeatIds.has('F1-A1'), true);
    assert.equal(sets.bookedSeatIds.has('F1-A2'), false);
    assert.equal(sets.bookedSeatIds.has('F1-A3'), true);
  });
});

describe('mergeOccupancyDocs', () => {
  it('merges slot rows with live floor rows and dedupes by _id', () => {
    const merged = mergeOccupancyDocs(
      [
        { _id: '2026-07-17_12:00-14:00_F1-A3', date: '2026-07-17', timeSlot: '12:00-14:00', seatId: 'F1-A3', type: 'reserved' },
        { _id: 'in_use_F1-A1', seatId: 'F1-A1', type: 'in_use' },
      ],
      [
        { _id: 'in_use_F1-A1', seatId: 'F1-A1', type: 'in_use', sessionId: 's1' },
        { _id: 'maint_F1-B1', seatId: 'F1-B1', type: 'maintenance' },
      ],
    );
    assert.equal(merged.length, 3);
    assert.equal(merged.filter((row) => row._id === 'in_use_F1-A1').length, 1);
    assert.ok(merged.some((row) => row.type === 'maintenance'));
  });
});
