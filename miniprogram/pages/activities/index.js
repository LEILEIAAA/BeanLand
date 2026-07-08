const { activities } = require('../../data/seed');

Page({
  data: { activities },
  join() {
    wx.navigateTo({ url: '/pages/appointment/index?type=activity' });
  },
});
