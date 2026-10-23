function normalizeKeyword(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function buildActivityFilters(list) {
  const filters = [
    { id: 'all', label: '全部' },
    { id: 'recruiting', label: '招募中' },
  ];
  const seen = new Set();
  (list || []).forEach((item) => {
    const keyword = normalizeKeyword(item && item.keyword);
    if (!keyword || seen.has(keyword)) return;
    seen.add(keyword);
    filters.push({ id: keyword, label: keyword });
  });
  return filters;
}

function filterActivities(list, filterId) {
  const rows = list || [];
  if (filterId === 'all') return rows;
  if (filterId === 'recruiting') {
    return rows.filter((item) => item.status === 'recruiting');
  }
  return rows.filter((item) => normalizeKeyword(item.keyword) === filterId);
}

module.exports = {
  normalizeKeyword,
  buildActivityFilters,
  filterActivities,
};
