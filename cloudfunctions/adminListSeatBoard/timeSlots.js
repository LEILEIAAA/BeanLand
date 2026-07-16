function parseSlotBounds(timeSlot) {
  const [start, end] = String(timeSlot || '').split('-');
  if (!start || !end) {
    throw new Error('invalid timeSlot');
  }
  return { start, end };
}

function areWallClockAdjacent(prevSlot, nextSlot) {
  try {
    const prev = parseSlotBounds(prevSlot);
    const next = parseSlotBounds(nextSlot);
    return prev.end === next.start;
  } catch {
    return false;
  }
}

function formatSlotSpan(timeSlots) {
  if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
    return '';
  }
  const first = parseSlotBounds(timeSlots[0]);
  const last = parseSlotBounds(timeSlots[timeSlots.length - 1]);
  return `${first.start}-${last.end}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateResult(date) {
  const utcMs = date.getTime();
  const china = new Date(utcMs + 8 * 60 * 60 * 1000);
  const year = china.getUTCFullYear();
  const month = pad(china.getUTCMonth() + 1);
  const day = pad(china.getUTCDate());
  const hour = pad(china.getUTCHours());
  const minute = pad(china.getUTCMinutes());

  return {
    iso: `${year}-${month}-${day}T${hour}:${minute}:00.000+08:00`,
    display: `${year}-${month}-${day} ${hour}:${minute}`,
  };
}

function calculateExpectedEndFromSlots(date, timeSlots) {
  if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
    throw new Error('timeSlots required');
  }
  const { end } = parseSlotBounds(timeSlots[timeSlots.length - 1]);
  const [hour, minute] = end.split(':').map(Number);
  const endDate = new Date(`${date}T${pad(hour)}:${pad(minute)}:00+08:00`);
  return formatDateResult(endDate);
}

function indexesToSlots(allSlots, indexes) {
  return indexes.map((index) => allSlots[index]);
}

function toggleContiguousSelection(allSlots, selectedIndexes, tapIndex) {
  const reason = '请选择连续时段';
  const sorted = [...selectedIndexes].sort((a, b) => a - b);
  const tap = Number(tapIndex);

  if (!Number.isInteger(tap) || tap < 0 || tap >= allSlots.length) {
    return { ok: false, reason, next: sorted };
  }

  const selectedSet = new Set(sorted);

  if (selectedSet.has(tap)) {
    if (sorted.length <= 1) {
      return { ok: false, reason, next: sorted };
    }
    if (tap !== sorted[0] && tap !== sorted[sorted.length - 1]) {
      return { ok: false, reason, next: sorted };
    }
    return { ok: true, next: sorted.filter((index) => index !== tap) };
  }

  if (sorted.length === 0) {
    return { ok: true, next: [tap] };
  }

  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (tap === min - 1) {
    if (!areWallClockAdjacent(allSlots[tap], allSlots[min])) {
      return { ok: false, reason, next: sorted };
    }
    return { ok: true, next: [tap, ...sorted] };
  }

  if (tap === max + 1) {
    if (!areWallClockAdjacent(allSlots[max], allSlots[tap])) {
      return { ok: false, reason, next: sorted };
    }
    return { ok: true, next: [...sorted, tap] };
  }

  return { ok: false, reason, next: sorted };
}

module.exports = {
  parseSlotBounds,
  areWallClockAdjacent,
  formatSlotSpan,
  calculateExpectedEndFromSlots,
  indexesToSlots,
  toggleContiguousSelection,
};
