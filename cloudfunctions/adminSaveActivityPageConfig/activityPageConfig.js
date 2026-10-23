const DEFAULT_HERO = {
  title: '开业首周有局',
  subtitle: 'Opening Week',
  content: '五月天破圈开场，接着大学生鱿鱼局，周末收个作品交流会。中间两天散场；包场咨询见海报墙末位。',
};

const DEFAULT_SCHEDULE_TITLE = '开业首周日程';
const MAX_SCHEDULE_ITEMS = 12;

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

module.exports = {
  DEFAULT_HERO,
  DEFAULT_SCHEDULE_TITLE,
  MAX_SCHEDULE_ITEMS,
  normalizeActivityPageConfig,
};
