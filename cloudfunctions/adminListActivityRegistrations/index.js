const cloud = require('wx-server-sdk');
const { STATUS, STATUS_LABEL, countPaidSince } = require('./activityRegistration');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

function chinaDayStartMs(now = Date.now()) {
  const china = new Date(now + 8 * 60 * 60 * 1000);
  const y = china.getUTCFullYear();
  const m = china.getUTCMonth();
  const d = china.getUTCDate();
  return Date.UTC(y, m, d) - 8 * 60 * 60 * 1000;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [], todayPaidCount: 0 };
  }

  const isAdmin = await assertAdmin(OPENID).catch(() => false);
  if (!isAdmin) {
    return { ok: false, code: 'FORBIDDEN', message: 'admin only', list: [], todayPaidCount: 0 };
  }

  const activityId = (event && event.activityId) || '';
  const status = (event && event.status) || '';

  try {
    let query = db.collection('activity_registrations');
    const where = {};
    if (activityId) where.activityId = activityId;
    if (status) where.status = status;
    if (Object.keys(where).length) {
      query = query.where(where);
    }

    const result = await query.limit(100).get();
    const list = (result.data || [])
      .slice()
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .map((row) => ({
        ...row,
        statusLabel: STATUS_LABEL[row.status] || row.status,
      }));

    const dayStart = chinaDayStartMs();
    const todayPaidCount = countPaidSince(
      (result.data || []).filter((row) => !status || row.status === STATUS.PAID),
      dayStart,
    );

    // If filtered by status, recount from a dedicated paid query for today metric
    let todayCount = todayPaidCount;
    if (status && status !== STATUS.PAID) {
      const paidToday = await db
        .collection('activity_registrations')
        .where({ status: STATUS.PAID })
        .limit(100)
        .get();
      todayCount = countPaidSince(paidToday.data || [], dayStart);
    }

    return { ok: true, list, todayPaidCount: todayCount };
  } catch (error) {
    console.error('[adminListActivityRegistrations]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: (error && error.message) || 'query failed',
      list: [],
      todayPaidCount: 0,
    };
  }
};
