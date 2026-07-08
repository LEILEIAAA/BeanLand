const { packages, timeSlots } = require('../../data/seed');
const { createAppointmentSummary } = require('../../utils/business');

const sourceOptions = ['小程序', '美团', '小红书', '朋友圈', '楼内导流', '社群'];

Page({
  data: {
    packages,
    timeSlots,
    sourceOptions,
    packageIndex: 0,
    slotIndex: 0,
    sourceIndex: 0,
    form: {
      name: '',
      phone: '',
      wechat: '',
      note: '',
      appointmentDate: '2026-07-10',
      peopleCount: 1,
      source: '小程序',
      isMeituan: false,
      meituanCode: '',
      agreed: false,
    },
    summary: null,
  },
  onLoad(query) {
    if (query.packageId) {
      const packageIndex = this.data.packages.findIndex((item) => item.id === query.packageId);
      if (packageIndex >= 0) {
        this.setData({ packageIndex });
      }
    }
  },
  onPackageChange(event) {
    this.setData({ packageIndex: Number(event.detail.value), summary: null });
  },
  onSlotChange(event) {
    this.setData({ slotIndex: Number(event.detail.value), summary: null });
  },
  onSourceChange(event) {
    const sourceIndex = Number(event.detail.value);
    this.setData({ sourceIndex, 'form.source': sourceOptions[sourceIndex], summary: null });
  },
  updateField(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({ [`form.${field}`]: event.detail.value, summary: null });
  },
  toggleMeituan(event) {
    this.setData({ 'form.isMeituan': event.detail.value, summary: null });
  },
  toggleAgree(event) {
    this.setData({ 'form.agreed': event.detail.value.length > 0, summary: null });
  },
  submit() {
    const selectedPackage = this.data.packages[this.data.packageIndex];
    const selectedSlot = this.data.timeSlots[this.data.slotIndex];
    const form = this.data.form;

    if (!form.name || !form.phone || !form.agreed) {
      wx.showToast({ title: '请填写姓名、手机号并同意规则', icon: 'none' });
      return;
    }

    const phoneValid = /^1\d{10}$/.test(form.phone);
    if (!phoneValid) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }

    const summary = createAppointmentSummary({
      name: form.name,
      packageName: selectedPackage.name,
      appointmentDate: form.appointmentDate,
      timeSlot: selectedSlot,
      peopleCount: Number(form.peopleCount || 1),
      durationMinutes: selectedPackage.durationMinutes,
      isMeituan: form.isMeituan,
      meituanCode: form.meituanCode,
    });

    this.setData({ summary });
    wx.showToast({ title: '预约信息已生成', icon: 'success' });
  },
});
