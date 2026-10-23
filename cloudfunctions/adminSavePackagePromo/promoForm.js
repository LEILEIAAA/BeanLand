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

function formatRateText(rate) {
  const n = Number(rate);
  if (!(n > 0 && n < 10)) return '';
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** tip 为空或形如「全场8折」时，跟随折扣率自动同步。 */
function shouldAutoSyncTip(tip) {
  const text = toStr(tip);
  return !text || /^全场[\d.]+折$/.test(text);
}

function formatPromoTip(rate) {
  const rateText = formatRateText(rate);
  return rateText ? `全场${rateText}折` : '';
}

function syncPromoTip(tip, discountRate) {
  if (!shouldAutoSyncTip(tip)) return toStr(tip);
  return formatPromoTip(discountRate) || toStr(tip);
}

/**
 * Normalize raw admin promo input.
 * discountRate is in "折" units: 8 = 8折 = 80%.
 */
function normalizePromoInput(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const discountRate = toNumber(raw.discountRate);
  return {
    active: toBool(raw.active),
    discountRate,
    label: toStr(raw.label),
    tip: syncPromoTip(raw.tip, discountRate),
  };
}

/**
 * Validate a normalized promo draft.
 * When active, discountRate must be within (0, 10).
 */
function validatePromo(draft) {
  if (!draft) {
    return { ok: false, message: '参数缺失' };
  }
  if (draft.active && !(draft.discountRate > 0 && draft.discountRate < 10)) {
    return { ok: false, message: '折扣需在 0-10 之间（如 8 表示 8 折）' };
  }
  return { ok: true };
}

function buildPromoDoc(draft) {
  return {
    active: draft.active,
    discountRate: draft.discountRate,
    label: draft.label,
    tip: syncPromoTip(draft.tip, draft.discountRate),
  };
}

module.exports = {
  formatRateText,
  formatPromoTip,
  shouldAutoSyncTip,
  syncPromoTip,
  normalizePromoInput,
  validatePromo,
  buildPromoDoc,
};
