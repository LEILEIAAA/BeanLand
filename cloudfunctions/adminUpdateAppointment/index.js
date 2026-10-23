const cloud = require('wx-server-sdk');
const {
  STATUS,
  assertCanTransition,
  buildConfirmFields,
  buildOccupancyDocs,
  buildRejectFields,
  buildAdminCancelFields,
} = require('./appointmentRegistration');
// 说明：到店（arrived）只能由开台触发（见 adminStartSeatSession），
// 本函数不再提供手动「标记到店」路径，未开台的预约停留在 confirmed。
const {
  buildOccupancyUnion,
  assertCanBookSeats,
  buildSeatsFromTables,
  mergeOccupancyDocs,
} = require('./seats');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const FALLBACK_TABLES = [
  { code: 'F1-A', area: 'F1一楼·左墙', capacity: 6, bookable: true },
  { code: 'F1-B', area: 'F1一楼·窗边', capacity: 2, bookable: true },
  { code: 'F1-C', area: 'F1一楼·长桌', capacity: 6, bookable: true },
  { code: 'F2-A', area: 'F2二楼·左墙', capacity: 6, bookable: true },
  { code: 'F2-B', area: 'F2二楼·右墙', capacity: 6, bookable: true },
  { code: 'F2-C', area: 'F2二楼·长桌', capacity: 6, bookable: true },
];

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    // exists
  }
}

async function loadSeats() {
  try {
    const result = await db.collection('seats').limit(200).get();
    if (result.data && result.data.length) return result.data;
  } catch (error) {
    // fall through
  }
  try {
    const tablesRes = await db.collection('tables').limit(50).get();
    if (tablesRes.data && tablesRes.data.length) {
      return buildSeatsFromTables(tablesRes.data, { seatIdSeparator: '' });
    }
  } catch (error) {
    // fall through
  }
  return buildSeatsFromTables(FALLBACK_TABLES, { seatIdSeparator: '' });
}

async function loadOccupancies(date) {
  try {
    const _ = db.command;
    const [byDate, live] = await Promise.all([
      db.collection('seat_occupancies').where({ date }).limit(500).get(),
      db
        .collection('seat_occupancies')
        .where(_.or([{ type: 'in_use' }, { type: 'maintenance' }]))
        .limit(200)
        .get(),
    ]);
    return mergeOccupancyDocs(byDate.data || [], live.data || []);
  } catch (error) {
    return [];
  }
}

async function writeOccupancies(docs) {
  for (const doc of docs) {
    const { _id, ...data } = doc;
    try {
      await db.collection('seat_occupancies').doc(_id).set({ data });
    } catch (error) {
      await db.collection('seat_occupancies').add({
        data: { ...data, _id },
      }).catch(async () => {
        await db.collection('seat_occupancies').doc(_id).update({ data });
      });
    }
  }
}

async function removeOccupanciesForAppointment(appointmentId) {
  try {
    const found = await db
      .collection('seat_occupancies')
      .where({ appointmentId })
      .limit(200)
      .get();
    const rows = found.data || [];
    await Promise.all(
      rows.map((row) => db.collection('seat_occupancies').doc(row._id).remove()),
    );
  } catch (error) {
    console.warn('[adminUpdateAppointment] remove occupancies', error);
  }
}

async function handleConfirm(appt, appointmentId, seatIds, now) {
  const gate = assertCanTransition(appt.status, 'confirm');
  if (!gate.ok) {
    return { ok: false, code: 'INVALID_STATUS', message: gate.reason };
  }

  const confirm = buildConfirmFields({
    seatIds,
    peopleCount: appt.peopleCount,
    now,
  });
  if (!confirm.ok) {
    return { ok: false, code: 'INVALID_SEATS', message: confirm.reason };
  }

  const seats = await loadSeats();
  const slots = appt.timeSlots || (appt.timeSlot ? [appt.timeSlot] : []);
  const occupancies = await loadOccupancies(appt.appointmentDate);
  const occupancy = buildOccupancyUnion(occupancies, appt.appointmentDate, slots);
  const book = assertCanBookSeats({
    seats,
    seatIds: confirm.fields.seatIds,
    peopleCount: appt.peopleCount,
    bookedSeatIds: occupancy.bookedSeatIds,
    inUseSeatIds: occupancy.inUseSeatIds,
    maintenanceIds: occupancy.maintenanceIds,
  });
  if (!book.ok) {
    return { ok: false, code: 'SEAT_BLOCKED', message: book.reason || '座位不可用' };
  }

  const occDocs = buildOccupancyDocs({
    appointmentId,
    appointmentDate: appt.appointmentDate,
    timeSlots: slots,
    seatIds: confirm.fields.seatIds,
    type: 'reserved',
    now,
  });

  await ensureCollection('seat_occupancies');
  await writeOccupancies(occDocs);

  try {
    await db.collection('appointments').doc(appointmentId).update({
      data: confirm.fields,
    });
  } catch (error) {
    await removeOccupanciesForAppointment(appointmentId);
    throw error;
  }

  return {
    ok: true,
    appointmentId,
    status: STATUS.confirmed,
    seatIds: confirm.fields.seatIds,
    tableCode: confirm.fields.tableCode,
  };
}

async function handleReject(appt, appointmentId, rejectReason, now) {
  const gate = assertCanTransition(appt.status, 'reject');
  if (!gate.ok) {
    return { ok: false, code: 'INVALID_STATUS', message: gate.reason };
  }
  const reject = buildRejectFields({ rejectReason, now });
  if (!reject.ok) {
    return { ok: false, code: 'INVALID_REASON', message: reject.reason };
  }
  await removeOccupanciesForAppointment(appointmentId);
  await db.collection('appointments').doc(appointmentId).update({
    data: reject.fields,
  });
  return {
    ok: true,
    appointmentId,
    status: STATUS.rejected,
    rejectReason: reject.fields.rejectReason,
  };
}

async function handleAdminCancel(appt, appointmentId, now) {
  const gate = assertCanTransition(appt.status, 'adminCancel');
  if (!gate.ok) {
    return { ok: false, code: 'INVALID_STATUS', message: gate.reason };
  }
  await removeOccupanciesForAppointment(appointmentId);
  const fields = buildAdminCancelFields(now);
  await db.collection('appointments').doc(appointmentId).update({ data: fields });
  return {
    ok: true,
    appointmentId,
    status: STATUS.cancelled,
    cancelReason: fields.cancelReason,
  };
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
    }
    const isAdmin = await assertAdmin(OPENID).catch(() => false);
    if (!isAdmin) {
      return { ok: false, code: 'FORBIDDEN', message: 'admin only' };
    }

    const appointmentId = event && event.appointmentId;
    const action = event && event.action;
    if (!appointmentId || !action) {
      return {
        ok: false,
        code: 'INVALID_PAYLOAD',
        message: 'appointmentId and action required',
      };
    }

    const doc = await db.collection('appointments').doc(appointmentId).get();
    const appt = doc && doc.data;
    if (!appt) {
      return { ok: false, code: 'NOT_FOUND', message: '预约不存在' };
    }

    const now = Date.now();
    if (action === 'confirm') {
      return handleConfirm(appt, appointmentId, event.seatIds, now);
    }
    if (action === 'reject') {
      return handleReject(appt, appointmentId, event.rejectReason, now);
    }
    if (action === 'adminCancel') {
      return handleAdminCancel(appt, appointmentId, now);
    }

    return { ok: false, code: 'INVALID_ACTION', message: '未知操作' };
  } catch (error) {
    console.error('[adminUpdateAppointment]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && error.message) || 'update failed',
    };
  }
};
