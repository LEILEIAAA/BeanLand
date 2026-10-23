const api = require('../../../utils/api');
const {
  groupSeatsByTable,
  getSeatAdminStatus,
} = require('../../../utils/seats');
const {
  DURATION_OPTIONS,
  calcSessionTime,
  toggleSeatSelection,
  trimSeatsToMemberCount,
  formatSessionTimeLabels,
  formatReservedOpenPrompt,
} = require('../../../utils/seatSession');
const {
  parseAssignQuery,
  assertCanPickAssignSeat,
  toggleAssignSeatSelection,
  syncAssignSelectionMeta,
  buildAssignBanner,
} = require('../../../utils/appointmentAssign');
const {
  ADMIN_MEMBER_SEARCH_DEBOUNCE_MS,
  shouldRemoteSearchMember,
} = require('../../../utils/adminMemberSearch');
const { resolveSeatsForBoard } = require('../../../utils/seatBoard');

const statusLabel = {
  idle: '空闲',
  reserved: '有预约',
  in_use: '体验中',
};

function phoneTail(phone) {
  const text = String(phone || '');
  return text.length >= 4 ? text.slice(-4) : text || '--';
}

function cloudErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  const msg =
    error.errMsg ||
    error.message ||
    (error.result && error.result.message) ||
    '';
  if (/FUNCTION_NOT_FOUND|FunctionName|not found|不存在/i.test(msg)) {
    return '云函数未部署，请先上传座位管理相关函数';
  }
  return msg || fallback;
}

function showTip(title, options = {}) {
  const text = String(title || '').trim() || '操作失败';
  // Toast 过长会被截断且难读；长文案改弹窗
  if (text.length > 18 || options.forceModal) {
    wx.showModal({
      title: options.modalTitle || '提示',
      content: text,
      showCancel: false,
      confirmText: '知道了',
    });
    return;
  }
  wx.showToast({ title: text, icon: 'none', duration: 2500 });
}

function humanizeStartError(result, selectedMembers) {
  if (!result) return '开台失败';
  const code = result.code || result.errorCode;
  const raw = result.message || result.errorMessage || '';
  // 若服务端已返回可读中文且不含长 id，直接用
  if (raw && !/[a-f0-9]{16,}/i.test(raw) && !/memberId|openid/i.test(raw)) {
    return raw;
  }
  if (code === 'MEMBER_BUSY') {
    const name =
      (selectedMembers &&
        selectedMembers[0] &&
        (selectedMembers[0].label || '').split('·')[0].trim()) ||
      '该会员';
    return `${name} 已有进行中计时，请先停止后再开台`;
  }
  if (code === 'COUNT_MISMATCH') return '人数与座位数不一致';
  if (code === 'SEAT_BLOCKED') return '所选座位不可用，请换座';
  if (code === 'MEMBER_NO_OPENID') return '会员未绑定登录账号，无法开台';
  if (code === 'MEMBER_NOT_FOUND') return '会员不存在或未注册';
  if (code === 'FORBIDDEN') return '无店主权限';
  return raw || '开台失败';
}

function resolveSessionTime(info, board) {
  if (!info) return null;
  if (info.startedAt != null && info.expectedEndAt != null) {
    return calcSessionTime({
      startedAt: info.startedAt,
      expectedEndAt: info.expectedEndAt,
      durationMinutes: info.durationMinutes,
      now: (board && board.now) || Date.now(),
    });
  }
  if (info.elapsedMinutes != null && info.phase) {
    return {
      elapsedMinutes: info.elapsedMinutes,
      remainingMinutes: info.remainingMinutes || 0,
      overtimeMinutes: info.overtimeMinutes || 0,
      phase: info.phase,
    };
  }
  return {
    elapsedMinutes: info.elapsedMinutes || 0,
    remainingMinutes: info.remainingMinutes || 0,
    overtimeMinutes: info.overtimeMinutes || 0,
    phase: info.phase || 'within',
  };
}

