const { formatSlotSpan } = require('./timeSlots');

function buildAssignTimerUrl({
  appointmentId,
  appointmentDate,
  peopleCount,
  timeSlots,
}) {
  const slots = Array.isArray(timeSlots) ? timeSlots.filter(Boolean) : [];
  const encodedSlots = slots.map((s) => encodeURIComponent(s)).join(',');
  return (
    `/pages/admin/timer/index?mode=assign` +
    `&appointmentId=${encodeURIComponent(appointmentId || '')}` +
    `&appointmentDate=${encodeURIComponent(appointmentDate || '')}` +
    `&peopleCount=${Number(peopleCount) || 0}` +
    `&timeSlots=${encodedSlots}`
  );
}

function parseAssignQuery(query) {
  const q = query || {};
  const mode = q.mode === 'assign' ? 'assign' : 'manage';
  let timeSlots = [];
  if (q.timeSlots) {
    timeSlots = String(q.timeSlots)
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
  return {
    mode,
    appointmentId: q.appointmentId || '',
    appointmentDate: q.appointmentDate || '',
    peopleCount: Number(q.peopleCount) || 0,
    timeSlots,
    slotLabel: formatSlotSpan(timeSlots),
  };
}

function assertCanPickAssignSeat(status) {
  if (status === 'idle') {
    return { ok: true };
  }
  if (status === 'in_use') {
    return { ok: false, reason: '该座位体验中' };
  }
  if (status === 'reserved') {
    return { ok: false, reason: '该座位已有预约' };
  }
  return { ok: false, reason: '该座位不可选' };
}

function toggleAssignSeatSelection({ selectedSeatIds, seatId, peopleCount }) {
  const people = Number(peopleCount) || 0;
  const current = Array.isArray(selectedSeatIds) ? [...selectedSeatIds] : [];
  if (people < 1) {
    return { ok: false, message: '人数无效', selectedSeatIds: current };
  }
  if (!seatId) {
    return { ok: false, message: '座位无效', selectedSeatIds: current };
  }

  const idx = current.indexOf(seatId);
  if (idx >= 0) {
    current.splice(idx, 1);
    return { ok: true, selectedSeatIds: current };
  }

  if (current.length >= people) {
    current[current.length - 1] = seatId;
    return { ok: true, selectedSeatIds: current, replaced: true };
  }

  current.push(seatId);
  return { ok: true, selectedSeatIds: current };
}

function syncAssignSelectionMeta({ selectedSeatIds, peopleCount }) {
  const people = Number(peopleCount) || 0;
  const seats = Array.isArray(selectedSeatIds)
    ? selectedSeatIds.filter(Boolean).slice(0, people || undefined)
    : [];
  const canConfirm = people > 0 && seats.length === people;
  let countHint = '请点空闲座位完成排座';
  if (people > 0) {
    countHint = canConfirm
      ? `已选 ${seats.length}/${people}，可确认排座`
      : `已选 ${seats.length}/${people}，请点空闲座位`;
  }
  return {
    selectedSeatIds: seats,
    canConfirm,
    countHint,
    selectProgress: people
      ? Math.min(100, Math.round((seats.length / people) * 100))
      : 0,
    selectedSeatLabel: seats.join('、'),
  };
}

function buildAssignBanner({ appointmentDate, peopleCount, slotLabel }) {
  const date = appointmentDate || '';
  const people = Number(peopleCount) || 0;
  const slot = slotLabel || '';
  const parts = [];
  if (date) parts.push(date);
  if (people) parts.push(`${people} 人`);
  if (slot) parts.push(slot);
  return {
    title: '确认排座',
    subtitle: parts.join(' · '),
  };
}

module.exports = {
  buildAssignTimerUrl,
  parseAssignQuery,
  assertCanPickAssignSeat,
  toggleAssignSeatSelection,
  syncAssignSelectionMeta,
  buildAssignBanner,
};
