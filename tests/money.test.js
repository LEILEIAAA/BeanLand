const test = require('node:test');
const assert = require('node:assert/strict');
const { formatYuan2 } = require('../miniprogram/utils/money');

test('formatYuan2 keeps two decimals and rounds float noise', () => {
  assert.equal(formatYuan2(0.019999999999999997), '0.02');
  assert.equal(formatYuan2(168), '168.00');
  assert.equal(formatYuan2('12.345'), '12.35');
  assert.equal(formatYuan2(null), '0.00');
  assert.equal(formatYuan2(undefined), '0.00');
  assert.equal(formatYuan2(NaN), '0.00');
});
