const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatDurationLabel,
  formatActiveElapsedLabel,
  formatAmountLabel,
  mapAdminSessionRow,
  mapMemberSessionRow,
  activeElapsedLabelFromSessions,
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
    assert.equal(formatAmountLabel(88), '¥88');
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
    assert.equal(row.memberLabel, '小豆 · 13800138000');
    assert.equal(row.seatLabel, 'F1-A1、F1-A2');
    assert.equal(row.dateLabel, '2026-07-16 14:30');
    assert.equal(row.durationLabel, '2 小时 25 分');
    assert.equal(row.overtimeLabel, '25 分钟');
    assert.equal(row.isOvertime, true);
    assert.equal(row.packageName, '双人畅玩');
    assert.equal(row.amountLabel, '¥88');
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
    assert.equal(row.amountLabel, '¥88');
    assert.equal(row.seatLabel, 'F1-A1');
    assert.equal(row.memberLabel, undefined);
    assert.equal(row.dateLabel, '2026-07-16 14:30');
    assert.equal(row.endedLabel, '2026-07-16 16:55');
    assert.equal(row.timeRangeLabel, '2026-07-16 14:30 - 16:55');
  });

  it('marks active session with elapsed duration from startedAt', () => {
    const now = startedAt + 45 * 60 * 1000;
    const row = mapMemberSessionRow(
      {
        _id: 's3',
        status: 'active',
        tableCode: 'F1-A',
        seatIds: ['F1-A1'],
        startedAt,
        totalMinutes: 0,
        overtimeMinutes: 0,
      },
      now,
    );
    assert.equal(row.active, true);
    assert.equal(row.statusLabel, '进行中');
    assert.equal(row.durationLabel, '已进行 45分钟');
    assert.equal(row.endedLabel, '');
    assert.equal(row.timeRangeLabel, '2026-07-16 14:30');
  });

  it('shows end date when session crosses midnight', () => {
    const overnightEnd = startedAt + 12 * 60 * 60 * 1000; // 02:30 next day
    const row = mapMemberSessionRow({
      _id: 's5',
      status: 'ended',
      tableCode: 'F1-A',
      seatIdsSnapshot: ['F1-A1'],
      startedAt,
      endedAt: overnightEnd,
      totalMinutes: 720,
      overtimeMinutes: 0,
    });
    assert.equal(row.timeRangeLabel, '2026-07-16 14:30 - 2026-07-17 02:30');
  });

  it('ignores Array.map index so elapsed is not stuck at 0', () => {
    const started = Date.now() - 45 * 60 * 1000;
    const row = mapMemberSessionRow(
      {
        _id: 's4',
        status: 'active',
        tableCode: 'F1-A',
        seatIds: ['F1-A1'],
        startedAt: started,
      },
      0,
    );
    assert.equal(row.durationLabel, '已进行 45分钟');
  });
});

describe('formatActiveElapsedLabel', () => {
  it('formats compact elapsed labels', () => {
    assert.equal(formatActiveElapsedLabel(0), '已进行 0分钟');
    assert.equal(formatActiveElapsedLabel(45), '已进行 45分钟');
    assert.equal(formatActiveElapsedLabel(60), '已进行 1小时');
    assert.equal(formatActiveElapsedLabel(145), '已进行 2小时25分');
  });
});

describe('activeElapsedLabelFromSessions', () => {
  it('returns label for newest active session, empty otherwise', () => {
    const now = startedAt + 45 * 60 * 1000;
    assert.equal(activeElapsedLabelFromSessions([], now), '');
    assert.equal(
      activeElapsedLabelFromSessions(
        [{ status: 'ended', startedAt, totalMinutes: 30 }],
        now,
      ),
      '',
    );
    assert.equal(
      activeElapsedLabelFromSessions(
        [
          { status: 'ended', startedAt: startedAt + 1000, totalMinutes: 10 },
          { status: 'active', startedAt },
        ],
        now,
      ),
      '已进行 45分钟',
    );
  });
});