function buildSeatGroups(seats, board, selectedSeatIds, memberCount, options = {}) {
  const maintenanceIds = new Set((board && board.maintenanceSeatIds) || []);
  const inUse = (board && board.inUse) || {};
  const reservationsBySeatId = (board && board.reservationsBySeatId) || {};
  const reservedSeatIds = new Set(Object.keys(reservationsBySeatId));
  const occupancy = {
    reservedSeatIds,
    inUse: {},
    maintenanceIds,
  };
  Object.keys(inUse).forEach((seatId) => {
    occupancy.inUse[seatId] = {
      remainingMinutes: inUse[seatId].remainingMinutes,
    };
  });

  const selected = new Set(selectedSeatIds || []);
  const selectedCount = (selectedSeatIds || []).length;
  const orderIndex = Object.fromEntries(
    (selectedSeatIds || []).map((id, i) => [id, i + 1]),
  );
  const maxSelectable =
    options.maxSelectable != null
      ? Number(options.maxSelectable) || 0
      : memberCount === 1
        ? 20
        : memberCount;
  const canPickMore = maxSelectable > 0 && selectedCount < maxSelectable;

  return groupSeatsByTable(seats || []).map((group) => ({
    tableCode: group.tableCode,
    area: group.area,
    seats: group.seats
      .map((seat) => {
      const result = getSeatAdminStatus(
        { ...seat, maintenance: maintenanceIds.has(seat.id) },
        occupancy,
      );
      const status = typeof result === 'string' ? result : result.status;
      if (status === 'maintenance') {
        return null;
      }
      const pickOrder = orderIndex[seat.id];
      const isSelected = selected.has(seat.id);
      const time =
        status === 'in_use' ? resolveSessionTime(inUse[seat.id], board) : null;
      const labels = time ? formatSessionTimeLabels(time) : null;
      const reservation = reservationsBySeatId[seat.id];
      const readyToOpen = !!(reservation && reservation.readyToOpen);
      const pickLocked =
        (status === 'idle' || status === 'reserved') &&
        !isSelected &&
        !canPickMore;
      return {
        id: seat.id,
        status,
        statusLabel:
          status === 'reserved' && readyToOpen
            ? '待开台'
            : statusLabel[status] || status,
        primaryTimeText: labels ? labels.primary : '',
        secondaryTimeText:
          status === 'reserved'
            ? (reservation && reservation.slotLabel) || ''
            : labels
              ? labels.secondary
              : '',
        secondaryKind: labels ? labels.secondaryKind : '',
        reservedSlotLabel:
          (reservation && reservation.slotLabel) || '',
        isOvertime: !!(time && time.phase === 'overtime'),
        selected: isSelected,
        pickLocked,
        pickOrderText: pickOrder ? `#${pickOrder}` : '',
        sessionId: (inUse[seat.id] && inUse[seat.id].sessionId) || '',
      };
    })
      .filter(Boolean),
  })).filter((group) => group.seats.length > 0);
}

function mapSessions(board) {
  return ((board && board.sessions) || []).map((row) => {
    const time = resolveSessionTime(row, board) || calcSessionTime({
      startedAt: row.startedAt,
      expectedEndAt: row.expectedEndAt,
      durationMinutes: row.durationMinutes,
      now: (board && board.now) || Date.now(),
    });
    const labels = formatSessionTimeLabels(time);
    return {
      id: row._id,
      tableCode: row.tableCode,
      seatLabel: (row.seatIds || []).join('、'),
      memberLabel: `${row.memberNickname || '会员'} · 尾号 ${phoneTail(
        row.memberPhone,
      )}`,
      primaryTimeText: labels.primary,
      secondaryTimeText: labels.secondary,
      secondaryKind: labels.secondaryKind,
      phase: time.phase,
      isOvertime: time.phase === 'overtime',
    };
  });
}

