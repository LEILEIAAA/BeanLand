const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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

  await Promise.all([
    ensureCollection('seat_sessions'),
    ensureCollection('seat_occupancies'),
  ]);

  const seatId = event && event.seatId;
  const maintenance = !!(event && event.maintenance);
  if (!seatId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'seatId required' };
  }

  const now = Date.now();
  const docId = `maint_${seatId}`;

  if (maintenance) {
    let activeRows = [];
    try {
      const active = await db
        .collection('seat_sessions')
        .where({ status: 'active' })
        .limit(100)
        .get();
      activeRows = active.data || [];
    } catch (error) {
      activeRows = [];
    }
    for (const session of activeRows) {
      if ((session.seatIds || []).includes(seatId)) {
        return {
          ok: false,
          code: 'SEAT_IN_USE',
          message: 'end session before maintenance',
        };
      }
    }
    await db.collection('seat_occupancies').doc(docId).set({
      data: {
        seatId,
        type: 'maintenance',
        updatedAt: now,
      },
    });
    return { ok: true, seatId, maintenance: true };
  }

  await db
    .collection('seat_occupancies')
    .doc(docId)
    .remove()
    .catch(() => null);
  return { ok: true, seatId, maintenance: false };
  } catch (error) {
    console.error('[adminSetSeatMaintenance]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && error.message) || 'maintenance failed',
    };
  }
};
