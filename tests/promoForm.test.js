const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePromoInput,
  validatePromo,
  buildPromoDoc,
  syncPromoTip,
  formatPromoTip,
} = require('../cloudfunctions/adminSavePackagePromo/promoForm');

test('normalizePromoInput coerces types', () => {
  const draft = normalizePromoInput({
    active: 'true',
    discountRate: '8.5',
    label: '  开业七天 ',
    tip: '限时特惠',
  });
  assert.equal(draft.active, true);
  assert.equal(draft.discountRate, 8.5);
  assert.equal(draft.label, '开业七天');
  assert.equal(draft.tip, '限时特惠');
});

test('syncPromoTip rewrites 全场X折 when rate changes', () => {
  assert.equal(syncPromoTip('全场8折', 9), '全场9折');
  assert.equal(syncPromoTip('', 9), '全场9折');
  assert.equal(syncPromoTip('限时特惠', 9), '限时特惠');
  assert.equal(formatPromoTip(8.5), '全场8.5折');
});

test('normalizePromoInput auto-syncs tip shaped as 全场X折', () => {
  const draft = normalizePromoInput({ active: true, discountRate: 9, tip: '全场8折' });
  assert.equal(draft.tip, '全场9折');
});

test('validatePromo requires valid rate when active', () => {
  assert.equal(validatePromo(normalizePromoInput({ active: true, discountRate: 8 })).ok, true);
  assert.equal(validatePromo(normalizePromoInput({ active: true, discountRate: 0 })).ok, false);
  assert.equal(validatePromo(normalizePromoInput({ active: true, discountRate: 10 })).ok, false);
  assert.equal(validatePromo(normalizePromoInput({ active: true, discountRate: 12 })).ok, false);
});

test('validatePromo allows any rate when inactive', () => {
  assert.equal(validatePromo(normalizePromoInput({ active: false, discountRate: 0 })).ok, true);
});

test('buildPromoDoc returns the four promo fields', () => {
  const doc = buildPromoDoc(normalizePromoInput({ active: true, discountRate: 8, label: 'a', tip: 'b' }));
  assert.deepEqual(doc, { active: true, discountRate: 8, label: 'a', tip: 'b' });
});
