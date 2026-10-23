const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_HERO_PHOTOS,
  resolveHomeHeroPhotos,
  normalizeBanners,
  planHomeBannerCloudSync,
} = require('../miniprogram/utils/homeBanners');

test('DEFAULT_HERO_PHOTOS has three local workshop assets', () => {
  assert.equal(DEFAULT_HERO_PHOTOS.length, 3);
  for (const item of DEFAULT_HERO_PHOTOS) {
    assert.match(item.src, /^\/assets\/background\//);
    assert.ok(item.caption);
  }
});

test('resolveHomeHeroPhotos prefers non-empty cloud banners', () => {
  const cloud = [{ src: 'cloud://a.jpg', caption: '云端' }];
  const resolved = resolveHomeHeroPhotos(cloud);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].src, 'cloud://a.jpg');
});

test('resolveHomeHeroPhotos falls back to DEFAULT_HERO_PHOTOS when cloud empty', () => {
  assert.deepEqual(resolveHomeHeroPhotos([]), normalizeBanners(DEFAULT_HERO_PHOTOS));
  assert.deepEqual(resolveHomeHeroPhotos(null), normalizeBanners(DEFAULT_HERO_PHOTOS));
});

test('planHomeBannerCloudSync seeds defaults when cloud empty', () => {
  const planned = planHomeBannerCloudSync([]);
  assert.equal(planned.needsSync, true);
  assert.deepEqual(planned.banners, normalizeBanners(DEFAULT_HERO_PHOTOS));
  assert.deepEqual(planHomeBannerCloudSync(null), planned);
});

test('planHomeBannerCloudSync keeps cloud banners without sync', () => {
  const cloud = [{ src: 'cloud://b.jpg', caption: '已配置' }];
  const planned = planHomeBannerCloudSync(cloud);
  assert.equal(planned.needsSync, false);
  assert.deepEqual(planned.banners, normalizeBanners(cloud));
});
