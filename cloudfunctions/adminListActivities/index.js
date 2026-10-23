const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

function normalizeRow(row) {
  const id = String((row && (row.id || row._id)) || '').trim();
  return {
    ...row,
    id,
    price: Number((row && row.price) || 0),
    capacity: Number((row && row.capacity) || 0),
    registeredCount: Number((row && row.registeredCount) || 0),
    onShelf: !(row && row.onShelf === false),
    sortOrder: Number((row && row.sortOrder) || 0),
  };
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [] };
    }
    const isAdmin = await assertAdmin(OPENID).catch(() => false);
    if (!isAdmin) {
      return { ok: false, code: 'FORBIDDEN', message: 'admin only', list: [] };
    }

    let rows = [];
    try {
      const result = await db.collection('activities').limit(200).get();
      rows = result.data || [];
    } catch (error) {
      const msg = String((error && error.message) || error || '');
      if (/DATABASE_COLLECTION_NOT_EXIST|not exist|不存在/i.test(msg)) {
        return { ok: true, list: [] };
      }
      throw error;
    }

    const list = rows
      .map(normalizeRow)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    return { ok: true, list };
  } catch (error) {
    console.error('[adminListActivities]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: (error && (error.errMsg || error.message)) || 'query failed',
      list: [],
    };
  }
};
