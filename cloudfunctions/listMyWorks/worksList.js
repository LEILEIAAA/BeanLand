function clampLimit(limit, fallback) {
  const base = fallback == null ? 50 : fallback;
  const n = Number(limit);
  if (!Number.isFinite(n)) {
    return Math.min(Math.max(base, 1), 100);
  }
  return Math.min(Math.max(n, 1), 100);
}

function takeNewestWorks(list, limit) {
  const n = clampLimit(limit);
  return (Array.isArray(list) ? list : [])
    .slice()
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, n);
}

function isCollectionMissingError(error) {
  const code = error && (error.errCode || error.code);
  if (code === -502005 || code === 'DATABASE_COLLECTION_NOT_EXIST') {
    return true;
  }
  const msg = String((error && (error.errMsg || error.message)) || '');
  return /COLLECTION_NOT_EXIST|Db or Table not exist/i.test(msg);
}

module.exports = {
  clampLimit,
  takeNewestWorks,
  isCollectionMissingError,
};
