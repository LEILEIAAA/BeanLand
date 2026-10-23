const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeActivityPageConfig,
  buildScheduleRows,
  DEFAULT_HERO,
  DEFAULT_SCHEDULE_TITLE,
  MAX_SCHEDULE_ITEMS,
} = require('../miniprogram/utils/activityPageConfig');

test('normalizeActivityPageConfig fills defaults for empty input', () => {
  const cfg = normalizeActivityPageConfig(null);
  assert.deepEqual(cfg.hero, {
    title: DEFAULT_HERO.title,
    subtitle: DEFAULT_HERO.subtitle,
    content: DEFAULT_HERO.content,
  });
  assert.equal(cfg.schedule.title, DEFAULT_SCHEDULE_TITLE);
  assert.deepEqual(cfg.schedule.items, []);
});

test('normalizeActivityPageConfig trims strings and keeps provided values', () => {
  const cfg = normalizeActivityPageConfig({
    hero: { title: '  夏日局  ', subtitle: 'Summer', content: '  来玩  ' },
    schedule: {
      title: '  本周日程 ',
      items: [
        { day: ' 1-2 ', activityId: ' mayday ' },
        { day: '3', activityId: 'squid-game' },
      ],
    },
  });
  assert.equal(cfg.hero.title, '夏日局');
  assert.equal(cfg.hero.subtitle, 'Summer');
  assert.equal(cfg.hero.content, '来玩');
  assert.equal(cfg.schedule.title, '本周日程');
  assert.deepEqual(cfg.schedule.items, [
    { day: '1-2', activityId: 'mayday' },
    { day: '3', activityId: 'squid-game' },
  ]);
});

test('normalizeActivityPageConfig drops items without activityId and caps count', () => {
  const many = Array.from({ length: MAX_SCHEDULE_ITEMS + 5 }, (_, i) => ({
    day: String(i),
    activityId: `a-${i}`,
  }));
  const cfg = normalizeActivityPageConfig({
    schedule: { items: [{ day: 'x', activityId: '' }, ...many] },
  });
  assert.equal(cfg.schedule.items.length, MAX_SCHEDULE_ITEMS);
  assert.equal(cfg.schedule.items[0].activityId, 'a-0');
});

test('buildScheduleRows joins items with activities by id/_id', () => {
  const activities = [
    { id: 'mayday', name: '五月天主题拼豆', status: 'recruiting', blurb: '开业第一场' },
    { _id: 'squid-game', name: '鱿鱼游戏', status: 'consulting', scheduleText: '三关局' },
  ];
  const rows = buildScheduleRows(
    [
      { day: '1-2', activityId: 'mayday' },
      { day: '4-5', activityId: 'squid-game' },
    ],
    activities,
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    day: '1-2',
    activityId: 'mayday',
    title: '五月天主题拼豆',
    note: '开业第一场',
    status: '招募中',
    kind: 'event',
  });
  assert.equal(rows[1].note, '三关局');
  assert.equal(rows[1].status, '咨询中');
  assert.equal(rows[1].kind, 'event');
});

test('buildScheduleRows maps available status to 可预约 rest day', () => {
  const rows = buildScheduleRows(
    [{ day: '3', activityId: 'rest-d3' }],
    [{
      id: 'rest-d3',
      name: '散场日',
      status: 'available',
      blurb: '无主题局，可预约日常座位',
    }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, '可预约');
  assert.equal(rows[0].kind, 'rest');
  assert.equal(rows[0].note, '无主题局，可预约日常座位');
});

test('buildScheduleRows drops items whose activity is missing', () => {
  const rows = buildScheduleRows(
    [
      { day: '1', activityId: 'gone' },
      { day: '2', activityId: 'mayday' },
    ],
    [{ id: 'mayday', name: '五月天', status: 'recruiting' }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].activityId, 'mayday');
});

test('buildScheduleRows tolerates empty inputs', () => {
  assert.deepEqual(buildScheduleRows(null, null), []);
  assert.deepEqual(buildScheduleRows([], [{ id: 'a' }]), []);
});
