const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPhoneSearchPattern,
  phoneMatchesKeyword,
} = require('../cloudfunctions/adminFindMember/memberSearch');

test('buildPhoneSearchPattern is contains match without leading caret', () => {
  assert.equal(buildPhoneSearchPattern('1234'), '1234');
  assert.equal(buildPhoneSearchPattern('13800138000'), '13800138000');
  assert.doesNotMatch(buildPhoneSearchPattern('88'), /^\^/);
});

test('buildPhoneSearchPattern escapes regexp metacharacters', () => {
  assert.equal(buildPhoneSearchPattern('12.3'), '12\\.3');
  assert.equal(buildPhoneSearchPattern('1+2'), '1\\+2');
});

test('phoneMatchesKeyword matches full phone, prefix, middle and tail', () => {
  const phone = '13800138000';
  assert.equal(phoneMatchesKeyword(phone, '13800138000'), true);
  assert.equal(phoneMatchesKeyword(phone, '138'), true);
  assert.equal(phoneMatchesKeyword(phone, '00138'), true);
  assert.equal(phoneMatchesKeyword(phone, '8000'), true);
});

test('phoneMatchesKeyword rejects non-matching fragment', () => {
  assert.equal(phoneMatchesKeyword('13800138000', '9999'), false);
  assert.equal(phoneMatchesKeyword('13800138000', ''), false);
  assert.equal(phoneMatchesKeyword('', '138'), false);
});
