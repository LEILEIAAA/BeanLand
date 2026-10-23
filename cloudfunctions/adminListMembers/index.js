const cloud = require('wx-server-sdk');
const { escapeRegExp, buildPhoneSearchPattern } = require('./memberSearch');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [] };
  }

  const isAdmin = await assertAdmin(OPENID).catch(() => false);
  if (!isAdmin) {
    return { ok: false, code: 'FORBIDDEN', message: 'admin only', list: [] };
  }

  const memberId = String((event && event.memberId) || '').trim();
  const keyword = String((event && event.keyword) || '').trim();
  const limit = Math.min(Math.max(Number((event && event.limit) || 50), 1), 100);

  try {
    if (memberId) {
      try {
        const doc = await db.collection('members').doc(memberId).get();
        const row = doc && doc.data ? doc.data : null;
        return { ok: true, list: row ? [{ _id: memberId, ...row }] : [] };
      } catch (error) {
        return { ok: true, list: [] };
      }
    }

    let found;
    if (!keyword) {
      try {
        found = await db
          .collection('members')
          .orderBy('updatedAt', 'desc')
          .limit(limit)
          .get();
      } catch (orderError) {
        console.warn('[adminListMembers] orderBy fallback', orderError);
        found = await db.collection('members').limit(limit).get();
      }
    } else {
      const safe = escapeRegExp(keyword);
      if (/^\d+$/.test(keyword)) {
        found = await db
          .collection('members')
          .where({
            phone: db.RegExp({
              regexp: buildPhoneSearchPattern(keyword),
              options: 'i',
            }),
          })
          .limit(limit)
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
          .limit(limit)
          .get();
      }
    }

    const list = (found.data || []).slice().sort((a, b) => {
      return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
    });

    return { ok: true, list };
  } catch (error) {
    console.error('[adminListMembers]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: (error && error.message) || 'query failed',
      list: [],
    };
  }
};
