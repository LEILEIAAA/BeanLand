const cloud = require('wx-server-sdk');
const { canRedeem, STATUS } = require('./coupons');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const isAdmin = await assertAdmin(OPENID).catch(() => false);
  if (!isAdmin) {
    return { ok: false, code: 'FORBIDDEN', message: 'admin only' };
  }

  const couponId = event && event.couponId;
  if (!couponId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'couponId required' };
  }

  const now = Date.now();
  let coupon;
  try {
    const doc = await db.collection('user_coupons').doc(couponId).get();
    coupon = doc.data;
  } catch (error) {
    return { ok: false, code: 'NOT_FOUND', message: 'coupon not found' };
  }

  if (!coupon) {
    return { ok: false, code: 'NOT_FOUND', message: 'coupon not found' };
  }

  if (!canRedeem(coupon, now)) {
    return { ok: false, code: 'NOT_REDEEMABLE', message: 'coupon not redeemable' };
  }

  await db.collection('user_coupons').doc(couponId).update({
    data: {
      status: STATUS.USED,
      available: false,
      usedAt: now,
      redeemedBy: OPENID,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    coupon: {
      ...coupon,
      _id: couponId,
      status: STATUS.USED,
      available: false,
      usedAt: now,
      redeemedBy: OPENID,
      updatedAt: now,
    },
  };
};
