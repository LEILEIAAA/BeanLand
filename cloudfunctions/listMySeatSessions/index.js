const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const FETCH_CAP = 100;

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

    const limit = Math.min(Math.max(Number(event && event.limit) || 50, 1), FETCH_CAP);

    try {
      const result = await db
        .collection('seat_sessions')
        .where({ memberOpenid: OPENID })
        .limit(FETCH_CAP)
        .get();
      const list = (result.data || [])
        .sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0))
        .slice(0, limit);
      return { ok: true, list };
    } catch (error) {
      if (isCollectionMissing(error)) {
        return { ok: true, list: [] };
      }
      throw error;
    }
  } catch (error) {
    console.error('[listMySeatSessions]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: (error && (error.errMsg || error.message)) || 'query failed',
      list: [],
    };
  }
};
