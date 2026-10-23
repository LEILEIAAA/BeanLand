const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSeatRow,
  resolveSeatsForBoard,
} = require('../miniprogram/utils/seatBoard');

describe('normalizeSeatRow', () => {
  it('unwraps cloud bson number wrappers for index/capacity', () => {
    const row = normalizeSeatRow({
      _id: 'F1-A1',
      id: 'F1-A1',
      tableCode: 'F1-A',
      area: 'F1一楼·左墙',
      index: { $numberInt: '1' },
      capacity: { $numberInt: '6' },
      maintenance: false,
    });
    assert.equal(row.id, 'F1-A1');
    assert.equal(row.index, 1);
    assert.equal(row.capacity, 6);
  });
});

describe('resolveSeatsForBoard', () => {
  it('prefers non-empty board.seats over client fallback', () => {
    const boardSeats = [
      { id: 'F2-C1', tableCode: 'F2-C', area: 'F2', index: 1, capacity: 6 },
    ];
    const clientSeats = [
      { id: 'F1-A1', tableCode: 'F1-A', area: 'F1', index: 1, capacity: 6 },
    ];
    const resolved = resolveSeatsForBoard(
      { ok: true, seats: boardSeats },
      clientSeats,
    );
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].id, 'F2-C1');
  });

  it('falls back to client seats when board has no seats', () => {
    const clientSeats = [
      { id: 'F1-A1', tableCode: 'F1-A', area: 'F1', index: 1, capacity: 6 },
    ];
    const resolved = resolveSeatsForBoard({ ok: true }, clientSeats);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].id, 'F1-A1');
  });

  it('returns empty array when both sources empty', () => {
    assert.deepEqual(resolveSeatsForBoard({ ok: false }, []), []);
  });
});
