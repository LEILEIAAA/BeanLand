const cloud = require('wx-server-sdk');
const {
  assertCanStartSeatBatch,
  buildStartSessionRecord,
  DURATION_OPTIONS,
} = require('./seatSession');
const { buildSeatsFromTables } = require('./seats');
const { resolveArriveOnStart } = require('./appointmentRegistration');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    // ignore
  }
}

async function safeQuery(loader, fallback = []) {
  try {
    const result = await loader();
    return result.data || fallback;
  } catch (error) {
    const msg = String((error && error.message) || error || '');
    if (/DATABASE_COLLECTION_NOT_EXIST|not exist|不存在/i.test(msg)) {
      return fallback;
    }
    throw error;
  }
}

const FALLBACK_TABLES = [
  { code: 'F1-A', area: 'F1一楼·左墙', capacity: 6, bookable: true },
  { code: 'F1-B', area: 'F1一楼·窗边', capacity: 2, bookable: true },
  { code: 'F1-C', area: 'F1一楼·长桌', capacity: 6, bookable: true },
  { code: 'F2-A', area: 'F2二楼·左墙', capacity: 6, bookable: true },
  { code: 'F2-B', area: 'F2二楼·右墙', capacity: 6, bookable: true },
  { code: 'F2-C', area: 'F2二楼·长桌', capacity: 6, bookable: true },
];

function fallbackSeatsById() {
  const seats = buildSeatsFromTables(FALLBACK_TABLES, { seatIdSeparator: '' });
  return Object.fromEntries(seats.map((s) => [s.id, s]));
}

function coversSeatIds(seatsById, seatIds) {
  return (seatIds || []).every((id) => seatsById[id]);
}

async function loadSeatsById(preferredSeatIds = []) {
  try {
    const result = await db.collection('seats').limit(200).get();
    const rows = result.data || [];
    if (rows.length) {
      const seatsById = Object.fromEntries(rows.map((s) => [s.id || s._id, s]));
      if (coversSeatIds(seatsById, preferredSeatIds)) {
        return seatsById;
      }
    }
  } catch (error) {
    console.warn('[adminStartSeatSession] seats read failed', error);
  }

  try {
    const tablesRes = await db.collection('tables').limit(50).get();
    const tables = tablesRes.data || [];
    if (tables.length) {
      const seats = buildSeatsFromTables(tables, { seatIdSeparator: '' });
      const seatsById = Object.fromEntries(seats.map((s) => [s.id, s]));
      if (coversSeatIds(seatsById, preferredSeatIds)) {
        return seatsById;
      }
    }
  } catch (error) {
    console.warn('[adminStartSeatSession] tables read failed', error);
  }

  return fallbackSeatsById();
}

function normalizeMemberIds(event) {
  if (Array.isArray(event && event.memberIds) && event.memberIds.length) {
    return event.memberIds;
  }
  if (event && event.memberId) {
    return [event.memberId];
  }
  return [];
}

async function removeAppointmentHoldOccupancies(appointmentId) {
  try {
    const found = await db
      .collection('seat_occupancies')
      .where({ appointmentId })
      .limit(200)
      .get();
    await Promise.all(
      (found.data || []).map((row) =>
        db.collection('seat_occupancies').doc(row._id).remove(),
      ),
    );
  } catch (error) {
    console.warn('[adminStartSeatSession] clear appointment holds', error);
  }
}

