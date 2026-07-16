const assert = require('node:assert/strict');
const test = require('node:test');

const {
  STATUS,
  STATUS_LABEL,
  HOLD_MINUTES,
  REJECT_REASON_PRESETS,
  assertCanRegister,
  assertCanTransition,
  buildRegistrationDoc,
  buildConfirmFields,
  buildOccupancyDocs,
  occupancyDocId,
  deriveTableCode,
  allowedRegisterDates,
  resolveNoShowDeadline,
  shouldMarkNoShow,
  buildNoShowFields,
  buildAdminCancelFields,
  assertRejectReason,
  buildRejectFields,
} = require('../miniprogram/utils/appointmentRegistration');

test('allowedRegisterDates returns today and tomorrow only', () => {
  assert.deepEqual(allowedRegisterDates('2026-07-16'), ['2026-07-16', '2026-07-17']);
});

test('assertCanRegister accepts valid registration without seats', () => {
  const result = assertCanRegister({
    appointmentDate: '2026-07-16',
    today: '2026-07-16',
    timeSlots: ['14:00-16:00'],
    peopleCount: 2,
    name: '小豆',
    phone: '13800138000',
    source: '小程序',
  });
  assert.equal(result.ok, true);
});

test('assertCanRegister rejects date outside today/tomorrow', () => {
  const result = assertCanRegister({
    appointmentDate: '2026-07-20',
    today: '2026-07-16',
    timeSlots: ['14:00-16:00'],
    peopleCount: 2,
    name: '小豆',
    phone: '13800138000',
    source: '小程序',
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /今天|明天/);
});

test('assertCanRegister rejects missing phone or seats are not required', () => {
  const badPhone = assertCanRegister({
    appointmentDate: '2026-07-16',
    today: '2026-07-16',
    timeSlots: ['14:00-16:00'],
    peopleCount: 2,
    name: '小豆',
    phone: '123',
    source: '小程序',
  });
  assert.equal(badPhone.ok, false);

  const noSeats = assertCanRegister({
    appointmentDate: '2026-07-17',
    today: '2026-07-16',
    timeSlots: ['12:00-14:00', '14:00-16:00'],
    peopleCount: 3,
    name: '小豆',
    phone: '13900139000',
    source: '社群',
    seatIds: [],
  });
  assert.equal(noSeats.ok, true);
});

test('buildRegistrationDoc creates pending without seatIds', () => {
  const doc = buildRegistrationDoc({
    openid: 'o1',
    memberId: 'm1',
    appointmentDate: '2026-07-16',
    timeSlots: ['14:00-16:00', '16:00-18:00'],
    peopleCount: 2,
    name: '小豆',
    phone: '13800138000',
    source: '小红书',
    now: 1000,
  });
  assert.equal(doc.status, STATUS.pending);
  assert.deepEqual(doc.seatIds, []);
  assert.equal(doc.tableCode, '');
  assert.equal(doc.timeSlot, '14:00-18:00');
  assert.equal(doc.createdAt, 1000);
});

test('assertCanTransition enforces status machine', () => {
  assert.equal(assertCanTransition(STATUS.pending, 'confirm').ok, true);
  assert.equal(assertCanTransition(STATUS.pending, 'reject').ok, true);
  assert.equal(assertCanTransition(STATUS.pending, 'cancel').ok, true);
  assert.equal(assertCanTransition(STATUS.pending, 'arrive').ok, false);
  assert.equal(assertCanTransition(STATUS.confirmed, 'arrive').ok, true);
  assert.equal(assertCanTransition(STATUS.confirmed, 'cancel').ok, false);
  assert.equal(assertCanTransition(STATUS.confirmed, 'adminCancel').ok, true);
  assert.equal(assertCanTransition(STATUS.pending, 'adminCancel').ok, false);
  assert.equal(assertCanTransition(STATUS.arrived, 'arrive').ok, false);
});

test('buildAdminCancelFields marks merchant cancelled and clears seats', () => {
  const fields = buildAdminCancelFields(8000);
  assert.equal(fields.status, STATUS.cancelled);
  assert.equal(fields.cancelledAt, 8000);
  assert.equal(fields.cancelReason, 'merchant');
  assert.deepEqual(fields.seatIds, []);
  assert.equal(fields.tableCode, '');
});

test('buildConfirmFields requires seat count match and writes confirmed', () => {
  const ok = buildConfirmFields({
    seatIds: ['F1-A1', 'F1-A2'],
    peopleCount: 2,
    now: 2000,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.fields.status, STATUS.confirmed);
  assert.deepEqual(ok.fields.seatIds, ['F1-A1', 'F1-A2']);
  assert.equal(ok.fields.tableCode, 'F1-A');
  assert.equal(ok.fields.confirmedAt, 2000);

  const bad = buildConfirmFields({
    seatIds: ['F1-A1'],
    peopleCount: 2,
    now: 2000,
  });
  assert.equal(bad.ok, false);
});

test('buildOccupancyDocs expands seat x slot with reserved or arrived type', () => {
  const docs = buildOccupancyDocs({
    appointmentId: 'ap1',
    appointmentDate: '2026-07-16',
    timeSlots: ['14:00-16:00', '16:00-18:00'],
    seatIds: ['F1-B1', 'F1-B2'],
    type: 'reserved',
    now: 3000,
  });
  assert.equal(docs.length, 4);
  assert.equal(docs[0]._id, occupancyDocId('2026-07-16', '14:00-16:00', 'F1-B1'));
  assert.equal(docs[0].type, 'reserved');
  assert.equal(docs[0].appointmentId, 'ap1');

  const arrived = buildOccupancyDocs({
    appointmentId: 'ap1',
    appointmentDate: '2026-07-16',
    timeSlots: ['14:00-16:00'],
    seatIds: ['F1-B1'],
    type: 'arrived',
    now: 4000,
  });
  assert.equal(arrived[0].type, 'arrived');
});

test('deriveTableCode joins unique table prefixes', () => {
  assert.equal(deriveTableCode(['F1-A1', 'F1-A2']), 'F1-A');
  assert.equal(deriveTableCode(['F1-A1', 'F2-B1']), 'F1-A/F2-B');
  assert.equal(deriveTableCode([]), '');
});

test('STATUS_LABEL maps for UI', () => {
  assert.equal(STATUS_LABEL.pending, '待商家确认');
  assert.equal(STATUS_LABEL.confirmed, '已确认');
  assert.equal(STATUS_LABEL.arrived, '已到店');
  assert.equal(STATUS_LABEL.no_show, '未到店');
  assert.equal(HOLD_MINUTES, 15);
});

test('resolveNoShowDeadline uses first slot start plus hold minutes', () => {
  const deadline = resolveNoShowDeadline('2026-07-16', ['10:00-12:00', '12:00-14:00']);
  const start = new Date('2026-07-16T10:00:00+08:00').getTime();
  assert.equal(deadline, start + 15 * 60 * 1000);
});

test('shouldMarkNoShow only for confirmed past deadline', () => {
  const start = new Date('2026-07-16T10:00:00+08:00').getTime();
  const appt = {
    status: STATUS.confirmed,
    appointmentDate: '2026-07-16',
    timeSlots: ['10:00-12:00'],
  };
  assert.equal(shouldMarkNoShow(appt, start + 14 * 60 * 1000), false);
  assert.equal(shouldMarkNoShow(appt, start + 15 * 60 * 1000), true);
  assert.equal(
    shouldMarkNoShow({ ...appt, status: STATUS.pending }, start + 20 * 60 * 1000),
    false,
  );
  assert.equal(
    shouldMarkNoShow({ ...appt, status: STATUS.arrived }, start + 20 * 60 * 1000),
    false,
  );
});

test('buildNoShowFields writes no_show with timeout reason', () => {
  const fields = buildNoShowFields(9000);
  assert.equal(fields.status, STATUS.no_show);
  assert.equal(fields.noShowAt, 9000);
  assert.equal(fields.cancelReason, 'timeout');
  assert.equal(fields.updatedAt, 9000);
  assert.deepEqual(fields.seatIds, []);
  assert.equal(fields.tableCode, '');
});

test('shouldReleaseArrivedHold after last slot end', () => {
  const {
    shouldReleaseArrivedHold,
    resolveSlotEndMs,
    buildCompletedFields,
    STATUS,
  } = require('../miniprogram/utils/appointmentRegistration');
  const end = resolveSlotEndMs('2026-07-16', ['10:00-12:00', '16:00-18:00']);
  assert.equal(end, new Date('2026-07-16T18:00:00+08:00').getTime());
  const appt = {
    status: STATUS.arrived,
    appointmentDate: '2026-07-16',
    timeSlots: ['10:00-12:00', '16:00-18:00'],
    seatIds: ['F1-A1'],
  };
  assert.equal(shouldReleaseArrivedHold(appt, end - 1), false);
  assert.equal(shouldReleaseArrivedHold(appt, end), true);
  assert.equal(
    shouldReleaseArrivedHold({ ...appt, status: STATUS.confirmed }, end + 1),
    false,
  );
  const done = buildCompletedFields(111);
  assert.equal(done.status, STATUS.completed);
  assert.deepEqual(done.seatIds, []);
  assert.equal(done.tableCode, '');
});

test('assertCanTransition rejects actions on no_show', () => {
  assert.equal(assertCanTransition(STATUS.no_show, 'cancel').ok, false);
  assert.equal(assertCanTransition(STATUS.no_show, 'arrive').ok, false);
  assert.equal(assertCanTransition(STATUS.no_show, 'confirm').ok, false);
});

test('resolveArriveOnStart marks confirmed as arrived, skips already arrived', () => {
  const {
    resolveArriveOnStart,
    STATUS,
  } = require('../miniprogram/utils/appointmentRegistration');

  const fromConfirmed = resolveArriveOnStart(STATUS.confirmed, 5000);
  assert.equal(fromConfirmed.ok, true);
  assert.equal(fromConfirmed.shouldUpdate, true);
  assert.equal(fromConfirmed.fields.status, STATUS.arrived);
  assert.equal(fromConfirmed.fields.arrivedAt, 5000);

  const fromArrived = resolveArriveOnStart(STATUS.arrived, 5000);
  assert.equal(fromArrived.ok, true);
  assert.equal(fromArrived.shouldUpdate, false);

  const fromPending = resolveArriveOnStart(STATUS.pending, 5000);
  assert.equal(fromPending.ok, false);
});

test('REJECT_REASON_PRESETS has quick reasons without incomplete-info', () => {
  assert.deepEqual(REJECT_REASON_PRESETS, ['时段已满', '人数超限', '临时闭店', '其他']);
  assert.equal(REJECT_REASON_PRESETS.includes('信息不完整'), false);
});

test('assertRejectReason requires non-empty trimmed reason', () => {
  assert.equal(assertRejectReason('').ok, false);
  assert.equal(assertRejectReason('   ').ok, false);
  const ok = assertRejectReason('  时段已满  ');
  assert.equal(ok.ok, true);
  assert.equal(ok.rejectReason, '时段已满');
});

test('buildRejectFields writes rejected status and reason', () => {
  const result = buildRejectFields({ rejectReason: '临时闭店', now: 9000 });
  assert.equal(result.ok, true);
  assert.equal(result.fields.status, STATUS.rejected);
  assert.equal(result.fields.rejectReason, '临时闭店');
  assert.equal(result.fields.rejectedAt, 9000);
  assert.equal(result.fields.updatedAt, 9000);

  const empty = buildRejectFields({ rejectReason: '', now: 9000 });
  assert.equal(empty.ok, false);
});
