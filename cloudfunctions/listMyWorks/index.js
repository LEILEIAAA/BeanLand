const cloud = require('wx-server-sdk');
const {
  clampLimit,
  takeNewestWorks,
  isCollectionMissingError,
} = require('./worksList');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const FETCH_CAP = 100;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [], total: 0 };
  }

  const limit = clampLimit(event && event.limit);

  try {
    const countRes = await db.collection('works').where({ _openid: OPENID }).count();
    const total = (countRes && countRes.total) || 0;
    const result = await db
      .collection('works')
      .where({ _openid: OPENID })
      .limit(FETCH_CAP)
      .get();
    const list = takeNewestWorks(result.data || [], limit);
    return { ok: true, list, total };
  } catch (error) {
    console.error('[listMyWorks]', error);
    if (isCollectionMissingError(error)) {
      return {
        ok: false,
        code: 'NO_COLLECTION',
        message: 'works collection missing',
        list: [],
        total: 0,
      };
    }
    const message = String((error && (error.errMsg || error.message)) || 'query failed');
    return { ok: false, code: 'QUERY_FAILED', message, list: [], total: 0 };
  }
};
