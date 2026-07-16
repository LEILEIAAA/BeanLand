const cloud = require('wx-server-sdk');
const { buildEndSessionFields } = require('./seatSession');

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

    const sessionId = event && event.sessionId;
    if (!sessionId) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'sessionId required' };
    }

    let session;
    try {
      const doc = await db.collection('seat_sessions').doc(sessionId).get();
      session = { ...doc.data, _id: sessionId };
    } catch (error) {
      return { ok: false, code: 'NOT_FOUND', message: 'session not found' };
    }
    if (!session || session.status !== 'active') {
      return { ok: false, code: 'SESSION_INACTIVE', message: 'session not active' };
    }

    const now = Date.now();
    const endFields = buildEndSessionFields(session, now);
    const patch = {
      seatIds: [],
      ...endFields,
    };

    await db.collection('seat_sessions').doc(sessionId).update({ data: patch });

    const seatIds = session.seatIds || [];
    await Promise.all(
      seatIds.map((seatId) =>
        db
          .collection('seat_occupancies')
          .doc(`in_use_${seatId}`)
          .remove()
          .catch(() => null),
      ),
    );

    return {
      ok: true,
      session: { ...session, ...patch, _id: sessionId },
    };
  } catch (error) {
    console.error('[adminEndSeatSession]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && error.message) || 'end session failed',
    };
  }
};
