const test = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldRemoteSearchMember,
  ADMIN_MEMBER_SEARCH_DEBOUNCE_MS,
  ADMIN_MEMBER_SEARCH_MIN_DIGITS,
} = require('../miniprogram/utils/adminMemberSearch');

test('exports debounce and min digit defaults', () => {
  assert.equal(ADMIN_MEMBER_SEARCH_DEBOUNCE_MS, 300);
  assert.equal(ADMIN_MEMBER_SEARCH_MIN_DIGITS, 4);
});

test('shouldRemoteSearchMember rejects empty and short digit tails', () => {
  assert.equal(shouldRemoteSearchMember(''), false);
  assert.equal(shouldRemoteSearchMember('   '), false);
  assert.equal(shouldRemoteSearchMember('1'), false);
  assert.equal(shouldRemoteSearchMember('18'), false);
  assert.equal(shouldRemoteSearchMember('184'), false);
});

test('shouldRemoteSearchMember allows 4+ digit fragments and full phone', () => {
  assert.equal(shouldRemoteSearchMember('1841'), true);
  assert.equal(shouldRemoteSearchMember('15715719050'), true);
});

test('shouldRemoteSearchMember allows nickname keywords of any non-empty length', () => {
  assert.equal(shouldRemoteSearchMember('R'), true);
  assert.equal(shouldRemoteSearchMember('Ray'), true);
  assert.equal(shouldRemoteSearchMember('豆'), true);
});
