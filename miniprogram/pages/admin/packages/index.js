const api = require('../../../utils/api');
const { formatYuan } = require('../../../utils/money');

function decorate(row) {
  const onShelf = !(row && row.onShelf === false);
  return {
    ...row,
    docId: row._id,
    onShelf,
    priceText: formatYuan(row.price),
    weekdayPriceText: formatYuan(row.weekdayPrice),
    weekendPriceText: formatYuan(row.weekendPrice),
    durationLabel: Number(row.durationMinutes) > 0 ? `${row.durationMinutes}分钟` : '不限时',
    shelfLabel: onShelf ? '已上架' : '已下架',
    shelfTone: onShelf ? 'on' : 'off',
  };
}

Page({
  data: {
    list: [],
    loading: true,
    loadedOnce: false,
    busy: false,
  },
  onLoad() {
    this._shouldRefreshList = true;
  },
  onShow() {
    if (this._shouldRefreshList) {
      this._shouldRefreshList = false;
      this.loadList();
    }
  },
  async loadList() {
    if (!this.data.loadedOnce) this.setData({ loading: true });
    try {
      const res = await api.adminListPackages({});
      if (!res || !res.ok) {
        wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' });
        this.setData({ list: [] });
        return;
      }
      this.setData({ list: (res.list || []).map(decorate) });
    } catch (error) {
      console.warn('[admin-packages]', error);
      this.setData({ list: [] });
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, loadedOnce: true });
    }
  },
  goCreate() {
    this._shouldRefreshList = true;
    wx.navigateTo({ url: '/pages/admin/packages/edit' });
  },
  goEdit(event) {
    const docId = event.currentTarget.dataset.id;
    if (!docId) return;
    this._shouldRefreshList = true;
    wx.navigateTo({ url: `/pages/admin/packages/edit?docId=${docId}` });
  },
  async toggleShelf(event) {
    if (this.data.busy) return;
    const { id, onshelf } = event.currentTarget.dataset;
    if (!id) return;
    const nextOnShelf = !(onshelf === true || onshelf === 'true');
    this.setData({ busy: true });
    try {
      const res = await api.adminSavePackage({
        action: 'setShelf',
        docId: id,
        onShelf: nextOnShelf,
      });
      if (!res || !res.ok) {
        wx.showToast({ title: (res && res.message) || '操作失败', icon: 'none' });
        return;
      }
      wx.showToast({ title: nextOnShelf ? '已上架' : '已下架', icon: 'success' });
      this.loadList();
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },
  async removeItem(event) {
    if (this.data.busy) return;
    const { id, name } = event.currentTarget.dataset;
    if (!id) return;
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '删除套餐',
        content: `确认删除「${name || '该套餐'}」？删除后不可恢复。`,
        confirmText: '删除',
        confirmColor: '#dc2626',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false),
      });
    });
    if (!confirm) return;
    this.setData({ busy: true });
    try {
      const res = await api.adminSavePackage({ action: 'delete', docId: id });
      if (!res || !res.ok) {
        wx.showToast({ title: (res && res.message) || '删除失败', icon: 'none' });
        return;
      }
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadList();
    } catch (error) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },
});
