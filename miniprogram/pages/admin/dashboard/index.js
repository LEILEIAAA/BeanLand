const api = require('../../../utils/api');

Page({
  data: {
    metrics: [
      { label: '今日预约', value: '—' },
      { label: '本周预约', value: '—' },
      { label: '新增会员', value: '—' },
      { label: '储值金额', value: '—' },
      { label: '活动报名', value: '—' },
      { label: '即将超时', value: '—' },
    ],
  },
  onShow() {
    this.loadActivityMetric();
  },
  async loadActivityMetric() {
    try {
      const res = await api.adminListActivityRegistrations({});
      if (!res || !res.ok) return;
      const metrics = this.data.metrics.map((item) => {
        if (item.label !== '活动报名') return item;
        return { ...item, value: String(res.todayPaidCount || 0) };
      });
      this.setData({ metrics });
    } catch (error) {
      console.warn('[admin-dashboard] activity metric', error);
    }
  },
  goCoupons() {
    wx.navigateTo({ url: '/pages/admin/coupons/index' });
  },
  goPackages() {
    wx.navigateTo({
      url: '/pages/admin/package-redeem/index',
      fail: (err) => {
        const msg = (err && (err.errMsg || err.message)) || '页面打开失败';
        wx.showModal({
          title: '无法打开套餐核销',
          content: msg,
          showCancel: false,
        });
      },
    });
  },
  goAppointments() {
    wx.navigateTo({ url: '/pages/admin/appointments/index' });
  },
  goActivityRegs() {
    wx.navigateTo({ url: '/pages/admin/activity-registrations/index' });
  },
  goTimer() {
    wx.navigateTo({ url: '/pages/admin/timer/index' });
  },
  goTimerHistory() {
    wx.navigateTo({ url: '/pages/admin/timer-history/index' });
  },
});
