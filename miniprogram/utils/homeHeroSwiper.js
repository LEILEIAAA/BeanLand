/**
 * 首页 hero swiper 状态 patch。
 * 展示态 heroIndex 与受控跳转 swiperCurrent 必须分离，
 * 否则 circular + current 双向绑定会在重进/自动播放时死循环。
 */

function captionAt(photos, index) {
  const list = Array.isArray(photos) ? photos : [];
  const photo = list[index];
  return photo && photo.caption ? photo.caption : '';
}

function clampIndex(photos, index) {
  const list = Array.isArray(photos) ? photos : [];
  if (!list.length) return 0;
  const n = Number(index);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), list.length - 1);
}

/** bindchange：只更新展示态，禁止回写 swiperCurrent */
function buildHeroChangePatch(heroPhotos, prevIndex, nextIndex) {
  if (typeof nextIndex !== 'number' || !Number.isFinite(nextIndex)) return null;
  if (nextIndex === prevIndex) return null;
  return {
    heroIndex: nextIndex,
    heroCaption: captionAt(heroPhotos, nextIndex),
  };
}

/** 圆点点击：同时驱动 current 与展示态 */
function buildHeroDotPatch(heroPhotos, prevIndex, nextIndex) {
  const index = Number(nextIndex);
  if (!Number.isFinite(index) || index === prevIndex) return null;
  return {
    swiperCurrent: index,
    heroIndex: index,
    heroCaption: captionAt(heroPhotos, index),
  };
}

/**
 * 重载轮播列表：保留当前索引（越界则钳位），不写 swiperCurrent，
 * 避免 onShow 重进时强制 current=0 触发循环。
 */
function buildHeroPhotosPatch(banners, prevIndex) {
  const heroPhotos = Array.isArray(banners) ? banners : [];
  const heroIndex = clampIndex(heroPhotos, prevIndex);
  return {
    heroPhotos,
    heroIndex,
    heroCaption: captionAt(heroPhotos, heroIndex),
  };
}

module.exports = {
  buildHeroChangePatch,
  buildHeroDotPatch,
  buildHeroPhotosPatch,
};
