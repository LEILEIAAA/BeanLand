const DAY_MS = 24 * 60 * 60 * 1000;
const CN_OFFSET_MS = 8 * 60 * 60 * 1000;

function filterTransactionsByType(list, type) {
  const rows = Array.isArray(list) ? list : [];
  const key = String(type || '').trim();
  if (!key) return rows.slice();
  return rows.filter((row) => String((row && row.type) || '') === key);
}

function filterTransactionsByOpenid(list, openid) {
  const rows = Array.isArray(list) ? list : [];
  const key = String(openid || '').trim();
  if (!key) return [];
  return rows.filter((row) => String((row && row._openid) || '') === key);
}

/**
 * Merchant-facing signed amount.
 * Wallet ledger: recharge +, consume -, refund +.
 * Merchant view: recharge +, consume +, refund - (consume/refund flipped).
 */
function toMerchantAmount(row) {
  const amount = Number((row && row.amount) || 0);
  if (!Number.isFinite(amount)) return 0;
  const type = String((row && row.type) || '');
  if (type === 'recharge') return Math.abs(amount);
  return -amount;
}

function summarizeTransactions(list) {
  const rows = Array.isArray(list) ? list : [];
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    const amount = toMerchantAmount(row);
    if (!(Number.isFinite(amount) && amount !== 0)) continue;
    if (amount > 0) income += amount;
    else expense += Math.abs(amount);
  }
  return {
    count: rows.length,
    income,
    expense,
    net: income - expense,
  };
}

function parseYmdToChinaDayStartMs(ymd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!(y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  return Date.UTC(y, m - 1, d) - CN_OFFSET_MS;
}

function formatChinaYmd(ms) {
  const china = new Date(Number(ms) + CN_OFFSET_MS);
  const y = china.getUTCFullYear();
  const m = String(china.getUTCMonth() + 1).padStart(2, '0');
  const d = String(china.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function chinaDayStartMs(now = Date.now()) {
  return parseYmdToChinaDayStartMs(formatChinaYmd(now));
}

/**
 * Resolve [startAt, endAt) in epoch ms.
 * preset: today | last7 | last30 | custom | all
 */
function resolveTimeRangeMs({
  preset = 'today',
  startDate = '',
  endDate = '',
  now = Date.now(),
} = {}) {
  const key = String(preset || 'today');
  if (key === 'all') {
    return { startAt: null, endAt: null, startDate: '', endDate: '' };
  }

  if (key === 'custom') {
    let startAt = parseYmdToChinaDayStartMs(startDate);
    let endDay = parseYmdToChinaDayStartMs(endDate);
    if (startAt == null && endDay == null) {
      const todayStart = chinaDayStartMs(now);
      return {
        startAt: todayStart,
        endAt: todayStart + DAY_MS,
        startDate: formatChinaYmd(todayStart),
        endDate: formatChinaYmd(todayStart),
      };
    }
    if (startAt == null) startAt = endDay;
    if (endDay == null) endDay = startAt;
    if (startAt > endDay) {
      const tmp = startAt;
      startAt = endDay;
      endDay = tmp;
    }
    return {
      startAt,
      endAt: endDay + DAY_MS,
      startDate: formatChinaYmd(startAt),
      endDate: formatChinaYmd(endDay),
    };
  }

  const todayStart = chinaDayStartMs(now);
  if (key === 'last7') {
    const startAt = todayStart - 6 * DAY_MS;
    return {
      startAt,
      endAt: todayStart + DAY_MS,
      startDate: formatChinaYmd(startAt),
      endDate: formatChinaYmd(todayStart),
    };
  }
  if (key === 'last30') {
    const startAt = todayStart - 29 * DAY_MS;
    return {
      startAt,
      endAt: todayStart + DAY_MS,
      startDate: formatChinaYmd(startAt),
      endDate: formatChinaYmd(todayStart),
    };
  }

  // today (default)
  return {
    startAt: todayStart,
    endAt: todayStart + DAY_MS,
    startDate: formatChinaYmd(todayStart),
    endDate: formatChinaYmd(todayStart),
  };
}

function filterTransactionsByTime(list, startAt, endAt) {
  const rows = Array.isArray(list) ? list : [];
  const start = startAt == null ? null : Number(startAt);
  const end = endAt == null ? null : Number(endAt);
  return rows.filter((row) => {
    const createdAt = Number((row && row.createdAt) || 0);
    if (!(createdAt > 0)) return false;
    if (start != null && Number.isFinite(start) && createdAt < start) return false;
    if (end != null && Number.isFinite(end) && createdAt >= end) return false;
    return true;
  });
}

module.exports = {
  filterTransactionsByType,
  filterTransactionsByOpenid,
  toMerchantAmount,
  summarizeTransactions,
  parseYmdToChinaDayStartMs,
  formatChinaYmd,
  chinaDayStartMs,
  resolveTimeRangeMs,
  filterTransactionsByTime,
};
