const api = require('../../../utils/api');
const { planHomeBannerCloudSync, MAX_BANNERS } = require('../../../utils/homeBanners');
const {
  isMediaPickCancel,
  describeMediaPickError,
} = require('../../../utils/mediaPickError');

Page({
  data: {
    banners: [],
    maxBanners: MAX_BANNERS,
    loading: true,
    saving: false,
  },
  onLoad() {
    this.loadBanners();
  },
  async loadBanners() {
    this.setData({ loading: true });
    let banners = [];
    try {
      const heroPhotos = await api.getHomeBanners();
      const planned = planHomeBannerCloudSync(heroPhotos);
      banners = planned.banners;
      if (planned.needsSync) {
        const res = await api.adminSaveHomeBanners({ action: 'save', banners });
        if (!res || !res.ok) {
          console.warn('[admin-home-banners] sync defaults failed', res);
          wx.showToast({
            title: (res && res.message) || '默认同步失败',
            icon: 'none',
          });
        }
      }
    } catch (error) {
      console.warn('[admin-home-banners] load failed', error);
    }
    this.setData({ banners, loading: false });
  },
  onCaptionInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    this.setData({ [`banners[${index}].caption`]: event.detail.value });
  },
  onChooseImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    // chooseMedia 必须同步跟手；前面不能 await。
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (choose) => {
        this.uploadChosenBanner(index, choose);
      },
      fail: (error) => {
        if (isMediaPickCancel(error)) return;
        console.warn('[admin-home-banners] chooseMedia failed', error);
        wx.showToast({ title: describeMediaPickError(error), icon: 'none', duration: 2500 });
      },
    });
  },
  async uploadChosenBanner(index, choose) {
    const file = choose && choose.tempFiles && choose.tempFiles[0];
    if (!file || !file.tempFilePath) return;
    wx.showLoading({ title: '上传中', mask: true });
    try {
      const cloudPath = `home-banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath,
          filePath: file.tempFilePath,
          success: resolve,
          fail: reject,
        });
      });
      wx.hideLoading();
      if (!up || !up.fileID) {
        wx.showToast({ title: '上传失败', icon: 'none' });
        return;
      }
      this.setData({ [`banners[${index}].src`]: up.fileID });
      wx.showToast({ title: '图片已上传', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      console.warn('[admin-home-banners] upload failed', error);
      wx.showToast({ title: describeMediaPickError(error, 'upload'), icon: 'none' });
    }
  },
  onMoveUp(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index) || index <= 0) return;
    const banners = this.data.banners.slice();
    [banners[index - 1], banners[index]] = [banners[index], banners[index - 1]];
    this.setData({ banners });
  },
  onMoveDown(event) {
    const index = Number(event.currentTarget.dataset.index);
    const banners = this.data.banners.slice();
    if (!Number.isFinite(index) || index >= banners.length - 1) return;
    [banners[index + 1], banners[index]] = [banners[index], banners[index + 1]];
    this.setData({ banners });
  },
  onRemove(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    const banners = this.data.banners.slice();
    banners.splice(index, 1);
    this.setData({ banners });
  },
  onAdd() {
    if (this.data.banners.length >= MAX_BANNERS) {
      wx.showToast({ title: `最多 ${MAX_BANNERS} 张`, icon: 'none' });
      return;
    }
    const banners = this.data.banners.concat([{ src: '', caption: '' }]);
    this.setData({ banners });
  },
  async onSave() {
    if (this.data.saving) return;
    const banners = (this.data.banners || []).filter((item) => item && item.src);
    if (!banners.length) {
      wx.showToast({ title: '至少配置一张轮播图', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中', mask: true });
    try {
      const res = await api.adminSaveHomeBanners({ action: 'save', banners });
      wx.hideLoading();
      if (!res || !res.ok) {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' });
        return;
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
