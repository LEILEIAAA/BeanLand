const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
    }
    const orderNo = String((event && event.orderNo) || '');
    const bookingId = String((event && event.bookingId) || '');
    if (!orderNo && !bookingId) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: '缺少预约标识' };
    }

    let appt = null;
    if (bookingId) {
      const doc = await db.collection('seat_bookings').doc(bookingId).get().catch(() => null);
      appt = doc && doc.data;
    } else {
      const found = await db.collection('seat_bookings')
        .where({ _openid: OPENID, orderNo })
        .limit(1)
        .get();
      appt = found.data && found.data[0];
    }
    if (!appt) {
      return { ok: false, code: 'NOT_FOUND', message: '预约不存在' };
    }
    if (appt._openid && appt._openid !== OPENID) {
      return { ok: false, code: 'FORBIDDEN', message: '只能取消自己的预约' };
    }
    if (appt.status !== 'pending') {
      return { ok: false, code: 'INVALID_STATUS', message: '当前状态不可取消' };
    }

    const now = Date.now();
    await db.collection('seat_bookings').doc(appt._id).update({
      data: { status: 'cancelled', cancelledAt: now, updatedAt: now },
    });
    return { ok: true, status: 'cancelled' };
  } catch (error) {
    console.error('[cancelSeatBooking]', error);
    return { ok: false, code: 'INTERNAL', message: (error && error.message) || 'cancel failed' };
  }
};
