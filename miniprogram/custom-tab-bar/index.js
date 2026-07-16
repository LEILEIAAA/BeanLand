Component({
  data: {
    selected: 0,
    hidden: false,
    list: [
      {
        pagePath: '/pages/home/index',
        text: '首页',
        iconPath: '/assets/tab/home.png',
        selectedIconPath: '/assets/tab/home-active.png',
      },
      {
        pagePath: '/pages/activities/index',
        text: '活动',
        iconPath: '/assets/tab/activities.png',
        selectedIconPath: '/assets/tab/activities-active.png',
      },
      {
        pagePath: '/pages/packages/index',
        text: '套餐',
        iconPath: '/assets/tab/packages.png',
        selectedIconPath: '/assets/tab/packages-active.png',
      },
      {
        pagePath: '/pages/member/index',
        text: '会员',
        iconPath: '/assets/tab/member.png',
        selectedIconPath: '/assets/tab/member-active.png',
      },
    ],
  },
  methods: {
    onSwitch(event) {
      const { path, index } = event.currentTarget.dataset;
      if (typeof index === 'number') this.setData({ selected: index });
      wx.switchTab({ url: path });
    },
  },
});
