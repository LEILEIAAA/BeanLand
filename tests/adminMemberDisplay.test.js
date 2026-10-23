const test = require('node:test');
const assert = require('node:assert/strict');
const { mapAdminMemberRow } = require('../miniprogram/utils/adminMemberDisplay');

test('mapAdminMemberRow maps nickname phone balance and tier label', () => {
  const row = mapAdminMemberRow({
    _id: 'm1',
    nickName: '豆豆',
    phone: '13800138000',
    totalBalance: 128.5,
    tier: 'vip',
  });
  assert.equal(row.id, 'm1');
  assert.equal(row.nickname, '豆豆');
  assert.equal(row.phone, '13800138000');
  assert.equal(row.balanceText, '128.5');
  assert.equal(row.tier, 'vip');
  assert.equal(row.tierLabel, 'VIP');
});

test('mapAdminMemberRow falls back nickname and member tier', () => {
  const row = mapAdminMemberRow({
    _id: 'm2',
    nickname: '小A',
    phone: '',
    totalBalance: 0,
  });
  assert.equal(row.nickname, '小A');
  assert.equal(row.tierLabel, '普通会员');
  assert.equal(row.phone, '未绑定手机');
});
