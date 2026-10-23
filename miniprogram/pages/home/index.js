const api = require('../../utils/api');
const {
  buildFeaturedPackages,
  buildFeaturedActivities,
} = require('../../utils/homeFeatured');
const { fallbackActivityCover } = require('../../utils/activityCover');
const { resolveHomeHeroPhotos, DEFAULT_HERO_PHOTOS } = require('../../utils/homeBanners');
const {
  buildHeroChangePatch,
  buildHeroDotPatch,
  buildHeroPhotosPatch,
} = require('../../utils/homeHeroSwiper');
const { resolvePublicStore, DEFAULT_STORE } = require('../../utils/storePublic');
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
const {
  needsMemberRegister,
  openMemberRegister,
} = require('../../utils/memberRegisterGate');
const { syncTabBar, setTabBarHidden } = require('../../utils/tabBar');

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

const { shareBehavior } = require('../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    store: {
      name: DEFAULT_STORE.name,
      slogan: DEFAULT_STORE.slogan,
      shortAddress: DEFAULT_STORE.shortAddress,
    },
    brandLetters: buildBrandLetters(DEFAULT_STORE.name),
    heroPhotos: DEFAULT_HERO_PHOTOS,
    heroIndex: 0,
    swiperCurrent: 0,
    heroCaption: DEFAULT_HERO_PHOTOS[0] ? DEFAULT_HERO_PHOTOS[0].caption : '',
    featuredPackages: [],
    activities: [],
    showProfileGuide: false,
    guideAvatarUrl: DEFAULT_AVATAR,
    guideNickName: '',
  },
  onShow() {
    syncTabBar(this, 0);
    this.refreshProfileGuide();
    this.loadStore();
    this.loadHeroPhotos();
    this.loadFeatured();
  },
  async loadStore() {
    try {
      const cloudStore = await api.getStore();
      const store = resolvePublicStore(cloudStore);
      this.setData({
        store: {
          name: store.name || '',
          slogan: store.slogan || '',
          shortAddress: store.shortAddress || '',
        },
        brandLetters: buildBrandLetters(store.name),
      });
    } catch (error) {
      console.warn('[home] load store failed', error);
      const store = resolvePublicStore(null);
      this.setData({
        store: {
          name: store.name || '',
          slogan: store.slogan || '',
          shortAddress: store.shortAddress || '',
        },
        brandLetters: buildBrandLetters(store.name),
      });
    }
  },
  async loadHeroPhotos() {
    try {
      const heroPhotos = await api.getHomeBanners();
      const banners = resolveHomeHeroPhotos(heroPhotos);
      this.setData(buildHeroPhotosPatch(banners, this.data.heroIndex));
    } catch (error) {
      console.warn('[home] load hero photos failed', error);
      const banners = resolveHomeHeroPhotos([]);
      this.setData(buildHeroPhotosPatch(banners, this.data.heroIndex));
    }
  },
  async loadFeatured() {
    let packageRows = [];
    let activityRows = [];
    try {
      const packages = await api.getPackages();
      if (Array.isArray(packages)) packageRows = packages;
    } catch (error) {
      console.warn('[home] load packages failed', error);
    }
    try {
      const activities = await api.getActivities();
      if (Array.isArray(activities)) activityRows = activities;
    } catch (error) {
      console.warn('[home] load activities failed', error);
    }
    this.setData({
      featuredPackages: buildFeaturedPackages(packageRows),
      activities: buildFeaturedActivities(activityRows),
    });
  },
  onActivityCoverError(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index) || index < 0) return;
    const list = this.data.activities || [];
    const row = list[index];
    if (!row) return;
    const nextCover = fallbackActivityCover(index, row.cover);
    if (!nextCover || nextCover === row.cover) return;
    this.setData({ [`activities[${index}].cover`]: nextCover });
  },
  onHeroChange(event) {
    const patch = buildHeroChangePatch(
      this.data.heroPhotos,
      this.data.heroIndex,
      event.detail.current
    );
    if (!patch) return;
    this.setData(patch);
  },
  onHeroDotTap(event) {
    const patch = buildHeroDotPatch(
      this.data.heroPhotos,
      this.data.heroIndex,
      event.currentTarget.dataset.index
    );
    if (!patch) return;
    // autoplay 只改 heroIndex，swiperCurrent 可能仍停在旧值；同值 setData 无法驱动跳转
    if (this.data.swiperCurrent === patch.swiperCurrent) {
      const nudge = patch.swiperCurrent === 0 ? 1 : patch.swiperCurrent - 1;
      this.setData({ swiperCurrent: nudge }, () => {
        this.setData(patch);
      });
      return;
    }
    this.setData(patch);
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
  async goAppointment() {
    try {
      const res = await api.getMyMember();
      const member = res && res.member;
      if (needsMemberRegister(member, DEFAULT_AVATAR)) {
        if (!openMemberRegister()) {
          wx.showToast({ title: '请先完成会员注册', icon: 'none' });
        }
        return;
      }
    } catch (error) {
      console.warn('[home] appointment gate', error);
      if (!openMemberRegister()) {
        wx.showToast({ title: '请先完成会员注册', icon: 'none' });
      }
      return;
    }
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
