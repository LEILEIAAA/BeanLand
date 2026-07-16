const {
  STATUS,
  shouldMarkNoShow,
  shouldReleaseArrivedHold,
  buildNoShowFields,
  buildCompletedFields,
} = require('./appointmentRegistration');

async function removeHoldOccupancies(db, appointmentId) {
  try {
    const occRes = await db
      .collection('seat_occupancies')
      .where({ appointmentId })
      .limit(100)
      .get();
    for (const row of occRes.data || []) {
      const type = row.type || 'reserved';
      if (type !== 'reserved' && type !== 'arrived') continue;
      try {
        await db.collection('seat_occupancies').doc(row._id).remove();
      } catch (removeErr) {
        console.warn('[settleNoShow] remove occupancy failed', row._id, removeErr);
      }
    }
  } catch (occErr) {
    console.warn('[settleNoShow] list occupancy failed', appointmentId, occErr);
  }
}

function hasLeftoverSeatFields(appt) {
  if (!appt) return false;
  if (appt.tableCode) return true;
  return Array.isArray(appt.seatIds) && appt.seatIds.length > 0;
}

function applyLocalFields(appt, fields) {
  Object.assign(appt, fields);
  if (Object.prototype.hasOwnProperty.call(fields, 'seatIds')) {
    appt.seatIds = fields.seatIds;
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'tableCode')) {
    appt.tableCode = fields.tableCode;
  }
}

/**
 * 打开列表时结算：
 * - confirmed 超时 → no_show，清空座位并删 reserved/arrived 占用
 * - arrived 时段已结束 → completed，清空座位并删占用
 * - 已是 no_show/completed 仍残留座位时补清
 */
async function settleNoShowAppointments(db, appointments, now) {
  const rows = Array.isArray(appointments) ? appointments : [];
  const ts = Number(now) || Date.now();
  const noShowFields = buildNoShowFields(ts);
  const completedFields = buildCompletedFields(ts);
  const clearSeatFields = {
    seatIds: [],
    tableCode: '',
    updatedAt: ts,
  };

  for (const appt of rows) {
    const id = appt._id || appt.id;
    if (!id) continue;

    if (shouldMarkNoShow(appt, ts)) {
      try {
        await db.collection('appointments').doc(id).update({ data: noShowFields });
      } catch (error) {
        console.warn('[settleNoShow] update appointment failed', id, error);
        continue;
      }
      applyLocalFields(appt, noShowFields);
      await removeHoldOccupancies(db, id);
      continue;
    }

    if (shouldReleaseArrivedHold(appt, ts)) {
      try {
        await db.collection('appointments').doc(id).update({ data: completedFields });
      } catch (error) {
        console.warn('[settleNoShow] complete arrived failed', id, error);
        continue;
      }
      applyLocalFields(appt, completedFields);
      await removeHoldOccupancies(db, id);
      continue;
    }

    if (appt.status !== STATUS.no_show && appt.status !== STATUS.completed) {
      continue;
    }
    if (!hasLeftoverSeatFields(appt)) {
      await removeHoldOccupancies(db, id);
      continue;
    }

    try {
      await db.collection('appointments').doc(id).update({ data: clearSeatFields });
    } catch (error) {
      console.warn('[settleNoShow] clear seat fields failed', id, error);
      continue;
    }
    applyLocalFields(appt, clearSeatFields);
    await removeHoldOccupancies(db, id);
  }

  return rows;
}

module.exports = {
  settleNoShowAppointments,
};