function buildPairPreview(members, seatIds) {
  const list = [];
  if (members.length === 1 && (seatIds || []).length > 0) {
    list.push({
      index: 1,
      text: `${members[0].label || '？'} ↔ ${seatIds.join('、')}`,
    });
    return list;
  }
  const n = Math.max(members.length, seatIds.length);
  for (let i = 0; i < n; i += 1) {
    const m = members[i];
    const seatId = seatIds[i];
    list.push({
      index: i + 1,
      text: `#${i + 1} ${(m && m.label) || '？'} ↔ ${seatId || '？'}`,
    });
  }
  return list;
}

function countSeatStatuses(groups) {
  const counts = {
    all: 0,
    idle: 0,
    reserved: 0,
    in_use: 0,
    overtime: 0,
  };
  for (const group of groups || []) {
    for (const seat of group.seats || []) {
      counts.all += 1;
      if (seat.isOvertime) counts.overtime += 1;
      if (seat.status === 'idle') counts.idle += 1;
      else if (seat.status === 'reserved') counts.reserved += 1;
      else if (seat.status === 'in_use') counts.in_use += 1;
    }
  }
  return counts;
}

function filterSeatGroupsByStatus(groups, statusFilter) {
  if (!statusFilter || statusFilter === 'all') {
    return groups || [];
  }
  return (groups || [])
    .map((group) => ({
      ...group,
      seats: (group.seats || []).filter((seat) => {
        if (statusFilter === 'overtime') return !!seat.isOvertime;
        return seat.status === statusFilter;
      }),
    }))
    .filter((group) => (group.seats || []).length > 0);
}

function buildStatusFilters(counts, active) {
  return [
    { key: 'all', label: '全部', count: counts.all || 0, active: active === 'all' },
    { key: 'idle', label: '空闲', count: counts.idle || 0, active: active === 'idle' },
    { key: 'in_use', label: '体验中', count: counts.in_use || 0, active: active === 'in_use' },
    {
      key: 'overtime',
      label: '延时',
      count: counts.overtime || 0,
      active: active === 'overtime',
    },
    {
      key: 'reserved',
      label: '预约',
      count: counts.reserved || 0,
      active: active === 'reserved',
    },
  ];
}

