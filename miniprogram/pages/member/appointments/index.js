const MERCHANT_PHONE = '18267171841';

function resolveStorePhone(raw) {
  const phone = String(raw || '').trim();
  if (!phone || phone === '待填写') return MERCHANT_PHONE;
  return phone;
}

const api = require('../../../utils/api');
const { STATUS_LABEL } = require('../../../utils/appointmentRegistration');
const { formatSlotSpan } = require('../../../utils/timeSlots');

function displayRow(item) {
  const slots = Array.isArray(item.timeSlots) && item.timeSlots.length
    ? item.timeSlots
    : item.timeSlot
      ? [item.timeSlot]
      : [];
  const timeLabel = slots.length > 1 ? formatSlotSpan(slots) : (slots[0] || '');
  const status = item.status || 'pending';
  const rejectReason = String(item.rejectReason || '').trim();
  return {
    id: item._id || item.id,
    title: '开拼预约',
    date: item.appointmentDate || '',
    timeSlot: timeLabel,
    peopleCount: item.peopleCount || 0,
    status,
    statusLabel: STATUS_LABEL[status] || status,
    rejectReason,
    showRejectReason: status === 'rejected' && !!rejectReason,
    canCancel: status === 'pending',
    showContactCancel: status === 'confirmed',
  };
}

Page({
  data: {
    appointments: [],
    loading: false,
    storePhone: MERCHANT_PHONE,
  },

  onShow() {
    this.loadStorePhone();
    this.loadList();
  },

  async loadStorePhone() {
    try {
      const store = await api.getStore();
      this.setData({ storePhone: resolveStorePhone(store && store.phone) });
    } catch (error) {
      this.setData({ storePhone: MERCHANT_PHONE });
    }
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const list = await api.listMyAppointments();
      this.setData({ appointments: (list || []).map(displayRow) });
    } catch (error) {
      console.warn('[member-appointments]', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async cancel(event) {
    const id = event.currentTarget.dataset.id;
    const { confirm } = await new Promise((resolve) => {
      wx.showModal({
        title: '取消预约',
        content: '确认取消这条待商家确认预约？',
        success: resolve,
        fail: () => resolve({ confirm: false }),
      });
    });
    if (!confirm) return;
    try {
      const result = await api.cancelAppointment({ appointmentId: id });
      if (!result || !result.ok) {
        wx.showToast({ title: (result && result.message) || '取消失败', icon: 'none' });
        return;
      }
      wx.showToast({ title: '已取消', icon: 'success' });
      this.loadList();
    } catch (error) {
      wx.showToast({ title: '取消失败', icon: 'none' });
    }
  },

  contactCancel() {
    const phone = resolveStorePhone(this.data.storePhone);
    wx.showModal({
      title: '联系商家取消',
      content: `请致电商家说明取消预约：\n${phone}`,
      confirmText: '拨打',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({ phoneNumber: phone });
        }
      },
    });
  },

  goBook() {
    wx.navigateTo({ url: '/pages/appointment/index' });
  },
});
