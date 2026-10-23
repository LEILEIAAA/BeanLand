const api = require('../../utils/api');
const { createAppointmentSummary } = require('../../utils/business');
const {
  groupSeatsByTable,
  buildOccupancyUnion,
  getSeatUserStatus,
  assertCanBookSeats,
} = require('../../utils/seats');
const {
  toggleContiguousSelection,
  indexesToSlots,
  formatSlotSpan,
} = require('../../utils/timeSlots');
const { resolveTimeSlots } = require('../../utils/storePublic');
const {
  allowedRegisterDates,
  STATUS_LABEL,
  assertCanRegister,
} = require('../../utils/appointmentRegistration');
const {
  DEFAULT_AVATAR,
  ensureDefaultProfile,
  writeProfile,
  displayAvatar,
  isProfileSynced,
  appointmentNameFromProfile,
  resolveNickNameUpdate,
  needsSyncHints,
} = require('../../utils/wxProfile');
const { normalizePhone } = require('../../utils/memberProfile');
const {
  needsMemberRegister,
  openMemberRegister,
} = require('../../utils/memberRegisterGate');
const { buildAssignTimerUrl } = require('../../utils/appointmentAssign');

const sourceOptions = ['小程序', '美团', '小红书', '朋友圈', '楼内导流', '社群'];
const userStatusLabel = {
  available: '可约',
  booked: '已约',
  unavailable: '满',
};