async function markAppointmentArrivedOnStart(appointmentId, now) {
  try {
    const doc = await db.collection('appointments').doc(appointmentId).get();
    const appt = doc && doc.data;
    if (!appt) {
      return { ok: false, code: 'APPOINTMENT_NOT_FOUND' };
    }
    const resolved = resolveArriveOnStart(appt.status, now);
    if (!resolved.ok) {
      return { ok: false, code: 'INVALID_STATUS', message: resolved.reason };
    }
    if (resolved.shouldUpdate) {
      await db.collection('appointments').doc(appointmentId).update({
        data: resolved.fields,
      });
    }
    // 开台后清除预约占位（reserved/arrived），由 in_use 接管
    await removeAppointmentHoldOccupancies(appointmentId);
    return {
      ok: true,
      appointmentId,
      status: resolved.shouldUpdate ? resolved.fields.status : appt.status,
      updated: !!resolved.shouldUpdate,
    };
  } catch (error) {
    console.error('[adminStartSeatSession] arrive sync', error);
    return {
      ok: false,
      code: 'ARRIVE_SYNC_FAILED',
      message: (error && error.message) || 'arrive sync failed',
    };
  }
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
    }
    const isAdmin = await assertAdmin(OPENID).catch(() => false);
    if (!isAdmin) {
      return { ok: false, code: 'FORBIDDEN', message: 'admin only' };
    }

    await Promise.all([
      ensureCollection('seat_sessions'),
      ensureCollection('seat_occupancies'),
    ]);

    const memberIds = normalizeMemberIds(event);
    const seatIds = (event && event.seatIds) || [];
    const durationMinutes = Number(event && event.durationMinutes);

    if (!DURATION_OPTIONS.includes(durationMinutes)) {
      return {
        ok: false,
        code: 'INVALID_DURATION',
        message: 'durationMinutes invalid',
      };
    }

    const seatsById = await loadSeatsById(seatIds);
    const activeSessions = await safeQuery(() =>
      db.collection('seat_sessions').where({ status: 'active' }).limit(100).get(),
    );
    const maint = await safeQuery(() =>
      db
        .collection('seat_occupancies')
        .where({ type: 'maintenance' })
        .limit(200)
        .get(),
    );

    const blockedIds = new Set();
    const busyMemberIds = new Set();
    const memberLabelsById = {};
    for (const row of maint) {
      if (row.seatId) blockedIds.add(row.seatId);
    }
    for (const session of activeSessions) {
      if (session.memberId) {
        busyMemberIds.add(session.memberId);
        const nick = session.memberNickname || '';
        const phone = session.memberPhone || '';
        const tail =
          phone.length >= 4 ? phone.slice(-4) : phone || '';
        memberLabelsById[session.memberId] = nick
          ? tail
            ? `${nick}（尾号 ${tail}）`
            : nick
          : tail
            ? `尾号 ${tail}`
            : '该会员';
      }
      for (const id of session.seatIds || []) blockedIds.add(id);
    }

    const check = assertCanStartSeatBatch({
      memberIds,
      seatIds,
      seatsById,
      blockedIds,
      busyMemberIds,
      memberLabelsById,
    });
    if (!check.ok) {
      return check;
    }

    const membersById = {};
    for (const memberId of memberIds) {
      try {
        const doc = await db.collection('members').doc(memberId).get();
        if (!doc.data) {
          return {
            ok: false,
            code: 'MEMBER_NOT_FOUND',
            message: '会员不存在或未注册',
          };
        }
        membersById[memberId] = doc.data;
      } catch (error) {
        return {
          ok: false,
          code: 'MEMBER_NOT_FOUND',
          message: '会员不存在或未注册',
        };
      }
    }

    // 「套餐核销并开台」链路：把本次核销套餐的消费额挂到对应会员的会话记录
    let packageInfo = null;
    const packageOrderId = event && event.packageOrderId;
    if (packageOrderId) {
      try {
        const orderDoc = await db
          .collection('package_orders')
          .doc(packageOrderId)
          .get();
        const order = orderDoc && orderDoc.data;
        if (order) {
          const amount =
            order.payAmountYuan != null
              ? Number(order.payAmountYuan)
              : Number(order.payAmountFen ? order.payAmountFen / 100 : 0);
          packageInfo = {
            packageOrderId,
            memberId: order.memberId || '',
            packageName:
              order.packageName ||
              (order.packageSnapshot && order.packageSnapshot.name) ||
              '',
            consumedAmount: Number(amount) || 0,
          };
        }
      } catch (error) {
        console.warn('[adminStartSeatSession] package order read failed', error);
      }
    }

    const now = Date.now();
    const prepared = [];
    for (const group of check.groups) {
      const member = membersById[group.memberId];
      const seatIdsForSession = group.seatIds || [];
      const primarySeat = seatsById[seatIdsForSession[0]];
      const attachPackage =
        packageInfo &&
        ((packageInfo.memberId && packageInfo.memberId === group.memberId) ||
          (!packageInfo.memberId && check.groups.length === 1));
      const record = buildStartSessionRecord({
        memberId: group.memberId,
        memberOpenid: member._openid || member.openid || '',
        memberPhone: member.phone || '',
        memberNickname: member.nickname || member.nickName || '',
        seatIds: seatIdsForSession,
        tableCode: primarySeat.tableCode,
        durationMinutes,
        packageOrderId: attachPackage ? packageInfo.packageOrderId : '',
        packageName: attachPackage ? packageInfo.packageName : '',
        consumedAmount: attachPackage ? packageInfo.consumedAmount : 0,
        now,
      });
      if (!record.memberOpenid) {
        const nick = record.memberNickname || '该会员';
        return {
          ok: false,
          code: 'MEMBER_NO_OPENID',
          message: `${nick} 未绑定登录账号，无法开台`,
        };
      }
      prepared.push(record);
    }

    const sessions = [];
    for (const record of prepared) {
      const addRes = await db.collection('seat_sessions').add({ data: record });
      const sessionId = addRes._id;
      for (const seatId of record.seatIds || []) {
        await db.collection('seat_occupancies').doc(`in_use_${seatId}`).set({
          data: {
            seatId,
            type: 'in_use',
            sessionId,
            expectedEndAt: record.expectedEndAt,
            updatedAt: now,
          },
        });
      }
      sessions.push({ ...record, _id: sessionId });
    }

    let appointmentSync = null;
    const appointmentId = event && event.appointmentId;
    if (appointmentId) {
      appointmentSync = await markAppointmentArrivedOnStart(
        appointmentId,
        now,
      );
    }

    return {
      ok: true,
      sessions,
      session: sessions[0] || null,
      appointmentSync,
    };
  } catch (error) {
    console.error('[adminStartSeatSession]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && error.message) || 'start session failed',
    };
  }
};
