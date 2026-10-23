const test = require('node:test');
const assert = require('node:assert/strict');
const { formatYuan, formatYuan2 } = require('../miniprogram/utils/money');

test('formatYuan strips float noise and keeps integers bare', () => {
  assert.equal(formatYuan(0.060000000000000005), '0.06');
  assert.equal(formatYuan(99), '99');
  assert.equal(formatYuan(99.0), '99');
  assert.equal(formatYuan(128.5), '128.5');
  assert.equal(formatYuan('12.345'), '12.35');
  assert.equal(formatYuan(null), '0');
  assert.equal(formatYuan(undefined), '0');
  assert.equal(formatYuan(NaN), '0');
});

test('formatYuan2 keeps two decimals and rounds float noise', () => {
  assert.equal(formatYuan2(0.019999999999999997), '0.02');
  assert.equal(formatYuan2(168), '168.00');
  assert.equal(formatYuan2('12.345'), '12.35');
  assert.equal(formatYuan2(null), '0.00');
  assert.equal(formatYuan2(undefined), '0.00');
  assert.equal(formatYuan2(NaN), '0.00');
});
