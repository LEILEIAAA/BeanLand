const api = require('../../../utils/api');
const { STATUS, STATUS_LABEL, PAY_CHANNEL } = require('../../../utils/activityRegistration');
const {
  ADMIN_ACTIVITY_REG_FILTER_TABS,
  DEFAULT_ADMIN_ACTIVITY_REG_FILTER,
} = require('../../../utils/adminActivityRegistrationFilter');
const { formatYuan } = require('../../../utils/money');

function formatPaidAt(ts) {
  const n = Number(ts || 0);
  if (!(n > 0)) return '';
  const china = new Date(n + 8 * 60 * 60 * 1000);
  const y = china.getUTCFullYear();
  const m = String(china.getUTCMonth() + 1).padStart(2, '0');
  const d = String(china.getUTCDate()).padStart(2, '0');
  const hh = String(china.getUTCHours()).padStart(2, '0');
  const mm = String(china.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

Page({
  data: {
    list: [],
    todayPaidCount: 0,
    filterTabs: ADMIN_ACTIVITY_REG_FILTER_TABS,
    filterStatus: DEFAULT_ADMIN_ACTIVITY_REG_FILTER,
    loading: true,
  },
  onShow() {
    this.loadList();
  },
  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await api.adminListActivityRegistrations({
        status: this.data.filterStatus || undefined,
      });
      const list = ((res && res.list) || []).map((row) => ({
        ...row,
        statusLabel: row.isEffective
          ? '已生效'
          : STATUS_LABEL[row.status] || row.statusLabel || row.status,
        channelLabel: row.payChannel === PAY_CHANNEL.BALANCE ? '余额' : '在线支付',
        paidAtLabel: formatPaidAt(row.paidAt || row.createdAt),
        canConfirmRefund: row.status === STATUS.REFUND_PENDING,
        amountText: formatYuan(
          row.amount != null
            ? row.amount
            : Number(row.payAmountFen || 0) / 100,
        ),
      }));
      this.setData({
        list,
        todayPaidCount: (res && res.todayPaidCount) || 0,
      });
    } catch (error) {
      console.warn('[admin-activity-regs]', error);
      this.setData({ list: [], todayPaidCount: 0 });
    } finally {
      this.setData({ loading: false });
    }
  },
  setFilter(event) {
    const status = event.currentTarget.dataset.status;
    const next = status == null ? DEFAULT_ADMIN_ACTIVITY_REG_FILTER : String(status);
    this.setData({ filterStatus: next }, () => this.loadList());
  },
  async confirmRefund(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const row = this.data.list.find((item) => item._id === id);
    const refundFen =
      row && row.refundFeeFen != null && row.refundFeeFen !== ''
        ? Number(row.refundFeeFen)
        : Number((row && row.payAmountFen) || 0);
    const amountText = `¥${formatYuan(refundFen / 100)}`;
    const refundTip = `${amountText}原路退回，注意查收`;
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '重试退款？',
        content: refundTip,
        success: (res) => resolve(!!res.confirm),
      });
    });
    if (!confirm) return;

    wx.showLoading({ title: '提交中', mask: true });
    try {
      const result = await api.adminConfirmActivityRefund({ registrationId: id });
      wx.hideLoading();
      if (!result || !result.ok) {
        wx.showToast({ title: (result && result.message) || '失败', icon: 'none' });
        return;
      }
      wx.showToast({ title: refundTip, icon: 'none' });
      this.loadList();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '失败', icon: 'none' });
    }
  },
});
