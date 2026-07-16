function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 统一按中国时区（UTC+8）格式化 */
function formatChinaDateTime(ms) {
  const n = Number(ms);
  if (!n) return '';
  const d = new Date(n + 8 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate(),
  )} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function formatDurationLabel(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`;
}

function formatAmountLabel(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `¥${n.toFixed(2)}`;
}

function phoneTail(phone) {
  const text = String(phone || '');
  return text.length >= 4 ? text.slice(-4) : text;
}

function seatLabelOf(row) {
  const snapshot = Array.isArray(row && row.seatIdsSnapshot)
    ? row.seatIdsSnapshot
    : [];
  const live = Array.isArray(row && row.seatIds) ? row.seatIds : [];
  const ids = snapshot.length ? snapshot : live;
  return ids.join('、');
}

function mapAdminSessionRow(row) {
  const total = Number((row && row.totalMinutes) || 0);
  const overtime = Number((row && row.overtimeMinutes) || 0);
  const tail = phoneTail(row && row.memberPhone);
  return {
    id: (row && (row._id || row.id)) || '',
    memberLabel: `${(row && row.memberNickname) || '会员'}${
      tail ? ` · 尾号 ${tail}` : ''
    }`,
    tableCode: (row && row.tableCode) || '',
    seatLabel: seatLabelOf(row),
    dateLabel: formatChinaDateTime(row && row.startedAt),
    endedLabel: formatChinaDateTime(row && row.endedAt),
    durationLabel: formatDurationLabel(total),
    overtimeLabel: overtime > 0 ? formatDurationLabel(overtime) : '',
    isOvertime: overtime > 0,
    packageName: (row && row.packageName) || '',
    amountLabel: formatAmountLabel(row && row.consumedAmount),
  };
}

function mapMemberSessionRow(row) {
  const total = Number((row && row.totalMinutes) || 0);
  const overtime = Number((row && row.overtimeMinutes) || 0);
  const active = (row && row.status) === 'active';
  return {
    id: (row && (row._id || row.id)) || '',
    tableCode: (row && row.tableCode) || '',
    seatLabel: seatLabelOf(row),
    dateLabel: formatChinaDateTime(row && row.startedAt),
    active,
    statusLabel: active ? '进行中' : '已结束',
    durationLabel: active ? '' : formatDurationLabel(total),
    overtimeLabel: overtime > 0 ? formatDurationLabel(overtime) : '',
    isOvertime: overtime > 0,
    packageName: (row && row.packageName) || '',
    amountLabel: formatAmountLabel(row && row.consumedAmount),
  };
}

module.exports = {
  formatChinaDateTime,
  formatDurationLabel,
  formatAmountLabel,
  mapAdminSessionRow,
  mapMemberSessionRow,
};
