const api = require('../../../utils/api');
const seed = require('../../../data/seed');
const {
  TAB,
  formatValidRange,
  formatBenefitText,
  withEffectiveAvailability,
} = require('../../../utils/coupons');

const TAB_ITEMS = [
  { key: TAB.UNUSED, label: '未使用' },
  { key: TAB.USED, label: '已使用' },
  { key: TAB.EXPIRED, label: '已过期' },
];

const EMPTY_TIPS = {
  [TAB.UNUSED]: '暂无未使用优惠券',
  [TAB.USED]: '暂无已使用优惠券',
  [TAB.EXPIRED]: '暂无已过期优惠券',
};

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

function mapCoupon(item, tab) {
  const id = item._id || item.id;
  const available = item.available === true;
  const validRange = formatValidRange(item);
  let meta = '';
  let statusText = '';

  if (tab === TAB.UNUSED) {
    statusText = available ? '可用' : '不可用';
    if (!available && item.unavailableReason) {
      meta = item.unavailableReason;
    }
  } else if (tab === TAB.USED) {
    statusText = '已使用';
    const used = formatTime(item.usedAt);
    if (used) meta = `核销 ${used}`;
  } else if (tab === TAB.EXPIRED) {
    statusText = '已过期';
    const expired = formatTime(item.expireAt);
    if (expired) meta = `过期 ${expired}`;
  }

  return {
    id,
    name: item.name || '优惠券',
    benefitText: formatBenefitText(item) || '—',
    meta,
    validRange,
    statusText,
    available,
    dimmed: tab === TAB.UNUSED && !available,
  };
}

function seedListForTab(tab) {
  const rows = (seed.memberProfile && seed.memberProfile.coupons) || [];
  const now = Date.now();
  return rows
    .filter((item) => (item.status || TAB.UNUSED) === tab)
    .map((item) => {
      const effective =
        tab === TAB.UNUSED ? withEffectiveAvailability(item, now) : item;
      return mapCoupon(effective, tab);
    });
}

const { shareBehavior } = require('../../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    tabs: TAB_ITEMS,
    activeTab: TAB.UNUSED,
    coupons: [],
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
      const result = await api.listMyCoupons({ tab });
      const cloudOk = !!(result && result.ok && Array.isArray(result.list));
      let coupons = [];
      if (cloudOk) {
        coupons = result.list.map((item) => mapCoupon(item, tab));
      } else if (api.ALLOW_SEED_FALLBACK) {
        coupons = seedListForTab(tab);
      }

      this.setData({
        coupons,
        heroCount: coupons.length,
        emptyTip: cloudOk && !coupons.length ? EMPTY_TIPS[tab] : '',
      });

      if (!cloudOk && !api.ALLOW_SEED_FALLBACK) {
        wx.showToast({ title: '优惠券加载失败', icon: 'none' });
      }
    } catch (error) {
      console.warn('[coupons] load failed', error);
      if (api.ALLOW_SEED_FALLBACK) {
        const coupons = seedListForTab(tab);
        this.setData({ coupons, heroCount: coupons.length, emptyTip: '' });
      } else {
        wx.showToast({ title: '优惠券加载失败', icon: 'none' });
      }
    } finally {
      this.setData({ loading: false });
    }
  },
});
