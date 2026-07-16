const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180, 210, 240];
/** @deprecated 产品已改为自动延时，UI 不再使用手动延长 */
const EXTEND_MINUTES = [15, 30];

function fail(code, message) {
  return { ok: false, code, message };
}

function buildStartPairs(memberIds, seatIds) {
  const groups = buildStartGroups(memberIds, seatIds);
  const pairs = [];
  for (const group of groups) {
    for (const seatId of group.seatIds || []) {
      pairs.push({ memberId: group.memberId, seatId });
    }
  }
  return pairs;
}

/** 单会员多座合并一会话；结伴仍按序一人一座 */
function buildStartGroups(memberIds, seatIds) {
  const members = Array.isArray(memberIds) ? memberIds : [];
  const seats = Array.isArray(seatIds) ? seatIds : [];
  if (members.length === 1) {
    return [{ memberId: members[0], seatIds: seats }];
  }
  const len = Math.min(members.length, seats.length);
  const groups = [];
  for (let i = 0; i < len; i += 1) {
    groups.push({ memberId: members[i], seatIds: [seats[i]] });
  }
  return groups;
}

function assertCanStartSeatBatch({
  memberIds,
  seatIds,
  seatsById,
  blockedIds = new Set(),
  busyMemberIds = new Set(),
  memberLabelsById = {},
}) {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return fail('MEMBER_REQUIRED', '请选择会员');
  }
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return fail('SEATS_REQUIRED', '请选择座位');
  }
  if (memberIds.length === 1) {
    if (seatIds.length < 1) {
      return fail('SEATS_REQUIRED', '请选择座位');
    }
  } else if (memberIds.length !== seatIds.length) {
    return fail(
      'COUNT_MISMATCH',
      `请选 ${memberIds.length} 个座位（当前 ${seatIds.length} 个）`,
    );
  } else if (new Set(memberIds).size !== memberIds.length) {
    return fail('MEMBER_DUPLICATE', '结伴开台时会员不能重复');
  }
  if (new Set(seatIds).size !== seatIds.length) {
    return fail('SEAT_DUPLICATE', '座位不能重复选择');
  }

  for (const memberId of memberIds) {
    if (!memberId) {
      return fail('MEMBER_REQUIRED', '请选择会员');
    }
    if (busyMemberIds.has(memberId)) {
      const label = memberLabelsById[memberId] || '该会员';
      return fail(
        'MEMBER_BUSY',
        `${label} 已有进行中计时，请先停止后再开台`,
      );
    }
  }

  for (const seatId of seatIds) {
    if (!seatsById[seatId]) {
      return fail('SEAT_NOT_FOUND', `座位 ${seatId} 不存在`);
    }
    if (blockedIds.has(seatId)) {
      return fail('SEAT_BLOCKED', `座位 ${seatId} 不可用`);
    }
  }

  const groups = buildStartGroups(memberIds, seatIds);
  return {
    ok: true,
    groups,
    pairs: buildStartPairs(memberIds, seatIds),
  };
}

function calcSessionTime({
  startedAt,
  expectedEndAt,
  durationMinutes,
  now,
}) {
  const start = Number(startedAt);
  const end = Number(expectedEndAt);
  const current = Number(now);
  const duration = Number(durationMinutes);
  const elapsedMs = current - start;
  const remainingMs = end - current;
  const overtimeMs = current - end;

  const elapsedMinutes = Number.isFinite(elapsedMs)
    ? Math.max(0, Math.floor(elapsedMs / 60000))
    : 0;
  const remainingMinutes =
    Number.isFinite(remainingMs) && remainingMs > 0
      ? Math.floor(remainingMs / 60000)
      : 0;
  const overtimeMinutes =
    Number.isFinite(overtimeMs) && overtimeMs > 0
      ? Math.floor(overtimeMs / 60000)
      : 0;

  return {
    elapsedMinutes,
    remainingMinutes,
    overtimeMinutes,
    phase: overtimeMinutes > 0 ? 'overtime' : 'within',
    durationMinutes: duration,
  };
}

function buildEndSessionFields(session, endedAt) {
  const end = Number(endedAt);
  const start = Number(session && session.startedAt);
  const duration = Number(session && session.durationMinutes) || 0;
  const totalMinutes =
    Number.isFinite(end) && Number.isFinite(start)
      ? Math.max(0, Math.floor((end - start) / 60000))
      : 0;
  return {
    status: 'ended',
    endedAt: end,
    totalMinutes,
    overtimeMinutes: Math.max(0, totalMinutes - duration),
    // 结束时会清空 seatIds，此处快照原座位供历史复盘展示
    seatIdsSnapshot: Array.isArray(session && session.seatIds)
      ? [...session.seatIds]
      : [],
    updatedAt: end,
  };
}

function calcRemainingMinutes(expectedEndAt, now) {
  return calcSessionTime({
    startedAt: Number(now),
    expectedEndAt,
    durationMinutes: 0,
    now,
  }).remainingMinutes;
}

