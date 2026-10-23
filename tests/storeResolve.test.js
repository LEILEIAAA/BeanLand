const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveStorePayload,
} = require('../miniprogram/utils/storeResolve');

test('resolveStorePayload prefers doc data', () => {
  const doc = { name: 'from-doc' };
  const rows = [{ name: 'from-rows' }];
  assert.equal(
    resolveStorePayload(doc, rows, { allowSeedFallback: false, seedStore: { name: 'seed' } }).name,
    'from-doc',
  );
});

test('resolveStorePayload uses first collection row when doc empty', () => {
  const rows = [{ name: 'from-rows' }];
  assert.equal(
    resolveStorePayload(null, rows, { allowSeedFallback: false, seedStore: { name: 'seed' } }).name,
    'from-rows',
  );
});

test('resolveStorePayload returns null when cloud empty and seed fallback off', () => {
  assert.equal(
    resolveStorePayload(null, [], { allowSeedFallback: false, seedStore: { name: 'seed' } }),
    null,
  );
});

test('resolveStorePayload uses seed only when fallback allowed', () => {
  assert.equal(
    resolveStorePayload(null, [], { allowSeedFallback: true, seedStore: { name: 'seed' } }).name,
    'seed',
  );
});
