const COVER_POOL = [
  '/assets/background/images1.jpg',
  '/assets/background/image3.jpg',
  '/assets/background/images2.jpg',
];

function toStr(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function isValidCoverSrc(src) {
  const value = toStr(src);
  if (!value) return false;
  if (value === 'null' || value === 'undefined') return false;
  return (
    value.startsWith('cloud://')
    || value.startsWith('/')
    || value.startsWith('https://')
    || value.startsWith('http://')
  );
}

function poolCover(index) {
  const slot = Math.abs(Number(index) || 0) % COVER_POOL.length;
  return COVER_POOL[slot];
}

function resolveActivityCover(coverImage, index) {
  if (isValidCoverSrc(coverImage)) return toStr(coverImage);
  return poolCover(index);
}

function fallbackActivityCover(index, brokenSrc) {
  const primary = poolCover(index);
  if (!brokenSrc || toStr(brokenSrc) !== primary) return primary;
  return poolCover((Number(index) || 0) + 1);
}

module.exports = {
  COVER_POOL,
  isValidCoverSrc,
  resolveActivityCover,
  fallbackActivityCover,
};
