/**
 * 门店公开信息与营业时段：包内产品默认（非会员 mock）。
 * 云端有值时覆盖；云空/失败时用默认保证首页与路线可用。
 */

const DEFAULT_STORE = {
  name: 'Bean Land',
  slogan: '拼一局，带走一块自己的光',
  address: '杭州市拱墅区上塘路 259 号（假山路口）新青年广场 A幢2617',
  shortAddress: '杭州市拱墅区上塘路 259 号 · 新青年广场 A幢2617',
  routeTip: '地址在 A幢 2617；电梯到顶楼就到，找不到直接打电话。',
  phone: '15715719050',
  wechat: 'yanzhenfei0918',
  markerName: 'Bean Land',
  latitude: 30.2961,
  longitude: 120.157959,
  scale: 17,
};

const DEFAULT_TIME_SLOTS = [
  '10:00-12:00',
  '12:00-14:00',
  '14:00-16:00',
  '16:00-18:00',
  '18:00-20:00',
  '20:00-22:00',
];

function isBlank(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return !value.trim();
  return false;
}

function isBlankCoord(value) {
  const num = Number(value);
  return !Number.isFinite(num) || num === 0;
}

function resolvePublicStore(cloudStore) {
  if (!cloudStore || typeof cloudStore !== 'object') {
    return { ...DEFAULT_STORE };
  }
  const merged = { ...DEFAULT_STORE };
  Object.keys(cloudStore).forEach((key) => {
    const value = cloudStore[key];
    if (key === 'latitude' || key === 'longitude') {
      if (isBlankCoord(value)) return;
      merged[key] = Number(value);
      return;
    }
    if (isBlank(value) && !isBlank(DEFAULT_STORE[key])) return;
    merged[key] = value;
  });
  return merged;
}

function resolveCopyAddressText(store) {
  const row = resolvePublicStore(store);
  const address = String(row.address || '').trim();
  if (address) return address;
  const shortAddress = String(row.shortAddress || '').trim();
  if (shortAddress) return shortAddress;
  return String(DEFAULT_STORE.address || '').trim();
}

function parseTimeSlotDocs(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (rows.length === 1 && Array.isArray(rows[0].slots)) {
    return rows[0].slots.filter(Boolean);
  }
  return rows.map((row) => row.label || row.slot || row).filter(Boolean);
}

function resolveTimeSlots(slots) {
  const list = Array.isArray(slots) ? slots.filter(Boolean) : [];
  return list.length ? list : DEFAULT_TIME_SLOTS.slice();
}

module.exports = {
  DEFAULT_STORE,
  DEFAULT_TIME_SLOTS,
  resolvePublicStore,
  resolveCopyAddressText,
  parseTimeSlotDocs,
  resolveTimeSlots,
};
