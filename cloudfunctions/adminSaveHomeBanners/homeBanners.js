const MAX_BANNERS = 8;

function toStr(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeBanner(item) {
  const raw = item && typeof item === 'object' ? item : {};
  return {
    src: toStr(raw.src),
    caption: toStr(raw.caption),
  };
}

function normalizeBanners(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(normalizeBanner)
    .filter((banner) => banner.src)
    .slice(0, MAX_BANNERS);
}

function validateBanners(list) {
  if (!Array.isArray(list)) {
    return { ok: false, message: '轮播数据格式错误' };
  }
  const banners = normalizeBanners(list);
  if (!banners.length) {
    return { ok: false, message: '至少配置一张轮播图' };
  }
  return { ok: true, banners };
}

module.exports = {
  MAX_BANNERS,
  normalizeBanner,
  normalizeBanners,
  validateBanners,
};
