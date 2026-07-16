const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeActivityRow,
  mapActivityList,
  buildSeatSnapshot,
} = require('../miniprogram/utils/activityList');

test('normalizeActivityRow coerces counts and prefers id', () => {
  const row = normalizeActivityRow({
    _id: 'mayday',
    id: 'mayday',
    name: '五月天主题拼豆',
    registeredCount: '1',
    capacity: '28',
    price: '0.01',
    status: 'recruiting',
  });
  assert.equal(row.id, 'mayday');
  assert.equal(row.registeredCount, 1);
  assert.equal(row.capacity, 28);
  assert.equal(row.price, 0.01);
  assert.equal(row.status, 'recruiting');
});

test('normalizeActivityRow falls back to _id when id missing', () => {
  const row = normalizeActivityRow({
    _id: 'squid-game',
    registeredCount: 0,
    capacity: 24,
  });
  assert.equal(row.id, 'squid-game');
  assert.equal(row.registeredCount, 0);
});

test('normalizeActivityRow returns null for empty row', () => {
  assert.equal(normalizeActivityRow(null), null);
  assert.equal(normalizeActivityRow({}), null);
});

test('mapActivityList filters invalid rows and keeps order', () => {
  const list = mapActivityList([
    { _id: 'a', id: 'a', registeredCount: 2, capacity: 10 },
    null,
    { name: 'broken' },
    { _id: 'b', registeredCount: 0, capacity: 5 },
  ]);
  assert.deepEqual(
    list.map((row) => row.id),
    ['a', 'b'],
  );
  assert.equal(list[0].registeredCount, 2);
});

test('buildSeatSnapshot exposes registration seat fields', () => {
  assert.deepEqual(
    buildSeatSnapshot({
      registeredCount: 3,
      capacity: 28,
      status: 'recruiting',
    }),
    {
      registeredCount: 3,
      capacity: 28,
      activityStatus: 'recruiting',
    },
  );
});
