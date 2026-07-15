/**
 * 向云库 user_coupons 灌测试券的字段模板。
 * 有效期为日期范围：validFrom（开始）~ expireAt（结束），时间戳 ms。
 * 使用方式：云开发控制台 → 数据库 → user_coupons → 添加记录，
 * 将 _openid / memberId 换成真实会员。
 */
function sampleUserCoupons({ openid, memberId, now = Date.now() }) {
  const day = 24 * 3600 * 1000;
  return [
    {
      _openid: openid,
      memberId,
      name: '打卡奖励 · 赠送 2 小时',
      category: 'checkin',
      benefitType: 'hours',
      benefitValue: 2,
      status: 'unused',
      available: true,
      unavailableReason: '',
      validFrom: now - 7 * day,
      expireAt: now + 30 * day,
      createdAt: now,
      updatedAt: now,
    },
    {
      _openid: openid,
      memberId,
      name: '老师专属 · 8 折',
      category: 'teacher',
      benefitType: 'discount',
      benefitValue: 8,
      status: 'unused',
      available: true,
      unavailableReason: '',
      validFrom: now - 7 * day,
      expireAt: now + 30 * day,
      createdAt: now,
      updatedAt: now,
    },
    {
      _openid: openid,
      memberId,
      name: '最佳作品 · 赠送 3 小时',
      category: 'best_work',
      benefitType: 'hours',
      benefitValue: 3,
      status: 'unused',
      available: true,
      unavailableReason: '',
      validFrom: now + 3 * day,
      expireAt: now + 40 * day,
      createdAt: now,
      updatedAt: now,
    },
    {
      _openid: openid,
      memberId,
      name: '打卡奖励 · 8 折',
      category: 'checkin',
      benefitType: 'discount',
      benefitValue: 8,
      status: 'used',
      available: false,
      unavailableReason: '',
      validFrom: now - 20 * day,
      expireAt: now + 10 * day,
      usedAt: now - 7 * day,
      redeemedBy: '',
      createdAt: now - 20 * day,
      updatedAt: now - 7 * day,
    },
    {
      _openid: openid,
      memberId,
      name: '老师专属 · 赠送 1 小时',
      category: 'teacher',
      benefitType: 'hours',
      benefitValue: 1,
      status: 'expired',
      available: false,
      unavailableReason: '',
      validFrom: now - 40 * day,
      expireAt: now - 2 * day,
      createdAt: now - 40 * day,
      updatedAt: now - 2 * day,
    },
  ];
}

module.exports = {
  sampleUserCoupons,
};
