const api = require('../../../utils/api');

// 角标配色预设，先保持两种，与云函数 PACKAGE_BADGE_COLORS 及会员页 ribbon 对齐。
const BADGE_COLOR_OPTIONS = [
  { value: 'orange', bg: 'linear-gradient(90deg,#ff3d02,#ff6a3d)' },
  { value: 'yellow', bg: 'linear-gradient(90deg,#ffb80a,#ffd35a)' },
];

const DEFAULT_FORM = {
  id: '',
  name: '',
  weekdayPrice: '',
  weekendPrice: '',
  targetAudience: '',
  durationMinutes: '',
  overtimeRule: '',
  includedItemsText: '',
  badge: '',
  badgeColorIndex: 0,
  skipOpeningDiscount: false,
  onShelf: true,
  sortOrder: '',
};

Page({
  data: {
    docId: '',
    isCreate: true,
    saving: false,
    badgeColorOptions: BADGE_COLOR_OPTIONS,
    form: { ...DEFAULT_FORM },
  },
  onLoad(options) {
    const docId = (options && options.docId) || '';
    if (!docId) {
      wx.setNavigationBarTitle({ title: '新建套餐' });
      this.setData({ isCreate: true, docId: '', form: { ...DEFAULT_FORM } });
      return;
    }
    wx.setNavigationBarTitle({ title: '编辑套餐' });
    this.setData({ isCreate: false, docId });
    this.loadDetail(docId);
  },
  async loadDetail(docId) {
    try {
      const res = await api.adminListPackages({});
      const row = ((res && res.list) || []).find((item) => item._id === docId);
      if (!row) {
        wx.showToast({ title: '套餐不存在', icon: 'none' });
        return;
      }
      this.setData({
        form: {
          id: row.id || '',
          name: row.name || '',
          weekdayPrice: row.weekdayPrice === undefined ? '' : String(row.weekdayPrice),
          weekendPrice: row.weekendPrice === undefined ? '' : String(row.weekendPrice),
          targetAudience: row.targetAudience || '',
          durationMinutes: row.durationMinutes === undefined ? '' : String(row.durationMinutes),
          overtimeRule: row.overtimeRule || '',
          includedItemsText: (row.includedItems || []).join('\n'),
          badge: row.badge || '',
          badgeColorIndex: Math.max(0, BADGE_COLOR_OPTIONS.findIndex((item) => item.value === row.badgeColor)),
          skipOpeningDiscount: !!row.skipOpeningDiscount,
          onShelf: !(row.onShelf === false),
          sortOrder: row.sortOrder === undefined ? '' : String(row.sortOrder),
        },
      });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },
  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },
  onSwitch(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },
  onBadgeColorTap(event) {
    const raw = event.currentTarget.dataset.index;
    const index = Number(raw);
    if (!Number.isFinite(index) || index < 0 || index >= BADGE_COLOR_OPTIONS.length) return;
    this.setData({ 'form.badgeColorIndex': index });
  },
  async onSave() {
    if (this.data.saving) return;
    const form = this.data.form;
    if (!String(form.name || '').trim()) {
      wx.showToast({ title: '请填写套餐名称', icon: 'none' });
      return;
    }
    const doc = {
      id: form.id,
      name: form.name,
      weekdayPrice: form.weekdayPrice,
      weekendPrice: form.weekendPrice,
      targetAudience: form.targetAudience,
      durationMinutes: form.durationMinutes,
      overtimeRule: form.overtimeRule,
      includedItems: form.includedItemsText,
      badge: form.badge,
      badgeColor: (BADGE_COLOR_OPTIONS[form.badgeColorIndex] || BADGE_COLOR_OPTIONS[0]).value,
      skipOpeningDiscount: form.skipOpeningDiscount,
      onShelf: form.onShelf,
      sortOrder: form.sortOrder,
    };
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中', mask: true });
    try {
      const payload = this.data.isCreate
        ? { action: 'create', doc }
        : { action: 'update', docId: this.data.docId, doc };
      const res = await api.adminSavePackage(payload);
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
