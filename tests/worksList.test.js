const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clampLimit,
  takeNewestWorks,
  isCollectionMissingError,
} = require('../cloudfunctions/listMyWorks/worksList');

test('clampLimit defaults and clamps', () => {
  assert.equal(clampLimit(undefined), 50);
  assert.equal(clampLimit(3), 3);
  assert.equal(clampLimit(0), 1);
  assert.equal(clampLimit(999), 100);
});

test('takeNewestWorks sorts by createdAt desc and slices', () => {
  const list = [
    { _id: 'a', createdAt: 10 },
    { _id: 'b', createdAt: 30 },
    { _id: 'c', createdAt: 20 },
  ];
  assert.deepEqual(
    takeNewestWorks(list, 2).map((row) => row._id),
    ['b', 'c'],
  );
});

test('takeNewestWorks handles empty and non-array', () => {
  assert.deepEqual(takeNewestWorks(null, 3), []);
  assert.deepEqual(takeNewestWorks([], 3), []);
});

test('isCollectionMissingError detects cloud codes', () => {
  assert.equal(isCollectionMissingError({ errCode: -502005 }), true);
  assert.equal(
    isCollectionMissingError({ errMsg: 'Db or Table not exist: DATABASE_COLLECTION_NOT_EXIST' }),
    true,
  );
  assert.equal(isCollectionMissingError({ message: 'timeout' }), false);
});
