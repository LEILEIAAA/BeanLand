const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const FETCH_CAP = 100;

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

function isCollectionMissing(error) {
  const msg = String((error && (error.errMsg || error.message)) || '');
  return /DATABASE_COLLECTION_NOT_EXIST|COLLECTION_NOT_EXIST|not exist|不存在/i.test(msg);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [] };
    }
    const isAdmin = await assertAdmin(OPENID).catch(() => false);
    if (!isAdmin) {
      return { ok: false, code: 'FORBIDDEN', message: 'admin only', list: [] };
    }

    const limit = Math.min(Math.max(Number(event && event.limit) || 50, 1), FETCH_CAP);
    const where = { status: 'ended' };
    if (event && event.memberId) {
      where.memberId = event.memberId;
    }

    try {
      const result = await db
        .collection('seat_sessions')
        .where(where)
        .orderBy('endedAt', 'desc')
        .limit(limit)
        .get();
      return { ok: true, list: result.data || [] };
    } catch (error) {
      if (isCollectionMissing(error)) {
        return { ok: true, list: [] };
      }
      throw error;
    }
  } catch (error) {
    console.error('[adminListSeatSessions]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: (error && (error.errMsg || error.message)) || 'query failed',
      list: [],
    };
  }
};
