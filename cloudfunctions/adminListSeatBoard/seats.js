function buildSeatsFromTables(tables, options = {}) {
  const seats = [];
  const seatIdSeparator =
    options.seatIdSeparator === undefined ? '-' : options.seatIdSeparator;

  for (const table of tables) {
    if (table.bookable === false) {
      continue;
    }

    for (let index = 1; index <= table.capacity; index += 1) {
      seats.push({
        id: `${table.code}${seatIdSeparator}${index}`,
        tableCode: table.code,
        area: table.area,
        index,
        capacity: table.capacity,
        maintenance: false,
      });
    }
  }

  return seats;
}

function isContiguousSameTable(seatIds, seatsById) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return false;
  }

  const resolved = seatIds.map((id) => seatsById[id]);
  if (resolved.some((seat) => !seat)) {
    return false;
  }

  const tableCode = resolved[0].tableCode;
  if (resolved.some((seat) => seat.tableCode !== tableCode)) {
    return false;
  }

  const indexes = resolved.map((seat) => seat.index).sort((a, b) => a - b);
  for (let i = 1; i < indexes.length; i += 1) {
    if (indexes[i] !== indexes[i - 1] + 1) {
      return false;
    }
  }

  return true;
}

function findContiguousCombos(tableSeats, peopleCount, isAvailable) {
  if (peopleCount < 1) {
    return [];
  }

  const ordered = [...tableSeats].sort((a, b) => a.index - b.index);
  const combos = [];

  for (let start = 0; start <= ordered.length - peopleCount; start += 1) {
    const slice = ordered.slice(start, start + peopleCount);
    const contiguous = slice.every((seat, offset) => {
      if (offset === 0) {
        return true;
      }
      return seat.index === slice[offset - 1].index + 1;
    });

    if (!contiguous) {
      continue;
    }

    if (slice.every((seat) => isAvailable(seat.id))) {
      combos.push(slice.map((seat) => seat.id));
    }
  }

  return combos;
}

function getSeatUserStatus(seat, context) {
  const { bookedSeatIds = new Set(), inUseSeatIds = new Set() } = context;

  if (seat.maintenance || inUseSeatIds.has(seat.id)) {
    return 'unavailable';
  }

  if (bookedSeatIds.has(seat.id)) {
    return 'booked';
  }

  return 'available';
}

function getSeatAdminStatus(seat, context) {
  const {
    reservedSeatIds = new Set(),
    inUse = {},
    maintenanceIds = new Set(),
  } = context;

  if (maintenanceIds.has(seat.id) || seat.maintenance) {
    return 'maintenance';
  }

  if (Object.prototype.hasOwnProperty.call(inUse, seat.id)) {
    return {
      status: 'in_use',
      remainingMinutes: inUse[seat.id].remainingMinutes,
    };
  }

  if (reservedSeatIds.has(seat.id)) {
    return 'reserved';
  }

  return 'idle';
}

function assertCanBookSeats({
  seats,
  seatIds,
  peopleCount,
  bookedSeatIds = new Set(),
  inUseSeatIds = new Set(),
  maintenanceIds = new Set(),
}) {
  if (!Array.isArray(seatIds) || seatIds.length !== peopleCount) {
    return { ok: false, reason: '人数与座位数不一致' };
  }

  const seatsById = Object.fromEntries(seats.map((seat) => [seat.id, seat]));
  const uniqueIds = new Set(seatIds);

  if (uniqueIds.size !== seatIds.length) {
    return { ok: false, reason: '座位选择有重复' };
  }

  for (const seatId of seatIds) {
    const seat = seatsById[seatId];
    if (!seat) {
      return { ok: false, reason: '座位不存在' };
    }

    const userStatus = getSeatUserStatus(
      {
        ...seat,
        maintenance: seat.maintenance || maintenanceIds.has(seatId),
      },
      { bookedSeatIds, inUseSeatIds },
    );

    if (userStatus !== 'available') {
      return { ok: false, reason: '座位不可约' };
    }
  }

  return { ok: true };
}

function groupSeatsByTable(seats) {
  const groups = [];
  const byTable = new Map();

  for (const seat of seats) {
    if (!byTable.has(seat.tableCode)) {
      byTable.set(seat.tableCode, []);
    }
    byTable.get(seat.tableCode).push(seat);
  }

  for (const [tableCode, tableSeats] of byTable.entries()) {
    tableSeats.sort((a, b) => a.index - b.index);
    groups.push({
      tableCode,
      area: tableSeats[0].area,
      seats: tableSeats,
    });
  }

  return groups;
}

function isSlotScopedOccupancy(item) {
  return Boolean(item && item.date && item.timeSlot);
}

function isLiveFloorOccupancy(item) {
  if (!item) return false;
  if (item.type !== 'in_use' && item.type !== 'maintenance') return false;
  return !isSlotScopedOccupancy(item);
}

function mergeOccupancyDocs(...groups) {
  const byId = new Map();
  let auto = 0;
  for (const group of groups) {
    for (const row of group || []) {
      if (!row) continue;
      const key =
        row._id != null && row._id !== ''
          ? String(row._id)
          : `anon_${auto++}_${row.type || ''}_${row.seatId || ''}`;
      byId.set(key, row);
    }
  }
  return [...byId.values()];
}

function buildOccupancySets(occupancies, date, timeSlot) {
  const bookedSeatIds = new Set();
  const inUseSeatIds = new Set();
  const maintenanceIds = new Set();
  const reservedSeatIds = new Set();
  const inUse = {};

  for (const item of occupancies) {
    const liveFloor = isLiveFloorOccupancy(item);
    if (!liveFloor && (item.date !== date || item.timeSlot !== timeSlot)) {
      continue;
    }

    if (item.type === 'reserved' || item.type === 'arrived') {
      bookedSeatIds.add(item.seatId);
      reservedSeatIds.add(item.seatId);
    } else if (item.type === 'in_use') {
      inUseSeatIds.add(item.seatId);
      inUse[item.seatId] = { remainingMinutes: item.remainingMinutes };
    } else if (item.type === 'maintenance') {
      maintenanceIds.add(item.seatId);
    }
  }

  return {
    bookedSeatIds,
    inUseSeatIds,
    maintenanceIds,
    reservedSeatIds,
    inUse,
  };
}

function buildOccupancyUnion(occupancies, date, timeSlots) {
  const bookedSeatIds = new Set();
  const inUseSeatIds = new Set();
  const maintenanceIds = new Set();
  const reservedSeatIds = new Set();
  const inUse = {};
  const slots = Array.isArray(timeSlots) ? timeSlots : [];

  for (const timeSlot of slots) {
    const part = buildOccupancySets(occupancies, date, timeSlot);
    for (const seatId of part.bookedSeatIds) {
      bookedSeatIds.add(seatId);
    }
    for (const seatId of part.reservedSeatIds) {
      reservedSeatIds.add(seatId);
    }
    for (const seatId of part.inUseSeatIds) {
      inUseSeatIds.add(seatId);
    }
    for (const seatId of part.maintenanceIds) {
      maintenanceIds.add(seatId);
    }
    Object.assign(inUse, part.inUse);
  }

  return {
    bookedSeatIds,
    inUseSeatIds,
    maintenanceIds,
    reservedSeatIds,
    inUse,
  };
}

module.exports = {
  buildSeatsFromTables,
  isContiguousSameTable,
  findContiguousCombos,
  getSeatUserStatus,
  getSeatAdminStatus,
  assertCanBookSeats,
  groupSeatsByTable,
  isLiveFloorOccupancy,
  mergeOccupancyDocs,
  buildOccupancySets,
  buildOccupancyUnion,
};
