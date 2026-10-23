const MERCHANT_PHONE = '15715719050';

function resolveStorePhone(raw) {
  const phone = String(raw || '').trim();
  if (!phone || phone === '待填写') return MERCHANT_PHONE;
  return phone;
}

const api = require('../../../utils/api');
const { STATUS_LABEL } = require('../../../utils/appointmentRegistration');
const { formatSlotSpan } = require('../../../utils/timeSlots');
const {
  STATUS,
  STATUS_LABEL: ACTIVITY_STATUS_LABEL,
  PAY_CHANNEL,
  assertUserCancelAllowed,
  calcCancelRefund,
  buildCancelConfirmContent,
} = require('../../../utils/activityRegistration');
const { formatYuan } = require('../../../utils/money');
const { buildScheduleHeaderCounts } = require('../../../utils/memberScheduleCount');
const { DEFAULT_AVATAR } = require('../../../utils/wxProfile');
const {
  needsMemberRegister,
  openMemberRegister,
} = require('../../../utils/memberRegisterGate');

const TAB = {
  APPOINTMENTS: 'appointments',
  ACTIVITIES: 'activities',
};

const TAB_ITEMS = [
  { key: TAB.APPOINTMENTS, label: '开拼预约' },
  { key: TAB.ACTIVITIES, label: '活动报名' },
];

function displayAppointmentRow(item) {
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

const { shareBehavior } = require('../../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    tabs: TAB_ITEMS,
    activeTab: TAB.APPOINTMENTS,
    appointments: [],
    activities: [],
    appointmentActiveCount: 0,
    activityActiveCount: 0,
    loading: true,
    storePhone: MERCHANT_PHONE,
  },

  onLoad(query) {
    const tab = query && query.tab;
    if (tab === TAB.ACTIVITIES || tab === TAB.APPOINTMENTS) {
      this.setData({ activeTab: tab });
    }
  },

  onShow() {
    this.loadStorePhone();
    this.loadAll();
  },

  onTabChange(event) {
    const tab = event.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
  },

  async loadStorePhone() {
    try {
      const store = await api.getStore();
      this.setData({ storePhone: resolveStorePhone(store && store.phone) });
    } catch (error) {
      this.setData({ storePhone: MERCHANT_PHONE });
    }
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const [appointmentList, activityRes] = await Promise.all([
        api.listMyAppointments().catch((error) => {
          console.warn('[member-schedule] appointments', error);
          return [];
        }),
        api.listMyActivityRegistrations().catch((error) => {
          console.warn('[member-schedule] activities', error);
          return null;
        }),
      ]);
      const rawAppointments = appointmentList || [];
      const activities = (((activityRes && activityRes.list) || [])).map((row) => ({
        ...row,
        statusLabel: ACTIVITY_STATUS_LABEL[row.status] || row.status,
        channelLabel: row.payChannel === PAY_CHANNEL.BALANCE ? '余额' : '在线支付',
        amountText: formatYuan(
          row.amount != null
            ? row.amount
            : Number(row.payAmountFen || 0) / 100,
        ),
      }));
      const headerCounts = buildScheduleHeaderCounts({
        appointments: rawAppointments,
        activities,
      });
      this.setData({
        appointments: rawAppointments.map(displayAppointmentRow),
        activities,
        appointmentActiveCount: headerCounts.appointmentActiveCount,
        activityActiveCount: headerCounts.activityActiveCount,
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async cancelAppointment(event) {
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
      this.loadAll();
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

  async goBook() {
    try {
      const res = await api.getMyMember();
      const member = res && res.member;
      if (needsMemberRegister(member, DEFAULT_AVATAR)) {
        if (!openMemberRegister()) {
          wx.showToast({ title: '请先完成会员注册', icon: 'none' });
        }
        return;
      }
    } catch (error) {
      console.warn('[member-appointments] book gate', error);
      if (!openMemberRegister()) {
        wx.showToast({ title: '请先完成会员注册', icon: 'none' });
      }
      return;
    }
    wx.navigateTo({ url: '/pages/appointment/index' });
  },

  goBrowse() {
    wx.switchTab({ url: '/pages/activities/index' });
  },

  async cancelActivity(event) {
    const id = event.currentTarget.dataset.id;
    const row = this.data.activities.find((item) => item._id === id);
    if (!row || row.status !== STATUS.PAID) return;

    const gate = assertUserCancelAllowed(row, row.startAt, Date.now());
    if (!gate.ok) {
      wx.showToast({ title: gate.message || '不可取消', icon: 'none' });
      return;
    }
    const refund = calcCancelRefund(row, gate.policy);
    const refundTip = buildCancelConfirmContent(gate.policy, refund);
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '取消报名？',
        content: refundTip,
        success: (res) => resolve(!!res.confirm),
      });
    });
    if (!confirm) return;

    wx.showLoading({ title: '取消中', mask: true });
    try {
      const result = await api.cancelActivityRegistration({ registrationId: id });
      wx.hideLoading();
      if (!result || !result.ok) {
        wx.showToast({ title: (result && result.message) || '取消失败', icon: 'none' });
        return;
      }
      if (result.refundPending) {
        wx.showToast({ title: '退款处理中，请稍后', icon: 'none' });
      } else {
        wx.showToast({ title: refundTip, icon: 'none' });
      }
      this.loadAll();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '取消失败', icon: 'none' });
    }
  },
});
