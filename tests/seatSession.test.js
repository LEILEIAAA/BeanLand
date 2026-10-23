const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  assertCanStartSeatBatch,
  buildStartPairs,
  buildStartGroups,
  calcSessionTime,
  buildEndSessionFields,
  buildStartSessionRecord,
  calcRemainingMinutes,
  DURATION_OPTIONS,
} = require('../miniprogram/utils/seatSession');
const { buildSeatsFromTables } = require('../miniprogram/utils/seats');

const seats = buildSeatsFromTables(
  [
    { code: 'F1-A', area: 'F1一楼·左墙', capacity: 6, bookable: true },
    { code: 'F1-B', area: 'F1一楼·窗边', capacity: 2, bookable: true },
    { code: 'F2-A', area: 'F2二楼·左墙', capacity: 6, bookable: true },
  ],
  { seatIdSeparator: '' },
);
const seatsById = Object.fromEntries(seats.map((s) => [s.id, s]));

describe('toggleSeatSelection / trimSeatsToMemberCount', () => {
  it('caps seat picks to member count and trims when members shrink', () => {
    const {
      toggleSeatSelection,
      trimSeatsToMemberCount,
    } = require('../miniprogram/utils/seatSession');

    assert.equal(
      toggleSeatSelection({
        selectedSeatIds: [],
        seatId: 'F1-A1',
        memberCount: 0,
      }).code,
      'NEED_MEMBERS',
    );

    const first = toggleSeatSelection({
      selectedSeatIds: [],
      seatId: 'F1-A1',
      memberCount: 2,
    });
    assert.equal(first.ok, true);
    assert.deepEqual(first.selectedSeatIds, ['F1-A1']);

    const full = toggleSeatSelection({
      selectedSeatIds: ['F1-A1', 'F1-A2'],
      seatId: 'F1-A3',
      memberCount: 2,
    });
    assert.equal(full.ok, false);
    assert.equal(full.code, 'SEAT_LIMIT');

    const oneMember = toggleSeatSelection({
      selectedSeatIds: ['F1-A1'],
      seatId: 'F1-A2',
      memberCount: 1,
    });
    assert.equal(oneMember.ok, true);
    assert.deepEqual(oneMember.selectedSeatIds, ['F1-A1', 'F1-A2']);

    assert.deepEqual(trimSeatsToMemberCount(['F1-A1', 'F1-A2', 'F1-A3'], 1), [
      'F1-A1',
      'F1-A2',
      'F1-A3',
    ]);
    assert.deepEqual(trimSeatsToMemberCount(['F1-A1', 'F1-A2', 'F1-A3'], 2), [
      'F1-A1',
      'F1-A2',
    ]);
  });
});

describe('formatSessionTimeLabels', () => {
  it('shows elapsed as primary and remaining or overtime as secondary', () => {
    const { formatSessionTimeLabels } = require('../miniprogram/utils/seatSession');
    const within = formatSessionTimeLabels({
      elapsedMinutes: 40,
      remainingMinutes: 80,
      overtimeMinutes: 0,
      phase: 'within',
    });
    assert.equal(within.primary, '40 分钟');
    assert.equal(within.secondary, '80 分钟');
    assert.equal(within.secondaryKind, 'remaining');

    const overtime = formatSessionTimeLabels({
      elapsedMinutes: 135,
      remainingMinutes: 0,
      overtimeMinutes: 15,
      phase: 'overtime',
    });
    assert.equal(overtime.primary, '135 分钟');
    assert.equal(overtime.secondary, '15 分钟');
    assert.equal(overtime.secondaryKind, 'overtime');
  });
});