function buildStartSessionRecord({
  memberId,
  memberOpenid,
  memberPhone,
  memberNickname,
  seatIds,
  tableCode,
  durationMinutes,
  packageOrderId,
  packageName,
  consumedAmount,
  now,
}) {
  const duration = Number(durationMinutes);
  const startedAt = Number(now);
  const ids = Array.isArray(seatIds) ? [...seatIds] : [];
  return {
    memberId,
    memberOpenid,
    memberPhone: memberPhone || '',
    memberNickname: memberNickname || '',
    tableCode,
    seatIds: ids,
    durationMinutes: duration,
    startedAt,
    expectedEndAt: startedAt + duration * 60 * 1000,
    status: 'active',
    packageOrderId: packageOrderId || '',
    packageName: packageName || '',
    consumedAmount: Number(consumedAmount) || 0,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

function trimSeatsToMemberCount(selectedSeatIds, memberCount) {
  const seats = Array.isArray(selectedSeatIds) ? selectedSeatIds : [];
  const count = Math.max(0, Number(memberCount) || 0);
  if (count === 1) return seats;
  return seats.slice(0, count);
}

function toggleSeatSelection({
  selectedSeatIds,
  seatId,
  memberCount,
  maxSeatsPerMember = 20,
}) {
  const current = Array.isArray(selectedSeatIds) ? [...selectedSeatIds] : [];
  const count = Math.max(0, Number(memberCount) || 0);
  const limit =
    count === 1 ? Math.max(1, Number(maxSeatsPerMember) || 20) : count;
  const idx = current.indexOf(seatId);

  if (idx >= 0) {
    current.splice(idx, 1);
    return { ok: true, selectedSeatIds: current };
  }

  if (limit <= 0) {
    return {
      ok: false,
      code: 'NEED_MEMBERS',
      message: '请先选择会员再选座',
      selectedSeatIds: current,
    };
  }

  if (current.length >= limit) {
    return {
      ok: false,
      code: 'SEAT_LIMIT',
      message:
        count === 1
          ? `最多选 ${limit} 个座位`
          : `已选 ${limit} 个会员，最多选 ${limit} 个座位`,
      selectedSeatIds: current,
    };
  }

  current.push(seatId);
  return { ok: true, selectedSeatIds: current };
}

function formatSessionTimeLabels(info) {
  const elapsed = Number((info && info.elapsedMinutes) || 0);
  const remaining = Number((info && info.remainingMinutes) || 0);
  const overtime = Number((info && info.overtimeMinutes) || 0);
  const phase = (info && info.phase) || 'within';
  return {
    primary: `${elapsed} 分钟`,
    secondary: phase === 'overtime' ? `${overtime} 分钟` : `${remaining} 分钟`,
    secondaryKind: phase === 'overtime' ? 'overtime' : 'remaining',
  };
}

function normalizeTimeSlots(row) {
  if (Array.isArray(row && row.timeSlots) && row.timeSlots.length) {
    return row.timeSlots.map(String).filter(Boolean);
  }
  if (row && row.timeSlot) {
    return [String(row.timeSlot)];
  }
  return [];
}

function addReservationSlot(bySeat, seatId, timeSlot) {
  if (!seatId || !timeSlot) return;
  if (!bySeat[seatId]) {
    bySeat[seatId] = { timeSlots: [], memberIds: [] };
  }
  const slots = bySeat[seatId].timeSlots;
  if (!slots.includes(timeSlot)) {
    slots.push(timeSlot);
  }
}

function addReservationMember(bySeat, seatId, memberId) {
  if (!seatId || !memberId) return;
  if (!bySeat[seatId]) {
    bySeat[seatId] = { timeSlots: [], memberIds: [] };
  }
  const ids = bySeat[seatId].memberIds || (bySeat[seatId].memberIds = []);
  if (!ids.includes(memberId)) {
    ids.push(memberId);
  }
}

/** 多时段只展示首尾，如 10:00-12:00 + 16:00-18:00 → 10:00-18:00 */
function formatReservationSlotLabel(timeSlots) {
  const slots = [...(timeSlots || [])].filter(Boolean).sort();
  if (!slots.length) return '';
  if (slots.length === 1) return slots[0];
  const start = String(slots[0]).split('-')[0];
  const end = String(slots[slots.length - 1]).split('-')[1];
  if (start && end) return `${start}-${end}`;
  return slots.join('、');
}

function isReleasedReservationStatus(status) {
  return /取消|拒绝|完成|cancelled|rejected|completed|no_show|未到店/i.test(
    String(status || ''),
  );
}

function reservationPhaseFromStatus(status) {
  const s = String(status || '');
  if (isReleasedReservationStatus(s)) return '';
  if (/arrived|已到店/i.test(s)) return 'arrived';
  if (/confirmed|已确认/i.test(s)) return 'confirmed';
  if (/pending|待确认|待商家确认/i.test(s)) return '';
  return '';
}

function markSeatPhase(bySeat, seatId, phase) {
  if (!seatId || !phase || !bySeat[seatId]) return;
  if (phase === 'arrived' || bySeat[seatId].phase !== 'arrived') {
    bySeat[seatId].phase = phase;
    bySeat[seatId].readyToOpen = phase === 'arrived';
  }
}

/** 从预约单 / 占用记录汇总「座位 → 预约时段 + 预约会员」；arrived 标 readyToOpen */
function buildReservationsBySeatId({ appointments = [], occupancies = [], today }) {
  const bySeat = {};
  const memberByAppointmentId = {};
  const releasedAppointmentIds = new Set();
  for (const appt of appointments || []) {
    const apptId = appt._id || appt.id || '';
    if (apptId && isReleasedReservationStatus(appt.status)) {
      releasedAppointmentIds.add(apptId);
    }
  }
  for (const appt of appointments || []) {
    const date = appt.appointmentDate || appt.date;
    if (today && date && date !== today) continue;
    const phase = reservationPhaseFromStatus(appt.status);
    if (!phase) continue;
    const memberId = appt.memberId || '';
    const apptId = appt._id || appt.id || '';
    if (apptId && memberId) {
      memberByAppointmentId[apptId] = memberId;
    }
    const seatIds = Array.isArray(appt.seatIds) ? appt.seatIds : [];
    const slots = normalizeTimeSlots(appt);
    for (const seatId of seatIds) {
      for (const slot of slots) {
        addReservationSlot(bySeat, seatId, slot);
      }
      markSeatPhase(bySeat, seatId, phase);
      if (memberId) {
        addReservationMember(bySeat, seatId, memberId);
      }
    }
  }
  for (const row of occupancies || []) {
    const type = row.type || 'reserved';
    if (type !== 'reserved' && type !== 'arrived') continue;
    if (today && row.date && row.date !== today) continue;
    if (row.appointmentId && releasedAppointmentIds.has(row.appointmentId)) {
      continue;
    }
    const memberId =
      row.memberId || memberByAppointmentId[row.appointmentId] || '';
    for (const slot of normalizeTimeSlots(row)) {
      addReservationSlot(bySeat, row.seatId, slot);
      markSeatPhase(bySeat, row.seatId, type === 'arrived' ? 'arrived' : 'confirmed');
      if (memberId) {
        addReservationMember(bySeat, row.seatId, memberId);
      }
    }
  }
  for (const seatId of Object.keys(bySeat)) {
    bySeat[seatId].timeSlots.sort();
    bySeat[seatId].slotLabel = formatReservationSlotLabel(bySeat[seatId].timeSlots);
    if (!bySeat[seatId].phase) {
      bySeat[seatId].phase = 'confirmed';
      bySeat[seatId].readyToOpen = false;
    }
  }
  return bySeat;
}

function buildSeatOpeningMemberMap(memberIds, seatIds) {
  const members = Array.isArray(memberIds) ? memberIds : [];
  const seats = Array.isArray(seatIds) ? seatIds : [];
  const map = {};
  if (members.length === 1) {
    for (const seatId of seats) {
      map[seatId] = members[0];
    }
    return map;
  }
  for (let i = 0; i < Math.min(members.length, seats.length); i += 1) {
    map[seats[i]] = members[i];
  }
  return map;
}

function isSeatReservedByMember(info, memberId) {
  if (!info || !memberId) return false;
  return (info.memberIds || []).includes(memberId);
}

/** 开台前：选中预约座时的可读提示；预约人本人开台则跳过对应座位 */
function formatReservedOpenPrompt(seatIds, reservationsBySeatId, memberIds) {
  const openingBySeat = buildSeatOpeningMemberMap(memberIds, seatIds);
  const lines = [];
  for (const seatId of seatIds || []) {
    const info = reservationsBySeatId && reservationsBySeatId[seatId];
    if (!info || !(info.timeSlots || []).length) continue;
    if (isSeatReservedByMember(info, openingBySeat[seatId])) continue;
    lines.push(`${seatId}：${info.slotLabel || info.timeSlots.join('、')}`);
  }
  if (!lines.length) return '';
  return `以下座位今日有预约：\n${lines.join('\n')}\n\n仍要开台吗？`;
}

module.exports = {
  DURATION_OPTIONS,
  EXTEND_MINUTES,
  buildStartPairs,
  buildStartGroups,
  assertCanStartSeatBatch,
  calcSessionTime,
  buildEndSessionFields,
  calcRemainingMinutes,
  buildStartSessionRecord,
  trimSeatsToMemberCount,
  toggleSeatSelection,
  formatSessionTimeLabels,
  buildReservationsBySeatId,
  formatReservedOpenPrompt,
};
