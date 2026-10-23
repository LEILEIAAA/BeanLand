const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function parseTimeSlotDocs(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (rows.length === 1 && Array.isArray(rows[0].slots)) {
    return rows[0].slots.filter(Boolean);
  }
  return rows.map((row) => row.label || row.slot || row).filter(Boolean);
}

exports.main = async () => {
  try {
    const result = await db.collection('time_slots').limit(100).get();
    const rows = (result && result.data) || [];
    const timeSlots = parseTimeSlotDocs(rows);
    return { ok: true, timeSlots };
  } catch (error) {
    const msg = String((error && (error.errMsg || error.message)) || error || '');
    if (/DATABASE_COLLECTION_NOT_EXIST|not exist|不存在/i.test(msg)) {
      return { ok: true, timeSlots: [] };
    }
    console.error('[getTimeSlots]', error);
    return { ok: false, code: 'QUERY_FAILED', message: msg || 'query failed', timeSlots: [] };
  }
};