describe('buildStartPairs / buildStartGroups / assertCanStartSeatBatch', () => {
  it('pairs members and seats by order one-to-one for companion batch', () => {
    assert.deepEqual(buildStartPairs(['m1', 'm2'], ['F1-A1', 'F2-A3']), [
      { memberId: 'm1', seatId: 'F1-A1' },
      { memberId: 'm2', seatId: 'F2-A3' },
    ]);
  });

  it('merges multiple seats into one group for single member', () => {
    assert.deepEqual(buildStartGroups(['m1'], ['F1-A1', 'F1-A2', 'F2-A3']), [
      { memberId: 'm1', seatIds: ['F1-A1', 'F1-A2', 'F2-A3'] },
    ]);
    const batch = assertCanStartSeatBatch({
      memberIds: ['m1'],
      seatIds: ['F1-A1', 'F1-A2', 'F2-A3'],
      seatsById,
      blockedIds: new Set(),
      busyMemberIds: new Set(),
    });
    assert.equal(batch.ok, true);
    assert.equal(batch.groups.length, 1);
    assert.deepEqual(batch.groups[0].seatIds, ['F1-A1', 'F1-A2', 'F2-A3']);
  });

  it('allows single pair and cross-zone non-contiguous seats', () => {
    const one = assertCanStartSeatBatch({
      memberIds: ['m1'],
      seatIds: ['F1-A1'],
      seatsById,
      blockedIds: new Set(),
      busyMemberIds: new Set(),
    });
    assert.equal(one.ok, true);
    assert.equal(one.pairs.length, 1);

    const batch = assertCanStartSeatBatch({
      memberIds: ['m1', 'm2'],
      seatIds: ['F1-A1', 'F2-A3'],
      seatsById,
      blockedIds: new Set(),
      busyMemberIds: new Set(),
    });
    assert.equal(batch.ok, true);
    assert.deepEqual(batch.pairs, [
      { memberId: 'm1', seatId: 'F1-A1' },
      { memberId: 'm2', seatId: 'F2-A3' },
    ]);
  });

  it('rejects unequal counts for companion, busy member, blocked seat, duplicates', () => {
    assert.equal(
      assertCanStartSeatBatch({
        memberIds: ['m1', 'm2'],
        seatIds: ['F1-A1'],
        seatsById,
        blockedIds: new Set(),
        busyMemberIds: new Set(),
      }).code,
      'COUNT_MISMATCH',
    );
    const busy = assertCanStartSeatBatch({
      memberIds: ['m1', 'm2'],
      seatIds: ['F1-A1', 'F1-A2'],
      seatsById,
      blockedIds: new Set(),
      busyMemberIds: new Set(['m2']),
      memberLabelsById: { m2: '小豆' },
    });
    assert.equal(busy.code, 'MEMBER_BUSY');
    assert.match(busy.message, /小豆/);
    assert.doesNotMatch(busy.message, /m2/);
    assert.equal(
      assertCanStartSeatBatch({
        memberIds: ['m1', 'm2'],
        seatIds: ['F1-A1', 'F1-A2'],
        seatsById,
        blockedIds: new Set(['F1-A2']),
        busyMemberIds: new Set(),
      }).code,
      'SEAT_BLOCKED',
    );
    assert.equal(
      assertCanStartSeatBatch({
        memberIds: ['m1', 'm1'],
        seatIds: ['F1-A1', 'F1-A2'],
        seatsById,
        blockedIds: new Set(),
        busyMemberIds: new Set(),
      }).code,
      'MEMBER_DUPLICATE',
    );
    assert.equal(
      assertCanStartSeatBatch({
        memberIds: ['m1', 'm2'],
        seatIds: ['F1-A1', 'F1-A1'],
        seatsById,
        blockedIds: new Set(),
        busyMemberIds: new Set(),
      }).code,
      'SEAT_DUPLICATE',
    );
  });
});

