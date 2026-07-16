const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatDurationLabel,
  formatAmountLabel,
  mapAdminSessionRow,
  mapMemberSessionRow,
} = require('../miniprogram/utils/seatSessionHistory');

// 2026-07-16 14:30 UTC+8 => started
const startedAt = Date.UTC(2026, 6, 16, 6, 30, 0); // 14:30 China
const endedAt = startedAt + 145 * 60 * 1000; // +2h25m

describe('formatDurationLabel', () => {
  it('formats minutes, hours and mixed', () => {
    assert.equal(formatDurationLabel(0), '0 分钟');
    assert.equal(formatDurationLabel(45), '45 分钟');
    assert.equal(formatDurationLabel(60), '1 小时');
    assert.equal(formatDurationLabel(145), '2 小时 25 分');
    assert.equal(formatDurationLabel(-5), '0 分钟');
  });
});

describe('formatAmountLabel', () => {
  it('shows yuan for positive amount, empty otherwise', () => {
    assert.equal(formatAmountLabel(88), '¥88.00');
    assert.equal(formatAmountLabel(0), '');
    assert.equal(formatAmountLabel(null), '');
    assert.equal(formatAmountLabel(undefined), '');
  });
});

describe('mapAdminSessionRow', () => {
  it('builds review row with member, seats snapshot, duration and amount', () => {
    const row = mapAdminSessionRow({
      _id: 's1',
      memberNickname: '小豆',
      memberPhone: '13800138000',
      tableCode: 'F1-A',
      seatIds: [],
      seatIdsSnapshot: ['F1-A1', 'F1-A2'],
      startedAt,
      endedAt,
      totalMinutes: 145,
      overtimeMinutes: 25,
      packageName: '双人畅玩',
      consumedAmount: 88,
    });
    assert.equal(row.id, 's1');
    assert.equal(row.memberLabel, '小豆 · 尾号 8000');
    assert.equal(row.seatLabel, 'F1-A1、F1-A2');
    assert.equal(row.dateLabel, '2026-07-16 14:30');
    assert.equal(row.durationLabel, '2 小时 25 分');
    assert.equal(row.overtimeLabel, '25 分钟');
    assert.equal(row.isOvertime, true);
    assert.equal(row.packageName, '双人畅玩');
    assert.equal(row.amountLabel, '¥88.00');
  });

  it('degrades gracefully for legacy rows without snapshot/amount', () => {
    const row = mapAdminSessionRow({
      _id: 's2',
      memberNickname: '',
      memberPhone: '',
      tableCode: '',
      seatIds: ['F2-B3'],
      startedAt,
      endedAt,
      totalMinutes: 30,
      overtimeMinutes: 0,
    });
    assert.equal(row.memberLabel, '会员');
    assert.equal(row.seatLabel, 'F2-B3');
    assert.equal(row.overtimeLabel, '');
    assert.equal(row.isOvertime, false);
    assert.equal(row.amountLabel, '');
    assert.equal(row.packageName, '');
  });
});

describe('mapMemberSessionRow', () => {
  it('builds ended record for member without exposing other members', () => {
    const row = mapMemberSessionRow({
      _id: 's1',
      status: 'ended',
      tableCode: 'F1-A',
      seatIdsSnapshot: ['F1-A1'],
      startedAt,
      endedAt,
      totalMinutes: 145,
      overtimeMinutes: 25,
      packageName: '双人畅玩',
      consumedAmount: 88,
    });
    assert.equal(row.active, false);
    assert.equal(row.statusLabel, '已结束');
    assert.equal(row.durationLabel, '2 小时 25 分');
    assert.equal(row.amountLabel, '¥88.00');
    assert.equal(row.seatLabel, 'F1-A1');
    assert.equal(row.memberLabel, undefined);
  });

  it('marks active session without duration', () => {
    const row = mapMemberSessionRow({
      _id: 's3',
      status: 'active',
      tableCode: 'F1-A',
      seatIds: ['F1-A1'],
      startedAt,
      totalMinutes: 0,
      overtimeMinutes: 0,
    });
    assert.equal(row.active, true);
    assert.equal(row.statusLabel, '进行中');
    assert.equal(row.durationLabel, '');
  });
});
