const cloud = require('wx-server-sdk');
const {
  canRedeemPackageOrder,
  applyRedeemPackageOrder,
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
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const isAdmin = await assertAdmin(OPENID).catch(() => false);
  if (!isAdmin) {
    return { ok: false, code: 'FORBIDDEN', message: 'admin only' };
  }

  const orderId = event && event.orderId;
  if (!orderId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'orderId required' };
  }

  let orderDoc;
  try {
    orderDoc = await db.collection('package_orders').doc(orderId).get();
  } catch (error) {
    return { ok: false, code: 'NOT_FOUND', message: 'order not found' };
  }
  if (!orderDoc || !orderDoc.data) {
    return { ok: false, code: 'NOT_FOUND', message: 'order not found' };
  }

  const order = { _id: orderId, ...orderDoc.data };
  const now = Date.now();
  if (!canRedeemPackageOrder(order, now)) {
    return { ok: false, code: 'NOT_REDEEMABLE', message: '套餐不可核销' };
  }

  let redeemed;
  try {
    redeemed = applyRedeemPackageOrder(order, { now, redeemedBy: OPENID });
  } catch (error) {
    return { ok: false, code: 'NOT_REDEEMABLE', message: (error && error.message) || '套餐不可核销' };
  }

  await db.collection('package_orders').doc(orderId).update({
    data: {
      status: redeemed.status,
      redeemedAt: redeemed.redeemedAt,
      redeemedBy: redeemed.redeemedBy,
      updatedAt: redeemed.updatedAt,
    },
  });

  return {
    ok: true,
    order: {
      ...redeemed,
      id: orderId,
      _id: orderId,
    },
  };
};
