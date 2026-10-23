const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildHeroChangePatch,
  buildHeroDotPatch,
  buildHeroPhotosPatch,
} = require('../miniprogram/utils/homeHeroSwiper');

const PHOTOS = [
  { src: '/a.jpg', caption: 'A' },
  { src: '/b.jpg', caption: 'B' },
  { src: '/c.jpg', caption: 'C' },
];

test('buildHeroChangePatch updates display only, never swiperCurrent', () => {
  const patch = buildHeroChangePatch(PHOTOS, 0, 1);
  assert.deepEqual(patch, { heroIndex: 1, heroCaption: 'B' });
  assert.equal(Object.prototype.hasOwnProperty.call(patch, 'swiperCurrent'), false);
});

test('buildHeroChangePatch returns null when index unchanged', () => {
  assert.equal(buildHeroChangePatch(PHOTOS, 1, 1), null);
  assert.equal(buildHeroChangePatch(PHOTOS, 0, '1'), null);
});

test('buildHeroDotPatch drives both swiperCurrent and display', () => {
  assert.deepEqual(buildHeroDotPatch(PHOTOS, 0, 2), {
    swiperCurrent: 2,
    heroIndex: 2,
    heroCaption: 'C',
  });
  assert.equal(buildHeroDotPatch(PHOTOS, 2, 2), null);
});

test('buildHeroPhotosPatch keeps current index on reload, does not force swiperCurrent', () => {
  const patch = buildHeroPhotosPatch(PHOTOS, 2);
  assert.deepEqual(patch, {
    heroPhotos: PHOTOS,
    heroIndex: 2,
    heroCaption: 'C',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(patch, 'swiperCurrent'), false);
});

test('buildHeroPhotosPatch clamps out-of-range index when banner count shrinks', () => {
  const short = [{ src: '/only.jpg', caption: 'Only' }];
  const patch = buildHeroPhotosPatch(short, 5);
  assert.deepEqual(patch, {
    heroPhotos: short,
    heroIndex: 0,
    heroCaption: 'Only',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(patch, 'swiperCurrent'), false);
});
