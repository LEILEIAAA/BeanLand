const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  try {
    const doc = await db.collection('store').doc('main').get();
    const data = (doc && doc.data) || null;
    if (data) {
      return { ok: true, store: data };
    }
  } catch (error) {
    const msg = String((error && (error.errMsg || error.message)) || error || '');
    if (!/DATABASE_COLLECTION_NOT_EXIST|not exist|不存在|DOCUMENT_NOT_FOUND/i.test(msg)) {
      console.error('[getStore] doc', error);
      return { ok: false, code: 'QUERY_FAILED', message: msg || 'query failed', store: null };
    }
  }

  try {
    const result = await db.collection('store').limit(1).get();
    const rows = (result && result.data) || [];
    if (rows.length) {
      return { ok: true, store: rows[0] };
    }
    return { ok: true, store: null };
  } catch (error) {
    const msg = String((error && (error.errMsg || error.message)) || error || '');
    console.error('[getStore] list', error);
    return { ok: false, code: 'QUERY_FAILED', message: msg || 'query failed', store: null };
  }
};
