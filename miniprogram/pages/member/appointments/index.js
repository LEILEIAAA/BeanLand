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
  return {
    id: item._id || item.id,
    title: '开拼预约',
    date: item.appointmentDate || '',
    timeSlot: timeLabel,
    peopleCount: item.peopleCount || 0,
    status,
    statusLabel: STATUS_LABEL[status] || status,
    canCancel: status === 'pending',
  };
}

Page({
  data: {
    appointments: [],
    loading: false,
  },

  onShow() {
    this.loadList();
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

  goBook() {
    wx.navigateTo({ url: '/pages/appointment/index' });
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
});
