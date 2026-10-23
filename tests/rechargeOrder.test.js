const test = require('node:test');
const assert = require('node:assert/strict');

const rechargeOrder = require('../miniprogram/utils/rechargeOrder');
const {
  yuanToFen,
  buildOutTradeNo,
  buildWechatRechargeDraft,
  buildManualRechargeDraft,
  canTransition,
  isCreditIdempotent,
  assertPayAmountMatch,
  CHANNEL,
  STATUS,
} = rechargeOrder;

test('yuanToFen converts recharge yuan to integer fen', () => {
  assert.equal(yuanToFen(100), 10000);
  assert.equal(yuanToFen(300), 30000);
  assert.equal(yuanToFen('500'), 50000);
});

test('buildOutTradeNo is unique-looking and within wechat length', () => {
  const a = buildOutTradeNo('m1');
  const b = buildOutTradeNo('m1');
  assert.notEqual(a, b);
  assert.ok(a.length <= 32);
  assert.match(a, /^R/);
});

test('buildWechatRechargeDraft snapshots plan and starts as created', () => {
  const draft = buildWechatRechargeDraft({
    openid: 'o1',
    memberId: 'm1',
    plan: { id: 'r100', rechargeAmount: 100, bonusAmount: 10 },
    now: 1000,
    outTradeNo: 'RTEST1',
  });

  assert.equal(draft.channel, CHANNEL.WECHAT_JSAPI);
  assert.equal(draft.status, STATUS.CREATED);
  assert.equal(draft.payAmountFen, 10000);
  assert.equal(draft.rechargeAmount, 100);
  assert.equal(draft.bonusAmount, 10);
  assert.equal(draft.planId, 'r100');
  assert.equal(draft.outTradeNo, 'RTEST1');
  assert.equal(draft.memberId, 'm1');
  assert.equal(draft._openid, 'o1');
});

test('buildManualRechargeDraft is transfer_manual and credited', () => {
  const draft = buildManualRechargeDraft({
    openid: 'oUser',
    memberId: 'm1',
    planId: 'r300',
    rechargeAmount: 300,
    bonusAmount: 40,
    operatorOpenid: 'oAdmin',
    now: 2000,
    outTradeNo: 'RMANUAL1',
  });

  assert.equal(draft.channel, CHANNEL.TRANSFER_MANUAL);
  assert.equal(draft.status, STATUS.CREDITED);
  assert.equal(draft.payAmountFen, 30000);
  assert.equal(draft.operatorOpenid, 'oAdmin');
  assert.equal(draft.creditedAt, 2000);
});

test('canTransition allows wechat happy path and rejects illegal jumps', () => {
  assert.equal(canTransition(STATUS.CREATED, STATUS.PAYING), true);
  assert.equal(canTransition(STATUS.PAYING, STATUS.PAID), true);
  assert.equal(canTransition(STATUS.PAID, STATUS.CREDITED), true);
  assert.equal(canTransition(STATUS.CREATED, STATUS.CREDITED), false);
  assert.equal(canTransition(STATUS.CREDITED, STATUS.PAID), false);
});

test('isCreditIdempotent when already credited', () => {
  assert.equal(isCreditIdempotent({ status: STATUS.CREDITED }), true);
  assert.equal(isCreditIdempotent({ status: STATUS.PAID }), false);
});

test('assertPayAmountMatch accepts equal fen and rejects mismatch', () => {
  assert.equal(assertPayAmountMatch({ payAmountFen: 10000 }, 10000), true);
  assert.equal(assertPayAmountMatch({ payAmountFen: 10000 }, 9999), false);
});

test('custom recharge helpers are removed', () => {
  assert.equal(rechargeOrder.resolveCustomRecharge, undefined);
  assert.equal(rechargeOrder.CUSTOM_MIN_YUAN, undefined);
  assert.equal(rechargeOrder.CUSTOM_PLAN_ID, undefined);
  assert.equal(rechargeOrder.normalizeYuan, undefined);
});
