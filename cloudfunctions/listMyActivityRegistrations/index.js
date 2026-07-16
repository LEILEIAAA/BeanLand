const cloud = require('wx-server-sdk');
const { STATUS_LABEL, isUserVisibleRegistration } = require('./activityRegistration');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function loadStartAtMap(activityIds) {
  const ids = [...new Set((activityIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const map = {};
  if (!ids.length) return map;

  const col = db.collection('activities');
  await Promise.all(
    ids.map(async (id) => {
      try {
        const byId = await col.doc(id).get();
        if (byId && byId.data) {
          map[id] = Number(byId.data.startAt || 0);
          return;
        }
      } catch (error) {
        // try where
      }
      try {
        const found = await col.where({ id }).limit(1).get();
        if (found.data && found.data.length) {
          map[id] = Number(found.data[0].startAt || 0);
        }
      } catch (error) {
        // ignore
      }
    }),
  );
  return map;
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [] };
  }

  try {
    const result = await db
      .collection('activity_registrations')
      .where({ _openid: OPENID })
      .limit(50)
      .get();
    const rows = (result.data || []).filter(isUserVisibleRegistration);
    const startAtMap = await loadStartAtMap(rows.map((row) => row.activityId));
    const list = rows
      .slice()
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .map((row) => {
        const activityId = String(row.activityId || '');
        return {
          ...row,
          startAt: startAtMap[activityId] || 0,
          statusLabel: STATUS_LABEL[row.status] || row.status,
        };
      });
    return { ok: true, list };
  } catch (error) {
    console.error('[listMyActivityRegistrations]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: (error && error.message) || 'query failed',
      list: [],
    };
  }
};
