const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_STORE,
  DEFAULT_TIME_SLOTS,
  resolvePublicStore,
  parseTimeSlotDocs,
  resolveTimeSlots,
  resolveCopyAddressText,
} = require('../miniprogram/utils/storePublic');

test('resolvePublicStore uses defaults when cloud empty', () => {
  const store = resolvePublicStore(null);
  assert.equal(store.shortAddress, DEFAULT_STORE.shortAddress);
  assert.equal(store.latitude, DEFAULT_STORE.latitude);
  assert.equal(store.longitude, DEFAULT_STORE.longitude);
});

test('resolvePublicStore lets cloud override fields', () => {
  const store = resolvePublicStore({ shortAddress: '云端地址', latitude: 1, longitude: 2 });
  assert.equal(store.shortAddress, '云端地址');
  assert.equal(store.latitude, 1);
  assert.equal(store.name, DEFAULT_STORE.name);
});

test('parseTimeSlotDocs reads slots array doc', () => {
  assert.deepEqual(parseTimeSlotDocs([{ slots: ['10:00-12:00', '12:00-14:00'] }]), [
    '10:00-12:00',
    '12:00-14:00',
  ]);
});

test('resolvePublicStore ignores blank cloud address so copy still works', () => {
  const store = resolvePublicStore({ address: '', shortAddress: '   ', name: '云店' });
  assert.equal(store.address, DEFAULT_STORE.address);
  assert.equal(store.shortAddress, DEFAULT_STORE.shortAddress);
  assert.equal(store.name, '云店');
});

test('resolveCopyAddressText prefers full address then defaults', () => {
  assert.equal(
    resolveCopyAddressText({ address: '完整地址', shortAddress: '短地址' }),
    '完整地址',
  );
  assert.equal(
    resolveCopyAddressText({ address: '', shortAddress: '短地址' }),
    DEFAULT_STORE.address,
  );
  assert.equal(resolveCopyAddressText({ address: '', shortAddress: '' }), DEFAULT_STORE.address);
  assert.equal(
    resolveCopyAddressText({ address: '  ', shortAddress: '仅短地址' }),
    DEFAULT_STORE.address,
  );
});
