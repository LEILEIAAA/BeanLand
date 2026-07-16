const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const workId = String((event && event.workId) || '').trim();
  if (!workId) {
    return { ok: false, code: 'INVALID_ID', message: 'missing workId' };
  }

  const col = db.collection('works');
  const got = await col.doc(workId).get();
  const row = got && got.data;
  if (!row || row._openid !== OPENID) {
    return { ok: false, code: 'NOT_FOUND', message: 'work not found' };
  }

  await col.doc(workId).remove();
  if (row.imageFileID) {
    try {
      await cloud.deleteFile({ fileList: [row.imageFileID] });
    } catch (error) {
      console.warn('[deleteWork] deleteFile failed', error);
    }
  }
  return { ok: true, workId };
};
