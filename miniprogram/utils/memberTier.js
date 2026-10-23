const DEFAULT_TIER_RULES = {
  spendRatio: 0.6,
  vip: { minRecharge: 500, minSpent: 300 },
  svip: { minRecharge: 1000, minSpent: 600 },
};

const TIER_RANK = {
  member: 0,
  vip: 1,
  svip: 2,
};

const TIER_LABEL = {
  member: '普通会员',
  vip: 'VIP',
  svip: 'SVIP',
};

function spentThresholdFromRecharge(minRecharge, spendRatio = DEFAULT_TIER_RULES.spendRatio) {
  return Math.round(Number(minRecharge || 0) * Number(spendRatio || 0));
}

function resolveTier(totalRecharge, totalSpent, rules = DEFAULT_TIER_RULES) {
  const recharge = Number(totalRecharge || 0);
  const spent = Number(totalSpent || 0);
  const vip = rules.vip || DEFAULT_TIER_RULES.vip;
  const svip = rules.svip || DEFAULT_TIER_RULES.svip;

  if (recharge >= svip.minRecharge || spent >= svip.minSpent) {
    return 'svip';
  }
  if (recharge >= vip.minRecharge || spent >= vip.minSpent) {
    return 'vip';
  }
  return 'member';
}

function upgradeTier(current, candidate) {
  const currentRank = TIER_RANK[current] || 0;
  const nextRank = TIER_RANK[candidate] || 0;
  if (nextRank > currentRank) {
    return candidate;
  }
  return current && TIER_RANK[current] !== undefined ? current : 'member';
}

function tierLabel(tier) {
  return TIER_LABEL[tier] || TIER_LABEL.member;
}

function tierStyleClass(tier) {
  if (tier === 'svip') return 'tier-svip';
  if (tier === 'vip') return 'tier-vip';
  return 'tier-member';
}

module.exports = {
  DEFAULT_TIER_RULES,
  TIER_RANK,
  TIER_LABEL,
  spentThresholdFromRecharge,
  resolveTier,
  upgradeTier,
  tierLabel,
  tierStyleClass,
};
