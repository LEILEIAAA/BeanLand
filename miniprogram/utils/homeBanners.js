const MAX_BANNERS = 8;

/** 包内工坊实拍默认图（非 mock）；云端 heroPhotos 非空时覆盖 */
const DEFAULT_HERO_PHOTOS = [
  { src: '/assets/background/images2.jpg', caption: '顶楼工坊' },
  { src: '/assets/background/image3.jpg', caption: 'MAYDAYLAND' },
  { src: '/assets/background/images1.jpg', caption: '窗边主题墙' },
];

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

function resolveHomeHeroPhotos(cloudList) {
  const banners = normalizeBanners(cloudList);
  return banners.length ? banners : normalizeBanners(DEFAULT_HERO_PHOTOS);
}

/** 云端空时规划写入默认轮播；已有配置则不覆盖 */
function planHomeBannerCloudSync(cloudList) {
  const banners = normalizeBanners(cloudList);
  if (banners.length) {
    return { needsSync: false, banners };
  }
  return { needsSync: true, banners: normalizeBanners(DEFAULT_HERO_PHOTOS) };
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
  DEFAULT_HERO_PHOTOS,
  normalizeBanner,
  normalizeBanners,
  resolveHomeHeroPhotos,
  planHomeBannerCloudSync,
  validateBanners,
};
