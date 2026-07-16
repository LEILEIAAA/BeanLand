const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid', openid: '' };
  }

  const found = await db.collection('members').where({ _openid: OPENID }).limit(1).get();
  if (!found.data || !found.data.length) {
    return { ok: false, code: 'NOT_FOUND', message: 'member not found', openid: OPENID };
  }

  return { ok: true, member: found.data[0], openid: OPENID };
};
