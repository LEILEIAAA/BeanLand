const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildActivityDetailRows,
  buildActivityDetailView,
} = require('../miniprogram/utils/activityDetail');
const { activities } = require('../miniprogram/data/seed');

test('buildActivityDetailRows skips empty fields and keeps order', () => {
  const rows = buildActivityDetailRows({
    scheduleText: '开业 D1–D2',
    timeText: '14:00 / 18:30',
    audience: '',
    content: '主题拼豆',
    includes: ['材料', '  ', '合影'],
    notice: null,
  });
  assert.deepEqual(
    rows.map((row) => row.key),
    ['scheduleText', 'timeText', 'content', 'includes'],
  );
  assert.equal(rows.find((row) => row.key === 'includes').value, '材料 · 合影');
});

test('buildActivityDetailRows returns empty for invalid input', () => {
  assert.deepEqual(buildActivityDetailRows(null), []);
  assert.deepEqual(buildActivityDetailRows(undefined), []);
});

test('buildActivityDetailView splits highlights body chips and notice', () => {
  const view = buildActivityDetailView({
    scheduleText: '开业 D1–D2',
    timeText: '14:00',
    audience: '大学生',
    content: '三关迷你季',
    includes: ['图纸', '主持'],
    notice: '一人一报',
  });
  assert.equal(view.empty, false);
  assert.deepEqual(
    view.highlights.map((row) => row.key),
    ['scheduleText', 'timeText'],
  );
  assert.equal(view.audience, '大学生');
  assert.equal(view.content, '三关迷你季');
  assert.deepEqual(view.includes, ['图纸', '主持']);
  assert.equal(view.notice, '一人一报');
});

test('seed activities expose detail fields for registration page', () => {
  assert.ok(activities.length >= 4);
  for (const activity of activities) {
    assert.ok(activity.scheduleText, `${activity.id} scheduleText`);
    assert.ok(activity.timeText, `${activity.id} timeText`);
    assert.ok(activity.content, `${activity.id} content`);
    assert.ok(activity.audience, `${activity.id} audience`);
    assert.ok(Array.isArray(activity.includes) && activity.includes.length, `${activity.id} includes`);
    const view = buildActivityDetailView(activity);
    assert.equal(view.empty, false, `${activity.id} detail view`);
    assert.ok(view.highlights.length >= 2, `${activity.id} highlights`);
  }
});
