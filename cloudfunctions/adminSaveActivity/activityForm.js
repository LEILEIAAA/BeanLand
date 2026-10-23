const ACTIVITY_STATUSES = [
  'recruiting',
  'consulting',
  'full',
  'ended',
  'cancelled',
  'draft',
];

function normalizeKeyword(value) {
  return toStr(value);
}

// 角标配色预设（会员端海报英文角标底色/字色）。
const ACCENT_THEMES = {
  yellow: { accent: '#FFB80A', orbInk: '#18181b' },
  orange: { accent: '#FF3D02', orbInk: '#ffffff' },
  green: { accent: '#69D868', orbInk: '#18181b' },
};

function normalizeAccentTheme(value) {
  const v = String(value === undefined || value === null ? '' : value).trim();
  return ACCENT_THEMES[v] ? v : 'yellow';
}

function toStr(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toStr(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,，、]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function slugify(text) {
  return toStr(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** China local wall time (YYYY-MM-DD, HH:mm) -> epoch ms (Asia/Shanghai, UTC+8). */
function chinaDateTimeToMs(dateText, timeText) {
  const date = toStr(dateText);
  const time = toStr(timeText) || '00:00';
  const dm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  const tm = /^(\d{1,2}):(\d{1,2})$/.exec(time);
  if (!dm || !tm) return 0;
  const year = Number(dm[1]);
  const month = Number(dm[2]);
  const day = Number(dm[3]);
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  return Date.UTC(year, month - 1, day, hour - 8, minute, 0);
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

/**
 * Normalize raw admin form input into a clean activity draft.
 */
function normalizeActivityInput(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const status = ACTIVITY_STATUSES.includes(toStr(raw.status))
    ? toStr(raw.status)
    : 'recruiting';
  let startAt = 0;
  if (raw.startAt !== undefined && raw.startAt !== '' && raw.startAt !== null) {
    startAt = Math.floor(toNumber(raw.startAt));
  } else if (raw.startDate) {
    startAt = chinaDateTimeToMs(raw.startDate, raw.startTime);
  }
  return {
    id: toStr(raw.id),
    name: toStr(raw.name),
    price: toNumber(raw.price),
    capacity: Math.max(0, Math.floor(toNumber(raw.capacity))),
    status,
    keyword: normalizeKeyword(raw.keyword),
    accentTheme: normalizeAccentTheme(raw.accentTheme),
    blurb: toStr(raw.blurb),
    onShelf: raw.onShelf === undefined ? true : toBool(raw.onShelf),
    coverImage: toStr(raw.coverImage),
    startAt,
    scheduleText: toStr(raw.scheduleText),
    timeText: toStr(raw.timeText),
    audience: toStr(raw.audience),
    content: toStr(raw.content),
    includes: toStringArray(raw.includes),
    notice: toStr(raw.notice),
    sortOrder: Math.floor(toNumber(raw.sortOrder)),
  };
}

/**
 * Validate a normalized activity draft.
 */
function validateActivity(draft) {
  if (!draft || !draft.name) {
    return { ok: false, message: '活动名称必填' };
  }
  if (!(draft.price >= 0)) {
    return { ok: false, message: '价格不能为负' };
  }
  if (!(draft.capacity >= 0)) {
    return { ok: false, message: '名额不能为负' };
  }
  if (!ACTIVITY_STATUSES.includes(draft.status)) {
    return { ok: false, message: '状态非法' };
  }
  return { ok: true };
}

/**
 * Build the persistable activity document.
 * Preserves registeredCount from existing row (not admin-editable here).
 */
function buildActivityDoc(draft, options) {
  const opts = options || {};
  const now = opts.now || Date.now();
  const doc = {
    name: draft.name,
    price: draft.price,
    capacity: draft.capacity,
    status: draft.status,
    keyword: draft.keyword,
    accentTheme: draft.accentTheme,
    blurb: draft.blurb,
    onShelf: draft.onShelf,
    coverImage: draft.coverImage,
    scheduleText: draft.scheduleText,
    timeText: draft.timeText,
    audience: draft.audience,
    content: draft.content,
    includes: draft.includes,
    notice: draft.notice,
    sortOrder: draft.sortOrder,
    updatedAt: now,
  };
  if (draft.startAt > 0) {
    doc.startAt = draft.startAt;
  }
  const id = draft.id || slugify(draft.name) || `act-${now}`;
  doc.id = id;
  if (opts.isCreate) {
    doc.createdAt = now;
    doc.registeredCount = Number(opts.registeredCount || 0);
  }
  return doc;
}

module.exports = {
  ACTIVITY_STATUSES,
  normalizeKeyword,
  ACCENT_THEMES,
  normalizeAccentTheme,
  chinaDateTimeToMs,
  msToChinaDateTime,
  slugify,
  toStringArray,
  normalizeActivityInput,
  validateActivity,
  buildActivityDoc,
};
