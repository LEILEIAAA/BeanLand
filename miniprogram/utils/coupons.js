const STATUS = {
  UNUSED: 'unused',
  USED: 'used',
  EXPIRED: 'expired',
};

const TAB = {
  UNUSED: 'unused',
  USED: 'used',
  EXPIRED: 'expired',
};

const CATEGORY = {
  CHECKIN: 'checkin',
  TEACHER: 'teacher',
  BEST_WORK: 'best_work',
};

const CATEGORY_LABEL = {
  [CATEGORY.CHECKIN]: '打卡奖励',
  [CATEGORY.TEACHER]: '老师专属',
  [CATEGORY.BEST_WORK]: '最佳作品',
};

const BENEFIT_TYPE = {
  HOURS: 'hours',
  DISCOUNT: 'discount',
};

function isPastExpire(coupon, now) {
  const expireAt = Number(coupon && coupon.expireAt);
  if (!Number.isFinite(expireAt) || expireAt <= 0) return false;
  return Number(now) > expireAt;
}

function isBeforeValid(coupon, now) {
  const validFrom = Number(coupon && coupon.validFrom);
  if (!Number.isFinite(validFrom) || validFrom <= 0) return false;
  return Number(now) < validFrom;
}

function promoteIfExpired(coupon, now) {
  if (!coupon || coupon.status !== STATUS.UNUSED) {
    return { coupon, changed: false };
  }
  if (!isPastExpire(coupon, now)) {
    return { coupon, changed: false };
  }
  return {
    coupon: { ...coupon, status: STATUS.EXPIRED },
    changed: true,
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateYmd(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatValidRange(coupon) {
  const from = formatDateYmd(coupon && coupon.validFrom);
  const to = formatDateYmd(coupon && coupon.expireAt);
  if (from && to) return `${from} 至 ${to}`;
  if (to) return `至 ${to}`;
  if (from) return `${from} 起`;
  return '';
}

function parseYmdParts(ymd) {
  const text = String(ymd || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseYmdStartMs(ymd) {
  const parts = parseYmdParts(ymd);
  if (!parts) return NaN;
  return new Date(parts.year, parts.month - 1, parts.day).getTime();
}

function parseYmdEndMs(ymd) {
  const parts = parseYmdParts(ymd);
  if (!parts) return NaN;
  return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999).getTime();
}

function buildCouponName(category, benefitType, benefitValue) {
  const label = CATEGORY_LABEL[category] || '';
  const value = Number(benefitValue);
  if (benefitType === BENEFIT_TYPE.HOURS) {
    return `${label} · 赠送 ${value} 小时`;
  }
  if (benefitType === BENEFIT_TYPE.DISCOUNT) {
    return `${label} · ${value} 折`;
  }
  return label;
}

function formatBenefitText(coupon) {
  if (!coupon) return '';
  const value = Number(coupon.benefitValue);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (coupon.benefitType === BENEFIT_TYPE.HOURS) return `${value}小时`;
  if (coupon.benefitType === BENEFIT_TYPE.DISCOUNT) return `${value}折`;
  return '';
}

function withEffectiveAvailability(coupon, now) {
  const { coupon: promoted } = promoteIfExpired(coupon, now);
  if (!promoted || promoted.status !== STATUS.UNUSED) {
    return promoted;
  }
  if (isBeforeValid(promoted, now)) {
    return {
      ...promoted,
      available: false,
      unavailableReason: '未到使用期',
    };
  }
  return {
    ...promoted,
    available: true,
    unavailableReason: '',
  };
}

function filterCouponsForTab(rows, tab, now) {
  const expiredIds = [];
  const list = [];
  const target = tab || TAB.UNUSED;

  (rows || []).forEach((row) => {
    const { coupon, changed } = promoteIfExpired(row, now);
    if (changed && row && row._id) {
      expiredIds.push(row._id);
    }
    if (coupon.status !== target) return;
    list.push(target === TAB.UNUSED ? withEffectiveAvailability(coupon, now) : coupon);
  });

  return { list, expiredIds };
}

function countAvailable(rows, now) {
  let count = 0;
  (rows || []).forEach((row) => {
    const next = withEffectiveAvailability(row, now);
    if (next && next.status === STATUS.UNUSED && next.available === true) {
      count += 1;
    }
  });
  return count;
}

function canRedeem(coupon, now) {
  if (!coupon) return false;
  const next = withEffectiveAvailability(coupon, now);
  return !!(next && next.status === STATUS.UNUSED && next.available === true);
}

function buildIssueCouponPayload(input, now) {
  const memberId = String((input && input.memberId) || '').trim();
  const openid = String((input && input.openid) || '').trim();
  const issuedBy = String((input && input.issuedBy) || '').trim();
  const category = String((input && input.category) || '').trim();
  const benefitType = String((input && input.benefitType) || '').trim();
  const benefitValue = Number(input && input.benefitValue);
  const validFromDate = String((input && input.validFromDate) || '').trim();
  const expireAtDate = String((input && input.expireAtDate) || '').trim();

  if (!memberId || !openid) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'memberId and openid required',
    };
  }
  if (!CATEGORY_LABEL[category]) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'invalid category',
    };
  }
  if (benefitType !== BENEFIT_TYPE.HOURS && benefitType !== BENEFIT_TYPE.DISCOUNT) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'invalid benefitType',
    };
  }
  if (!Number.isFinite(benefitValue) || benefitValue <= 0) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'benefitValue must be > 0',
    };
  }

  const validFrom = parseYmdStartMs(validFromDate);
  const expireAt = parseYmdEndMs(expireAtDate);
  if (!Number.isFinite(validFrom) || !Number.isFinite(expireAt) || validFrom > expireAt) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'validFromDate/expireAtDate invalid',
    };
  }

  const ts = Number(now) || Date.now();
  return {
    ok: true,
    coupon: {
      _openid: openid,
      memberId,
      category,
      benefitType,
      benefitValue,
      name: buildCouponName(category, benefitType, benefitValue),
      status: STATUS.UNUSED,
      available: true,
      unavailableReason: '',
      validFrom,
      expireAt,
      issuedBy,
      createdAt: ts,
      updatedAt: ts,
    },
  };
}

module.exports = {
  STATUS,
  TAB,
  CATEGORY,
  CATEGORY_LABEL,
  BENEFIT_TYPE,
  isPastExpire,
  isBeforeValid,
  promoteIfExpired,
  withEffectiveAvailability,
  formatDateYmd,
  formatValidRange,
  formatBenefitText,
  buildCouponName,
  filterCouponsForTab,
  countAvailable,
  canRedeem,
  buildIssueCouponPayload,
  parseYmdStartMs,
  parseYmdEndMs,
};
