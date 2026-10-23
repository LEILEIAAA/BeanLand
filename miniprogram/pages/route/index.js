const api = require('../../utils/api');
const {
  resolvePublicStore,
  resolveCopyAddressText,
  DEFAULT_STORE,
} = require('../../utils/storePublic');

const { shareBehavior } = require('../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    store: { ...DEFAULT_STORE },
    loading: true,
    loadError: false,
  },
  onShow() {
    this.loadStore();
  },
  async loadStore() {
    this.setData({ loading: true, loadError: false });
    try {
      const cloudStore = await api.getStore();
      const store = resolvePublicStore(cloudStore);
      this.setData({
        store,
        loading: false,
        loadError: false,
      });
    } catch (error) {
      console.warn('[route] load store failed', error);
      this.setData({
        store: resolvePublicStore(null),
        loading: false,
        loadError: true,
      });
    }
  },
  copyAddress() {
    const text = resolveCopyAddressText(this.data.store);
    if (!text) {
      wx.showToast({ title: '地址暂不可用', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: text,
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      },
    });
  },
  callStore() {
    if (!this.data.store.phone || this.data.store.phone === '待填写') {
      wx.showToast({ title: '电话暂未填写', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: this.data.store.phone });
  },
  openMap() {
    const { latitude, longitude, markerName, address, scale } = this.data.store;
    if (!latitude || !longitude) {
      wx.showToast({ title: '位置暂不可用', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude,
      longitude,
      name: markerName,
      address,
      scale,
    });
  },
});
