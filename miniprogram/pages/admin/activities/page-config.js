const api = require('../../../utils/api');
const {
  normalizeActivityPageConfig,
  MAX_SCHEDULE_ITEMS,
} = require('../../../utils/activityPageConfig');

function activityLabel(row) {
  const id = (row && (row.id || row._id)) || '';
  const name = (row && row.name) || '';
  const tag = (row && (row.scheduleText || row.blurb)) || '';
  const base = name || id || '未命名活动';
  // 同名散场日等靠 scheduleText/blurb 区分
  return tag && tag !== base ? `${base} · ${tag}` : base;
}

Page({
  data: {
    loading: true,
    saving: false,
    maxItems: MAX_SCHEDULE_ITEMS,
    hero: { title: '', subtitle: '', content: '' },
    scheduleTitle: '',
    items: [],
    activityOptions: [],
    activityNames: [],
  },
  onLoad() {
    this.loadAll();
  },
  async loadAll() {
    this.setData({ loading: true });
    let config = normalizeActivityPageConfig(null);
    let activityOptions = [];
    try {
      const listRes = await api.adminListActivities({});
      if (listRes && listRes.ok && Array.isArray(listRes.list)) {
        activityOptions = listRes.list.map((row) => ({
          id: (row.id || row._id) || '',
          name: activityLabel(row),
        }));
      }
    } catch (error) {
      console.warn('[admin-activity-page-config] activities load failed', error);
    }
    try {
      const pageConfig = await api.getActivityPageConfig();
      if (pageConfig && pageConfig.activitiesPage) {
        config = normalizeActivityPageConfig(pageConfig.activitiesPage);
      }
    } catch (error) {
      console.warn('[admin-activity-page-config] config load failed', error);
    }
    const nameById = {};
    activityOptions.forEach((opt) => {
      if (opt.id) nameById[opt.id] = opt.name;
    });
    const items = config.schedule.items.map((item) => ({
      day: item.day,
      activityId: item.activityId,
      activityName: nameById[item.activityId] || '（活动已删除）',
    }));
    this.setData({
      loading: false,
      hero: config.hero,
      scheduleTitle: config.schedule.title,
      items,
      activityOptions,
      activityNames: activityOptions.map((opt) => opt.name),
    });
  },
  onHeroInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`hero.${field}`]: event.detail.value });
  },
  onScheduleTitleInput(event) {
    this.setData({ scheduleTitle: event.detail.value });
  },
  onDayInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    this.setData({ [`items[${index}].day`]: event.detail.value });
  },
  onPickActivity(event) {
    const index = Number(event.currentTarget.dataset.index);
    const optIndex = Number(event.detail.value);
    const option = this.data.activityOptions[optIndex];
    if (!Number.isFinite(index) || !option) return;
    this.setData({
      [`items[${index}].activityId`]: option.id,
      [`items[${index}].activityName`]: option.name,
    });
  },
  onMoveUp(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index) || index <= 0) return;
    const items = this.data.items.slice();
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    this.setData({ items });
  },
  onMoveDown(event) {
    const index = Number(event.currentTarget.dataset.index);
    const items = this.data.items.slice();
    if (!Number.isFinite(index) || index >= items.length - 1) return;
    [items[index + 1], items[index]] = [items[index], items[index + 1]];
    this.setData({ items });
  },
  onRemove(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    const items = this.data.items.slice();
    items.splice(index, 1);
    this.setData({ items });
  },
  onAddPick(event) {
    if (this.data.items.length >= this.data.maxItems) {
      wx.showToast({ title: `最多 ${this.data.maxItems} 项`, icon: 'none' });
      return;
    }
    const option = this.data.activityOptions[Number(event.detail.value)];
    if (!option) return;
    const items = this.data.items.concat([
      { day: '', activityId: option.id, activityName: option.name },
    ]);
    this.setData({ items });
  },
  onAddEmpty() {
    wx.showToast({ title: '请先在活动配置中创建活动', icon: 'none' });
  },
  async onSave() {
    if (this.data.saving) return;
    const items = (this.data.items || []).filter((item) => item && item.activityId);
    const config = {
      hero: {
        title: this.data.hero.title,
        subtitle: this.data.hero.subtitle,
        content: this.data.hero.content,
      },
      schedule: {
        title: this.data.scheduleTitle,
        items: items.map((item) => ({ day: item.day, activityId: item.activityId })),
      },
    };
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中', mask: true });
    try {
      const res = await api.adminSaveActivityPageConfig({ action: 'save', config });
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
