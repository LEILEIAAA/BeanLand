const cloud = require('wx-server-sdk');
const {
  calcSessionTime,
  buildReservationsBySeatId,
} = require('./seatSession');
const { settleNoShowAppointments } = require('./settleNoShow');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function chinaToday() {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = china.getUTCFullYear();
  const m = String(china.getUTCMonth() + 1).padStart(2, '0');
  const d = String(china.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    // ignore
  }
}

async function safeGet(query) {
  try {
    const result = await query;
    return result.data || [];
  } catch (error) {
    console.warn('[adminListSeatBoard] query failed', error);
    return [];
  }
}

async function loadTodayAppointments(today) {
  const rows = [];
  const queries = [
    db.collection('appointments').where({ appointmentDate: today }).limit(100).get(),
    db.collection('appointments').where({ date: today }).limit(100).get(),
  ];
  for (const q of queries) {
    try {
      const result = await q;
      for (const row of result.data || []) {
        rows.push(row);
      }
    } catch (error) {
      // collection missing or field absent
    }
  }
  return rows;
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
    }
    const isAdmin = await assertAdmin(OPENID).catch(() => false);
    if (!isAdmin) {
      return { ok: false, code: 'FORBIDDEN', message: 'admin only' };
    }

    await Promise.all([
      ensureCollection('seat_sessions'),
      ensureCollection('seat_occupancies'),
    ]);

    const now = Date.now();
    const today = chinaToday();
    const [sessionRows, maintRows, reservedOcc, arrivedOcc, appointments] = await Promise.all([
      safeGet(
        db.collection('seat_sessions').where({ status: 'active' }).limit(100).get(),
      ),
      safeGet(
        db
          .collection('seat_occupancies')
          .where({ type: 'maintenance' })
          .limit(200)
          .get(),
      ),
      safeGet(
        db
          .collection('seat_occupancies')
          .where({ type: 'reserved', date: today })
          .limit(200)
          .get(),
      ),
      safeGet(
        db
          .collection('seat_occupancies')
          .where({ type: 'arrived', date: today })
          .limit(200)
          .get(),
      ),
      loadTodayAppointments(today),
    ]);

    await settleNoShowAppointments(db, appointments, now);

    const releasedIds = new Set(
      (appointments || [])
        .filter(
          (row) =>
            row &&
            /^(no_show|cancelled|rejected|completed)$/.test(String(row.status || '')),
        )
        .map((row) => row._id || row.id)
        .filter(Boolean),
    );
    const activeReserved = (reservedOcc || []).filter(
      (row) => !row.appointmentId || !releasedIds.has(row.appointmentId),
    );
    const activeArrived = (arrivedOcc || []).filter(
      (row) => !row.appointmentId || !releasedIds.has(row.appointmentId),
    );

    const reservationsBySeatId = buildReservationsBySeatId({
      appointments,
      occupancies: [...activeReserved, ...activeArrived],
      today,
    });

    const sessions = sessionRows
      .filter((row) => row.status === 'active')
      .map((row) => {
        const time = calcSessionTime({
          startedAt: row.startedAt,
          expectedEndAt: row.expectedEndAt,
          durationMinutes: row.durationMinutes,
          now,
        });
        return {
          ...row,
          remainingMinutes: time.remainingMinutes,
          overtimeMinutes: time.overtimeMinutes,
          elapsedMinutes: time.elapsedMinutes,
          phase: time.phase,
        };
      });

    const maintenanceSeatIds = maintRows.map((row) => row.seatId).filter(Boolean);

    const inUse = {};
    for (const session of sessions) {
      for (const seatId of session.seatIds || []) {
        inUse[seatId] = {
          remainingMinutes: session.remainingMinutes,
          overtimeMinutes: session.overtimeMinutes,
          elapsedMinutes: session.elapsedMinutes,
          phase: session.phase,
          sessionId: session._id,
          memberNickname: session.memberNickname || '',
        };
      }
    }

    return {
      ok: true,
      now,
      today,
      sessions,
      maintenanceSeatIds,
      inUse,
      reservationsBySeatId,
    };
  } catch (error) {
    console.error('[adminListSeatBoard]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && error.message) || 'list board failed',
    };
  }
};
