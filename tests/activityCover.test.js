const test = require('node:test');
const assert = require('node:assert/strict');
const {
  COVER_POOL,
  isValidCoverSrc,
  resolveActivityCover,
  fallbackActivityCover,
} = require('../miniprogram/utils/activityCover');

test('isValidCoverSrc accepts cloud, local and http urls', () => {
  assert.equal(isValidCoverSrc('cloud://env/xxx.jpg'), true);
  assert.equal(isValidCoverSrc('/assets/background/images1.jpg'), true);
  assert.equal(isValidCoverSrc('https://cdn.example.com/a.jpg'), true);
  assert.equal(isValidCoverSrc('http://cdn.example.com/a.jpg'), true);
});

test('isValidCoverSrc rejects empty and junk', () => {
  assert.equal(isValidCoverSrc(''), false);
  assert.equal(isValidCoverSrc('   '), false);
  assert.equal(isValidCoverSrc(null), false);
  assert.equal(isValidCoverSrc(undefined), false);
  assert.equal(isValidCoverSrc('null'), false);
  assert.equal(isValidCoverSrc('undefined'), false);
  assert.equal(isValidCoverSrc('wxfile://tmp_abc'), false);
  assert.equal(isValidCoverSrc('not-a-path'), false);
});

test('resolveActivityCover falls back to COVER_POOL by slot', () => {
  assert.equal(resolveActivityCover('', 0), COVER_POOL[0]);
  assert.equal(resolveActivityCover('null', 1), COVER_POOL[1]);
  assert.equal(resolveActivityCover('cloud://env/ok.jpg', 0), 'cloud://env/ok.jpg');
  assert.equal(resolveActivityCover('/assets/background/images2.jpg', 2), '/assets/background/images2.jpg');
});

test('fallbackActivityCover returns pool path and avoids same broken src when possible', () => {
  assert.equal(fallbackActivityCover(0), COVER_POOL[0]);
  assert.equal(fallbackActivityCover(1, 'cloud://broken'), COVER_POOL[1]);
  assert.equal(fallbackActivityCover(0, COVER_POOL[0]), COVER_POOL[1]);
});
