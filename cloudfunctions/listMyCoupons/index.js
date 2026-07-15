const cloud = require('wx-server-sdk');
const {
  TAB,
  filterCouponsForTab,
  countAvailable,
  STATUS,
} = require('./coupons');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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
    return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [], availableCount: 0 };
  }

  const tab = (event && event.tab) || TAB.UNUSED;
  const now = Date.now();

  const result = await db
    .collection('user_coupons')
    .where({ _openid: OPENID })
    .limit(100)
    .get();

  const rows = result.data || [];
  const { list, expiredIds } = filterCouponsForTab(rows, tab, now);
  const availableCount = countAvailable(rows, now);

  if (expiredIds.length) {
    await markExpired(expiredIds, now).catch((error) => {
      console.warn('[listMyCoupons] markExpired failed', error);
    });
  }

  return { ok: true, list, availableCount };
};
