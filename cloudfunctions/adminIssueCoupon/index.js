const cloud = require('wx-server-sdk');
const { buildIssueCouponPayload } = require('./coupons');

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

  const memberId = event && event.memberId;
  if (!memberId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'memberId required' };
  }

  let member;
  try {
    const doc = await db.collection('members').doc(memberId).get();
    member = doc.data;
  } catch (error) {
    return { ok: false, code: 'NOT_FOUND', message: 'member not found' };
  }

  if (!member) {
    return { ok: false, code: 'NOT_FOUND', message: 'member not found' };
  }

  const built = buildIssueCouponPayload(
    {
      memberId,
      openid: member._openid,
      category: event && event.category,
      benefitType: event && event.benefitType,
      benefitValue: event && event.benefitValue,
      validFromDate: event && event.validFromDate,
      expireAtDate: event && event.expireAtDate,
      issuedBy: OPENID,
    },
    Date.now(),
  );

  if (!built.ok) {
    return built;
  }

  const addRes = await db.collection('user_coupons').add({ data: built.coupon });
  const couponId = addRes._id;

  return {
    ok: true,
    coupon: {
      ...built.coupon,
      _id: couponId,
    },
  };
};
