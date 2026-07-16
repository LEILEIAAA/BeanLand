const {
  shouldMarkNoShow,
  buildNoShowFields,
} = require('./appointmentRegistration');

/**
 * 打开列表时结算：confirmed 超时 → no_show，并删除 reserved 占用。
 * 就地更新 appointments 数组中的文档字段；幂等。
 */
async function settleNoShowAppointments(db, appointments, now) {
  const rows = Array.isArray(appointments) ? appointments : [];
  const ts = Number(now) || Date.now();
  const fields = buildNoShowFields(ts);

  for (const appt of rows) {
    if (!shouldMarkNoShow(appt, ts)) continue;
    const id = appt._id || appt.id;
    if (!id) continue;

    try {
      await db.collection('appointments').doc(id).update({ data: fields });
    } catch (error) {
      console.warn('[settleNoShow] update appointment failed', id, error);
      continue;
    }

    appt.status = fields.status;
    appt.noShowAt = fields.noShowAt;
    appt.cancelReason = fields.cancelReason;
    appt.updatedAt = fields.updatedAt;

    try {
      const occRes = await db
        .collection('seat_occupancies')
        .where({ appointmentId: id })
        .limit(100)
        .get();
      for (const row of occRes.data || []) {
        if (row.type && row.type !== 'reserved') continue;
        try {
          await db.collection('seat_occupancies').doc(row._id).remove();
        } catch (removeErr) {
          console.warn('[settleNoShow] remove occupancy failed', row._id, removeErr);
        }
      }
    } catch (occErr) {
      console.warn('[settleNoShow] list occupancy failed', id, occErr);
    }
  }

  return rows;
}

module.exports = {
  settleNoShowAppointments,
};
