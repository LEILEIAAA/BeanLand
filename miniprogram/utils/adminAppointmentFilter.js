const ADMIN_APPOINTMENT_FILTER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'ended', label: '已结束' },
];

const DEFAULT_ADMIN_APPOINTMENT_FILTER = 'pending';

const ENDED_STATUSES = new Set([
  'rejected',
  'cancelled',
  'arrived',
  'no_show',
  'completed',
]);

function filterAdminAppointments(list, filterKey) {
  const rows = Array.isArray(list) ? list : [];
  const key = filterKey || DEFAULT_ADMIN_APPOINTMENT_FILTER;
  if (key === 'all') return rows.slice();
  if (key === 'pending' || key === 'confirmed') {
    return rows.filter((item) => (item && item.status) === key);
  }
  if (key === 'ended') {
    return rows.filter((item) => ENDED_STATUSES.has(item && item.status));
  }
  return rows.slice();
}

module.exports = {
  ADMIN_APPOINTMENT_FILTER_TABS,
  DEFAULT_ADMIN_APPOINTMENT_FILTER,
  ENDED_STATUSES,
  filterAdminAppointments,
};
