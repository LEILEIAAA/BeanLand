const api = require('../../../utils/api');
const {
  STATUS_LABEL,
  REJECT_REASON_PRESETS,
  REJECT_REASON_MAX_LEN,
  assertRejectReason,
} = require('../../../utils/appointmentRegistration');
const { formatSlotSpan } = require('../../../utils/timeSlots');
const { buildAssignTimerUrl } = require('../../../utils/appointmentAssign');
const {
  ADMIN_APPOINTMENT_FILTER_TABS,
  DEFAULT_ADMIN_APPOINTMENT_FILTER,
  filterAdminAppointments,
} = require('../../../utils/adminAppointmentFilter');

function displayRow(item) {
  const slots = Array.isArray(item.timeSlots) && item.timeSlots.length
    ? item.timeSlots
    : item.timeSlot
      ? [item.timeSlot]
      : [];
  const timeLabel = slots.length > 1 ? formatSlotSpan(slots) : (slots[0] || item.timeSlot || '');
  const status = item.status || 'pending';
  const seatIds = Array.isArray(item.seatIds) ? item.seatIds : [];
  const rejectReason = String(item.rejectReason || '').trim();
  return {
    id: item._id || item.id,
    memberId: item.memberId || '',
    name: item.name || '会员',
    phone: item.phone || '',
    people: item.peopleCount || 0,
    source: item.source || '',
    date: item.appointmentDate || '',
    time: timeLabel,
    timeSlots: slots,
    status,
    statusLabel: STATUS_LABEL[status] || status,
    tableCode: item.tableCode || '',
    seatLabel: seatIds.join('、'),
    seatIds,
    rejectReason,
    showRejectReason: status === 'rejected' && !!rejectReason,
    canConfirm: status === 'pending',
    canReject: status === 'pending',
    canOpen: status === 'confirmed' && seatIds.length > 0,
    canAdminCancel: status === 'confirmed',
  };
}

function applyFilter(allAppointments, statusFilter) {
  return filterAdminAppointments(allAppointments, statusFilter);
}

Page({
  data: {
    loading: true,
    allAppointments: [],
    appointments: [],
    filterTabs: ADMIN_APPOINTMENT_FILTER_TABS,
    statusFilter: DEFAULT_ADMIN_APPOINTMENT_FILTER,
    rejectSheetOpen: false,
    rejectTargetId: '',
    rejectTargetLabel: '',
    rejectReason: '',
    rejectPresets: REJECT_REASON_PRESETS,
    rejectMaxLen: REJECT_REASON_MAX_LEN,
    rejectSubmitting: false,
  },

  onShow() {
    this.loadList();
  },

  onFilterChange(event) {
    const key = event.currentTarget.dataset.key;
    if (!key || key === this.data.statusFilter) return;
    this.setData({
      statusFilter: key,
      appointments: applyFilter(this.data.allAppointments, key),
    });
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const list = await api.adminListAppointments({});
      const allAppointments = (list || []).map(displayRow);
      const statusFilter = this.data.statusFilter || DEFAULT_ADMIN_APPOINTMENT_FILTER;
      this.setData({
        allAppointments,
        appointments: applyFilter(allAppointments, statusFilter),
        statusFilter,
      });
    } catch (error) {
      console.warn('[admin-appointments]', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goConfirm(event) {
    const id = event.currentTarget.dataset.id;
    const row = this.data.appointments.find((item) => item.id === id);
    if (!row) return;
    wx.navigateTo({
      url: buildAssignTimerUrl({
        appointmentId: id,
        appointmentDate: row.date,
        peopleCount: row.people,
        timeSlots: row.timeSlots,
      }),
    });
  },

  reject(event) {
    const id = event.currentTarget.dataset.id;
    const row = this.data.appointments.find((item) => item.id === id);
    if (!row) return;
    this.setData({
      rejectSheetOpen: true,
      rejectTargetId: id,
      rejectTargetLabel: `${row.name} · ${row.date} ${row.time}`,
      rejectReason: '',
      rejectSubmitting: false,
    });
  },

  closeRejectSheet() {
    if (this.data.rejectSubmitting) return;
    this.setData({
      rejectSheetOpen: false,
      rejectTargetId: '',
      rejectTargetLabel: '',
      rejectReason: '',
    });
  },

  noop() {},

  selectRejectPreset(event) {
    const reason = event.currentTarget.dataset.reason || '';
    this.setData({ rejectReason: reason });
  },

  onRejectReasonInput(event) {
    this.setData({ rejectReason: event.detail.value || '' });
  },

  async confirmReject() {
    if (this.data.rejectSubmitting) return;
    const appointmentId = this.data.rejectTargetId;
    const gate = assertRejectReason(this.data.rejectReason);
    if (!gate.ok) {
      wx.showToast({ title: gate.reason, icon: 'none' });
      return;
    }
    this.setData({ rejectSubmitting: true });
    try {
      const result = await api.adminUpdateAppointment({
        appointmentId,
        action: 'reject',
        rejectReason: gate.rejectReason,
      });
      if (!result || !result.ok) {
        wx.showToast({ title: (result && result.message) || '操作失败', icon: 'none' });
        return;
      }
      this.setData({
        rejectSheetOpen: false,
        rejectTargetId: '',
        rejectTargetLabel: '',
        rejectReason: '',
      });
      wx.showToast({ title: '已拒绝', icon: 'success' });
      this.loadList();
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      this.setData({ rejectSubmitting: false });
    }
  },

  async adminCancel(event) {
    const id = event.currentTarget.dataset.id;
    const row = this.data.appointments.find((item) => item.id === id);
    if (!row) return;
    const { confirm } = await new Promise((resolve) => {
      wx.showModal({
        title: '用户取消',
        content: `确认取消 ${row.name} 的已确认预约？座位占用将释放。`,
        success: resolve,
        fail: () => resolve({ confirm: false }),
      });
    });
    if (!confirm) return;
    try {
      const result = await api.adminUpdateAppointment({
        appointmentId: id,
        action: 'adminCancel',
      });
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

  goOpen(event) {
    const id = event.currentTarget.dataset.id;
    const row = this.data.appointments.find((item) => item.id === id);
    if (!row) return;
    if (!row.memberId) {
      wx.showToast({ title: '缺少会员信息，请在座位管理手动选会员', icon: 'none' });
    }
    const seatIds = (row.seatIds || []).map(encodeURIComponent).join(',');
    const label = encodeURIComponent(
      `${row.name || '会员'}${row.phone ? ` · ${row.phone}` : ''}`,
    );
    wx.navigateTo({
      url:
        `/pages/admin/timer/index` +
        `?appointmentId=${encodeURIComponent(id)}` +
        `&memberId=${encodeURIComponent(row.memberId || '')}` +
        `&seatIds=${seatIds}` +
        `&memberLabel=${label}`,
    });
  },

  goTimer() {
    wx.navigateTo({ url: '/pages/admin/timer/index' });
  },
});
