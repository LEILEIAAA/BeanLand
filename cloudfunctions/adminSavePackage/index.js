const cloud = require('wx-server-sdk');
const {
  normalizePackageInput,
  validatePackage,
  buildPackageDoc,
} = require('./packageForm');

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

async function handleCreate(event, now) {
  const draft = normalizePackageInput(event && event.doc);
  const valid = validatePackage(draft);
  if (!valid.ok) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: valid.message };
  }
  const doc = buildPackageDoc(draft, { now, isCreate: true });
  await ensureCollection('packages');
  const added = await db.collection('packages').add({ data: doc });
  return { ok: true, docId: added._id, id: doc.id };
}

async function handleUpdate(event, now) {
  const docId = String((event && event.docId) || '').trim();
  if (!docId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'docId required' };
  }
  const draft = normalizePackageInput(event && event.doc);
  const valid = validatePackage(draft);
  if (!valid.ok) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: valid.message };
  }
  const doc = buildPackageDoc(draft, { now });
  await db.collection('packages').doc(docId).update({ data: doc });
  return { ok: true, docId, id: doc.id };
}

async function handleDelete(event) {
  const docId = String((event && event.docId) || '').trim();
  if (!docId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'docId required' };
  }
  await db.collection('packages').doc(docId).remove();
  return { ok: true, docId };
}

async function handleSetShelf(event, now) {
  const docId = String((event && event.docId) || '').trim();
  if (!docId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'docId required' };
  }
  const onShelf = event && event.onShelf === true;
  await db.collection('packages').doc(docId).update({
    data: { onShelf, updatedAt: now },
  });
  return { ok: true, docId, onShelf };
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

    const action = event && event.action;
    const now = Date.now();
    if (action === 'create') return handleCreate(event, now);
    if (action === 'update') return handleUpdate(event, now);
    if (action === 'delete') return handleDelete(event);
    if (action === 'setShelf') return handleSetShelf(event, now);
    return { ok: false, code: 'INVALID_ACTION', message: '未知操作' };
  } catch (error) {
    console.error('[adminSavePackage]', error);
    return {
      ok: false,
      code: 'INTERNAL',
      message: (error && (error.errMsg || error.message)) || 'save failed',
    };
  }
};
