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
function spendBalance(member, amount, reason) {
  const current = normalizeMember(member);
  const spendAmount = Number(amount || 0);

  if (spendAmount < 0) {
    throw new Error('invalid spend amount');
  }

  if (current.totalBalance < spendAmount) {
    throw new Error('余额不足，无法完成本次扣款');
  }

  const bonusPaid = Math.min(current.bonusBalance, spendAmount);
  const principalPaid = spendAmount - bonusPaid;
  const next = {
    ...current,
    bonusBalance: current.bonusBalance - bonusPaid,
    principalBalance: current.principalBalance - principalPaid,
    totalSpent: current.totalSpent + spendAmount,
  };
  next.totalBalance = next.principalBalance + next.bonusBalance;

  return {
    member: next,
    transaction: {
      type: 'consume',
      amount: -spendAmount,
      principalDelta: -principalPaid,
      bonusDelta: -bonusPaid,
      principalBalanceAfter: next.principalBalance,
      bonusBalanceAfter: next.bonusBalance,
      totalBalanceAfter: next.totalBalance,
      reason,
    },
  };
}

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

/**
 * Debit member balance and write consume transaction.
 */
async function debitMemberSpend(db, {
  member,
  memberId,
  amount,
  title,
  reason,
  channel,
  packageId,
  couponId,
  orderId,
  outTradeNo,
  now,
}) {
  const applied = spendBalance(member, amount, reason || title || '套餐消费');
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
      totalSpent: applied.member.totalSpent,
      tier: nextTier,
      tierUpdatedAt: nextTier !== member.tier ? ts : member.tierUpdatedAt || ts,
      updatedAt: ts,
    },
  });

  const tx = {
    _openid: member._openid,
    type: 'consume',
    title: title || reason || '套餐消费',
    reason: applied.transaction.reason,
    amount: applied.transaction.amount,
    principalDelta: applied.transaction.principalDelta,
    bonusDelta: applied.transaction.bonusDelta,
    principalBalanceAfter: applied.transaction.principalBalanceAfter,
    bonusBalanceAfter: applied.transaction.bonusBalanceAfter,
    totalBalanceAfter: applied.transaction.totalBalanceAfter,
    channel: channel || 'balance',
    packageId: packageId || '',
    couponId: couponId || '',
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

/**
 * Record wechat package consume (no balance change) + optional tier by spent.
 * For wechat path, totalSpent still increases by pay yuan amount for tier.
 */
async function recordPackageWechatConsume(db, {
  member,
  memberId,
  payYuan,
  title,
  channel,
  packageId,
  couponId,
  orderId,
  outTradeNo,
  now,
}) {
  const current = normalizeMember(member);
  const spent = Number(payYuan || 0);
  const nextSpent = current.totalSpent + spent;
  const rules = await loadTierRules(db);
  const nextTier = upgradeTier(
    member.tier || 'member',
    resolveTier(current.totalRecharge, nextSpent, rules),
  );
  const ts = now || Date.now();

  await db.collection('members').doc(memberId).update({
    data: {
      totalSpent: nextSpent,
      tier: nextTier,
      tierUpdatedAt: nextTier !== member.tier ? ts : member.tierUpdatedAt || ts,
      updatedAt: ts,
    },
  });

  const tx = {
    _openid: member._openid,
    type: 'consume',
    title: title || '套餐消费',
    reason: title || '套餐在线支付',
    amount: -spent,
    principalDelta: 0,
    bonusDelta: 0,
    principalBalanceAfter: current.principalBalance,
    bonusBalanceAfter: current.bonusBalance,
    totalBalanceAfter: current.totalBalance,
    channel: channel || 'wechat_jsapi',
    packageId: packageId || '',
    couponId: couponId || '',
    orderId: orderId || '',
    outTradeNo: outTradeNo || '',
    createdAt: ts,
  };

  const txRes = await db.collection('member_transactions').add({ data: tx });

  return {
    member: {
      ...member,
      ...current,
      totalSpent: nextSpent,
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
  spendBalance,
  resolveTier,
  upgradeTier,
  loadTierRules,
  creditMemberRecharge,
  debitMemberSpend,
  recordPackageWechatConsume,
};
