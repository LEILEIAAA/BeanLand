const { packages } = require('../../data/seed');

Page({
  data: { packages },
  book(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/appointment/index?packageId=${id}` });
  },
});
