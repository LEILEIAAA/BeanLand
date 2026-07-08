const { store, packages, activities, fiveBallPatterns } = require('../../data/seed');

Page({
  data: {
    store,
    featuredPackages: packages.filter((item) => item.isRecommended).slice(0, 4),
    activities: activities.slice(0, 3),
    highlights: [
      { title: '白底毛玻璃', meta: '更轻盈、更高级，信息层级更清晰' },
      { title: '五月天五球', meta: '五色圆球以更灵动的方式融入首屏' },
      { title: '一键预约', meta: '预约与座位计时继续保持高效率' },
      { title: '地图导航', meta: '到店路线和微信地图入口保持突出' },
    ],
    fiveBallPatterns,
    tabs: [
      { key: 'home', label: '首页', path: '/pages/home/index' },
      { key: 'package', label: '套餐', path: '/pages/packages/index' },
      { key: 'book', label: '预约', path: '/pages/appointment/index' },
      { key: 'member', label: '会员', path: '/pages/member/index' },
    ],
    activeTab: 'home',
  },
  goAppointment() {
    this.switchTab('/pages/appointment/index', 'book');
  },
  goRoute() {
    wx.navigateTo({ url: '/pages/route/index' });
  },
  goPackages() {
    this.switchTab('/pages/packages/index', 'package');
  },
  goActivities() {
    wx.navigateTo({ url: '/pages/activities/index' });
  },
  switchTab(path, activeTab) {
    this.setData({ activeTab });
    wx.switchTab({ url: path });
  },
  onTabTap(event) {
    const { path, key } = event.currentTarget.dataset;
    this.switchTab(path, key);
  },
});
