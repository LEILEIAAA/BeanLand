const { store, packages, activities } = require('../../data/seed');
const {
  DEFAULT_AVATAR,
  ensureDefaultProfile,
  writeProfile,
  readGuideSkipped,
  writeGuideSkipped,
  needsProfileGuide,
  displayAvatar,
  isProfileSynced,
  resolveNickNameUpdate,
} = require('../../utils/wxProfile');
const { syncTabBar, setTabBarHidden } = require('../../utils/tabBar');

const COVER_LAND = '/assets/background/image3.jpg';
const COVER_POSTERS = '/assets/background/images1.jpg';

const HERO_PHOTOS = [
  { src: '/assets/background/images2.jpg', caption: '顶楼工坊' },
  { src: '/assets/background/image3.jpg', caption: 'MAYDAYLAND' },
  { src: '/assets/background/images1.jpg', caption: '窗边主题墙' },
];

const ACTIVITY_COVERS = {
  mayday: COVER_POSTERS,
  'squid-game': COVER_LAND,
  'craft-meetup': COVER_POSTERS,
};

const HOME_PACKAGE_IDS = ['weekend-solo', 'weekend-duo', 'weekend-family'];
const HOME_ACTIVITY_IDS = ['mayday', 'squid-game', 'craft-meetup'];

const ACTIVITY_STATUS_LABEL = {
  recruiting: '招募中',
  consulting: '咨询中',
};

const PACKAGE_AUDIENCE_LABEL = {
  'opening-trio': '三人免一',
  'weekend-solo': '单人无限时',
  'solo-2h': '单人2小时',
  'solo-1h': '单人1小时',
  'weekend-duo': '双人无限时',
  'duo-2h': '双人2小时',
  'duo-1h': '双人1小时',
  'weekend-family': '亲子无限时',
};

/** MAYDAYLAND 灯箱取样色，按序给 Bean Land 逐字上色 */
const BRAND_LETTER_COLORS = ['#BBD2E0', '#FFB80A', '#FF3D02', '#FCA681', '#69D868'];

function buildBrandLetters(name) {
  let colorIndex = 0;
  return String(name || '').split('').map((char, index) => {
    if (char === ' ') {
      return { key: `sp-${index}`, char: ' ', color: '', isSpace: true };
    }
    const color = BRAND_LETTER_COLORS[colorIndex % BRAND_LETTER_COLORS.length];
    colorIndex += 1;
    return { key: `ch-${index}`, char, color, isSpace: false };
  });
}

const PACKAGE_LOOKS = {
  'weekend-solo': { accent: '#FFB80A', enLabel: 'SOLO' },
  'weekend-duo': { accent: '#FF3D02', enLabel: 'DUO' },
  'weekend-family': { accent: '#69D868', enLabel: 'KIDS' },
  'opening-trio': { accent: '#FF3D02', enLabel: 'OPEN' },
};

const ACTIVITY_LOOKS = {
  mayday: { accent: '#FFB80A', enLabel: 'LIVE', orbInk: '#18181b' },
  'squid-game': { accent: '#FF3D02', enLabel: 'GAME', orbInk: '#ffffff' },
  'craft-meetup': { accent: '#69D868', enLabel: 'MEET', orbInk: '#18181b' },
};

