const test = require('node:test');
const assert = require('node:assert/strict');
const {
  pickMemberFromList,
  buildMemberDetailReset,
} = require('../miniprogram/utils/adminMemberDetail');

test('pickMemberFromList matches by _id and ignores other rows', () => {
  const list = [
    { _id: 'm-first', nickName: '甲' },
    { _id: 'm-target', nickName: '乙' },
  ];
  const hit = pickMemberFromList(list, 'm-target');
  assert.equal(hit._id, 'm-target');
  assert.equal(hit.nickName, '乙');
});

test('pickMemberFromList does not fall back to list[0] when id missing', () => {
  const list = [{ _id: 'm-first', nickName: '甲' }];
  assert.equal(pickMemberFromList(list, 'm-other'), null);
  assert.equal(pickMemberFromList(list, ''), null);
  assert.equal(pickMemberFromList(list, null), null);
  assert.equal(pickMemberFromList(null, 'm-first'), null);
});

test('pickMemberFromList also matches id field', () => {
  const hit = pickMemberFromList([{ id: 'm9', nickName: '丙' }], 'm9');
  assert.equal(hit.id, 'm9');
});

test('buildMemberDetailReset clears member and transactions for new id', () => {
  const state = buildMemberDetailReset('m42');
  assert.equal(state.memberId, 'm42');
  assert.equal(state.member, null);
  assert.deepEqual(state.transactions, []);
  assert.equal(state.filterType, '');
  assert.equal(state.loading, true);
  assert.equal(state.txLoading, true);
});

test('buildMemberDetailReset with empty id still clears display fields', () => {
  const state = buildMemberDetailReset('');
  assert.equal(state.memberId, '');
  assert.equal(state.member, null);
  assert.deepEqual(state.transactions, []);
  assert.equal(state.loading, false);
  assert.equal(state.txLoading, false);
});
