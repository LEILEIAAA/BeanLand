const { formatYuan } = require('./money');
const { tierLabel } = require('./memberTier');

function mapAdminMemberRow(member) {
  const raw = member || {};
  const nickname =
    (raw.nickName != null && String(raw.nickName).trim()) ||
    (raw.nickname != null && String(raw.nickname).trim()) ||
    '未命名';
  const phoneRaw = raw.phone != null ? String(raw.phone).trim() : '';
  const tier = raw.tier || 'member';
  return {
    id: raw._id || raw.id || '',
    nickname,
    phone: phoneRaw || '未绑定手机',
    balanceText: formatYuan(raw.totalBalance),
    totalBalance: Number(raw.totalBalance) || 0,
    tier,
    tierLabel: tierLabel(tier),
    principalBalance: Number(raw.principalBalance) || 0,
    bonusBalance: Number(raw.bonusBalance) || 0,
    totalRecharge: Number(raw.totalRecharge) || 0,
    totalSpent: Number(raw.totalSpent) || 0,
  };
}

module.exports = { mapAdminMemberRow };
