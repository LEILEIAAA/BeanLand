const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_TIER_RULES,
  resolveTier,
  upgradeTier,
  tierLabel,
  tierStyleClass,
  spentThresholdFromRecharge,
} = require('../miniprogram/utils/memberTier');

test('spentThresholdFromRecharge uses 0.6 ratio', () => {
  assert.equal(spentThresholdFromRecharge(500, 0.6), 300);
  assert.equal(spentThresholdFromRecharge(1000, 0.6), 600);
  assert.equal(DEFAULT_TIER_RULES.vip.minSpent, 300);
  assert.equal(DEFAULT_TIER_RULES.svip.minSpent, 600);
});

test('resolveTier stays member below thresholds', () => {
  assert.equal(resolveTier(0, 0), 'member');
  assert.equal(resolveTier(499, 299), 'member');
});

test('resolveTier upgrades to vip by recharge or spend', () => {
  assert.equal(resolveTier(500, 0), 'vip');
  assert.equal(resolveTier(0, 300), 'vip');
});

test('resolveTier upgrades to svip by recharge or spend', () => {
  assert.equal(resolveTier(1000, 0), 'svip');
  assert.equal(resolveTier(0, 600), 'svip');
  assert.equal(resolveTier(500, 600), 'svip');
});

test('upgradeTier never downgrades', () => {
  assert.equal(upgradeTier('svip', 'vip'), 'svip');
  assert.equal(upgradeTier('vip', 'member'), 'vip');
  assert.equal(upgradeTier('member', 'vip'), 'vip');
});

test('tierLabel maps codes', () => {
  assert.equal(tierLabel('vip'), 'VIP');
  assert.equal(tierLabel('unknown'), '普通会员');
});

test('tierStyleClass maps codes for UI skins', () => {
  assert.equal(tierStyleClass('member'), 'tier-member');
  assert.equal(tierStyleClass('vip'), 'tier-vip');
  assert.equal(tierStyleClass('svip'), 'tier-svip');
  assert.equal(tierStyleClass('unknown'), 'tier-member');
  assert.equal(tierStyleClass(''), 'tier-member');
});
