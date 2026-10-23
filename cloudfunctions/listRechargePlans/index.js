const cloud = require('wx-server-sdk');
const { mapRechargePlans } = require('./rechargePlans');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  try {
    let rows = [];
    try {
      const result = await db.collection('recharge_plans').limit(100).get();
      rows = result.data || [];
    } catch (error) {
      const msg = String((error && (error.errMsg || error.message)) || error || '');
      if (/DATABASE_COLLECTION_NOT_EXIST|not exist|不存在/i.test(msg)) {
        return { ok: true, list: [] };
      }
      throw error;
    }

    return { ok: true, list: mapRechargePlans(rows) };
  } catch (error) {
    console.error('[listRechargePlans]', error);
    return {
      ok: false,
      code: 'QUERY_FAILED',
      message: (error && (error.errMsg || error.message)) || 'query failed',
      list: [],
    };
  }
};
