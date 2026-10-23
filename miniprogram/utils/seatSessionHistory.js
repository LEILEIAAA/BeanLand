const { formatYuan } = require('./money');

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

function chinaParts(ms) {
  const n = Number(ms);
  if (!n) return null;
  const d = new Date(n + 8 * 60 * 60 * 1000);
  return {
    year: d.getUTCFullYear(),
    month: pad2(d.getUTCMonth() + 1),
    day: pad2(d.getUTCDate()),
    hour: pad2(d.getUTCHours()),
    minute: pad2(d.getUTCMinutes()),
  };
}

/** 会员到店：年月日 + 时间范围；同日省略结束日期 */
function formatMemberTimeRangeLabel(startedAt, endedAt) {
  const start = chinaParts(startedAt);
  if (!start) return '';
  const startDate = `${start.year}-${start.month}-${start.day}`;
  const startTime = `${start.hour}:${start.minute}`;
  const end = chinaParts(endedAt);
  if (!end) return `${startDate} ${startTime}`;
  const endDate = `${end.year}-${end.month}-${end.day}`;
  const endTime = `${end.hour}:${end.minute}`;
  if (startDate === endDate) return `${startDate} ${startTime} - ${endTime}`;
  return `${startDate} ${startTime} - ${endDate} ${endTime}`;
}

function formatDurationLabel(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`;
}

/** 进行中耗时：已进行 45分钟 / 已进行 2小时25分 */
function formatActiveElapsedLabel(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  if (m < 60) return `已进行 ${m}分钟`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `已进行 ${h}小时${rest}分` : `已进行 ${h}小时`;
}

function elapsedMinutesFromStart(startedAt, now) {
  const start = Number(startedAt);
  const current = Number(now);
  if (!Number.isFinite(start) || !Number.isFinite(current)) return 0;
  return Math.max(0, Math.floor((current - start) / 60000));
}

/** 仅接受毫秒时间戳；拒绝 Array.map 下标等小数 */
function resolveClock(now) {
  const n = Number(now);
  if (Number.isFinite(n) && n >= 1e12) return n;
  return Date.now();
}

function formatAmountLabel(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `¥${formatYuan(n)}`;
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
  const phone = String((row && row.memberPhone) || '');
  return {
    id: (row && (row._id || row.id)) || '',
    memberLabel: `${(row && row.memberNickname) || '会员'}${
      phone ? ` · ${phone}` : ''
    }`,
    memberPhone: phone,
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

function mapMemberSessionRow(row, now) {
  const total = Number((row && row.totalMinutes) || 0);
  const overtime = Number((row && row.overtimeMinutes) || 0);
  const active = (row && row.status) === 'active';
  const clock = resolveClock(now);
  const durationLabel = active
    ? formatActiveElapsedLabel(elapsedMinutesFromStart(row && row.startedAt, clock))
    : formatDurationLabel(total);
  const dateLabel = formatChinaDateTime(row && row.startedAt);
  const endedLabel = formatChinaDateTime(row && row.endedAt);
  const timeRangeLabel = formatMemberTimeRangeLabel(
    row && row.startedAt,
    row && row.endedAt,
  );
  return {
    id: (row && (row._id || row.id)) || '',
    tableCode: (row && row.tableCode) || '',
    seatLabel: seatLabelOf(row),
    dateLabel,
    endedLabel,
    timeRangeLabel,
    active,
    statusLabel: active ? '进行中' : '已结束',
    durationLabel,
    overtimeLabel: overtime > 0 ? formatDurationLabel(overtime) : '',
    isOvertime: overtime > 0,
    packageName: (row && row.packageName) || '',
    amountLabel: formatAmountLabel(row && row.consumedAmount),
  };
}

/** 取最近一条进行中会话行；无则 null */
function findActiveMemberSession(list, now) {
  const rows = Array.isArray(list) ? list : [];
  const active = rows
    .filter((row) => row && row.status === 'active')
    .sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0))[0];
  if (!active) return null;
  return mapMemberSessionRow(active, resolveClock(now));
}

/** 取进行中会话的耗时文案；无则空串 */
function activeElapsedLabelFromSessions(list, now) {
  const row = findActiveMemberSession(list, now);
  return row ? row.durationLabel : '';
}

module.exports = {
  formatChinaDateTime,
  formatMemberTimeRangeLabel,
  formatDurationLabel,
  formatActiveElapsedLabel,
  formatAmountLabel,
  mapAdminSessionRow,
  mapMemberSessionRow,
  findActiveMemberSession,
  activeElapsedLabelFromSessions,
};
