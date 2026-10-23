const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  try {
    const doc = await db.collection('store').doc('main').get();
    const data = (doc && doc.data) || {};
    const heroPhotos = Array.isArray(data.heroPhotos) ? data.heroPhotos : [];
    return { ok: true, heroPhotos };
  } catch (error) {
    const msg = String((error && (error.errMsg || error.message)) || error || '');
    if (/DATABASE_COLLECTION_NOT_EXIST|not exist|不存在|document.*not.*exist|DOCUMENT_NOT_FOUND/i.test(msg)) {
      return { ok: true, heroPhotos: [] };
    }
    console.error('[getHomeBanners]', error);
    return { ok: false, code: 'QUERY_FAILED', message: msg || 'query failed', heroPhotos: [] };
  }
};