function chinaToday() {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = china.getUTCFullYear();
  const m = String(china.getUTCMonth() + 1).padStart(2, '0');
  const d = String(china.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTodayDisplay(isoDate) {
  const parts = String(isoDate || '').split('-');
  if (parts.length !== 3) return isoDate;
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

function slotChipStates(allSlots, selectedIndexes) {
  const selected = new Set(selectedIndexes);
  return allSlots.map((label, index) => ({
    label,
    index,
    selected: selected.has(index),
  }));
}

function selectionMeta(selectedSeatIds) {
  if (!selectedSeatIds.length) return { selectedSeatLabel: '' };
  return { selectedSeatLabel: selectedSeatIds.join('、') };
}

function buildSeatGroups(seats, occupancies, date, selectedSlots, selectedSeatIds) {
  const occupancy = buildOccupancyUnion(occupancies, date, selectedSlots);
  const selected = new Set(selectedSeatIds);
  const groups = groupSeatsByTable(seats || []).map((group) => {
    const mappedSeats = group.seats.map((seat) => {
      const status = getSeatUserStatus(seat, occupancy);
      return {
        id: seat.id,
        index: seat.index,
        status,
        statusLabel: userStatusLabel[status],
        selected: selected.has(seat.id),
      };
    });
    return {
      tableCode: group.tableCode,
      area: group.area,
      hasSelected: mappedSeats.some((seat) => seat.selected),
      availableCount: mappedSeats.filter((seat) => seat.status === 'available').length,
      seats: mappedSeats,
    };
  });
  return { groups, occupancy };
}

const { shareBehavior } = require('../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    mode: 'register',
    appointmentId: '',
    timeSlots: [],
    slotChips: [],
    sourceOptions,
    sourceIndex: 0,
    selectedSlotIndexes: [],
    selectedSlotLabel: '',
    dateOptions: [],
    form: {
      name: '',
      phone: '',
      appointmentDate: '',
      peopleCount: 1,
      source: '小程序',
      agreed: false,
    },
    todayLabel: '',
    todayDisplay: '',
    profileSynced: false,
    showSyncHints: true,
    avatarUrl: DEFAULT_AVATAR,
    selectedSeatIds: [],
    selectedSeatLabel: '',
    canGoForm: false,
    selectProgress: 0,
    seatGroups: [],
    summary: null,
    submitting: false,
    memberReady: false,
  },

  async onLoad(query) {
    if (query.mode === 'assign') {
      let assignSlots = [];
      if (query.timeSlots) {
        assignSlots = String(query.timeSlots)
          .split(',')
          .map((s) => {
            try {
              return decodeURIComponent(s);
            } catch (error) {
              return s;
            }
          })
          .filter(Boolean);
      }
      wx.redirectTo({
        url: buildAssignTimerUrl({
          appointmentId: query.appointmentId || '',
          appointmentDate: query.appointmentDate || '',
          peopleCount: Number(query.peopleCount || 0),
          timeSlots: assignSlots,
        }),
      });
      return;
    }

    const mode = 'register';
    const today = chinaToday();
    const dates = allowedRegisterDates(today);
    const dateOptions = [
      { value: dates[0], label: `今天 ${formatTodayDisplay(dates[0])}` },
      { value: dates[1], label: `明天 ${formatTodayDisplay(dates[1])}` },
    ];

    let timeSlots = [];
    try {
      timeSlots = resolveTimeSlots(await api.getTimeSlots());
    } catch (error) {
      console.warn('[appointment] load time slots failed', error);
      timeSlots = resolveTimeSlots([]);
    }
    if (!timeSlots.length) {
      wx.showToast({ title: '时段加载失败', icon: 'none' });
    }

    const defaultSlot = Math.min(1, Math.max(0, timeSlots.length - 1));
    const selectedSlotIndexes = timeSlots.length ? [defaultSlot] : [];
    const appointmentDate = dates[0];
    const peopleCount = 1;
    const appointmentId = '';

    wx.setNavigationBarTitle({ title: '预约开拼' });

    this.setData({
      mode,
      appointmentId,
      timeSlots,
      dateOptions,
      selectedSlotIndexes,
      selectedSlotLabel: formatSlotSpan(indexesToSlots(timeSlots, selectedSlotIndexes)),
      slotChips: slotChipStates(timeSlots, selectedSlotIndexes),
      todayLabel: today,
      todayDisplay: formatTodayDisplay(appointmentDate),
      'form.appointmentDate': appointmentDate,
      'form.peopleCount': peopleCount,
    });

    this._skipNextShowGate = true;
    await this.ensureMemberGate();
    this.applyWxProfile();
    await this.prefillMemberPhone();
  },

  onShow() {
    if (this.data.mode !== 'register') return;
    this.applyWxProfile();
    if (this._skipNextShowGate) {
      this._skipNextShowGate = false;
      return;
    }
    this.ensureMemberGate();
  },

  async ensureMemberGate() {
    try {
      const res = await api.getMyMember();
      const member = res && res.member;
      if (needsMemberRegister(member, DEFAULT_AVATAR)) {
        const opened = openMemberRegister({ replace: true });
        this.setData({ memberReady: false });
        if (!opened) {
          wx.showToast({ title: '请先完成会员注册', icon: 'none' });
        }
        return false;
      }
      this.setData({ memberReady: true, _member: member });
      return true;
    } catch (error) {
      console.warn('[appointment] member gate', error);
      const opened = openMemberRegister({ replace: true });
      this.setData({ memberReady: false });
      if (!opened) {
        wx.showToast({ title: '请先完成会员注册', icon: 'none' });
      }
      return false;
    }
  },

  async prefillMemberPhone() {
    const member = this.data._member;
    if (member && member.phone) {
      this.setData({ 'form.phone': normalizePhone(member.phone) });
    }
  },

  applyWxProfile() {
    const profile = ensureDefaultProfile();
    const app = getApp();
    app.globalData.userProfile = profile;
    const nickName = appointmentNameFromProfile(profile);
    this.setData({
      profileSynced: isProfileSynced(profile),
      showSyncHints: needsSyncHints(profile),
      avatarUrl: displayAvatar(profile),
      'form.name': nickName || this.data.form.name,
    });
  },

  persistProfile(partial) {
    const next = writeProfile(partial, null, {
      avatarUrl: this.data.avatarUrl,
      nickName: this.data.form.name,
    });
    const app = getApp();
    app.globalData.userProfile = next;
    this.setData({
      profileSynced: isProfileSynced(next),
      showSyncHints: needsSyncHints(next),
      avatarUrl: displayAvatar(next),
      'form.name': next.nickName,
    });
  },

  onChooseAvatar(event) {
    const tempPath = event.detail.avatarUrl;
    if (!tempPath) return;
    const fs = wx.getFileSystemManager();
    fs.saveFile({
      tempFilePath: tempPath,
      success: (res) => this.persistProfile({ avatarUrl: res.savedFilePath }),
      fail: () => this.persistProfile({ avatarUrl: tempPath }),
    });
  },

  onAvatarError() {
    if (this.data.avatarUrl === '/assets/icons/bean.png') return;
    this.setData({ avatarUrl: '/assets/icons/bean.png' });
  },

  onNicknameBlur(event) {
    const nickName = resolveNickNameUpdate(event.detail.value, this.data.form.name);
    if (!nickName || nickName === this.data.form.name) return;
    this.setData({ 'form.name': nickName, summary: null });
    this.persistProfile({ nickName });
  },

  selectDate(event) {
    if (this.data.mode === 'assign') return;
    const value = event.currentTarget.dataset.value;
    this.setData({
      'form.appointmentDate': value,
      todayDisplay: formatTodayDisplay(value),
      summary: null,
    });
  },

  onSlotTap(event) {
    if (this.data.mode === 'assign') return;
    const slotIndex = Number(event.currentTarget.dataset.index);
    const result = toggleContiguousSelection(
      this.data.timeSlots,
      this.data.selectedSlotIndexes,
      slotIndex,
    );
    if (!result.ok) {
      wx.showToast({ title: result.reason || '请选择连续时段', icon: 'none' });
      return;
    }
    this.setData({
      selectedSlotIndexes: result.next,
      selectedSlotLabel: formatSlotSpan(indexesToSlots(this.data.timeSlots, result.next)),
      slotChips: slotChipStates(this.data.timeSlots, result.next),
      summary: null,
    });
  },

  changePeople(event) {
    if (this.data.mode === 'assign') return;
    const delta = Number(event.currentTarget.dataset.delta);
    const next = Math.min(6, Math.max(1, Number(this.data.form.peopleCount || 1) + delta));
    if (next === this.data.form.peopleCount) return;
    this.setData({ 'form.peopleCount': next, summary: null });
    if (this.data.mode === 'assign') {
      let selectedSeatIds = [...this.data.selectedSeatIds];
      if (selectedSeatIds.length > next) selectedSeatIds = selectedSeatIds.slice(0, next);
      this.refreshSeatMap(selectedSeatIds);
    }
  },

  onSourceChange(event) {
    const sourceIndex = Number(event.detail.value);
    this.setData({
      sourceIndex,
      'form.source': sourceOptions[sourceIndex],
      summary: null,
    });
  },

  updateField(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({ [`form.${field}`]: event.detail.value, summary: null });
  },

  toggleAgree(event) {
    this.setData({ 'form.agreed': event.detail.value.length > 0, summary: null });
  },

  selectedSlots() {
    return indexesToSlots(this.data.timeSlots, this.data.selectedSlotIndexes);
  },

  async loadOccupancies(date, slots) {
    const rows = [];
    for (const timeSlot of slots) {
      try {
        const part = await api.getOccupancies(date, timeSlot);
        rows.push(...(part || []));
      } catch (error) {
        console.warn('[appointment] occupancies', error);
      }
    }
    return rows;
  },

  async refreshSeatMap(selectedSeatIds = this.data.selectedSeatIds) {
    const peopleCount = Number(this.data.form.peopleCount || 1);
    const selectedSlots = this.selectedSlots();
    const date = this.data.form.appointmentDate;
    let seats = [];
    try {
      seats = (await api.getSeats()) || [];
    } catch (error) {
      seats = [];
    }
    const occupancies = await this.loadOccupancies(date, selectedSlots);
    const { groups } = buildSeatGroups(
      seats,
      occupancies,
      date,
      selectedSlots,
      selectedSeatIds,
    );
    const meta = selectionMeta(selectedSeatIds);
    this._seatsCache = seats;
    this._occupancyCache = occupancies;
    this.setData({
      seatGroups: groups,
      selectedSeatIds,
      selectedSeatLabel: meta.selectedSeatLabel,
      selectedSlotLabel: formatSlotSpan(selectedSlots),
      canGoForm: selectedSeatIds.length === peopleCount,
      selectProgress: Math.min(100, Math.round((selectedSeatIds.length / peopleCount) * 100)),
    });
  },

  clearSelection() {
    this.refreshSeatMap([]);
  },

  onSeatTap(event) {
    if (this.data.mode !== 'assign') return;
    const { seatId, status } = event.currentTarget.dataset;
    if (status !== 'available') {
      wx.showToast({ title: status === 'booked' ? '该座位已约' : '该座位不可选', icon: 'none' });
      return;
    }
    const peopleCount = Number(this.data.form.peopleCount || 1);
    let next = [...this.data.selectedSeatIds];
    const exists = next.indexOf(seatId);
    if (exists >= 0) {
      next.splice(exists, 1);
      this.refreshSeatMap(next);
      return;
    }
    if (next.length >= peopleCount) {
      next[next.length - 1] = seatId;
      this.refreshSeatMap(next);
      wx.showToast({ title: '已替换最后一个座位', icon: 'none' });
      return;
    }
    next.push(seatId);
    this.refreshSeatMap(next);
  },

  async submitRegister() {
    if (!this.data.memberReady) {
      const ready = await this.ensureMemberGate();
      if (!ready) return;
    }
    const form = this.data.form;
    const timeSlots = this.selectedSlots();
    const check = assertCanRegister({
      appointmentDate: form.appointmentDate,
      today: this.data.todayLabel,
      timeSlots,
      peopleCount: form.peopleCount,
      name: form.name,
      phone: form.phone,
      source: form.source,
    });
    if (!check.ok) {
      wx.showToast({ title: check.reason, icon: 'none' });
      return;
    }
    if (!form.agreed) {
      wx.showToast({ title: '请先了解预约说明', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const result = await api.createAppointment({
        appointmentDate: form.appointmentDate,
        timeSlots,
        peopleCount: Number(form.peopleCount),
        name: String(form.name || '').trim(),
        phone: form.phone,
        source: form.source,
      });
      if (!result || !result.ok) {
        wx.showToast({
          title: (result && result.message) || '提交失败',
          icon: 'none',
        });
        return;
      }
      this.persistProfile({ nickName: String(form.name || '').trim() });
      const summary = createAppointmentSummary({
        name: form.name,
        packageName: '开拼预约',
        appointmentDate: form.appointmentDate,
        timeSlots,
        peopleCount: form.peopleCount,
        durationMinutes: timeSlots.length * 120,
        seatIds: [],
        tableCode: '',
      });
      summary.statusLabel = STATUS_LABEL.pending;
      this.setData({ summary });
      wx.showToast({ title: '已提交，待店主确认', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async submitAssign() {
    const peopleCount = Number(this.data.form.peopleCount || 1);
    const selectedSeatIds = this.data.selectedSeatIds;
    const seats = this._seatsCache || [];
    const selectedSlots = this.selectedSlots();
    const occupancy = buildOccupancyUnion(
      this._occupancyCache || [],
      this.data.form.appointmentDate,
      selectedSlots,
    );
    const book = assertCanBookSeats({
      seats,
      seatIds: selectedSeatIds,
      peopleCount,
      bookedSeatIds: occupancy.bookedSeatIds,
      inUseSeatIds: occupancy.inUseSeatIds,
      maintenanceIds: occupancy.maintenanceIds,
    });
    if (!book.ok) {
      wx.showToast({ title: book.reason || '请重新选座', icon: 'none' });
      return;
    }
    if (!this.data.appointmentId) {
      wx.showToast({ title: '缺少预约 ID', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const result = await api.adminUpdateAppointment({
        appointmentId: this.data.appointmentId,
        action: 'confirm',
        seatIds: selectedSeatIds,
      });
      if (!result || !result.ok) {
        wx.showToast({
          title: (result && result.message) || '确认失败',
          icon: 'none',
        });
        return;
      }
      wx.showToast({ title: '已确认排座', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack({ fail: () => {
          wx.redirectTo({ url: '/pages/admin/appointments/index' });
        } });
      }, 400);
    } catch (error) {
      wx.showToast({ title: '确认失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  submit() {
    if (this.data.submitting) return;
    if (this.data.mode === 'assign') {
      this.submitAssign();
      return;
    }
    this.submitRegister();
  },
});
