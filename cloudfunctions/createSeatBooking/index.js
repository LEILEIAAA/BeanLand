const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SLOT_RE = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad4(value) {
  return String(value).padStart(4, '0');
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    // already exists
  }
}

async function loadMember(openid) {
  const found = await db.collection('members').where({ _openid: openid }).limit(1).get();
  if (!found.data || !found.data.length) return null;
  return found.data[0];
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
    }

    const payload = event || {};
    const appointmentDate = String(payload.appointmentDate || '');
    const sessionType = String(payload.sessionType || '');
    const seatIds = Array.isArray(payload.seatIds)
      ? [...new Set(payload.seatIds.map((s) => String(s || '')).filter(Boolean))]
      : [];
    const slots = Array.isArray(payload.timeSlots)
      ? payload.timeSlots.filter((s) => SLOT_RE.test(s))
      : [];

    if (!DATE_RE.test(appointmentDate)) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: '日期无效' };
    }
    if (!seatIds.length) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: '请选择座位' };
    }
    if (sessionType !== 'all_day' && sessionType !== 'custom') {
      return { ok: false, code: 'INVALID_PAYLOAD', message: '场次无效' };
    }
    if (!slots.length) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: '请选择时段' };
    }

    const member = await loadMember(OPENID);
    if (!member) {
      return { ok: false, code: 'NO_MEMBER', message: '请先完成会员注册' };
    }
    if (!member.phone) {
      return { ok: false, code: 'NO_MEMBER', message: '请先完善手机号' };
    }

    await ensureCollection('seat_bookings');

    // 当日待到店预约 → 每个座位已占整点
    const existing = await db.collection('seat_bookings')
      .where({ appointmentDate, status: 'pending' })
      .limit(1000)
      .get();
    const takenBySeat = {};
    for (const row of existing.data || []) {
      const rowSeats = Array.isArray(row.seatIds) ? row.seatIds : [];
      for (const seatId of rowSeats) {
        if (!takenBySeat[seatId]) takenBySeat[seatId] = new Set();
        for (const s of row.timeSlots || []) takenBySeat[seatId].add(s);
      }
    }
    const conflict = [];
    for (const seatId of seatIds) {
      const taken = takenBySeat[seatId];
      if (taken && slots.some((s) => taken.has(s))) conflict.push(seatId);
    }
    if (conflict.length) {
      return { ok: false, code: 'SLOT_TAKEN', message: `座位 ${conflict.join('、')} 该时段已被预约` };
    }

    const countRes = await db.collection('seat_bookings').where({ appointmentDate }).count();
    const seq = (countRes.total || 0) + 1;
    const now = Date.now();
    const orderNo = `BK${appointmentDate.replace(/-/g, '')}${pad4(seq)}`;
    const code = `BEAN-${pad4(Math.floor(Math.random() * 9000) + 1000)}`;

    const doc = {
      _openid: OPENID,
      memberId: member._id || member.id || '',
      orderNo,
      code,
      appointmentDate,
      floorKey: String(payload.floorKey || ''),
      floorLabel: String(payload.floorLabel || ''),
      seatIds,
      sessionType,
      timeSlots: slots,
      span: String(payload.span || ''),
      status: 'pending',
      phone: member.phone,
      source: String(payload.source || '小程序'),
      createdAt: now,
      updatedAt: now,
    };
    const added = await db.collection('seat_bookings').add({ data: doc });
    return { ok: true, bookingId: added._id, orderNo, code, status: 'pending' };
  } catch (error) {
    console.error('[createSeatBooking]', error);
    return { ok: false, code: 'INTERNAL', message: (error && error.message) || 'createSeatBooking failed' };
  }
};
