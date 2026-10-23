const cloud = require('wx-server-sdk');
const {
  STATUS,
  STATUS_LABEL,
  countPaidSince,
  resolveAdminListStatusFilter,
  isActivityRegistrationEffective,
} = require('./activityRegistration');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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

async function loadActivityStartAtMap() {
  const map = Object.create(null);
  try {
    const result = await db.collection('activities').limit(200).get();
    for (const row of result.data || []) {
      const startAt = Number((row && row.startAt) || 0);
      const docId = String((row && row._id) || '').trim();
      const legacyId = String((row && row.id) || '').trim();
      if (docId) map[docId] = startAt;
      if (legacyId) map[legacyId] = startAt;
    }
  } catch (error) {
    console.warn('[adminListActivityRegistrations] load activities', error);
  }
  return map;
}

function decorateRegistration(row, startAtMap, now) {
  const activityId = String((row && row.activityId) || '').trim();
  const activityStartAt = Number((startAtMap && startAtMap[activityId]) || 0);
  const isEffective = isActivityRegistrationEffective(row, activityStartAt, now);
  return {
    ...row,
    activityStartAt,
    isEffective,
    statusLabel: isEffective ? '已生效' : STATUS_LABEL[row.status] || row.status,
  };
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
  const statusFilter = resolveAdminListStatusFilter(status);
  const now = Date.now();

  try {
    let query = db.collection('activity_registrations');
    const where = {};
    if (activityId) where.activityId = activityId;
    if (statusFilter) {
      if (statusFilter.op === 'in') {
        where.status = _.in(statusFilter.values);
      } else {
        where.status = statusFilter.value;
      }
    }
    if (Object.keys(where).length) {
      query = query.where(where);
    }

    const result = await query.limit(100).get();
    const startAtMap = await loadActivityStartAtMap();
    let list = (result.data || [])
      .slice()
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .map((row) => decorateRegistration(row, startAtMap, now));

    if (statusFilter && statusFilter.refine === 'effective') {
      list = list.filter((row) => row.isEffective);
    }

    const dayStart = chinaDayStartMs(now);
    let todayCount = countPaidSince(
      (result.data || []).filter((row) => !status || row.status === STATUS.PAID),
      dayStart,
    );

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
