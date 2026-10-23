const cloud = require('wx-server-sdk');
const { normalizeActivityPageConfig } = require('./activityPageConfig');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    // exists
  }
}

async function saveConfig(event, now) {
  const activitiesPage = normalizeActivityPageConfig(event && event.config);
  await ensureCollection('store');
  const existing = await db
    .collection('store')
    .doc('main')
    .get()
    .catch(() => null);
  if (existing && existing.data) {
    await db.collection('store').doc('main').update({
      data: { activitiesPage, updatedAt: now },
    });
  } else {
    await db.collection('store').add({
      data: { _id: 'main', activitiesPage, updatedAt: now },
    });
  }
  return { ok: true, activitiesPage };
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
    }
    const isAdmin = await assertAdmin(OPENID).catch(() => false);
    if (!isAdmin) {
      return { ok: false, code: 'FORBIDDEN', message: 'admin only' };
    }

    const action = (event && event.action) || 'save';
    const now = Date.now();
    if (action === 'save') return saveConfig(event, now);
    return { ok: false, code: 'INVALID_ACTION', message: '未知操作' };
  } catch (error) {
    console.error('[adminSaveActivityPageConfig]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && (error.errMsg || error.message)) || 'save failed',
    };
  }
};
