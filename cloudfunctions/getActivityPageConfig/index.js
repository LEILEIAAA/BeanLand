const cloud = require('wx-server-sdk');
const {
  normalizeActivityPageConfig,
  buildScheduleRows,
} = require('./activityPageConfig');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function loadActivitiesByIds(ids) {
  const unique = Array.from(new Set((ids || []).filter(Boolean)));
  if (!unique.length) return [];
  // 按 id/_id 查，含未上架，供日程展示散场日等占位活动
  const result = await db
    .collection('activities')
    .where(_.or([{ id: _.in(unique) }, { _id: _.in(unique) }]))
    .limit(100)
    .get();
  return result.data || [];
}

exports.main = async () => {
  const empty = normalizeActivityPageConfig(null);
  try {
    const doc = await db.collection('store').doc('main').get();
    const data = (doc && doc.data) || {};
    const activitiesPage = normalizeActivityPageConfig(data.activitiesPage);
    const activityIds = activitiesPage.schedule.items.map((item) => item.activityId);
    const activities = await loadActivitiesByIds(activityIds).catch(() => []);
    const scheduleRows = buildScheduleRows(activitiesPage.schedule.items, activities);
    return { ok: true, activitiesPage, scheduleRows };
  } catch (error) {
    const msg = String((error && (error.errMsg || error.message)) || error || '');
    if (/DATABASE_COLLECTION_NOT_EXIST|not exist|不存在|document.*not.*exist|DOCUMENT_NOT_FOUND/i.test(msg)) {
      return { ok: true, activitiesPage: empty, scheduleRows: [] };
    }
    console.error('[getActivityPageConfig]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: msg || 'query failed',
      activitiesPage: empty,
      scheduleRows: [],
    };
  }
};
