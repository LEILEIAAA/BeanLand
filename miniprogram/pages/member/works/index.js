const api = require('../../../utils/api');
const { formatWorkDate, normalizeCaption } = require('../../../utils/worksView');

Page({
  data: {
    works: [],
    loading: true,
  },
  onShow() {
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const res = await api.listMyWorks({ limit: 50 });
      const list = (res && res.ok && Array.isArray(res.list) ? res.list : []).map((row) => ({
        ...row,
        dateLabel: formatWorkDate(row.createdAt),
      }));
      this.setData({ works: list });
    } catch (error) {
      console.warn('[works] load failed', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ works: [] });
    } finally {
      this.setData({ loading: false });
    }
  },
  onPreview(event) {
    const file = event.currentTarget.dataset.file;
    const urls = this.data.works.map((w) => w.imageFileID).filter(Boolean);
    wx.previewImage({ current: file, urls });
  },
  async onUpload() {
    try {
      const choose = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
      });
      const file = choose.tempFiles && choose.tempFiles[0];
      if (!file || !file.tempFilePath) return;

      wx.showLoading({ title: '上传中', mask: true });
      const cloudPath = `works/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await wx.cloud.uploadFile({
        cloudPath,
        filePath: file.tempFilePath,
      });
      const res = await api.createWork({
        imageFileID: up.fileID,
        caption: normalizeCaption(''),
      });
      wx.hideLoading();
      if (!res || !res.ok) {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' });
        return;
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      this.load();
    } catch (error) {
      wx.hideLoading();
      if (error && error.errMsg && /cancel/i.test(error.errMsg)) return;
      console.warn('[works] upload failed', error);
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },
  onDelete(event) {
    const workId = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除作品',
      content: '删除后不可恢复',
      success: async (modal) => {
        if (!modal.confirm) return;
        try {
          const res = await api.deleteWork({ workId });
          if (!res || !res.ok) {
            wx.showToast({ title: (res && res.message) || '删除失败', icon: 'none' });
            return;
          }
          wx.showToast({ title: '已删除', icon: 'success' });
          this.load();
        } catch (error) {
          console.warn('[works] delete failed', error);
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },
});
