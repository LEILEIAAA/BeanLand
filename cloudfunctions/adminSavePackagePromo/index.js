const cloud = require('wx-server-sdk');
const { normalizePromoInput, validatePromo, buildPromoDoc } = require('./promoForm');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEFAULT_PROMO = {
  active: true,
  discountRate: 8,
  label: '开业七天',
  tip: '全场8折',
};

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

async function loadPackagePromo() {
  try {
    const doc = await db.collection('store').doc('main').get();
    if (doc && doc.data && doc.data.packagePromo) {
      return doc.data.packagePromo;
    }
  } catch (error) {
    // missing
  }
  return { ...DEFAULT_PROMO };
}

async function handleGet() {
  const packagePromo = await loadPackagePromo();
  return { ok: true, packagePromo };
}

async function handleSave(event) {
  const draft = normalizePromoInput(event && event.promo);
  const valid = validatePromo(draft);
  if (!valid.ok) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: valid.message };
  }

  const packagePromo = buildPromoDoc(draft);
  await ensureCollection('store');
  const docRef = db.collection('store').doc('main');
  try {
    await docRef.update({ data: { packagePromo, updatedAt: Date.now() } });
  } catch (error) {
    await docRef.set({ data: { _id: 'main', packagePromo, updatedAt: Date.now() } });
  }

  return { ok: true, packagePromo };
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
    if (action === 'get') return handleGet();
    if (action === 'save') return handleSave(event);
    return { ok: false, code: 'INVALID_ACTION', message: '未知操作' };
  } catch (error) {
    console.error('[adminSavePackagePromo]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && (error.errMsg || error.message)) || 'save failed',
    };
  }
};
