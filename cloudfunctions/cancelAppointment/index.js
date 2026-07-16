const cloud = require('wx-server-sdk');
const {
  STATUS,
  assertCanTransition,
} = require('./appointmentRegistration');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
    }

    const appointmentId = event && event.appointmentId;
    if (!appointmentId) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'appointmentId required' };
    }

    const doc = await db.collection('appointments').doc(appointmentId).get();
    const appt = doc && doc.data;
    if (!appt) {
      return { ok: false, code: 'NOT_FOUND', message: '预约不存在' };
    }
    if (appt._openid && appt._openid !== OPENID) {
      return { ok: false, code: 'FORBIDDEN', message: '只能取消自己的预约' };
    }

    const gate = assertCanTransition(appt.status, 'cancel');
    if (!gate.ok) {
      return { ok: false, code: 'INVALID_STATUS', message: gate.reason };
    }

    const now = Date.now();
    await db.collection('appointments').doc(appointmentId).update({
      data: {
        status: STATUS.cancelled,
        cancelledAt: now,
        updatedAt: now,
      },
    });

    return { ok: true, appointmentId, status: STATUS.cancelled };
  } catch (error) {
    console.error('[cancelAppointment]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && error.message) || 'cancel failed',
    };
  }
};
