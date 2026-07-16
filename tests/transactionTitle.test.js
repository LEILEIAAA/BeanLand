const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatTransactionTitle,
  resolveTransactionTitle,
} = require('../miniprogram/utils/transactionTitle');

test('recharge titles get 充值 prefix and strip old 充/充值', () => {
  assert.equal(
    formatTransactionTitle({ type: 'recharge', title: '充 100 送 10' }),
    '充值 100 送 10',
  );
  assert.equal(
    formatTransactionTitle({ type: 'recharge', title: '充值 200 送 30' }),
    '充值 200 送 30',
  );
});

test('package consume titles get 套餐 prefix', () => {
  assert.equal(
    formatTransactionTitle({ type: 'consume', title: '双人主题套餐', packageId: 'double-theme' }),
    '套餐 双人主题套餐',
  );
  assert.equal(
    formatTransactionTitle({ type: 'consume', title: '套餐 标准拼豆体验' }),
    '套餐 标准拼豆体验',
  );
});

test('activity consume titles get 活动 prefix and strip 活动报名', () => {
  assert.equal(
    formatTransactionTitle({ type: 'consume', title: '活动报名 · 开业手作场' }),
    '活动 开业手作场',
  );
  assert.equal(
    formatTransactionTitle({ type: 'consume', title: '活动 开业手作场' }),
    '活动 开业手作场',
  );
});

test('refund and cancel keep typed prefixes', () => {
  assert.equal(
    formatTransactionTitle({ type: 'refund', title: '套餐过期退款' }),
    '套餐退款 过期退款',
  );
  assert.equal(
    formatTransactionTitle({ type: 'refund', title: '活动报名取消 · 开业手作场' }),
    '活动取消 开业手作场',
  );
});

test('falls back to reason then 流水', () => {
  assert.equal(
    formatTransactionTitle({ type: 'consume', reason: '标准拼豆体验 · 余额支付' }),
    '套餐 标准拼豆体验 · 余额支付',
  );
  assert.equal(formatTransactionTitle({ type: 'consume' }), '套餐 流水');
});

test('resolveTransactionTitle splits typeLabel and body for display', () => {
  assert.deepEqual(resolveTransactionTitle({ type: 'recharge', title: '充 100 送 10' }), {
    typeLabel: '充值',
    typeKey: 'recharge',
    body: '100 送 10',
  });
  assert.deepEqual(
    resolveTransactionTitle({ type: 'consume', title: '双人主题套餐', packageId: 'double-theme' }),
    { typeLabel: '套餐', typeKey: 'package', body: '双人主题套餐' },
  );
  assert.deepEqual(
    resolveTransactionTitle({ type: 'consume', title: '活动报名 · 开业手作场' }),
    { typeLabel: '活动', typeKey: 'activity', body: '开业手作场' },
  );
  assert.deepEqual(resolveTransactionTitle({ type: 'refund', title: '套餐过期退款' }), {
    typeLabel: '套餐退款',
    typeKey: 'package_refund',
    body: '过期退款',
  });
  assert.deepEqual(
    resolveTransactionTitle({ type: 'refund', title: '活动报名取消 · 开业手作场' }),
    { typeLabel: '活动取消', typeKey: 'activity_cancel', body: '开业手作场' },
  );
});
