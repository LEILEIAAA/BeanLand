function toStr(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/** China local wall time (YYYY-MM-DD, HH:mm) -> epoch ms (Asia/Shanghai, UTC+8). */
function chinaDateTimeToMs(dateText, timeText) {
  const date = toStr(dateText);
  const time = toStr(timeText) || '00:00';
  const dm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  const tm = /^(\d{1,2}):(\d{1,2})$/.exec(time);
  if (!dm || !tm) return 0;
  return Date.UTC(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]) - 8,
    Number(tm[2]),
    0,
  );
}

/** epoch ms -> { date: 'YYYY-MM-DD', time: 'HH:mm' } in Asia/Shanghai. */
function msToChinaDateTime(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return { date: '', time: '' };
  const shifted = new Date(n + 8 * 3600 * 1000);
  const pad = (v) => String(v).padStart(2, '0');
  const date = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  const time = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
  return { date, time };
}

module.exports = {
  chinaDateTimeToMs,
  msToChinaDateTime,
};
