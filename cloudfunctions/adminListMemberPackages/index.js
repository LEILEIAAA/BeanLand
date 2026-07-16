const cloud = require('wx-server-sdk');
const {
  canRedeemPackageOrder,
  isPackageOrderExpired,
  beginExpirePackageRefund,
} = require('./packagePurchase');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
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
    .collection('package_orders')
    .where({ memberId })
    .limit(100)
    .get();

  const rows = result.data || [];
  const toExpire = rows.filter((row) => isPackageOrderExpired(row, now));
  await Promise.all(
    toExpire.map(async (row) => {
      try {
        const next = beginExpirePackageRefund(row, now);
        await db.collection('package_orders').doc(row._id).update({
          data: {
            status: next.status,
            refundChannel: next.refundChannel,
            expireStartedAt: next.expireStartedAt,
            updatedAt: next.updatedAt,
          },
        });
        row.status = next.status;
      } catch (error) {
        // ignore
      }
    }),
  );

  const list = rows
    .filter((row) => canRedeemPackageOrder(row, now))
    .map((row) => {
      const snapshot = row.packageSnapshot || {};
      return {
        ...row,
        id: row._id,
        _id: row._id,
        packageName: row.packageName || snapshot.name || '套餐',
        displayName: row.packageName || snapshot.name || '套餐',
        redeemable: true,
      };
    })
    .sort((a, b) => Number(b.fulfilledAt || b.createdAt || 0) - Number(a.fulfilledAt || a.createdAt || 0));

  return { ok: true, list };
};
