const cloud = require('wx-server-sdk');
const { TAB, filterCouponsForTab, STATUS } = require('./coupons');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

async function markExpired(expiredIds, now) {
  await Promise.all(
    (expiredIds || []).map((id) =>
      db
        .collection('user_coupons')
        .doc(id)
        .update({
          data: {
            status: STATUS.EXPIRED,
            updatedAt: now,
          },
        }),
    ),
  );
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [] };
  }

  const isAdmin = await assertAdmin(OPENID).catch(() => false);
  if (!isAdmin) {
    return { ok: false, code: 'FORBIDDEN', message: 'admin only', list: [] };
  }

  const memberId = event && event.memberId;
  if (!memberId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'memberId required', list: [] };
  }

  const now = Date.now();
  const result = await db
    .collection('user_coupons')
    .where({ memberId })
    .limit(100)
    .get();

  const rows = result.data || [];
  const { list, expiredIds } = filterCouponsForTab(rows, TAB.UNUSED, now);

  if (expiredIds.length) {
    await markExpired(expiredIds, now).catch((error) => {
      console.warn('[adminListMemberCoupons] markExpired failed', error);
    });
  }

  return { ok: true, list };
};