describe('calcSessionTime / buildEndSessionFields', () => {
  const startedAt = 1_700_000_000_000;
  const durationMinutes = 120;
  const expectedEndAt = startedAt + durationMinutes * 60 * 1000;

  it('reports remaining within plan and overtime after expectedEndAt', () => {
    const within = calcSessionTime({
      startedAt,
      expectedEndAt,
      durationMinutes,
      now: startedAt + 30 * 60 * 1000,
    });
    assert.equal(within.phase, 'within');
    assert.equal(within.remainingMinutes, 90);
    assert.equal(within.overtimeMinutes, 0);
    assert.equal(within.elapsedMinutes, 30);

    const overtime = calcSessionTime({
      startedAt,
      expectedEndAt,
      durationMinutes,
      now: expectedEndAt + 18 * 60 * 1000,
    });
    assert.equal(overtime.phase, 'overtime');
    assert.equal(overtime.remainingMinutes, 0);
    assert.equal(overtime.overtimeMinutes, 18);
    assert.equal(overtime.elapsedMinutes, 138);
  });

  it('writes total and overtime on end for multi-seat session', () => {
    const session = buildStartSessionRecord({
      memberId: 'm1',
      memberOpenid: 'o1',
      memberPhone: '13800138000',
      memberNickname: '小豆',
      seatIds: ['F1-A1', 'F1-A2'],
      tableCode: 'F1-A',
      durationMinutes: 120,
      now: startedAt,
    });
    assert.deepEqual(session.seatIds, ['F1-A1', 'F1-A2']);
    // 开台即写快照，避免结束清空 seatIds 后历史丢座
    assert.deepEqual(session.seatIdsSnapshot, ['F1-A1', 'F1-A2']);
    const onTime = buildEndSessionFields(session, expectedEndAt);
    assert.equal(onTime.status, 'ended');
    assert.equal(onTime.totalMinutes, 120);
    assert.equal(onTime.overtimeMinutes, 0);
    // 结束时快照座位供历史复盘
    assert.deepEqual(onTime.seatIdsSnapshot, ['F1-A1', 'F1-A2']);

    const late = buildEndSessionFields(session, expectedEndAt + 25 * 60 * 1000);
    assert.equal(late.totalMinutes, 145);
    assert.equal(late.overtimeMinutes, 25);
  });

  it('keeps existing seatIdsSnapshot when ending with empty seatIds', () => {
    const endedLike = {
      seatIds: [],
      seatIdsSnapshot: ['F1-A1'],
      startedAt,
      durationMinutes: 120,
    };
    const fields = buildEndSessionFields(endedLike, expectedEndAt);
    assert.deepEqual(fields.seatIdsSnapshot, ['F1-A1']);
  });

  it('carries package consumption fields onto start record', () => {
    const withPkg = buildStartSessionRecord({
      memberId: 'm1',
      memberOpenid: 'o1',
      memberPhone: '13800138000',
      memberNickname: '小豆',
      seatIds: ['F1-A1'],
      tableCode: 'F1-A',
      durationMinutes: 120,
      packageOrderId: 'ord1',
      packageName: '双人畅玩',
      consumedAmount: 88,
      now: startedAt,
    });
    assert.equal(withPkg.packageOrderId, 'ord1');
    assert.equal(withPkg.packageName, '双人畅玩');
    assert.equal(withPkg.consumedAmount, 88);

    const noPkg = buildStartSessionRecord({
      memberId: 'm1',
      memberOpenid: 'o1',
      seatIds: ['F1-A1'],
      tableCode: 'F1-A',
      durationMinutes: 120,
      now: startedAt,
    });
    assert.equal(noPkg.packageOrderId, '');
    assert.equal(noPkg.packageName, '');
    assert.equal(noPkg.consumedAmount, 0);
  });

  it('keeps duration options and remaining helper', () => {
    assert.deepEqual(DURATION_OPTIONS, [30, 60, 90, 120, 150, 180, 210, 240]);
    assert.equal(calcRemainingMinutes(expectedEndAt, startedAt + 60 * 1000), 119);
  });
});

