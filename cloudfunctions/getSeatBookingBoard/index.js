const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

exports.main = async (event) => {
  try {
    const date = String((event && event.date) || '');
    if (!DATE_RE.test(date)) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: '日期无效' };
    }

    let res;
    try {
      res = await db.collection('seat_bookings')
        .where({ appointmentDate: date, status: 'pending' })
        .limit(1000)
        .get();
    } catch (error) {
      // 集合尚未创建：空板
      return { ok: true, seats: {}, maintenanceSeats: [] };
    }

    const seats = {};
    for (const row of res.data || []) {
      const rowSeats = Array.isArray(row.seatIds) ? row.seatIds : [];
      for (const seatId of rowSeats) {
        if (!seatId) continue;
        if (!seats[seatId]) seats[seatId] = { bookedSlots: [] };
        const set = new Set(seats[seatId].bookedSlots);
        for (const s of row.timeSlots || []) set.add(s);
        seats[seatId].bookedSlots = [...set];
      }
    }
    return { ok: true, seats, maintenanceSeats: [] };
  } catch (error) {
    console.error('[getSeatBookingBoard]', error);
    return { ok: false, code: 'INTERNAL', message: (error && error.message) || 'board failed' };
  }
};
