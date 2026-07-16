const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const isAdmin = await assertAdmin(OPENID).catch(() => false);
  if (!isAdmin) {
    return { ok: false, code: 'FORBIDDEN', message: 'admin only' };
  }

  const keyword = String(
    (event && (event.keyword || event.phone)) || '',
  ).trim();
  if (!keyword) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'keyword required' };
  }

  const safe = escapeRegExp(keyword);
  let found;

  if (/^\d+$/.test(keyword)) {
    found = await db
      .collection('members')
      .where({
        phone: db.RegExp({ regexp: `^${safe}`, options: 'i' }),
      })
      .limit(20)
      .get();
  } else {
    found = await db
      .collection('members')
      .where(
        _.or([
          { nickname: db.RegExp({ regexp: safe, options: 'i' }) },
          { nickName: db.RegExp({ regexp: safe, options: 'i' }) },
        ]),
      )
      .limit(20)
      .get();
  }

  return { ok: true, list: found.data || [] };
};
