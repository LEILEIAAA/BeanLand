const test = require('node:test');
const assert = require('node:assert/strict');
const {
  chinaDateTimeToMs,
  msToChinaDateTime,
  normalizeActivityInput,
  validateActivity,
  buildActivityDoc,
  ACCENT_THEMES,
} = require('../cloudfunctions/adminSaveActivity/activityForm');

test('chinaDateTimeToMs matches UTC+8 wall time', () => {
  const ms = chinaDateTimeToMs('2026-07-18', '14:00');
  assert.equal(ms, Date.UTC(2026, 6, 18, 14 - 8, 0, 0));
});

test('msToChinaDateTime round-trips with chinaDateTimeToMs', () => {
  const ms = chinaDateTimeToMs('2026-07-18', '14:30');
  assert.deepEqual(msToChinaDateTime(ms), { date: '2026-07-18', time: '14:30' });
});

test('msToChinaDateTime returns blank for invalid', () => {
  assert.deepEqual(msToChinaDateTime(0), { date: '', time: '' });
  assert.deepEqual(msToChinaDateTime(null), { date: '', time: '' });
});

test('normalizeActivityInput builds startAt from date+time', () => {
  const draft = normalizeActivityInput({
    name: '五月天',
    price: 10,
    capacity: '28',
    startDate: '2026-07-18',
    startTime: '14:00',
  });
  assert.equal(draft.startAt, chinaDateTimeToMs('2026-07-18', '14:00'));
  assert.equal(draft.capacity, 28);
  assert.equal(draft.onShelf, true);
});

test('normalizeActivityInput prefers explicit startAt ms', () => {
  const draft = normalizeActivityInput({ name: 'x', startAt: 12345, startDate: '2026-07-18' });
  assert.equal(draft.startAt, 12345);
});

test('normalizeActivityInput defaults invalid status to recruiting', () => {
  const draft = normalizeActivityInput({ name: 'x', status: 'weird' });
  assert.equal(draft.status, 'recruiting');
});

test('validateActivity rejects empty name and bad status', () => {
  assert.equal(validateActivity(normalizeActivityInput({})).ok, false);
  assert.equal(validateActivity(normalizeActivityInput({ name: 'x', price: -1 })).ok, false);
  assert.equal(validateActivity(normalizeActivityInput({ name: 'x', status: 'weird' })).ok, true);
  assert.equal(validateActivity(normalizeActivityInput({ name: 'x', capacity: 10 })).ok, true);
});

test('buildActivityDoc stamps registeredCount only on create', () => {
  const draft = normalizeActivityInput({ id: 'mayday', name: '五月天', capacity: 28 });
  const created = buildActivityDoc(draft, { now: 1000, isCreate: true, registeredCount: 3 });
  assert.equal(created.id, 'mayday');
  assert.equal(created.registeredCount, 3);
  assert.equal(created.createdAt, 1000);

  const updated = buildActivityDoc(draft, { now: 2000 });
  assert.equal(updated.registeredCount, undefined);
  assert.equal(updated.createdAt, undefined);
  assert.equal(updated.updatedAt, 2000);
});

test('activity form carries coverImage through normalize and build', () => {
  const draft = normalizeActivityInput({ name: '五月天', capacity: 28, coverImage: 'cloud://a.jpg' });
  assert.equal(draft.coverImage, 'cloud://a.jpg');
  const doc = buildActivityDoc(draft, { now: 1 });
  assert.equal(doc.coverImage, 'cloud://a.jpg');
});

test('buildActivityDoc omits startAt when not set', () => {
  const draft = normalizeActivityInput({ name: '包场', capacity: 40 });
  const doc = buildActivityDoc(draft, { now: 1 });
  assert.equal('startAt' in doc, false);
});

test('normalizeActivityInput trims keyword and blanks empty', () => {
  assert.equal(normalizeActivityInput({ name: 'x', keyword: '  五月天  ' }).keyword, '五月天');
  assert.equal(normalizeActivityInput({ name: 'x', keyword: '' }).keyword, '');
  assert.equal(normalizeActivityInput({ name: 'x' }).keyword, '');
});

test('accent theme keeps yellow orange green presets', () => {
  assert.deepEqual(Object.keys(ACCENT_THEMES).sort(), ['green', 'orange', 'yellow']);
  assert.equal(ACCENT_THEMES.green.accent, '#69D868');
  assert.equal(ACCENT_THEMES.green.orbInk, '#18181b');
});

test('normalizeActivityInput keeps valid accentTheme, defaults invalid to yellow', () => {
  assert.equal(normalizeActivityInput({ name: 'x', accentTheme: 'orange' }).accentTheme, 'orange');
  assert.equal(normalizeActivityInput({ name: 'x', accentTheme: 'green' }).accentTheme, 'green');
  assert.equal(normalizeActivityInput({ name: 'x', accentTheme: 'purple' }).accentTheme, 'yellow');
  assert.equal(normalizeActivityInput({ name: 'x' }).accentTheme, 'yellow');
});

test('activity form carries accentTheme through normalize and build', () => {
  const draft = normalizeActivityInput({ name: '五月天', accentTheme: 'orange' });
  assert.equal(draft.accentTheme, 'orange');
  assert.equal(buildActivityDoc(draft, { now: 1 }).accentTheme, 'orange');
  const greenDraft = normalizeActivityInput({ name: '手作局', accentTheme: 'green' });
  assert.equal(buildActivityDoc(greenDraft, { now: 1 }).accentTheme, 'green');
});

test('activity form carries keyword and blurb through normalize and build', () => {
  const draft = normalizeActivityInput({
    name: '五月天',
    capacity: 28,
    keyword: '  五月天  ',
    blurb: '  开业第一场  ',
  });
  assert.equal(draft.keyword, '五月天');
  assert.equal(draft.blurb, '开业第一场');
  const doc = buildActivityDoc(draft, { now: 1 });
  assert.equal(doc.keyword, '五月天');
  assert.equal(doc.blurb, '开业第一场');
  assert.equal('category' in doc, false);
});
