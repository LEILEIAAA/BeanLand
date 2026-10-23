const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeRechargePlan,
  mapRechargePlans,
} = require('../miniprogram/utils/rechargePlans');

test('normalizeRechargePlan prefers id and coerces amounts', () => {
  const row = normalizeRechargePlan({
    id: 'r100',
    _id: 'other',
    rechargeAmount: '100',
    bonusAmount: '10',
    arrivalAmount: '110',
    audience: '尝鲜入门 / 学生',
  });
  assert.equal(row.id, 'r100');
  assert.equal(row.rechargeAmount, 100);
  assert.equal(row.bonusAmount, 10);
  assert.equal(row.arrivalAmount, 110);
  assert.equal(row.audience, '尝鲜入门 / 学生');
});

test('normalizeRechargePlan falls back to _id when id missing', () => {
  const row = normalizeRechargePlan({
    _id: 'r300',
    rechargeAmount: 300,
    bonusAmount: 40,
  });
  assert.equal(row.id, 'r300');
  assert.equal(row.rechargeAmount, 300);
});

test('normalizeRechargePlan returns null for empty or zero-amount rows', () => {
  assert.equal(normalizeRechargePlan(null), null);
  assert.equal(normalizeRechargePlan({}), null);
  assert.equal(normalizeRechargePlan({ id: 'x', rechargeAmount: 0 }), null);
  assert.equal(normalizeRechargePlan({ id: 'x', rechargeAmount: -1 }), null);
});

test('mapRechargePlans sorts by rechargeAmount ascending', () => {
  const list = mapRechargePlans([
    { id: 'r500', rechargeAmount: 500, bonusAmount: 80 },
    { id: 'r100', rechargeAmount: 100, bonusAmount: 10 },
    { id: 'r1000', rechargeAmount: 1000, bonusAmount: 180 },
    { id: 'r300', rechargeAmount: 300, bonusAmount: 40 },
  ]);
  assert.deepEqual(
    list.map((item) => item.id),
    ['r100', 'r300', 'r500', 'r1000'],
  );
});
