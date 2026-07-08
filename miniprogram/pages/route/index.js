const { store } = require('../../data/seed');

Page({
  data: { store },
  copyAddress() {
    wx.setClipboardData({ data: this.data.store.address });
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
    wx.openLocation({
      latitude,
      longitude,
      name: markerName,
      address,
      scale,
    });
  },
});
