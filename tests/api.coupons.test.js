const test = require('node:test');
const assert = require('node:assert/strict');

test('api exports coupon cloud wrappers as functions', () => {
  const api = require('../miniprogram/utils/api');
  assert.equal(typeof api.listMyCoupons, 'function');
  assert.equal(typeof api.adminListMemberCoupons, 'function');
  assert.equal(typeof api.adminRedeemCoupon, 'function');
  assert.equal(typeof api.adminIssueCoupon, 'function');
});
