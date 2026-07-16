const api = require('../../../utils/api');
const {
  STATUS,
  STATUS_LABEL,
  PAY_CHANNEL,
  assertUserCancelAllowed,
  calcCancelRefund,
  buildCancelConfirmContent,
} = require('../../../utils/activityRegistration');

Page({
  data: {
    list: [],
  },
  onShow() {
    this.loadList();
  },
  async loadList() {
    try {
      const res = await api.listMyActivityRegistrations();
      const list = ((res && res.list) || []).map((row) => ({
        ...row,
        statusLabel: STATUS_LABEL[row.status] || row.status,
        channelLabel: row.payChannel === PAY_CHANNEL.BALANCE ? '余额' : '微信',
      }));
      this.setData({ list });
    } catch (error) {
      console.warn('[my-activity-regs] load', error);
      this.setData({ list: [] });
    }
  },
  goBrowse() {
    wx.switchTab({ url: '/pages/activities/index' });
  },
  async cancel(event) {
    const id = event.currentTarget.dataset.id;
    const row = this.data.list.find((item) => item._id === id);
    if (!row || row.status !== STATUS.PAID) return;

    const gate = assertUserCancelAllowed(row, row.startAt, Date.now());
    if (!gate.ok) {
      wx.showToast({ title: gate.message || '不可取消', icon: 'none' });
      return;
    }
    const refund = calcCancelRefund(row, gate.policy);
    const refundTip = buildCancelConfirmContent(gate.policy, refund);
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '取消报名？',
        content: refundTip,
        success: (res) => resolve(!!res.confirm),
      });
    });
    if (!confirm) return;

    wx.showLoading({ title: '取消中', mask: true });
    try {
      const result = await api.cancelActivityRegistration({ registrationId: id });
      wx.hideLoading();
      if (!result || !result.ok) {
        wx.showToast({ title: (result && result.message) || '取消失败', icon: 'none' });
        return;
      }
      if (result.refundPending) {
        wx.showToast({ title: '退款处理中，请稍后', icon: 'none' });
      } else {
        wx.showToast({ title: refundTip, icon: 'none' });
      }
      this.loadList();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '取消失败', icon: 'none' });
    }
  },
});
