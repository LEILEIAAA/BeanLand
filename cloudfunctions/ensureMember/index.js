const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function normalizePhone(phone) {
  let digits = String(phone || '')
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, '');
  if (digits.length >= 13 && digits.startsWith('86')) {
    const local = digits.slice(2);
    if (/^1[3-9]\d{9}$/.test(local)) {
      digits = local;
    }
  }
  return digits;
}

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(normalizePhone(phone));
}

async function checkIsAdmin(openid) {
  if (!openid) return false;
  try {
    const result = await db.collection('admins').where({ openid }).limit(1).get();
    return !!(result.data && result.data.length);
  } catch (error) {
    return false;
  }
}

function emptyMember(openid, event) {
  const now = Date.now();
  const phone = isValidPhone(event && event.phone) ? normalizePhone(event.phone) : '';
  return {
    _openid: openid,
    nickName: String((event && event.nickName) || '').trim(),
    phone,
    avatarUrl: (event && event.avatarUrl) || '',
    tier: 'member',
    principalBalance: 0,
    bonusBalance: 0,
    totalBalance: 0,
    totalRecharge: 0,
    totalBonus: 0,
    totalSpent: 0,
    visitCount: 0,
    stampCount: 0,
    stampTarget: 5,
    tags: [],
    coupons: [],
    createdAt: now,
    updatedAt: now,
    tierUpdatedAt: now,
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const col = db.collection('members');
  const found = await col.where({ _openid: OPENID }).limit(1).get();
  const payload = event || {};

  if (payload.phone && !isValidPhone(payload.phone)) {
    return { ok: false, code: 'INVALID_PHONE', message: 'invalid phone' };
  }

  if (found.data && found.data.length) {
    const member = found.data[0];
    const patch = {};
    const nickName = String(payload.nickName || '').trim();
    if (nickName && nickName !== member.nickName) {
      patch.nickName = nickName;
    }
    if (payload.avatarUrl && payload.avatarUrl !== member.avatarUrl) {
      patch.avatarUrl = payload.avatarUrl;
    }
    if (payload.phone) {
      const phone = normalizePhone(payload.phone);
      if (phone !== member.phone) {
        patch.phone = phone;
      }
    }
    const isAdmin = await checkIsAdmin(OPENID);
    if (Object.keys(patch).length) {
      patch.updatedAt = Date.now();
      await col.doc(member._id).update({ data: patch });
      return { ok: true, member: { ...member, ...patch }, isAdmin };
    }
    return { ok: true, member, isAdmin };
  }

  const doc = emptyMember(OPENID, payload);
  const addRes = await col.add({ data: doc });
  const isAdmin = await checkIsAdmin(OPENID);
  return { ok: true, member: { _id: addRes._id, ...doc }, isAdmin };
};
