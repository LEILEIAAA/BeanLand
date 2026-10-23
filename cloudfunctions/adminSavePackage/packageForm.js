const PACKAGE_TEXT_FIELDS = ['name', 'targetAudience', 'overtimeRule', 'badge'];

// 角标配色预设，先保持两种，与会员套餐页 ribbon 配色对齐。
const PACKAGE_BADGE_COLORS = ['orange', 'yellow'];

function normalizeBadgeColor(value) {
  const v = String(value === undefined || value === null ? '' : value).trim();
  return PACKAGE_BADGE_COLORS.includes(v) ? v : 'orange';
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

/**
 * Normalize raw admin form input into a clean package draft.
 */
function pickNumber(value, fallback) {
  return value === undefined || value === null || value === ''
    ? fallback
    : toNumber(value);
}

function normalizePackageInput(input) {
  const raw = input && typeof input === 'object' ? input : {};
  // 会员端只展示「工作日价 / 周末价」，故以二者为主；price 作内部兜底。
  const weekdayPrice = pickNumber(raw.weekdayPrice, toNumber(raw.price));
  const weekendPrice = pickNumber(raw.weekendPrice, weekdayPrice);
  const price = pickNumber(raw.price, weekdayPrice);
  const draft = {
    id: toStr(raw.id),
    name: toStr(raw.name),
    price,
    weekendPrice,
    weekdayPrice,
    targetAudience: toStr(raw.targetAudience),
    durationMinutes: Math.max(0, Math.floor(toNumber(raw.durationMinutes))),
    overtimeRule: toStr(raw.overtimeRule),
    includedItems: toStringArray(raw.includedItems),
    badge: toStr(raw.badge),
    badgeColor: normalizeBadgeColor(raw.badgeColor),
    skipOpeningDiscount: toBool(raw.skipOpeningDiscount),
    onShelf: raw.onShelf === undefined ? true : toBool(raw.onShelf),
    sortOrder: Math.floor(toNumber(raw.sortOrder)),
  };
  return draft;
}

/**
 * Validate a normalized package draft.
 * @returns {{ ok: boolean, message?: string }}
 */
function validatePackage(draft) {
  if (!draft || !draft.name) {
    return { ok: false, message: '套餐名称必填' };
  }
  if (!(draft.price >= 0) || !(draft.weekendPrice >= 0) || !(draft.weekdayPrice >= 0)) {
    return { ok: false, message: '价格不能为负' };
  }
  if (draft.durationMinutes < 0) {
    return { ok: false, message: '时长不能为负' };
  }
  return { ok: true };
}

/**
 * Build the persistable package document (adds id/timestamps).
 */
function buildPackageDoc(draft, options) {
  const opts = options || {};
  const now = opts.now || Date.now();
  const doc = {
    name: draft.name,
    price: draft.price,
    weekendPrice: draft.weekendPrice,
    weekdayPrice: draft.weekdayPrice,
    targetAudience: draft.targetAudience,
    durationMinutes: draft.durationMinutes,
    overtimeRule: draft.overtimeRule,
    includedItems: draft.includedItems,
    badge: draft.badge,
    badgeColor: draft.badgeColor,
    skipOpeningDiscount: draft.skipOpeningDiscount,
    onShelf: draft.onShelf,
    sortOrder: draft.sortOrder,
    updatedAt: now,
  };
  const id = draft.id || slugify(draft.name) || `pkg-${now}`;
  doc.id = id;
  if (opts.isCreate) {
    doc.createdAt = now;
  }
  return doc;
}

module.exports = {
  PACKAGE_TEXT_FIELDS,
  PACKAGE_BADGE_COLORS,
  normalizeBadgeColor,
  toStringArray,
  slugify,
  normalizePackageInput,
  validatePackage,
  buildPackageDoc,
};
