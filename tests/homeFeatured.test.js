const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildFeaturedPackages,
  buildFeaturedActivities,
} = require('../miniprogram/utils/homeFeatured');

test('buildFeaturedPackages takes first 3 after package page order', () => {
  const featured = buildFeaturedPackages([
    {
      id: 'weekend-family',
      name: '亲子无限时',
      price: 128,
      weekendPrice: 128,
      weekdayPrice: 98,
      targetAudience: '亲子',
      durationMinutes: 0,
      overtimeRule: '当日不限时',
      includedItems: ['a', 'b', 'c', 'd'],
    },
    {
      id: 'opening-trio',
      name: '三人同行一人免单',
      price: 198,
      weekendPrice: 198,
      weekdayPrice: 198,
      targetAudience: '开业限时',
      durationMinutes: 0,
      overtimeRule: '当日不限时',
      includedItems: ['三人入场'],
    },
    {
      id: 'solo-2h',
      name: '单人2小时',
      price: 68,
      weekendPrice: 68,
      weekdayPrice: 58,
      targetAudience: '轻体验',
      durationMinutes: 120,
      includedItems: ['材料'],
    },
    {
      id: 'weekend-solo',
      name: '单人无限时',
      price: 88,
      weekendPrice: 88,
      weekdayPrice: 68,
      targetAudience: '单人',
      durationMinutes: 0,
      overtimeRule: '当日不限时',
      includedItems: ['拼豆材料'],
    },
  ]);

  assert.deepEqual(
    featured.map((row) => row.id),
    ['opening-trio', 'weekend-solo', 'solo-2h'],
  );
  assert.equal(featured.length, 3);
  assert.equal(featured[0].lookNo, '01');
  assert.equal(featured[0].audienceLabel, '三人免一');
  assert.equal(featured[0].durationLabel, '当日不限时');
  assert.equal(featured[0].includes.length, 1);
  assert.equal(featured[2].durationLabel, '120 分钟');
  assert.equal(featured[2].audienceLabel, '单人2小时');
  // 标签色按槽位固定，不跟套餐 id 走
  assert.deepEqual(
    featured.map((row) => ({ accent: row.accent, enLabel: row.enLabel })),
    [
      { accent: '#FFB80A', enLabel: 'SOLO' },
      { accent: '#FF3D02', enLabel: 'DUO' },
      { accent: '#69D868', enLabel: 'KIDS' },
    ],
  );
});

test('buildFeaturedActivities takes first 3 of full list order', () => {
  const featured = buildFeaturedActivities([
    { id: 'mayday', name: '五月天主题拼豆', status: 'recruiting', capacity: 28, price: 39, coverImage: '/a.jpg' },
    { id: 'squid-game', name: '大学生鱿鱼游戏', status: 'recruiting', capacity: 24, price: 49 },
    { id: 'craft-meetup', name: '拼豆交流会', status: 'recruiting', capacity: 30, price: 0 },
    { id: 'birthday', name: '包场', status: 'consulting', capacity: 40, price: 0 },
  ]);

  assert.deepEqual(
    featured.map((row) => row.id),
    ['mayday', 'squid-game', 'craft-meetup'],
  );
  assert.equal(featured.length, 3);
  assert.equal(featured[0].statusLabel, '招募中');
  assert.equal(featured[0].cover, '/a.jpg');
  assert.equal(featured[0].dropNo, '01');
  assert.equal(featured[1].shift, 'shift-right');
  assert.equal(featured[1].cover.includes('/assets/background/'), true);
  // 标签色按槽位固定，不跟活动 id 走
  assert.deepEqual(
    featured.map((row) => ({ accent: row.accent, enLabel: row.enLabel, orbInk: row.orbInk })),
    [
      { accent: '#FFB80A', enLabel: 'LIVE', orbInk: '#18181b' },
      { accent: '#FF3D02', enLabel: 'GAME', orbInk: '#ffffff' },
      { accent: '#69D868', enLabel: 'MEET', orbInk: '#18181b' },
    ],
  );
});

test('buildFeaturedActivities falls back when coverImage is junk', () => {
  const featured = buildFeaturedActivities([
    { id: 'junk', name: '66666', status: 'recruiting', capacity: 56, price: 0, coverImage: 'null' },
    { id: 'empty', name: '空封面', status: 'recruiting', capacity: 10, price: 39, coverImage: '' },
    { id: 'ok', name: '有图', status: 'recruiting', capacity: 10, price: 39, coverImage: 'cloud://env/a.jpg' },
  ]);
  assert.equal(featured[0].cover.includes('/assets/background/'), true);
  assert.equal(featured[1].cover.includes('/assets/background/'), true);
  assert.equal(featured[2].cover, 'cloud://env/a.jpg');
});

test('builders tolerate empty input', () => {
  assert.deepEqual(buildFeaturedPackages([]), []);
  assert.deepEqual(buildFeaturedActivities(null), []);
});
