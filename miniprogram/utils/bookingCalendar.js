// 选座预约·日期条纯逻辑（按天横向滑，店休标记）
// getUTCDay: 0=周日 ... 6=周六

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function chinaTodayIso(now = Date.now()) {
  const china = new Date(now + 8 * 60 * 60 * 1000);
  return `${china.getUTCFullYear()}-${pad(china.getUTCMonth() + 1)}-${pad(china.getUTCDate())}`;
}

function addDaysIso(isoDate, days) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const utc = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const dt = new Date(utc);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function weekdayOf(isoDate) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return -1;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function monthTitle(isoDate) {
  const [y, m] = String(isoDate || '').split('-').map(Number);
  if (!y || !m) return '';
  return `${MONTH_EN[m - 1]} ${y}`;
}

// 生成从 todayIso 开始的 days 天日期条；restWeekdays 是 getUTCDay 数组（如 [1] = 每周一店休）
function buildDateStrip(todayIso, days = 14, restWeekdays = []) {
  const rest = new Set((restWeekdays || []).map(Number));
  const out = [];
  const total = Math.max(1, Number(days) || 1);
  for (let i = 0; i < total; i += 1) {
    const iso = addDaysIso(todayIso, i);
    if (!iso) break;
    const wd = weekdayOf(iso);
    const [, mm, dd] = iso.split('-');
    out.push({
      iso,
      weekdayLabel: WEEKDAY_LABELS[wd] || '',
      monthDay: `${Number(mm)}/${Number(dd)}`,
      isToday: i === 0,
      isRest: rest.has(wd),
    });
  }
  return out;
}

module.exports = {
  WEEKDAY_LABELS,
  MONTH_EN,
  chinaTodayIso,
  addDaysIso,
  weekdayOf,
  monthTitle,
  buildDateStrip,
};
