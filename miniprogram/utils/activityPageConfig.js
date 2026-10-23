const DEFAULT_HERO = {
  title: '开业首周有局',
  subtitle: 'Opening Week',
  content: '五月天破圈开场，接着大学生鱿鱼局，周末收个作品交流会。中间两天散场；包场咨询见海报墙末位。',
};

const DEFAULT_SCHEDULE_TITLE = '开业首周日程';
const MAX_SCHEDULE_ITEMS = 12;

const ACTIVITY_STATUS_LABEL = {
  recruiting: '招募中',
  consulting: '咨询中',
  full: '已满员',
  ended: '已结束',
  cancelled: '已取消',
  draft: '未发布',
  // 散场日等不上架占位活动，日程展示用
  available: '可预约',
};

function toStr(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeHero(raw) {
  const hero = raw && typeof raw === 'object' ? raw : {};
  return {
    title: toStr(hero.title) || DEFAULT_HERO.title,
    subtitle: toStr(hero.subtitle) || DEFAULT_HERO.subtitle,
    content: toStr(hero.content) || DEFAULT_HERO.content,
  };
}

function normalizeScheduleItems(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const raw = item && typeof item === 'object' ? item : {};
      return { day: toStr(raw.day), activityId: toStr(raw.activityId) };
    })
    .filter((item) => item.activityId)
    .slice(0, MAX_SCHEDULE_ITEMS);
}

function normalizeActivityPageConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const schedule = cfg.schedule && typeof cfg.schedule === 'object' ? cfg.schedule : {};
  return {
    hero: normalizeHero(cfg.hero),
    schedule: {
      title: toStr(schedule.title) || DEFAULT_SCHEDULE_TITLE,
      items: normalizeScheduleItems(schedule.items),
    },
  };
}

function buildScheduleRows(items, activities) {
  const normalizedItems = normalizeScheduleItems(items);
  const byId = {};
  (activities || []).forEach((activity) => {
    if (!activity || typeof activity !== 'object') return;
    const id = toStr(activity.id) || toStr(activity._id);
    if (id) byId[id] = activity;
  });
  return normalizedItems
    .map((item) => {
      const activity = byId[item.activityId];
      if (!activity) return null;
      const statusKey = toStr(activity.status);
      return {
        day: item.day,
        activityId: item.activityId,
        title: toStr(activity.name),
        note: toStr(activity.blurb) || toStr(activity.scheduleText),
        status: ACTIVITY_STATUS_LABEL[statusKey] || statusKey,
        kind: statusKey === 'available' ? 'rest' : 'event',
      };
    })
    .filter(Boolean);
}

module.exports = {
  DEFAULT_HERO,
  DEFAULT_SCHEDULE_TITLE,
  MAX_SCHEDULE_ITEMS,
  ACTIVITY_STATUS_LABEL,
  normalizeHero,
  normalizeScheduleItems,
  normalizeActivityPageConfig,
  buildScheduleRows,
};
