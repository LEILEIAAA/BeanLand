const api = require('../../../utils/api');
const {
  buildAdminDashboardMenu,
  applyAdminDashboardBadges,
} = require('../../../utils/adminDashboardMenu');

Page({
  data: {
    sections: buildAdminDashboardMenu(),
  },

  onShow() {
    this.refreshBadges();
  },

  async refreshBadges() {
    try {
      const [appointments, activityRes] = await Promise.all([
        api.adminListAppointments({ status: 'pending' }),
        api.adminListActivityRegistrations({ status: 'refund_pending' }),
      ]);
      const appointmentsPending = Array.isArray(appointments) ? appointments.length : 0;
      const activityList = (activityRes && activityRes.list) || [];
      const activityRegsPending = Array.isArray(activityList) ? activityList.length : 0;
      this.setData({
        sections: applyAdminDashboardBadges(buildAdminDashboardMenu(), {
          appointmentsPending,
          activityRegsPending,
        }),
      });
    } catch (error) {
      console.warn('[admin-dashboard-badges]', error);
    }
  },

  goMenu(event) {
    const url = event.currentTarget.dataset.url;
    if (!url) return;
    wx.navigateTo({
      url,
      fail: (err) => {
        const msg = (err && (err.errMsg || err.message)) || '页面打开失败';
        wx.showModal({
          title: '无法打开',
          content: msg,
          showCancel: false,
        });
      },
    });
  },
});
