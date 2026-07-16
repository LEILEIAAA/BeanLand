function buildOccupancyId(date, timeSlot, seatId) {
  if (!date) {
    throw new Error('date is required');
  }
  if (!timeSlot) {
    throw new Error('timeSlot is required');
  }
  if (!seatId) {
    throw new Error('seatId is required');
  }
  return `${date}_${timeSlot}_${seatId}`;
}

function parseOccupancyId(occupancyId) {
  const text = String(occupancyId || '');
  const first = text.indexOf('_');
  const last = text.lastIndexOf('_');
  if (first <= 0 || last <= first) {
    throw new Error('invalid occupancyId');
  }
  return {
    date: text.slice(0, first),
    timeSlot: text.slice(first + 1, last),
    seatId: text.slice(last + 1),
  };
}

module.exports = {
  buildOccupancyId,
  parseOccupancyId,
};