Page({
  data: {
    store,
    brandLetters: buildBrandLetters(store.name),
    heroPhotos: HERO_PHOTOS,
    heroIndex: 0,
    heroCaption: HERO_PHOTOS[0].caption,
    featuredPackages: HOME_PACKAGE_IDS.map((id, index) => {
      const item = packages.find((row) => row.id === id);
      const look = PACKAGE_LOOKS[id] || { accent: '#BBD2E0', enLabel: 'PLAY' };
      const durationLabel = Number(item.durationMinutes) > 0
        ? `${item.durationMinutes} 分钟`
        : (item.overtimeRule || '当日不限时');
      return {
        ...item,
        audienceLabel: PACKAGE_AUDIENCE_LABEL[id] || item.targetAudience,
        durationLabel,
        priceLabel: item.weekdayPrice
          ? `周末¥${item.weekendPrice} / 工作日¥${item.weekdayPrice}`
          : `¥${item.price}`,
        lookNo: String(index + 1).padStart(2, '0'),
        includes: (item.includedItems || []).slice(0, 3),
        ...look,
      };
    }),
    activities: HOME_ACTIVITY_IDS.map((id, index) => {
      const item = activities.find((row) => row.id === id);
      const look = ACTIVITY_LOOKS[id] || { accent: '#FFB80A', enLabel: 'LIVE', orbInk: '#18181b' };
      return {
        ...item,
        cover: ACTIVITY_COVERS[id] || '',
        statusLabel: ACTIVITY_STATUS_LABEL[item.status] || item.status,
        dropNo: String(index + 1).padStart(2, '0'),
        shift: index % 2 === 1 ? 'shift-right' : 'shift-left',
        ...look,
      };
    }),
    showProfileGuide: false,
    guideAvatarUrl: DEFAULT_AVATAR,
    guideNickName: '',
  },
  onShow() {
    syncTabBar(this, 0);
    this.refreshProfileGuide();
  },
  onHeroChange(event) {
    const heroIndex = event.detail.current;
    if (typeof heroIndex !== 'number') return;
    const photo = HERO_PHOTOS[heroIndex];
    this.setData({
      heroIndex,
      heroCaption: photo ? photo.caption : '',
    });
  },
  onHeroDotTap(event) {
    const heroIndex = Number(event.currentTarget.dataset.index);
    if (Number.isNaN(heroIndex) || heroIndex === this.data.heroIndex) return;
    const photo = HERO_PHOTOS[heroIndex];
    this.setData({
      heroIndex,
      heroCaption: photo ? photo.caption : '',
    });
  },
  refreshProfileGuide() {
    const profile = ensureDefaultProfile();
    const skipped = readGuideSkipped();
    const app = getApp();
    app.globalData.userProfile = profile;
    const showProfileGuide = needsProfileGuide(profile, skipped);
    this.setData({
      showProfileGuide,
      guideAvatarUrl: displayAvatar(profile),
      guideNickName: profile.nickName,
    });
    setTabBarHidden(this, showProfileGuide);
  },
  persistGuideProfile(partial) {
    const next = writeProfile(partial);
    const app = getApp();
    app.globalData.userProfile = next;
    this.setData({
      guideAvatarUrl: displayAvatar(next),
      guideNickName: next.nickName,
    });
    return next;
  },
  onGuideChooseAvatar(event) {
    const tempPath = event.detail.avatarUrl;
    if (!tempPath) return;

    const fs = wx.getFileSystemManager();
    fs.saveFile({
      tempFilePath: tempPath,
      success: (res) => {
        this.persistGuideProfile({ avatarUrl: res.savedFilePath });
      },
      fail: () => {
        this.persistGuideProfile({ avatarUrl: tempPath });
      },
    });
  },
  onGuideAvatarError() {
    if (this.data.guideAvatarUrl === '/assets/icons/bean.png') return;
    this.setData({ guideAvatarUrl: '/assets/icons/bean.png' });
  },
  onGuideNicknameBlur(event) {
    const nickName = resolveNickNameUpdate(event.detail.value, this.data.guideNickName);
    if (!nickName || nickName === this.data.guideNickName) return;
    this.persistGuideProfile({ nickName });
  },
  finishProfileGuide() {
    const nickName = (this.data.guideNickName || '').trim();
    if (!nickName) {
      wx.showToast({ title: '请先确认昵称', icon: 'none' });
      return;
    }

    const next = this.persistGuideProfile({ nickName });
    if (!isProfileSynced(next)) {
      wx.showToast({ title: '请先确认昵称', icon: 'none' });
      return;
    }

    writeGuideSkipped(false);
    this.setData({ showProfileGuide: false });
    setTabBarHidden(this, false);
    wx.showToast({ title: '已同步，预约可直接使用', icon: 'success' });
  },
  skipProfileGuide() {
    writeGuideSkipped(true);
    this.setData({ showProfileGuide: false });
    setTabBarHidden(this, false);
  },
  preventMove() {},
  goAppointment() {
    wx.navigateTo({ url: '/pages/appointment/index' });
  },
  goRoute() {
    wx.navigateTo({ url: '/pages/route/index' });
  },
  goPackages() {
    wx.switchTab({ url: '/pages/packages/index' });
  },
  goActivities() {
    wx.switchTab({ url: '/pages/activities/index' });
  },
});
