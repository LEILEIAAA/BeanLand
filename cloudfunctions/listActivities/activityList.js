function normalizeActivityRow(row) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id || row._id || '').trim();
  if (!id) return null;
  return {
    ...row,
    id,
    registeredCount: Number(row.registeredCount || 0),
    capacity: Number(row.capacity || 0),
    price: Number(row.price || 0),
  };
}

function mapActivityList(rows) {
  return (rows || []).map(normalizeActivityRow).filter(Boolean);
}

function buildSeatSnapshot(activity) {
  return {
    registeredCount: Number((activity && activity.registeredCount) || 0),
    capacity: Number((activity && activity.capacity) || 0),
    activityStatus: (activity && activity.status) || '',
  };
}

module.exports = {
  normalizeActivityRow,
  mapActivityList,
  buildSeatSnapshot,
};
