const api = require('../../../utils/api');
const { chinaDateTimeToMs, msToChinaDateTime } = require('../../../utils/adminContentForm');
const {
  isMediaPickCancel,
  describeMediaPickError,
} = require('../../../utils/mediaPickError');

const STATUS_OPTIONS = [
  { value: 'recruiting', label: '招募中' },
  { value: 'consulting', label: '咨询中' },
  { value: 'full', label: '已满员' },
  { value: 'ended', label: '已结束' },
  { value: 'cancelled', label: '已取消' },
  { value: 'draft', label: '未发布' },
];

// 角标配色预设，与云函数 ACCENT_THEMES 对齐；选择器样式对齐套餐 badge-dot。
const ACCENT_OPTIONS = [
  { value: 'yellow', bg: 'linear-gradient(90deg,#ffb80a,#ffd35a)' },
  { value: 'orange', bg: 'linear-gradient(90deg,#ff3d02,#ff6a3d)' },
  { value: 'green', bg: 'linear-gradient(90deg,#69d868,#8ee88d)' },
];

const DEFAULT_FORM = {
  id: '',
  name: '',
  price: '',
  capacity: '',
  statusIndex: 0,
  keyword: '',
  accentIndex: 0,
  blurb: '',
  startDate: '',
  startTime: '',
  scheduleText: '',
  timeText: '',
  audience: '',
  content: '',
  includesText: '',
  notice: '',
  sortOrder: '',
  onShelf: true,
  coverImage: '',
};

Page({
  data: {
    docId: '',
    isCreate: true,
    saving: false,
    statusOptions: STATUS_OPTIONS,
    statusLabels: STATUS_OPTIONS.map((item) => item.label),
    accentOptions: ACCENT_OPTIONS,
    form: { ...DEFAULT_FORM },
  },
  onLoad(options) {
    const docId = (options && options.docId) || '';
    if (!docId) {
      wx.setNavigationBarTitle({ title: '新建活动' });
      this.setData({ isCreate: true, docId: '', form: { ...DEFAULT_FORM } });
      return;
    }
    wx.setNavigationBarTitle({ title: '编辑活动' });
    this.setData({ isCreate: false, docId });
    this.loadDetail(docId);
  },
  async loadDetail(docId) {
    try {
      const res = await api.adminListActivities({});
      const row = ((res && res.list) || []).find((item) => item._id === docId);
      if (!row) {
        wx.showToast({ title: '活动不存在', icon: 'none' });
        return;
      }
      const dt = msToChinaDateTime(row.startAt);
      const statusIndex = Math.max(
        0,
        STATUS_OPTIONS.findIndex((item) => item.value === row.status),
      );
      const accentIdx = ACCENT_OPTIONS.findIndex((item) => item.value === row.accentTheme);
      const accentIndex = accentIdx >= 0 ? accentIdx : 0;
      this.setData({
        form: {
          id: row.id || '',
          name: row.name || '',
          price: row.price === undefined ? '' : String(row.price),
          capacity: row.capacity === undefined ? '' : String(row.capacity),
          statusIndex,
          keyword: row.keyword || '',
          accentIndex,
          blurb: row.blurb || '',
          startDate: dt.date,
          startTime: dt.time,
          scheduleText: row.scheduleText || '',
          timeText: row.timeText || '',
          audience: row.audience || '',
          content: row.content || '',
          includesText: (row.includes || []).join('\n'),
          notice: row.notice || '',
          sortOrder: row.sortOrder === undefined ? '' : String(row.sortOrder),
          onShelf: !(row.onShelf === false),
          coverImage: row.coverImage || '',
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
  onStatusChange(event) {
    this.setData({ 'form.statusIndex': Number(event.detail.value) });
  },
  onAccentTap(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isFinite(index)) this.setData({ 'form.accentIndex': index });
  },
  onDateChange(event) {
    this.setData({ 'form.startDate': event.detail.value });
  },
  onTimeChange(event) {
    this.setData({ 'form.startTime': event.detail.value });
  },
  // chooseMedia 必须在用户点击的同步调用栈里触发；前面不能 await，否则手势丢失会立刻 fail。
  onChooseCover() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (choose) => {
        this.uploadChosenCover(choose);
      },
      fail: (error) => {
        if (isMediaPickCancel(error)) return;
        console.warn('[activity-edit] chooseMedia failed', error);
        this.showMediaPickError(error);
      },
    });
  },
  showMediaPickError(error, stage) {
    const title = describeMediaPickError(error, stage);
    const msg = String((error && error.errMsg) || error || '');
    // toast 太短会截断，隐私/声明类用 modal 说清楚
    if (/privacy|隐私|scope is not declared|authorize|permission|权限/i.test(msg) || /隐私|权限|相册|相机/.test(title)) {
      wx.showModal({
        title: '无法选图',
        content: title + (msg ? `\n${msg}` : ''),
        showCancel: false,
      });
      return;
    }
    wx.showToast({ title, icon: 'none', duration: 2500 });
  },
  async uploadChosenCover(choose) {
    const file = choose && choose.tempFiles && choose.tempFiles[0];
    if (!file || !file.tempFilePath) return;
    wx.showLoading({ title: '上传中', mask: true });
    try {
      const extMatch = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(file.tempFilePath || '');
      const ext = (extMatch && extMatch[1] ? extMatch[1] : 'jpg').toLowerCase();
      const cloudPath = `activities/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
      this.setData({ 'form.coverImage': up.fileID });
      wx.showToast({ title: '封面已上传', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      console.warn('[activity-edit] cover upload failed', error);
      this.showMediaPickError(error, 'upload');
    }
  },
  onRemoveCover() {
    this.setData({ 'form.coverImage': '' });
  },
  async onSave() {
    if (this.data.saving) return;
    const form = this.data.form;
    if (!String(form.name || '').trim()) {
      wx.showToast({ title: '请填写活动名称', icon: 'none' });
      return;
    }
    const status = (STATUS_OPTIONS[form.statusIndex] || STATUS_OPTIONS[0]).value;
    const accentTheme = (ACCENT_OPTIONS[form.accentIndex] || ACCENT_OPTIONS[0]).value;
    const startAt = form.startDate ? chinaDateTimeToMs(form.startDate, form.startTime) : 0;
    const doc = {
      id: form.id,
      name: form.name,
      price: form.price,
      capacity: form.capacity,
      status,
      keyword: form.keyword,
      accentTheme,
      blurb: form.blurb,
      startAt,
      scheduleText: form.scheduleText,
      timeText: form.timeText,
      audience: form.audience,
      content: form.content,
      includes: form.includesText,
      notice: form.notice,
      sortOrder: form.sortOrder,
      onShelf: form.onShelf,
      coverImage: form.coverImage,
    };
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中', mask: true });
    try {
      const payload = this.data.isCreate
        ? { action: 'create', doc }
        : { action: 'update', docId: this.data.docId, doc };
      const res = await api.adminSaveActivity(payload);
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
