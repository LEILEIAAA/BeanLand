const api = require('../../../utils/api');
const { msToChinaDateTime } = require('../../../utils/adminContentForm');
const { formatYuan } = require('../../../utils/money');

const STATUS_LABEL = {
  recruiting: '招募中',
  consulting: '咨询中',
  full: '已满员',
  ended: '已结束',
  cancelled: '已取消',
  draft: '未发布',
  available: '可预约',
};

function decorate(row) {
  const onShelf = !(row && row.onShelf === false);
  const dt = msToChinaDateTime(row.startAt);
  const timeText = dt.date ? `${dt.date} ${dt.time}` : (row.scheduleText || '档期待定');
  return {
    ...row,
    docId: row._id,
    onShelf,
    priceText: formatYuan(row.price),
    statusLabel: STATUS_LABEL[row.status] || row.status || '',
    startText: timeText,
    seatLabel: `${Number(row.registeredCount || 0)}/${Number(row.capacity || 0)}`,
    shelfLabel: onShelf ? '已上架' : '已下架',
    shelfTone: onShelf ? 'on' : 'off',
  };
}

Page({
  data: {
    list: [],
    loading: true,
    busy: false,
  },
  onShow() {
    this.loadList();
  },
  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await api.adminListActivities({});
      if (!res || !res.ok) {
        wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' });
        this.setData({ list: [] });
        return;
      }
      this.setData({ list: (res.list || []).map(decorate) });
    } catch (error) {
      console.warn('[admin-activities]', error);
      this.setData({ list: [] });
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  goPageConfig() {
    wx.navigateTo({ url: '/pages/admin/activities/page-config' });
  },
  goCreate() {
    wx.navigateTo({ url: '/pages/admin/activities/edit' });
  },
  goEdit(event) {
    const docId = event.currentTarget.dataset.id;
    if (!docId) return;
    wx.navigateTo({ url: `/pages/admin/activities/edit?docId=${docId}` });
  },
  async toggleShelf(event) {
    if (this.data.busy) return;
    const { id, onshelf } = event.currentTarget.dataset;
    if (!id) return;
    const nextOnShelf = !(onshelf === true || onshelf === 'true');
    this.setData({ busy: true });
    try {
      const res = await api.adminSaveActivity({
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
        title: '删除活动',
        content: `确认删除「${name || '该活动'}」？删除后不可恢复。`,
        confirmText: '删除',
        confirmColor: '#dc2626',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false),
      });
    });
    if (!confirm) return;
    this.setData({ busy: true });
    try {
      const res = await api.adminSaveActivity({ action: 'delete', docId: id });
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
