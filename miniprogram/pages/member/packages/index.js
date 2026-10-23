const api = require('../../../utils/api');
const { formatYuan } = require('../../../utils/money');

const TAB = {
  UNUSED: 'unused',
  USED: 'used',
  EXPIRED: 'expired',
};

const TAB_ITEMS = [
  { key: TAB.UNUSED, label: '未使用' },
  { key: TAB.USED, label: '已使用' },
  { key: TAB.EXPIRED, label: '已退款' },
];

const EMPTY_TIPS = {
  [TAB.UNUSED]: '暂无未使用套餐，去套餐页购买',
  [TAB.USED]: '暂无已核销套餐',
  [TAB.EXPIRED]: '暂无退款记录',
};

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

function formatDay(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function remainDays(expiresAt, now) {
  const end = Number(expiresAt || 0);
  if (!end) return null;
  const left = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
  return left;
}

function mapOrder(item, tab, now) {
  const id = item._id || item.id;
  const name = item.displayName || item.packageName || (item.packageSnapshot && item.packageSnapshot.name) || '套餐';
  const pay = item.payAmountYuan != null
    ? Number(item.payAmountYuan)
    : Number(item.payAmountFen || 0) / 100;
  let meta = '';
  let statusText = '';
  let validRange = '';
  let ok = false;
  let canRefund = false;

  if (tab === TAB.UNUSED) {
    statusText = '待核销';
    ok = true;
    canRefund = true;
    const left = remainDays(item.expiresAt, now);
    if (left != null) {
      validRange = left > 0 ? `剩余 ${left} 天 · 至 ${formatDay(item.expiresAt)}` : `今日到期 · ${formatDay(item.expiresAt)}`;
    }
    meta = `购买 ${formatTime(item.fulfilledAt || item.createdAt)}`;
  } else if (tab === TAB.USED) {
    statusText = '已核销';
    meta = `核销 ${formatTime(item.redeemedAt)}`;
  } else {
    const pending = item.status === 'expired_refund_pending'
      || item.status === 'user_refund_pending'
      || item.status === 'expired_refunding'
      || item.status === 'user_refunding';
    const userRefunded = item.status === 'user_refunded';
    const expiredRefunded = item.status === 'expired_refunded';
    if (pending) {
      statusText = '退款处理中';
    } else if (userRefunded) {
      statusText = '已退款';
    } else if (expiredRefunded) {
      statusText = '已过期退款';
    } else {
      statusText = '退款记录';
    }
    const refundAt = item.refundedAt || item.updatedAt || 0;
    if (refundAt) {
      meta = `${userRefunded || pending ? '退款' : '过期退款'} ${formatTime(refundAt)}`;
    } else if (item.expiresAt) {
      meta = `到期 ${formatDay(item.expiresAt)}`;
    } else {
      meta = `购买 ${formatTime(item.fulfilledAt || item.createdAt)}`;
    }
    canRefund = item.status === 'user_refund_pending' || item.status === 'user_refunding';
  }

  return {
    id,
    name,
    meta,
    validRange,
    statusText,
    payText: formatYuan(pay),
    ok,
    canRefund,
  };
}

const { shareBehavior } = require('../../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    tabs: TAB_ITEMS,
    activeTab: TAB.UNUSED,
    orders: [],
    loading: true,
    emptyTip: '',
    heroCount: 0,
  },
  onShow() {
    this.load();
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },
  onTabChange(event) {
    const { tab } = event.currentTarget.dataset;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab }, () => this.load());
  },
  async load() {
    const tab = this.data.activeTab;
    this.setData({ loading: true, emptyTip: '' });
    try {
      const result = await api.listMyPackageOrders({ tab });
      const list = result && result.ok && Array.isArray(result.list) ? result.list : [];
      const now = Date.now();
      const orders = list.map((item) => mapOrder(item, tab, now));
      this.setData({
        orders,
        heroCount: orders.length,
        emptyTip: !orders.length ? EMPTY_TIPS[tab] : '',
        loading: false,
      });
    } catch (error) {
      console.warn('[member-packages] load failed', error);
      this.setData({
        orders: [],
        heroCount: 0,
        emptyTip: '加载失败，下拉重试',
        loading: false,
      });
    }
  },
  async onRefund(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const row = this.data.orders.find((item) => item.id === id);
    const amountText = `¥${(row && row.payText) || '0.00'}`;
    const refundTip = `${amountText}原路退回，注意查收`;
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '申请退款？',
        content: refundTip,
        success: (res) => resolve(!!res.confirm),
      });
    });
    if (!confirm) return;

    wx.showLoading({ title: '退款中', mask: true });
    try {
      const result = await api.refundPackageOrder({ orderId: id });
      wx.hideLoading();
      if (!result || !result.ok) {
        wx.showToast({ title: (result && result.message) || '退款失败', icon: 'none' });
        this.load();
        return;
      }
      wx.showToast({ title: refundTip, icon: 'none' });
      this.setData({ activeTab: TAB.EXPIRED }, () => this.load());
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '退款失败', icon: 'none' });
    }
  },
});
