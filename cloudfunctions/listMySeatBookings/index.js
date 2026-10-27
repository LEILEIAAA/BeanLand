const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
    }
    let res;
    try {
      res = await db.collection('seat_bookings')
        .where({ _openid: OPENID })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
    } catch (error) {
      return { ok: true, bookings: [] };
    }
    return { ok: true, bookings: res.data || [] };
  } catch (error) {
    console.error('[listMySeatBookings]', error);
    return { ok: false, code: 'INTERNAL', message: (error && error.message) || 'list failed' };
  }
};