Page({
  data: {
    loading: true,
    pageMode: 'manage',
    assignBanner: { title: '', subtitle: '' },
    assignPeopleCount: 0,
    canConfirm: false,
    selectProgress: 0,
    selectedSeatLabel: '',
    memberKeyword: '',
    members: [],
    memberDropdownOpen: false,
    memberSearching: false,
    selectedMembers: [],
    selectedSeatIds: [],
    pairPreview: [],
    canStart: false,
    countHint: '请选择会员与座位',
    durationOptions: DURATION_OPTIONS,
    durationLabels: DURATION_OPTIONS.map((m) => `${m} 分钟`),
    durationIndex: 3,
    durationMinutes: 120,
    seatGroups: [],
    statusFilter: 'all',
    statusFilters: buildStatusFilters(
      { all: 0, idle: 0, reserved: 0, in_use: 0, overtime: 0 },
      'all',
    ),
    sessions: [],
    sessionSheetOpen: false,
    sessionSheet: null,
    busy: false,
    boardReady: false,
  },

  onLoad(query) {
    const assign = parseAssignQuery(query);
    if (assign.mode === 'assign') {
      this._assignContext = assign;
      const banner = buildAssignBanner({
        appointmentDate: assign.appointmentDate,
        peopleCount: assign.peopleCount,
        slotLabel: assign.slotLabel,
      });
      const meta = syncAssignSelectionMeta({
        selectedSeatIds: [],
        peopleCount: assign.peopleCount,
      });
      this.setData({
        pageMode: 'assign',
        assignBanner: banner,
        assignPeopleCount: assign.peopleCount,
        canConfirm: meta.canConfirm,
        countHint: meta.countHint,
        selectProgress: meta.selectProgress,
        selectedSeatLabel: meta.selectedSeatLabel,
      });
      wx.setNavigationBarTitle({ title: '确认排座' });
      return;
    }

    const seatIds = String(query.seatIds || '')
      .split(',')
      .map((s) => {
        try {
          return decodeURIComponent(s);
        } catch (error) {
          return s;
        }
      })
      .filter(Boolean);
    let memberLabel = '';
    try {
      memberLabel = decodeURIComponent(query.memberLabel || '');
    } catch (error) {
      memberLabel = query.memberLabel || '';
    }
    this._prefill = {
      appointmentId: query.appointmentId || '',
      memberId: query.memberId || '',
      memberLabel,
      seatIds,
      packageOrderId: query.packageOrderId || '',
    };
  },

  onShow() {
    this.refreshBoard().then(() => {
      if (this.data.pageMode !== 'assign') {
        this.applyAppointmentPrefill();
      }
    });
  },

  pickLimit() {
    if (this.data.pageMode === 'assign') {
      return Number(this.data.assignPeopleCount) || 0;
    }
    return (this.data.selectedMembers || []).length;
  },

  seatGroupOptions() {
    if (this.data.pageMode === 'assign') {
      return { maxSelectable: Number(this.data.assignPeopleCount) || 0 };
    }
    return {};
  },

  applyAppointmentPrefill() {
    const prefill = this._prefill;
    if (!prefill || prefill.applied) return;
    prefill.applied = true;
    this._linkedAppointmentId = prefill.appointmentId || '';
    this._linkedPackageOrderId = prefill.packageOrderId || '';
    const members = [];
    if (prefill.memberId) {
      members.push({
        id: prefill.memberId,
        label: prefill.memberLabel || '预约会员',
      });
    }
    const seats = prefill.seatIds || [];
    if (members.length || seats.length) {
      this.syncSelectionMeta(members, seats);
    }
  },

  syncAssignMeta(selectedSeatIds) {
    const peopleCount = Number(this.data.assignPeopleCount) || 0;
    const meta = syncAssignSelectionMeta({
      selectedSeatIds,
      peopleCount,
    });
    this.setData({
      selectedSeatIds: meta.selectedSeatIds,
      canConfirm: meta.canConfirm,
      countHint: meta.countHint,
      selectProgress: meta.selectProgress,
      selectedSeatLabel: meta.selectedSeatLabel,
    });
    this.rebuildSeatGroups(meta.selectedSeatIds, peopleCount);
  },

  syncSelectionMeta(selectedMembers, selectedSeatIds) {
    if (this.data.pageMode === 'assign') {
      this.syncAssignMeta(selectedSeatIds);
      return;
    }
    const members = selectedMembers || [];
    let seats = selectedSeatIds || [];
    seats = trimSeatsToMemberCount(seats, members.length);
    const singleMember = members.length === 1;
    const multiReady =
      members.length > 1 && members.length === seats.length;
    const singleReady = singleMember && seats.length > 0;
    const canStart = singleReady || multiReady;
    let countHint = '请先选择会员，再选座位';
    if (singleMember && seats.length === 0) {
      countHint = '已选 1 人，请选至少 1 个座位（可多选）';
    } else if (singleMember && seats.length > 0) {
      countHint = `已选 1 人 / ${seats.length} 座，合并一会话结算`;
    } else if (members.length > 1 && !multiReady) {
      countHint = `已选 ${members.length} 人，还可选 ${
        members.length - seats.length
      } 个座位`;
    } else if (multiReady) {
      countHint = `已配对 ${members.length} 人 / ${seats.length} 座，可开台`;
    }
    this.setData({
      selectedMembers: members,
      selectedSeatIds: seats,
      pairPreview: buildPairPreview(members, seats),
      canStart,
      countHint,
    });
    this.rebuildSeatGroups(seats, members.length);
  },

  rebuildSeatGroups(selectedSeatIds, memberCount) {
    if (!this._seatsCache) return;
    const limitHint =
      this.data.pageMode === 'assign'
        ? Number(this.data.assignPeopleCount) || 0
        : memberCount;
    const fullGroups = buildSeatGroups(
      this._seatsCache,
      this._boardCache || {
        maintenanceSeatIds: [],
        inUse: {},
        now: Date.now(),
      },
      selectedSeatIds,
      limitHint,
      this.seatGroupOptions(),
    );
    this._fullSeatGroups = fullGroups;
    const statusFilter = this.data.statusFilter || 'all';
    const counts = countSeatStatuses(fullGroups);
    this.setData({
      seatGroups: filterSeatGroupsByStatus(fullGroups, statusFilter),
      statusFilters: buildStatusFilters(counts, statusFilter),
    });
  },

  onStatusFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.statusFilter) return;
    const fullGroups =
      this._fullSeatGroups ||
      buildSeatGroups(
        this._seatsCache || [],
        this._boardCache || { maintenanceSeatIds: [], inUse: {}, now: Date.now() },
        this.data.selectedSeatIds,
        this.pickLimit(),
        this.seatGroupOptions(),
      );
    this._fullSeatGroups = fullGroups;
    const counts = countSeatStatuses(fullGroups);
    this.setData({
      statusFilter: key,
      statusFilters: buildStatusFilters(counts, key),
      seatGroups: filterSeatGroupsByStatus(fullGroups, key),
    });
  },

  async refreshBoard() {
    this.setData({ loading: true });
    let clientSeats = [];
    let board = {
      ok: true,
      sessions: [],
      maintenanceSeatIds: [],
      inUse: {},
      now: Date.now(),
    };
    let boardError = '';

    try {
      try {
        const result = await api.adminListSeatBoard();
        if (result && result.ok === false) {
          boardError =
            result.message ||
            (result.code === 'FORBIDDEN' ? '无店主权限' : '座位板加载失败');
        } else if (result) {
          board = result;
        }
      } catch (error) {
        boardError = cloudErrorMessage(error, '座位板接口失败');
      }

      // Prefer seats from cloud function (admin ACL). Client getSeats is fallback only.
      if (!(board && Array.isArray(board.seats) && board.seats.length)) {
        try {
          clientSeats = (await api.getSeats()) || [];
        } catch (error) {
          if (!boardError) {
            boardError = cloudErrorMessage(error, '座位列表加载失败');
          }
        }
      }

      const seats = resolveSeatsForBoard(board, clientSeats);
      this._seatsCache = seats;
      this._boardCache = board;

      const isAssign = this.data.pageMode === 'assign';
      const memberCount = isAssign
        ? Number(this.data.assignPeopleCount) || 0
        : (this.data.selectedMembers || []).length;
      let selectedSeatIds = this.data.selectedSeatIds || [];
      if (!isAssign) {
        selectedSeatIds = trimSeatsToMemberCount(selectedSeatIds, memberCount);
      } else {
        selectedSeatIds = syncAssignSelectionMeta({
          selectedSeatIds,
          peopleCount: memberCount,
        }).selectedSeatIds;
      }
      const fullGroups = buildSeatGroups(
        seats,
        board,
        selectedSeatIds,
        memberCount,
        this.seatGroupOptions(),
      );
      this._fullSeatGroups = fullGroups;
      const statusFilter = this.data.statusFilter || 'all';
      const counts = countSeatStatuses(fullGroups);
      const sessions = mapSessions(board);

      const patch = {
        selectedSeatIds,
        seatGroups: filterSeatGroupsByStatus(fullGroups, statusFilter),
        statusFilters: buildStatusFilters(counts, statusFilter),
        sessions,
        boardReady: !boardError,
      };
      if (isAssign) {
        Object.assign(
          patch,
          syncAssignSelectionMeta({
            selectedSeatIds,
            peopleCount: memberCount,
          }),
        );
      }
      this.setData(patch);

      if (boardError) {
        showTip(boardError, { modalTitle: '座位管理' });
      } else if (!seats.length) {
        showTip('暂无座位数据，请检查云库 seats/tables', { forceModal: true });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  onMemberFocus() {
    const keyword = String(this.data.memberKeyword || '').trim();
    if (keyword && (this.data.members || []).length) {
      this.setData({ memberDropdownOpen: true });
    }
  },

  onMemberKeywordInput(e) {
    const memberKeyword = e.detail.value;
    const text = String(memberKeyword || '').trim();
    if (this._memberSearchTimer) {
      clearTimeout(this._memberSearchTimer);
      this._memberSearchTimer = null;
    }
    if (!text) {
      this._memberSearchSeq = (this._memberSearchSeq || 0) + 1;
      this.setData({
        memberKeyword,
        members: [],
        memberSearching: false,
        memberDropdownOpen: false,
      });
      return;
    }
    this.setData({
      memberKeyword,
      memberDropdownOpen: true,
    });
    if (!shouldRemoteSearchMember(text)) {
      this._memberSearchSeq = (this._memberSearchSeq || 0) + 1;
      this.setData({
        members: [],
        memberSearching: false,
      });
      return;
    }
    this._memberSearchTimer = setTimeout(() => {
      this.remoteSearchMembers(memberKeyword);
    }, ADMIN_MEMBER_SEARCH_DEBOUNCE_MS);
  },

  async remoteSearchMembers(keyword) {
    const text = String(keyword || '').trim();
    const seq = (this._memberSearchSeq = (this._memberSearchSeq || 0) + 1);
    if (!text || !shouldRemoteSearchMember(text)) {
      this.setData({
        members: [],
        memberSearching: false,
        memberDropdownOpen: false,
      });
      return;
    }
    this.setData({ memberSearching: true, memberDropdownOpen: true });
    try {
      const result = await api.adminFindMember({ keyword: text });
      if (seq !== this._memberSearchSeq) return;
      if (result && result.ok === false) {
        throw new Error(result.message || '搜索失败');
      }
      const selectedIds = new Set(
        (this.data.selectedMembers || []).map((m) => m.id),
      );
      const list = (result && result.list) || [];
      const members = list.map((m) => ({
        id: m._id,
        label: `${m.nickname || m.nickName || '会员'} · ${m.phone || ''}`,
        alreadySelected: selectedIds.has(m._id),
      }));
      this.setData({
        members,
        memberSearching: false,
        memberDropdownOpen: members.length > 0,
      });
    } catch (error) {
      if (seq !== this._memberSearchSeq) return;
      this.setData({
        members: [],
        memberSearching: false,
        memberDropdownOpen: false,
      });
      wx.showToast({
        title: (error && error.message) || '搜索失败',
        icon: 'none',
      });
    }
  },

  resetMemberSearch() {
    if (this._memberSearchTimer) {
      clearTimeout(this._memberSearchTimer);
      this._memberSearchTimer = null;
    }
    this._memberSearchSeq = (this._memberSearchSeq || 0) + 1;
    this.setData({
      memberKeyword: '',
      members: [],
      memberSearching: false,
      memberDropdownOpen: false,
    });
  },

  selectMember(e) {
    const id = e.currentTarget.dataset.id;
    const hit = (this.data.members || []).find((m) => m.id === id);
    if (!hit) return;
    const selectedMembers = [...(this.data.selectedMembers || [])];
    if (selectedMembers.some((m) => m.id === id)) {
      wx.showToast({ title: '该会员已选', icon: 'none' });
      this.resetMemberSearch();
      return;
    }
    selectedMembers.push({ id: hit.id, label: hit.label });
    this.resetMemberSearch();
    this.syncSelectionMeta(selectedMembers, this.data.selectedSeatIds);
  },

  removeMember(e) {
    const id = e.currentTarget.dataset.id;
    const selectedMembers = (this.data.selectedMembers || []).filter(
      (m) => m.id !== id,
    );
    this.syncSelectionMeta(selectedMembers, this.data.selectedSeatIds);
  },

  onDurationChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      durationIndex: index,
      durationMinutes: DURATION_OPTIONS[index],
    });
  },

  toggleSeat(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const sessionId = e.currentTarget.dataset.sessionId;

    if (this.data.pageMode === 'assign') {
      if (status === 'in_use') {
        if (sessionId) {
          this.openSessionSheet(sessionId, id);
        } else {
          wx.showToast({ title: '该座位体验中', icon: 'none' });
        }
        return;
      }
      const pick = assertCanPickAssignSeat(status);
      if (!pick.ok) {
        const reservationsBySeatId =
          (this._boardCache && this._boardCache.reservationsBySeatId) || {};
        const slot =
          (reservationsBySeatId[id] && reservationsBySeatId[id].slotLabel) || '';
        wx.showToast({
          title: slot ? `${pick.reason}（${slot}）` : pick.reason,
          icon: 'none',
        });
        return;
      }
      const result = toggleAssignSeatSelection({
        selectedSeatIds: this.data.selectedSeatIds,
        seatId: id,
        peopleCount: this.data.assignPeopleCount,
      });
      if (!result.ok) {
        wx.showToast({ title: result.message || '无法选座', icon: 'none' });
        return;
      }
      if (result.replaced) {
        wx.showToast({ title: '已替换最后一个座位', icon: 'none' });
      }
      this.syncAssignMeta(result.selectedSeatIds);
      return;
    }

    if (status === 'in_use') {
      if (sessionId) {
        this.openSessionSheet(sessionId, id);
      }
      return;
    }

    const selectedMembers = this.data.selectedMembers || [];
    const memberCount = selectedMembers.length;
    if (memberCount <= 0) {
      wx.showToast({ title: '请先选择会员再选座', icon: 'none' });
      if ((this.data.selectedSeatIds || []).length) {
        this.syncSelectionMeta([], []);
      }
      return;
    }

    const result = toggleSeatSelection({
      selectedSeatIds: this.data.selectedSeatIds,
      seatId: id,
      memberCount,
    });
    if (!result.ok) {
      wx.showToast({ title: result.message || '无法选座', icon: 'none' });
      return;
    }
    this.syncSelectionMeta(selectedMembers, result.selectedSeatIds);
  },

  clearAssignSelection() {
    if (this.data.pageMode !== 'assign') return;
    this.syncAssignMeta([]);
  },

  async confirmAssign() {
    if (this.data.pageMode !== 'assign' || this.data.busy) return;
    const ctx = this._assignContext || {};
    const meta = syncAssignSelectionMeta({
      selectedSeatIds: this.data.selectedSeatIds,
      peopleCount: this.data.assignPeopleCount,
    });
    if (!meta.canConfirm) {
      wx.showToast({ title: meta.countHint || '请选满座位', icon: 'none' });
      return;
    }
    if (!ctx.appointmentId) {
      wx.showToast({ title: '缺少预约 ID', icon: 'none' });
      return;
    }

    this.setData({ busy: true });
    try {
      const result = await api.adminUpdateAppointment({
        appointmentId: ctx.appointmentId,
        action: 'confirm',
        seatIds: meta.selectedSeatIds,
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
        wx.navigateBack({
          fail: () => {
            wx.redirectTo({ url: '/pages/admin/appointments/index' });
          },
        });
      }, 400);
    } catch (error) {
      wx.showToast({ title: '确认失败', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },

  openSessionSheet(sessionId, seatId) {
    const session = (this.data.sessions || []).find((row) => row.id === sessionId);
    if (!session) {
      wx.showToast({ title: '未找到该座位会话', icon: 'none' });
      return;
    }
    this.setData({
      sessionSheetOpen: true,
      sessionSheet: {
        ...session,
        seatLabel: session.seatLabel || seatId,
      },
    });
  },

  closeSessionSheet() {
    this.setData({
      sessionSheetOpen: false,
      sessionSheet: null,
    });
  },

  stopFromSheet(e) {
    const sessionId =
      (e && e.currentTarget && e.currentTarget.dataset.id) ||
      (this.data.sessionSheet && this.data.sessionSheet.id);
    if (!sessionId) return;
    wx.showModal({
      title: '停止计时',
      content: `确认停止该会员全部座位（${
        (this.data.sessionSheet && this.data.sessionSheet.seatLabel) || ''
      }）的计时？`,
      success: (res) => {
        if (res.confirm) {
          this.stopSessionById(sessionId);
        }
      },
    });
  },

  async startSession() {
    if (this.data.busy) return;
    const selectedMembers = this.data.selectedMembers || [];
    const seatIds = this.data.selectedSeatIds || [];
    if (!selectedMembers.length) {
      wx.showToast({ title: '请先选择已注册会员', icon: 'none' });
      return;
    }
    if (selectedMembers.length === 1) {
      if (!seatIds.length) {
        wx.showToast({ title: '请至少选 1 个座位', icon: 'none' });
        return;
      }
    } else if (selectedMembers.length !== seatIds.length) {
      wx.showToast({
        title: `请再选 ${selectedMembers.length - seatIds.length} 个座位`,
        icon: 'none',
      });
      return;
    }

    const reservationsBySeatId =
      (this._boardCache && this._boardCache.reservationsBySeatId) || {};
    const reservedPrompt = formatReservedOpenPrompt(
      seatIds,
      reservationsBySeatId,
      selectedMembers.map((m) => m.id),
    );
    if (reservedPrompt) {
      const confirmed = await new Promise((resolve) => {
        wx.showModal({
          title: '预约座位提示',
          content: reservedPrompt,
          confirmText: '继续开台',
          cancelText: '再想想',
          success: (res) => resolve(!!res.confirm),
          fail: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }

    this.setData({ busy: true });
    try {
      const payload = {
        memberIds: selectedMembers.map((m) => m.id),
        seatIds,
        durationMinutes: this.data.durationMinutes,
      };
      if (this._linkedAppointmentId) {
        payload.appointmentId = this._linkedAppointmentId;
      }
      if (this._linkedPackageOrderId) {
        payload.packageOrderId = this._linkedPackageOrderId;
      }
      const result = await api.adminStartSeatSession(payload);
      if (!result || result.ok === false || result.errorCode) {
        throw new Error(
          humanizeStartError(result, selectedMembers),
        );
      }
      this._linkedAppointmentId = '';
      this._linkedPackageOrderId = '';
      this.syncSelectionMeta([], []);
      this.setData({ busy: false });
      const arrived =
        result.appointmentSync && result.appointmentSync.updated;
      wx.showToast({
        title: arrived ? '已开台，预约已到店' : '已开台',
        icon: 'success',
      });
      await this.refreshBoard();
    } catch (error) {
      this.setData({ busy: false });
      showTip((error && error.message) || '开台失败', { forceModal: true });
    }
  },

  async stopSessionById(sessionId) {
    if (!sessionId || this.data.busy) return;
    this.setData({ busy: true });
    try {
      const result = await api.adminEndSeatSession({ sessionId });
      if (!result || result.ok === false) {
        throw new Error((result && result.message) || '停止失败');
      }
      this.setData({
        busy: false,
        sessionSheetOpen: false,
        sessionSheet: null,
      });
      wx.showToast({ title: '已停止计时', icon: 'success' });
      await this.refreshBoard();
    } catch (error) {
      this.setData({ busy: false });
      wx.showToast({
        title: (error && error.message) || '停止失败',
        icon: 'none',
      });
    }
  },
});
