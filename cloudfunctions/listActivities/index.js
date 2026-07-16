const cloud = require('wx-server-sdk');
const { mapActivityList } = require('./activityList');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  try {
    const result = await db.collection('activities').limit(100).get();
    const list = mapActivityList(result.data || []);
    return { ok: true, list };
  } catch (error) {
    console.error('[listActivities]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: (error && (error.errMsg || error.message)) || 'query failed',
      list: [],
    };
  }
};
