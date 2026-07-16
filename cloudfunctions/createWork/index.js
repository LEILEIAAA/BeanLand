const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CAPTION_MAX = 40;

function normalizeCaption(caption) {
  const text = String(caption == null ? '' : caption).trim();
  return text.length > CAPTION_MAX ? text.slice(0, CAPTION_MAX) : text;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const imageFileID = String((event && event.imageFileID) || '').trim();
  if (!imageFileID.startsWith('cloud://')) {
    return { ok: false, code: 'INVALID_FILE', message: 'invalid imageFileID' };
  }

  const now = Date.now();
  const doc = {
    _openid: OPENID,
    imageFileID,
    caption: normalizeCaption(event && event.caption),
    createdAt: now,
    updatedAt: now,
  };

  const addRes = await db.collection('works').add({ data: doc });
  return { ok: true, work: { _id: addRes._id, ...doc } };
};
