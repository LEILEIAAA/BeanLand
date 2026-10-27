const api = require('../../utils/api');
const {
  chinaTodayIso,
  monthTitle,
  buildDateStrip,
} = require('../../utils/bookingCalendar');
const {
  BUSINESS_HOURS,
  SESSION_TYPES,
  buildHourSlots,
  toggleHour,
  slotsFromIndexes,
  resolveSession,
  hourTimelineStates,
  isHourSelectable,
  isAllDayAvailable,
  nowMinutesInChina,
  buildRedemptionCode,
  buildOrderNo,
} = require('../../utils/sessionPackages');
const {
  getFloors,
  getSeatMeta,
  allSeatIds,
  buildFloorView,
} = require('../../utils/seatMapLayout');
const { resolvePublicStore } = require('../../utils/storePublic');
const { DEFAULT_AVATAR } = require('../../utils/wxProfile');
const { normalizePhone } = require('../../utils/memberProfile');
const { needsMemberRegister, openMemberRegister } = require('../../utils/memberRegisterGate');
const { shareBehavior } = require('../../utils/share');

Page({
  behaviors: [shareBehavior],
  data: {
    monthTitle: '',
    dateStrip: [],
    selectedDate: '',
    floors: getFloors(),
    floorKey: 'F1',
    floorView: { tables: [], decor: [], seats: [], label: '', subtitle: '', image: '', aspect: 116 },
    selectedSeatIds: [],
    selectedLabel: '',
    store: {},
    businessHours: BUSINESS_HOURS,
    // 底部选时段弹层
    sheetOpen: false,
    timeline: [],
    sessionType: SESSION_TYPES.ALL_DAY,
    SESSION_ALL_DAY: SESSION_TYPES.ALL_DAY,
    SESSION_CUSTOM: SESSION_TYPES.CUSTOM,
    allDayAvailable: true,
    allDaySpan: '',
    hourCells: [],
    customIndexes: [],
    sessionLabel: '',
    sessionSpan: '',
    canSubmit: false,
    submitting: false,
    // 成功页
    success: null,
  },

  async onLoad() {
    this._localBookings = [];
    const today = chinaTodayIso();
    const dateStrip = buildDateStrip(today, 14, []);
    this.setData({
      selectedDate: today,
      monthTitle: monthTitle(today),
      dateStrip,
    });
    await this.loadStore();
    this.renderFloor();
    await this.loadBoard();
  },

  async loadStore() {
    let store = resolvePublicStore(null);
    try {
      const res = await api.getStore();
      if (res) store = resolvePublicStore(res);
    } catch (error) {
      // 用默认店铺信息兑底
    }
    this.setData({ store });
  },

  async loadBoard() {
    const date = this.data.selectedDate;
    let board = { seats: {}, maintenanceSeats: [] };
    try {
      const res = await api.getSeatBookingBoard({ date });
      if (res && res.ok) board = { seats: res.seats || {}, maintenanceSeats: res.maintenanceSeats || [] };
    } catch (error) {
      // 云函数未部署：空板，只显示本地乐观预约
    }
    this._board = board;
    this.renderFloor();
  },

  // 某座位当日已占用的整点集合（云端 + 本地乐观）
  seatBookedSlots(seatId) {
    const board = this._board || { seats: {} };
    const entry = (board.seats && board.seats[seatId]) || {};
    const set = new Set(Array.isArray(entry.bookedSlots) ? entry.bookedSlots : []);
    for (const local of this._localBookings || []) {
      if (local.date !== this.data.selectedDate) continue;
      if (!local.seatIds.includes(seatId)) continue;
      for (const s of local.slots) set.add(s);
    }
    return set;
  },

  maintenanceSet() {
    const board = this._board || { maintenanceSeats: [] };
    return new Set(board.maintenanceSeats || []);
  },

  // 所有座位里当日已约满的（没有任何可用整点）
  computeFullSet() {
    const hourSlots = buildHourSlots(this.data.businessHours.open, this.data.businessHours.close);
    const isToday = this.data.selectedDate === chinaTodayIso();
    const nowMin = isToday ? nowMinutesInChina() : -1;
    const full = new Set();
    for (const seatId of allSeatIds()) {
      const booked = this.seatBookedSlots(seatId);
      const hasFree = hourSlots.some((slot) => isHourSelectable(slot, { bookedSlotSet: booked, nowMin }));
      if (!hasFree) full.add(seatId);
    }
    return full;
  },

  renderFloor() {
    const fullSet = this.computeFullSet();
    const selectedSet = new Set(this.data.selectedSeatIds);
    const floorView = buildFloorView({
      floorKey: this.data.floorKey,
      fullSet,
      maintenanceSet: this.maintenanceSet(),
      selectedSet,
    });
    this.setData({
      floorView,
      selectedLabel: this.data.selectedSeatIds.join('、'),
    });
  },

  selectDate(event) {
    const value = event.currentTarget.dataset.iso;
    const row = this.data.dateStrip.find((d) => d.iso === value);
    if (row && row.isRest) {
      wx.showToast({ title: '当日店休', icon: 'none' });
      return;
    }
    if (!value || value === this.data.selectedDate) return;
    this.setData({
      selectedDate: value,
      monthTitle: monthTitle(value),
      selectedSeatIds: [],
      sheetOpen: false,
    });
    this.loadBoard();
  },

  selectFloor(event) {
    const key = event.currentTarget.dataset.key;
    if (!key || key === this.data.floorKey) return;
    this.setData({ floorKey: key, selectedSeatIds: [], sheetOpen: false });
    this.renderFloor();
  },

  onSeatTap(event) {
    const { id, status } = event.currentTarget.dataset;
    if (status === 'full') {
      wx.showToast({ title: '该座位当日已约满', icon: 'none' });
      return;
    }
    if (status === 'maintenance') {
      wx.showToast({ title: '该座位维护中', icon: 'none' });
      return;
    }
    const next = [...this.data.selectedSeatIds];
    const idx = next.indexOf(id);
    if (idx >= 0) next.splice(idx, 1);
    else next.push(id);
    this.setData({ selectedSeatIds: next });
    this.renderFloor();
  },

  clearSelection() {
    this.setData({ selectedSeatIds: [] });
    this.renderFloor();
  },

  // 选完座位 → 打开时段弹层
  openSessionSheet() {
    if (!this.data.selectedSeatIds.length) {
      wx.showToast({ title: '请先选座位', icon: 'none' });
      return;
    }
    const hourSlots = buildHourSlots(this.data.businessHours.open, this.data.businessHours.close);
    const bookedSet = new Set();
    for (const seatId of this.data.selectedSeatIds) {
      for (const s of this.seatBookedSlots(seatId)) bookedSet.add(s);
    }
    const isToday = this.data.selectedDate === chinaTodayIso();
    const nowMin = isToday ? nowMinutesInChina() : -1;
    const timeline = hourTimelineStates(hourSlots, { bookedSlotSet: bookedSet, nowMin });
    // 全天不限时：不管现在几点，锁定打烊前所有还没结束的整点；只要这些整点没被别人占用就能选
    const allDayAvailable = isAllDayAvailable(hourSlots, bookedSet, nowMin);
    const allDay = resolveSession(SESSION_TYPES.ALL_DAY, {
      open: this.data.businessHours.open,
      close: this.data.businessHours.close,
      nowMin,
    });
    this._hourSlots = hourSlots;
    this._bookedSet = bookedSet;
    this._nowMin = nowMin;
    this.setData({
      sheetOpen: true,
      timeline,
      allDayAvailable,
      allDaySpan: allDay.ok ? allDay.span : '',
      sessionType: allDayAvailable ? SESSION_TYPES.ALL_DAY : SESSION_TYPES.CUSTOM,
      customIndexes: [],
    });
    this.recomputeSheet();
  },

  closeSheet() {
    this.setData({ sheetOpen: false });
  },

  chooseSession(event) {
    const type = event.currentTarget.dataset.type;
    if (type === SESSION_TYPES.ALL_DAY && !this.data.allDayAvailable) {
      wx.showToast({ title: '所选座位当日有占用，请自选空闲时段', icon: 'none' });
      return;
    }
    this.setData({ sessionType: type });
    this.recomputeSheet();
  },

  onHourTap(event) {
    const index = Number(event.currentTarget.dataset.index);
    const slot = this._hourSlots[index];
    if (!isHourSelectable(slot, { bookedSlotSet: this._bookedSet, nowMin: this._nowMin })) {
      wx.showToast({ title: '该时段不可选', icon: 'none' });
      return;
    }
    const result = toggleHour(this._hourSlots, this.data.customIndexes, index);
    if (!result.ok) {
      wx.showToast({ title: result.reason || '请选连续时段', icon: 'none' });
      return;
    }
    this.setData({ sessionType: SESSION_TYPES.CUSTOM, customIndexes: result.next });
    this.recomputeSheet();
  },

  recomputeSheet() {
    const hourSlots = this._hourSlots || [];
    const customSlots = slotsFromIndexes(hourSlots, this.data.customIndexes);
    const resolved = resolveSession(this.data.sessionType, {
      open: this.data.businessHours.open,
      close: this.data.businessHours.close,
      customSlots,
      nowMin: this._nowMin,
    });
    const selectedSet = new Set(this.data.customIndexes.map(Number));
    const hourCells = hourSlots.map((slot, index) => {
      const startLabel = slot.split('-')[0];
      const selectable = isHourSelectable(slot, { bookedSlotSet: this._bookedSet, nowMin: this._nowMin });
      let state = 'free';
      if (this._bookedSet.has(slot)) state = 'booked';
      else if (!selectable) state = 'ended';
      return { index, slot, startLabel, state, selectable, selected: selectedSet.has(index) };
    });
    this.setData({
      hourCells,
      sessionLabel: resolved.ok ? resolved.label : '',
      sessionSpan: resolved.ok ? resolved.span : '',
      canSubmit: resolved.ok,
    });
  },

  async ensureMember() {
    try {
      const res = await api.getMyMember();
      const member = res && res.member;
      if (needsMemberRegister(member, DEFAULT_AVATAR)) {
        openMemberRegister({ replace: false });
        return null;
      }
      return member;
    } catch (error) {
      openMemberRegister({ replace: false });
      return null;
    }
  },

  async submit() {
    if (this.data.submitting || !this.data.canSubmit || !this.data.selectedSeatIds.length) return;
    const member = await this.ensureMember();
    if (!member) {
      wx.showToast({ title: '请先完成会员注册', icon: 'none' });
      return;
    }
    const seatIds = this.data.selectedSeatIds.slice();
    const hourSlots = this._hourSlots || [];
    const customSlots = slotsFromIndexes(hourSlots, this.data.customIndexes);
    const resolved = resolveSession(this.data.sessionType, {
      open: this.data.businessHours.open,
      close: this.data.businessHours.close,
      customSlots,
      nowMin: this._nowMin,
    });
    if (!resolved.ok) {
      wx.showToast({ title: resolved.reason || '请选择时段', icon: 'none' });
      return;
    }

    const firstMeta = getSeatMeta(seatIds[0]) || {};
    const payload = {
      appointmentDate: this.data.selectedDate,
      floorKey: this.data.floorKey,
      floorLabel: firstMeta.floorLabel || '',
      seatIds,
      sessionType: resolved.sessionType,
      timeSlots: resolved.slots,
      span: resolved.span,
      source: '小程序',
    };

    this.setData({ submitting: true });
    try {
      let result = null;
      let preview = false;
      try {
        result = await api.createSeatBooking(payload);
      } catch (error) {
        preview = true;
      }
      if (!preview && (!result || !result.ok)) {
        wx.showToast({ title: (result && result.message) || '预约失败', icon: 'none' });
        return;
      }
      const phone = normalizePhone(member.phone) || this.data.store.phone || '';
      const orderNo = (!preview && result.orderNo)
        ? result.orderNo
        : buildOrderNo(payload.appointmentDate, (Date.now() % 9999) + 1);
      const code = (!preview && result.code)
        ? result.code
        : buildRedemptionCode('BEAN', Date.now());
      // 本地乐观入库：让地图/时间轴立即反映占用
      this._localBookings.push({
        orderNo,
        date: payload.appointmentDate,
        seatIds,
        slots: resolved.slots,
      });
      const success = {
        preview,
        code,
        orderNo,
        statusLabel: '待到店',
        storeName: this.data.store.name || 'Bean Land',
        floorLabel: payload.floorLabel,
        seatLabel: seatIds.join('、'),
        seatCount: seatIds.length,
        dateIso: payload.appointmentDate,
        sessionLabel: this.data.sessionLabel,
        span: payload.span,
        phone,
      };
      this.setData({ success, sheetOpen: false, selectedSeatIds: [] });
      this.renderFloor();
    } finally {
      this.setData({ submitting: false });
    }
  },

  copyCode() {
    const code = this.data.success && this.data.success.code;
    if (!code) return;
    wx.setClipboardData({ data: code });
  },

  async cancelBooking() {
    const success = this.data.success;
    if (!success) return;
    // 移除本地乐观占用
    this._localBookings = (this._localBookings || []).filter((b) => b.orderNo !== success.orderNo);
    if (!success.preview && success.orderNo) {
      const confirm = await new Promise((resolve) => {
        wx.showModal({
          title: '取消预约',
          content: '确定取消本次预约吗？',
          success: (res) => resolve(res.confirm),
          fail: () => resolve(false),
        });
      });
      if (!confirm) {
        // 撤销：把本地乐观加回去
        this._localBookings.push({
          orderNo: success.orderNo,
          date: success.dateIso,
          seatIds: String(success.seatLabel || '').split('、').filter(Boolean),
          slots: [],
        });
        return;
      }
      try {
        await api.cancelSeatBooking({ orderNo: success.orderNo });
        wx.showToast({ title: '已取消', icon: 'success' });
      } catch (error) {
        wx.showToast({ title: '取消失败', icon: 'none' });
      }
    }
    this.closeSuccess();
  },

  closeSuccess() {
    this.setData({ success: null });
    this.loadBoard();
  },

  noop() {},
});
