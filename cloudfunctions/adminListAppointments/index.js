const cloud = require('wx-server-sdk');
const { settleNoShowAppointments } = require('./settleNoShow');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
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

    const filter = event || {};
    const where = {};
    if (filter.appointmentDate) where.appointmentDate = filter.appointmentDate;
    if (filter.status) where.status = filter.status;

    let rows = [];
    try {
      let query = db.collection('appointments');
      if (Object.keys(where).length) {
        query = query.where(where);
      }
      const result = await query.orderBy('createdAt', 'desc').limit(100).get();
      rows = result.data || [];
    } catch (error) {
      try {
        let query = db.collection('appointments');
        if (Object.keys(where).length) {
          query = query.where(where);
        }
        const result = await query.limit(100).get();
        rows = (result.data || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      } catch (inner) {
        const msg = String((inner && inner.message) || inner || '');
        if (/DATABASE_COLLECTION_NOT_EXIST|not exist|不存在/i.test(msg)) {
          return { ok: true, list: [] };
        }
        throw inner;
      }
    }

    await settleNoShowAppointments(db, rows, Date.now());
    return { ok: true, list: rows };
  } catch (error) {
    console.error('[adminListAppointments]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && error.message) || 'list failed',
      list: [],
    };
  }
};
