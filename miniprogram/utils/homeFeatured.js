const { sortPackages } = require('./packageSort');
const { resolveActivityCover } = require('./activityCover');
const { formatYuan } = require('./money');

const HOME_LIMIT = 3;


const ACTIVITY_STATUS_LABEL = {
  recruiting: '招募中',
  consulting: '咨询中',
  full: '已满员',
  ended: '已结束',
  cancelled: '已取消',
  draft: '未发布',
};

const PACKAGE_AUDIENCE_LABEL = {
  'opening-trio': '三人免一',
  'weekend-solo': '单人无限时',
  'solo-2h': '单人2小时',
  'solo-1h': '单人1小时',
  'weekend-duo': '双人无限时',
  'duo-2h': '双人2小时',
  'duo-1h': '双人1小时',
  'weekend-family': '亲子无限时',
};

const PACKAGE_LOOKS_BY_SLOT = [
  { accent: '#FFB80A', enLabel: 'SOLO' },
  { accent: '#FF3D02', enLabel: 'DUO' },
  { accent: '#69D868', enLabel: 'KIDS' },
];

const ACTIVITY_LOOKS_BY_SLOT = [
  { accent: '#FFB80A', enLabel: 'LIVE', orbInk: '#18181b' },
  { accent: '#FF3D02', enLabel: 'GAME', orbInk: '#ffffff' },
  { accent: '#69D868', enLabel: 'MEET', orbInk: '#18181b' },
];

function decorateHomePackage(item, index) {
  const id = item.id || item._id;
  const look = PACKAGE_LOOKS_BY_SLOT[index] || PACKAGE_LOOKS_BY_SLOT[0];
  const durationLabel = Number(item.durationMinutes) > 0
    ? `${item.durationMinutes} 分钟`
    : (item.overtimeRule || '当日不限时');
  return {
    ...item,
    id,
    audienceLabel: PACKAGE_AUDIENCE_LABEL[id] || item.targetAudience,
    durationLabel,
    priceLabel: item.weekdayPrice
      ? `周末¥${formatYuan(item.weekendPrice)} / 工作日¥${formatYuan(item.weekdayPrice)}`
      : `¥${formatYuan(item.price)}`,
    weekendPriceText: formatYuan(item.weekendPrice || item.price),
    weekdayPriceText: item.weekdayPrice != null && item.weekdayPrice !== ''
      ? formatYuan(item.weekdayPrice)
      : '',
    priceText: formatYuan(item.price),
    lookNo: String(index + 1).padStart(2, '0'),
    includes: (item.includedItems || []).slice(0, 3),
    ...look,
  };
}

function decorateHomeActivity(item, index) {
  const id = item.id || item._id;
  const look = ACTIVITY_LOOKS_BY_SLOT[index] || ACTIVITY_LOOKS_BY_SLOT[0];
  return {
    ...item,
    id,
    cover: resolveActivityCover(item.coverImage, index),
    statusLabel: ACTIVITY_STATUS_LABEL[item.status] || item.status,
    dropNo: String(index + 1).padStart(2, '0'),
    shift: index % 2 === 1 ? 'shift-right' : 'shift-left',
    priceText: formatYuan(item.price),
    ...look,
  };
}

function buildFeaturedPackages(list, limit = HOME_LIMIT) {
  return sortPackages(list).slice(0, limit).map(decorateHomePackage);
}

function buildFeaturedActivities(list, limit = HOME_LIMIT) {
  return (list || []).slice(0, limit).map(decorateHomeActivity);
}

module.exports = {
  HOME_LIMIT,
  buildFeaturedPackages,
  buildFeaturedActivities,
};
