const DEFAULT_TIER_RULES = {
  spendRatio: 0.6,
  vip: { minRecharge: 500, minSpent: 300 },
  svip: { minRecharge: 1000, minSpent: 600 },
};

const TIER_RANK = { member: 0, vip: 1, svip: 2 };

function normalizeMember(member) {
  const principalBalance = Number(member.principalBalance || 0);
  const bonusBalance = Number(member.bonusBalance || 0);
  return {
    ...member,
    principalBalance,
    bonusBalance,
    totalBalance: principalBalance + bonusBalance,
    totalRecharge: Number(member.totalRecharge || 0),
    totalBonus: Number(member.totalBonus || 0),
    totalSpent: Number(member.totalSpent || 0),
  };
}

function applyRecharge(member, plan) {
  const current = normalizeMember(member);
  const rechargeAmount = Number(plan.rechargeAmount || 0);
  const bonusAmount = Number(plan.bonusAmount || 0);
  const next = {
    ...current,
    principalBalance: current.principalBalance + rechargeAmount,
    bonusBalance: current.bonusBalance + bonusAmount,
    totalRecharge: current.totalRecharge + rechargeAmount,
    totalBonus: current.totalBonus + bonusAmount,
  };
  next.totalBalance = next.principalBalance + next.bonusBalance;
  return {
    member: next,
    transaction: {
      type: 'recharge',
      amount: rechargeAmount + bonusAmount,
      principalDelta: rechargeAmount,
      bonusDelta: bonusAmount,
      principalBalanceAfter: next.principalBalance,
      bonusBalanceAfter: next.bonusBalance,
      totalBalanceAfter: next.totalBalance,
      reason: `充值 ${rechargeAmount} 赠送 ${bonusAmount}`,
    },
  };
}

function resolveTier(totalRecharge, totalSpent, rules = DEFAULT_TIER_RULES) {
  const recharge = Number(totalRecharge || 0);
  const spent = Number(totalSpent || 0);
  if (recharge >= rules.svip.minRecharge || spent >= rules.svip.minSpent) return 'svip';
  if (recharge >= rules.vip.minRecharge || spent >= rules.vip.minSpent) return 'vip';
  return 'member';
}

function upgradeTier(current, candidate) {
  const currentRank = TIER_RANK[current] || 0;
  const nextRank = TIER_RANK[candidate] || 0;
  if (nextRank > currentRank) return candidate;
  return current && TIER_RANK[current] !== undefined ? current : 'member';
}

async function loadTierRules(db) {
  try {
    const doc = await db.collection('member_tier_rules').doc('main').get();
    if (doc && doc.data) return { ...DEFAULT_TIER_RULES, ...doc.data };
  } catch (error) {
    // defaults
  }
  return DEFAULT_TIER_RULES;
}

/**
 * Apply recharge credit to member + write transaction.
 * Caller must ensure order is not already credited (idempotent guard outside).
 */
async function creditMemberRecharge(db, {
  member,
  memberId,
  rechargeAmount,
  bonusAmount,
  title,
  channel,
  planId,
  operatorOpenid,
  orderId,
  outTradeNo,
  now,
}) {
  const applied = applyRecharge(member, { rechargeAmount, bonusAmount });
  const rules = await loadTierRules(db);
  const nextTier = upgradeTier(
    member.tier || 'member',
    resolveTier(applied.member.totalRecharge, applied.member.totalSpent, rules),
  );
  const ts = now || Date.now();

  await db.collection('members').doc(memberId).update({
    data: {
      principalBalance: applied.member.principalBalance,
      bonusBalance: applied.member.bonusBalance,
      totalBalance: applied.member.totalBalance,
      totalRecharge: applied.member.totalRecharge,
      totalBonus: applied.member.totalBonus,
      tier: nextTier,
      tierUpdatedAt: nextTier !== member.tier ? ts : member.tierUpdatedAt || ts,
      updatedAt: ts,
    },
  });

  const tx = {
    _openid: member._openid,
    type: 'recharge',
    title: title || `充 ${rechargeAmount} 送 ${bonusAmount}`,
    reason: applied.transaction.reason,
    amount: applied.transaction.amount,
    principalDelta: applied.transaction.principalDelta,
    bonusDelta: applied.transaction.bonusDelta,
    principalBalanceAfter: applied.transaction.principalBalanceAfter,
    bonusBalanceAfter: applied.transaction.bonusBalanceAfter,
    totalBalanceAfter: applied.transaction.totalBalanceAfter,
    channel,
    planId: planId || '',
    operatorOpenid: operatorOpenid || '',
    orderId: orderId || '',
    outTradeNo: outTradeNo || '',
    createdAt: ts,
  };

  const txRes = await db.collection('member_transactions').add({ data: tx });

  return {
    member: {
      ...member,
      ...applied.member,
      tier: nextTier,
      updatedAt: ts,
    },
    transactionId: txRes._id,
    tier: nextTier,
    appliedAt: ts,
  };
}

module.exports = {
  DEFAULT_TIER_RULES,
  normalizeMember,
  applyRecharge,
  resolveTier,
  upgradeTier,
  loadTierRules,
  creditMemberRecharge,
};
