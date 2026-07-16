const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateExpectedEndTime,
  calculateOvertime,
  applyRecharge,
  spendBalance,
  createAppointmentSummary,
} = require('../miniprogram/utils/business');

test('calculateExpectedEndTime adds package duration to selected date and slot', () => {
  const result = calculateExpectedEndTime('2026-07-10', '13:00-15:00', 120);
  assert.equal(result.iso, '2026-07-10T15:00:00.000+08:00');
  assert.equal(result.display, '2026-07-10 15:00');
});

test('calculateOvertime returns zero before grace minutes and fee after overtime', () => {
  assert.deepEqual(calculateOvertime(120, 132, 15, 15), {
    overtimeMinutes: 0,
    fee: 0,
    billableUnits: 0,
  });

  assert.deepEqual(calculateOvertime(120, 166, 15, 30), {
    overtimeMinutes: 46,
    fee: 30,
    billableUnits: 2,
  });
});

test('applyRecharge separates principal and bonus balance', () => {
  const member = { principalBalance: 40, bonusBalance: 8, totalRecharge: 40, totalBonus: 8 };
  const result = applyRecharge(member, { rechargeAmount: 300, bonusAmount: 40 });

  assert.equal(result.member.principalBalance, 340);
  assert.equal(result.member.bonusBalance, 48);
  assert.equal(result.member.totalBalance, 388);
  assert.equal(result.transaction.type, 'recharge');
  assert.equal(result.transaction.principalDelta, 300);
  assert.equal(result.transaction.bonusDelta, 40);
});

test('spendBalance consumes bonus first then principal and records transaction', () => {
  const member = { principalBalance: 100, bonusBalance: 20, totalSpent: 0 };
  const result = spendBalance(member, 89, '标准拼豆体验');

  assert.equal(result.member.bonusBalance, 0);
  assert.equal(result.member.principalBalance, 31);
  assert.equal(result.member.totalBalance, 31);
  assert.equal(result.member.totalSpent, 89);
  assert.equal(result.transaction.bonusDelta, -20);
  assert.equal(result.transaction.principalDelta, -69);
});

test('spendBalance rejects insufficient balance', () => {
  assert.throws(() => spendBalance({ principalBalance: 10, bonusBalance: 5 }, 20, '余额支付'), /余额不足/);
});

test('createAppointmentSummary includes expected end time and meituan fields', () => {
  const summary = createAppointmentSummary({
    name: '小豆',
    packageName: '双人主题套餐',
    appointmentDate: '2026-07-10',
    timeSlot: '18:00-20:00',
    peopleCount: 2,
    durationMinutes: 120,
    isMeituan: true,
    meituanCode: 'MT123',
  });

  assert.equal(summary.title, '小豆的预约');
  assert.equal(summary.expectedEndTime.display, '2026-07-10 20:00');
  assert.equal(summary.tags.includes('美团来源'), true);
  assert.equal(summary.tags.includes('券码 MT123'), true);
});

test('createAppointmentSummary includes table and seats', () => {
  const summary = createAppointmentSummary({
    name: '小豆',
    packageName: '双人主题套餐',
    appointmentDate: '2026-07-10',
    timeSlot: '12:00-14:00',
    peopleCount: 2,
    durationMinutes: 120,
    isMeituan: false,
    tableCode: 'W1',
    seatIds: ['W1-3', 'W1-4'],
  });

  assert.equal(summary.tableCode, 'W1');
  assert.deepEqual(summary.seatIds, ['W1-3', 'W1-4']);
  assert.equal(summary.seatLabel, 'W1-3、W1-4');
});

test('createAppointmentSummary spans multiple contiguous slots', () => {
  const summary = createAppointmentSummary({
    name: '小豆',
    packageName: '双人主题套餐',
    appointmentDate: '2026-07-10',
    timeSlots: ['14:00-16:00', '16:00-18:00'],
    peopleCount: 2,
    durationMinutes: 120,
  });

  assert.equal(summary.timeSlot, '14:00-18:00');
  assert.deepEqual(summary.timeSlots, ['14:00-16:00', '16:00-18:00']);
  assert.equal(summary.expectedEndTime.display, '2026-07-10 18:00');
});
