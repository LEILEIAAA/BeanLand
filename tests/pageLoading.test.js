const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSkeletonRows } = require('../miniprogram/utils/pageLoading');

test('buildSkeletonRows clamps to 1..8 and marks wide rows', () => {
  assert.equal(buildSkeletonRows(0).length, 1);
  assert.equal(buildSkeletonRows(99).length, 8);
  assert.equal(buildSkeletonRows(4).length, 4);
  assert.deepEqual(
    buildSkeletonRows(3).map((row) => row.wide),
    [true, true, false],
  );
});
