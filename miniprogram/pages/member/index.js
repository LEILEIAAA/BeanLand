Page({
  data: {
    member: {
      nickname: '体验会员',
      totalBalance: 168,
      principalBalance: 140,
      bonusBalance: 28,
      totalSpent: 89,
      visitCount: 1,
      stampCount: 2,
      lastVisitAt: '2026-07-03',
      coupons: ['美团转会员 10 元券', '双人同行 20 元券'],
      records: [
        { title: '标准拼豆体验', meta: '2026-07-03 · 余额支付 ¥89' },
        { title: '充 100 送 10', meta: '2026-06-28 · 到账 ¥110' },
      ],
    },
  },
  goRecharge() {
    wx.navigateTo({ url: '/pages/recharge/index' });
  },
});
