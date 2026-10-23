const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeKeyword,
  buildActivityFilters,
  filterActivities,
} = require('../miniprogram/utils/activityFilters');

test('normalizeKeyword trims and blanks empty', () => {
  assert.equal(normalizeKeyword('  五月天  '), '五月天');
  assert.equal(normalizeKeyword(''), '');
  assert.equal(normalizeKeyword(null), '');
  assert.equal(normalizeKeyword(undefined), '');
});

test('buildActivityFilters keeps all and recruiting then unique keywords in order', () => {
  const filters = buildActivityFilters([
    { keyword: '五月天', status: 'recruiting' },
    { keyword: '', status: 'ended' },
    { keyword: '交流会', status: 'recruiting' },
    { keyword: '五月天', status: 'full' },
    { keyword: '  鱿鱼局  ', status: 'consulting' },
  ]);
  assert.deepEqual(filters, [
    { id: 'all', label: '全部' },
    { id: 'recruiting', label: '招募中' },
    { id: '五月天', label: '五月天' },
    { id: '交流会', label: '交流会' },
    { id: '鱿鱼局', label: '鱿鱼局' },
  ]);
});

test('filterActivities all recruiting and keyword', () => {
  const list = [
    { id: 'a', keyword: '五月天', status: 'recruiting' },
    { id: 'b', keyword: '交流会', status: 'ended' },
    { id: 'c', keyword: '', status: 'recruiting' },
  ];
  assert.deepEqual(
    filterActivities(list, 'all').map((item) => item.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    filterActivities(list, 'recruiting').map((item) => item.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    filterActivities(list, '五月天').map((item) => item.id),
    ['a'],
  );
  assert.deepEqual(filterActivities(list, '包场'), []);
});
