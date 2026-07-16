const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [] };
  }

  const limit = Math.min(Number((event && event.limit) || 50), 100);
  const result = await db
    .collection('member_transactions')
    .where({ _openid: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return { ok: true, list: result.data || [] };
};
