const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toStringArray,
  slugify,
  normalizePackageInput,
  validatePackage,
  buildPackageDoc,
  PACKAGE_BADGE_COLORS,
} = require('../cloudfunctions/adminSavePackage/packageForm');

test('toStringArray splits string and trims', () => {
  assert.deepEqual(toStringArray('材料, 图纸\n指导'), ['材料', '图纸', '指导']);
  assert.deepEqual(toStringArray(['a', ' b ', '']), ['a', 'b']);
  assert.deepEqual(toStringArray(null), []);
});

test('slugify produces url-safe id', () => {
  assert.equal(slugify('Solo 1H'), 'solo-1h');
  assert.equal(slugify('中文名'), '');
});

test('normalizePackageInput fills weekend/weekday from price when blank', () => {
  const draft = normalizePackageInput({ name: '单人', price: 50 });
  assert.equal(draft.weekendPrice, 50);
  assert.equal(draft.weekdayPrice, 50);
  assert.equal(draft.onShelf, true);
});

test('badge color keeps two presets only', () => {
  assert.deepEqual(PACKAGE_BADGE_COLORS.slice().sort(), ['orange', 'yellow']);
});

test('normalizePackageInput keeps valid badgeColor, defaults invalid to orange', () => {
  assert.equal(normalizePackageInput({ name: 'x', badgeColor: 'yellow' }).badgeColor, 'yellow');
  assert.equal(normalizePackageInput({ name: 'x', badgeColor: 'blue' }).badgeColor, 'orange');
  assert.equal(normalizePackageInput({ name: 'x' }).badgeColor, 'orange');
});

test('buildPackageDoc carries badgeColor', () => {
  const draft = normalizePackageInput({ name: 'x', badgeColor: 'yellow' });
  assert.equal(buildPackageDoc(draft, { now: 1 }).badgeColor, 'yellow');
});

test('normalizePackageInput coerces types', () => {
  const draft = normalizePackageInput({
    name: '  双人  ',
    price: '88',
    durationMinutes: '120',
    onShelf: 'false',
    includedItems: '材料,图纸',
  });
  assert.equal(draft.name, '双人');
  assert.equal(draft.price, 88);
  assert.equal(draft.durationMinutes, 120);
  assert.equal(draft.onShelf, false);
  assert.deepEqual(draft.includedItems, ['材料', '图纸']);
});

test('normalizePackageInput derives base price from weekday when price blank', () => {
  const draft = normalizePackageInput({ name: '双人', weekdayPrice: 50, weekendPrice: 60 });
  assert.equal(draft.weekdayPrice, 50);
  assert.equal(draft.weekendPrice, 60);
  assert.equal(draft.price, 50);
});

test('normalizePackageInput weekend falls back to weekday when only weekday set', () => {
  const draft = normalizePackageInput({ name: '单人', weekdayPrice: 40 });
  assert.equal(draft.weekendPrice, 40);
  assert.equal(draft.price, 40);
});

test('validatePackage rejects empty name and negative price', () => {
  assert.equal(validatePackage(normalizePackageInput({ price: 10 })).ok, false);
  assert.equal(validatePackage(normalizePackageInput({ name: 'x', price: -1 })).ok, false);
  assert.equal(validatePackage(normalizePackageInput({ name: 'x', price: 10 })).ok, true);
});

test('buildPackageDoc keeps explicit id and stamps createdAt on create', () => {
  const draft = normalizePackageInput({ id: 'solo-1h', name: '单人1小时', price: 30 });
  const doc = buildPackageDoc(draft, { now: 1000, isCreate: true });
  assert.equal(doc.id, 'solo-1h');
  assert.equal(doc.createdAt, 1000);
  assert.equal(doc.updatedAt, 1000);
});

test('buildPackageDoc derives id from name when id blank', () => {
  const draft = normalizePackageInput({ name: 'Solo 1H', price: 30 });
  const doc = buildPackageDoc(draft, { now: 2000 });
  assert.equal(doc.id, 'solo-1h');
  assert.equal(doc.createdAt, undefined);
});
