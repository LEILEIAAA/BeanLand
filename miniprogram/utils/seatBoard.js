function unwrapNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object') {
    if (value.$numberInt != null) return Number(value.$numberInt);
    if (value.$numberLong != null) return Number(value.$numberLong);
    if (value.$numberDouble != null) return Number(value.$numberDouble);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSeatRow(row) {
  if (!row) return null;
  const id = row.id || row._id || '';
  if (!id) return null;
  return {
    id,
    tableCode: row.tableCode || '',
    area: row.area || '',
    index: unwrapNumber(row.index),
    capacity: unwrapNumber(row.capacity),
    maintenance: !!row.maintenance,
  };
}

/** Prefer seats returned by adminListSeatBoard; else client fallback. */
function resolveSeatsForBoard(board, clientSeats) {
  const fromBoard = Array.isArray(board && board.seats) ? board.seats : [];
  if (fromBoard.length) {
    return fromBoard.map(normalizeSeatRow).filter(Boolean);
  }
  const fallback = Array.isArray(clientSeats) ? clientSeats : [];
  return fallback.map(normalizeSeatRow).filter(Boolean);
}

module.exports = {
  unwrapNumber,
  normalizeSeatRow,
  resolveSeatsForBoard,
};
