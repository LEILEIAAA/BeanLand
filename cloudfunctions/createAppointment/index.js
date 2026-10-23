const cloud = require('wx-server-sdk');
const {
  assertCanRegister,
  buildRegistrationDoc,
} = require('./appointmentRegistration');
const { assertMemberRegistered } = require('./memberRegistration');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function chinaToday() {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = china.getUTCFullYear();
  const m = String(china.getUTCMonth() + 1).padStart(2, '0');
  const d = String(china.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    // exists
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

    const member = await loadMember(OPENID);
    const registered = assertMemberRegistered(member);
    if (!registered.ok) {
      return registered;
    }

    const payload = event || {};
    const timeSlots = Array.isArray(payload.timeSlots) && payload.timeSlots.length
      ? payload.timeSlots
      : payload.timeSlot
        ? [payload.timeSlot]
        : [];

    const check = assertCanRegister({
      appointmentDate: payload.appointmentDate,
      today: chinaToday(),
      timeSlots,
      peopleCount: payload.peopleCount,
      name: payload.name,
      phone: payload.phone,
      source: payload.source,
    });
    if (!check.ok) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: check.reason };
    }

    await ensureCollection('appointments');
    const now = Date.now();
    const doc = buildRegistrationDoc({
      openid: OPENID,
      memberId: member._id || member.id || '',
      appointmentDate: payload.appointmentDate,
      timeSlots,
      peopleCount: payload.peopleCount,
      name: payload.name,
      phone: payload.phone,
      source: payload.source,
      now,
    });

    const added = await db.collection('appointments').add({ data: doc });
    return {
      ok: true,
      appointmentId: added._id,
      appointment: { _id: added._id, ...doc },
    };
  } catch (error) {
    console.error('[createAppointment]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && error.message) || 'createAppointment failed',
    };
  }
};