describe('buildReservationsBySeatId / formatReservedOpenPrompt', () => {
  it('merges appointment slots onto seats and builds open prompt', () => {
    const {
      buildReservationsBySeatId,
      formatReservedOpenPrompt,
    } = require('../miniprogram/utils/seatSession');
    const bySeat = buildReservationsBySeatId({
      today: '2026-07-16',
      appointments: [
        {
          appointmentDate: '2026-07-16',
          timeSlots: ['14:00-16:00', '16:00-18:00'],
          seatIds: ['F1-B1', 'F1-B2'],
          status: '已确认',
        },
        {
          date: '2026-07-16',
          timeSlot: '12:00-14:00',
          seatIds: ['F1-B1'],
          status: '已完成',
        },
      ],
      occupancies: [
        {
          type: 'reserved',
          date: '2026-07-16',
          timeSlot: '10:00-12:00',
          seatId: 'F1-C1',
        },
      ],
    });
    assert.deepEqual(bySeat['F1-B1'].timeSlots, ['14:00-16:00', '16:00-18:00']);
    assert.equal(bySeat['F1-B1'].slotLabel, '14:00-18:00');
    assert.equal(bySeat['F1-C1'].slotLabel, '10:00-12:00');
    const prompt = formatReservedOpenPrompt(['F1-B1', 'F1-A1'], bySeat);
    assert.match(prompt, /F1-B1/);
    assert.match(prompt, /14:00-18:00/);
    assert.doesNotMatch(prompt, /F1-A1/);
    assert.equal(bySeat['F1-B1'].phase, 'confirmed');
    assert.equal(bySeat['F1-B1'].readyToOpen, false);
    assert.deepEqual(bySeat['F1-B1'].memberIds, []);
  });

  it('skips reserved prompt when opening member owns the reservation', () => {
    const { buildReservationsBySeatId, formatReservedOpenPrompt } = require(
      '../miniprogram/utils/seatSession',
    );
    const bySeat = buildReservationsBySeatId({
      today: '2026-07-16',
      appointments: [
        {
          _id: 'appt1',
          memberId: 'm-owner',
          appointmentDate: '2026-07-16',
          timeSlots: ['12:00-14:00'],
          seatIds: ['F1-B1', 'F1-A6', 'F1-B2'],
          status: '已确认',
        },
      ],
      occupancies: [],
    });
    assert.deepEqual(bySeat['F1-B1'].memberIds, ['m-owner']);
    const ownerPrompt = formatReservedOpenPrompt(
      ['F1-B1', 'F1-A6', 'F1-B2'],
      bySeat,
      ['m-owner'],
    );
    assert.equal(ownerPrompt, '');

    const otherPrompt = formatReservedOpenPrompt(
      ['F1-B1', 'F1-A6'],
      bySeat,
      ['m-other'],
    );
    assert.match(otherPrompt, /F1-B1/);
    assert.match(otherPrompt, /12:00-14:00/);
  });

  it('marks arrived appointments as readyToOpen for seat board sync', () => {
    const { buildReservationsBySeatId } = require('../miniprogram/utils/seatSession');
    const bySeat = buildReservationsBySeatId({
      today: '2026-07-16',
      appointments: [
        {
          appointmentDate: '2026-07-16',
          timeSlots: ['14:00-16:00'],
          seatIds: ['F1-A1'],
          status: 'arrived',
        },
        {
          appointmentDate: '2026-07-16',
          timeSlots: ['16:00-18:00'],
          seatIds: ['F1-A2'],
          status: 'pending',
        },
      ],
      occupancies: [
        {
          type: 'arrived',
          date: '2026-07-16',
          timeSlot: '14:00-16:00',
          seatId: 'F1-A1',
        },
      ],
    });
    assert.equal(bySeat['F1-A1'].readyToOpen, true);
    assert.equal(bySeat['F1-A1'].phase, 'arrived');
    assert.equal(bySeat['F1-A2'], undefined);
  });

  it('ignores no_show appointments for seat reservation phase', () => {
    const { buildReservationsBySeatId } = require('../miniprogram/utils/seatSession');
    const bySeat = buildReservationsBySeatId({
      today: '2026-07-16',
      appointments: [
        {
          appointmentDate: '2026-07-16',
          timeSlots: ['10:00-12:00'],
          seatIds: ['F1-B1'],
          status: 'no_show',
        },
      ],
      occupancies: [],
    });
    assert.equal(bySeat['F1-B1'], undefined);
  });

  it('ignores leftover reserved occupancies for released appointments', () => {
    const { buildReservationsBySeatId } = require('../miniprogram/utils/seatSession');
    const bySeat = buildReservationsBySeatId({
      today: '2026-07-16',
      appointments: [
        {
          _id: 'appt-noshow',
          appointmentDate: '2026-07-16',
          timeSlots: ['10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00'],
          seatIds: ['F1-A1', 'F1-A2'],
          status: 'no_show',
        },
        {
          _id: 'appt-cancelled',
          appointmentDate: '2026-07-16',
          timeSlots: ['12:00-14:00'],
          seatIds: ['F1-B1'],
          status: 'cancelled',
        },
      ],
      occupancies: [
        {
          type: 'reserved',
          date: '2026-07-16',
          timeSlot: '10:00-12:00',
          seatId: 'F1-A1',
          appointmentId: 'appt-noshow',
        },
        {
          type: 'reserved',
          date: '2026-07-16',
          timeSlot: '16:00-18:00',
          seatId: 'F1-A2',
          appointmentId: 'appt-noshow',
        },
        {
          type: 'reserved',
          date: '2026-07-16',
          timeSlot: '12:00-14:00',
          seatId: 'F1-B1',
          appointmentId: 'appt-cancelled',
        },
        {
          type: 'reserved',
          date: '2026-07-16',
          timeSlot: '18:00-20:00',
          seatId: 'F1-C1',
          appointmentId: 'appt-active',
        },
      ],
    });
    assert.equal(bySeat['F1-A1'], undefined);
    assert.equal(bySeat['F1-A2'], undefined);
    assert.equal(bySeat['F1-B1'], undefined);
    assert.equal(bySeat['F1-C1'].slotLabel, '18:00-20:00');
  });
});
