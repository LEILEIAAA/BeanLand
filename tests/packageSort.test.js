const test = require('node:test');
const assert = require('node:assert/strict');
const { sortPackages } = require('../miniprogram/utils/packageSort');

test('sortPackages follows PACKAGE_ORDER then id', () => {
  const sorted = sortPackages([
    { id: 'weekend-family' },
    { id: 'opening-trio' },
    { id: 'solo-2h' },
    { id: 'unknown-z' },
    { id: 'weekend-solo' },
  ]);
  assert.deepEqual(
    sorted.map((row) => row.id),
    ['opening-trio', 'weekend-solo', 'solo-2h', 'weekend-family', 'unknown-z'],
  );
});

test('sortPackages honors sortOrder before built-in order', () => {
  const sorted = sortPackages([
    { id: 'opening-trio', sortOrder: 50 },
    { id: 'weekend-family', sortOrder: 10 },
    { id: 'solo-2h', sortOrder: 20 },
  ]);
  assert.deepEqual(
    sorted.map((row) => row.id),
    ['weekend-family', 'solo-2h', 'opening-trio'],
  );
});

test('sortPackages falls back to PACKAGE_ORDER when sortOrder equal', () => {
  const sorted = sortPackages([
    { id: 'weekend-solo', sortOrder: 0 },
    { id: 'opening-trio' },
    { id: 'solo-2h', sortOrder: 0 },
  ]);
  assert.deepEqual(
    sorted.map((row) => row.id),
    ['opening-trio', 'weekend-solo', 'solo-2h'],
  );
});

test('sortPackages returns empty for empty input', () => {
  assert.deepEqual(sortPackages([]), []);
  assert.deepEqual(sortPackages(null), []);
});
