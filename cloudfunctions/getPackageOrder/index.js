const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const orderId = event && event.orderId;
  const outTradeNo = event && event.outTradeNo;
  if (!orderId && !outTradeNo) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'orderId or outTradeNo required' };
  }

  let order = null;
  if (orderId) {
    try {
      const doc = await db.collection('package_orders').doc(orderId).get();
      order = doc.data ? { _id: orderId, ...doc.data } : null;
    } catch (error) {
      order = null;
    }
  } else {
    const found = await db.collection('package_orders').where({ outTradeNo }).limit(1).get();
    order = found.data && found.data[0] ? found.data[0] : null;
  }

  if (!order) {
    return { ok: false, code: 'NOT_FOUND', message: 'order not found' };
  }

  if (order._openid && order._openid !== OPENID) {
    return { ok: false, code: 'FORBIDDEN', message: 'not your order' };
  }

  return { ok: true, order };
};
