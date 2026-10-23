const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const P0_PAGES = [
  'miniprogram/pages/route/index.js',
  'miniprogram/pages/home/index.js',
  'miniprogram/pages/packages/index.js',
  'miniprogram/pages/activities/index.js',
  'miniprogram/pages/activities/register/index.js',
  'miniprogram/pages/recharge/index.js',
  'miniprogram/pages/appointment/index.js',
  'miniprogram/pages/admin/home-banners/index.js',
];

test('P0 pages do not require miniprogram/data/seed', () => {
  const leaks = [];
  for (const rel of P0_PAGES) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (/require\([^)]*data\/seed/.test(src)) {
      leaks.push(rel);
    }
  }
  assert.deepEqual(leaks, [], `seed require still present:\n${leaks.join('\n')}`);
});

test('getStore source does not unconditionally return seed.store', () => {
  const src = fs.readFileSync(path.join(ROOT, 'miniprogram/utils/api.js'), 'utf8');
  const fnMatch = src.match(/async function getStore\([\s\S]*?\n\}/);
  assert.ok(fnMatch, 'getStore function not found');
  const body = fnMatch[0];
  assert.equal(
    /return seed\.store\s*;/.test(body),
    false,
    'getStore still has unconditional return seed.store',
  );
});

test('getStore and getTimeSlots prefer cloud functions', () => {
  const src = fs.readFileSync(path.join(ROOT, 'miniprogram/utils/api.js'), 'utf8');
  assert.match(src, /callFunction\('getStore'/);
  assert.match(src, /callFunction\('getTimeSlots'/);
});

test('getRechargePlans prefers listRechargePlans cloud function', () => {
  const src = fs.readFileSync(path.join(ROOT, 'miniprogram/utils/api.js'), 'utf8');
  assert.match(src, /callFunction\('listRechargePlans'/);
});
