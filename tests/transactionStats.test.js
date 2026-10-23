const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toMerchantAmount,
  summarizeTransactions,
  filterTransactionsByType,
  filterTransactionsByOpenid,
  parseYmdToChinaDayStartMs,
  resolveTimeRangeMs,
  filterTransactionsByTime,
} = require('../cloudfunctions/adminListMemberTransactions/transactionStats');

test('filterTransactionsByOpenid keeps matching openid only', () => {
  const list = [
    { _openid: 'o1', type: 'recharge' },
    { _openid: 'o2', type: 'consume' },
    { _openid: 'o1', type: 'refund' },
  ];
  const filtered = filterTransactionsByOpenid(list, 'o1');
  assert.deepEqual(
    filtered.map((row) => row.type),
    ['recharge', 'refund'],
  );
});

test('filterTransactionsByOpenid returns empty when openid blank', () => {
  const list = [{ _openid: 'o1', type: 'recharge' }];
  assert.equal(filterTransactionsByOpenid(list, '').length, 0);
  assert.equal(filterTransactionsByOpenid(list, null).length, 0);
});

test('filterTransactionsByType keeps all when type empty', () => {
  const list = [{ type: 'recharge' }, { type: 'consume' }];
  assert.equal(filterTransactionsByType(list, '').length, 2);
  assert.equal(filterTransactionsByType(list, 'recharge').length, 1);
});

test('toMerchantAmount keeps recharge positive, flips consume and refund', () => {
  assert.equal(toMerchantAmount({ type: 'recharge', amount: 100 }), 100);
  assert.equal(toMerchantAmount({ type: 'consume', amount: -30 }), 30);
  assert.equal(toMerchantAmount({ type: 'refund', amount: 20 }), -20);
});

test('summarizeTransactions uses merchant perspective signs', () => {
  const stats = summarizeTransactions([
    { type: 'recharge', amount: 100 },
    { type: 'consume', amount: -30 },
    { type: 'refund', amount: 20 },
    { type: 'consume', amount: -5 },
  ]);
  assert.equal(stats.count, 4);
  assert.equal(stats.income, 135);
  assert.equal(stats.expense, 20);
  assert.equal(stats.net, 115);
});

test('parseYmdToChinaDayStartMs parses China local day start', () => {
  const start = parseYmdToChinaDayStartMs('2026-07-17');
  assert.equal(start, Date.UTC(2026, 6, 17) - 8 * 60 * 60 * 1000);
});

test('resolveTimeRangeMs builds inclusive day range for custom dates', () => {
  const range = resolveTimeRangeMs({
    preset: 'custom',
    startDate: '2026-07-10',
    endDate: '2026-07-17',
  });
  assert.equal(range.startAt, parseYmdToChinaDayStartMs('2026-07-10'));
  assert.equal(range.endAt, parseYmdToChinaDayStartMs('2026-07-17') + 24 * 60 * 60 * 1000);
});

test('resolveTimeRangeMs today covers current China day', () => {
  const now = parseYmdToChinaDayStartMs('2026-07-17') + 15 * 60 * 60 * 1000;
  const range = resolveTimeRangeMs({ preset: 'today', now });
  assert.equal(range.startAt, parseYmdToChinaDayStartMs('2026-07-17'));
  assert.equal(range.endAt, parseYmdToChinaDayStartMs('2026-07-18'));
});

test('filterTransactionsByTime keeps rows inside [start, end)', () => {
  const start = 1000;
  const end = 3000;
  const list = [
    { createdAt: 999 },
    { createdAt: 1000 },
    { createdAt: 2500 },
    { createdAt: 3000 },
  ];
  const filtered = filterTransactionsByTime(list, start, end);
  assert.deepEqual(
    filtered.map((row) => row.createdAt),
    [1000, 2500],
  );
});
