const cloud = require('wx-server-sdk');
const { settleNoShowAppointments } = require('./settleNoShow');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [] };
    }

    let rows = [];
    try {
      const result = await db
        .collection('appointments')
        .where({ _openid: OPENID })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      rows = result.data || [];
    } catch (error) {
      const msg = String((error && error.message) || error || '');
      if (/DATABASE_COLLECTION_NOT_EXIST|not exist|不存在/i.test(msg)) {
        return { ok: true, list: [] };
      }
      try {
        const result = await db.collection('appointments').where({ _openid: OPENID }).limit(50).get();
        rows = (result.data || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      } catch (inner) {
        console.warn('[listMyAppointments]', inner);
        return { ok: true, list: [] };
      }
    }

    await settleNoShowAppointments(db, rows, Date.now());
    return { ok: true, list: rows };
  } catch (error) {
    console.error('[listMyAppointments]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && error.message) || 'list failed',
      list: [],
    };
  }
};
