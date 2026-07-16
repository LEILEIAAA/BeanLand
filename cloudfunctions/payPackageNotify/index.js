const cloud = require('wx-server-sdk');
const { recordPackageWechatConsume } = require('./memberCredit');
const {
  STATUS,
  CHANNEL,
  isFulfillIdempotent,
  assertPayAmountMatch,
  attachFulfillmentEntitlement,
} = require('./packagePurchase');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function markUserCouponUsed(couponId, now) {
  await db.collection('user_coupons').doc(couponId).update({
    data: {
      status: 'used',
      usedAt: now,
      updatedAt: now,
      holdOrderId: '',
    },
  });
}

async function releaseUserCoupon(couponId, orderId, now) {
  try {
    const doc = await db.collection('user_coupons').doc(couponId).get();
    if (!doc || !doc.data) return;
    if (orderId && doc.data.holdOrderId && String(doc.data.holdOrderId) !== String(orderId)) {
      return;
    }
    await db.collection('user_coupons').doc(couponId).update({
      data: {
        holdOrderId: '',
        updatedAt: now,
      },
    });
  } catch (error) {
    // ignore
  }
}

/**
 * 云开发支付结果回调（套餐）。
 * 成功需返回 { errcode: 0, errmsg: 'ok' }。
 */
exports.main = async (event) => {
  const returnCode = event && (event.returnCode || event.return_code);
  const resultCode = event && (event.resultCode || event.result_code);
  const outTradeNo = event && (event.outTradeNo || event.out_trade_no);
  const totalFee = Number(event && (event.totalFee || event.total_fee));
  const transactionId = (event && (event.transactionId || event.transaction_id)) || '';

  if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
    return { errcode: 0, errmsg: 'ok' };
  }

  if (!outTradeNo) {
    return { errcode: 0, errmsg: 'ok' };
  }

  const found = await db.collection('package_orders').where({ outTradeNo }).limit(1).get();
  if (!found.data || !found.data.length) {
    return { errcode: 0, errmsg: 'ok' };
  }

  const order = found.data[0];
  const orderId = order._id;

  if (isFulfillIdempotent(order)) {
    return { errcode: 0, errmsg: 'ok' };
  }

  if (!assertPayAmountMatch(order, totalFee)) {
    await db.collection('package_orders').doc(orderId).update({
      data: {
        status: STATUS.FAILED,
        updatedAt: Date.now(),
        failReason: 'amount_mismatch',
      },
    });
    if (order.couponId) {
      await releaseUserCoupon(order.couponId, orderId, Date.now());
    }
    return { errcode: 0, errmsg: 'ok' };
  }

  const now = Date.now();
  if (order.status === STATUS.PAYING || order.status === STATUS.CREATED) {
    await db.collection('package_orders').doc(orderId).update({
      data: {
        status: STATUS.PAID,
        transactionId,
        paidAt: now,
        updatedAt: now,
      },
    });
  }

  const memberRes = await db.collection('members').doc(order.memberId).get();
  const member = memberRes.data;
  if (!member) {
    return { errcode: 0, errmsg: 'ok' };
  }

  const latest = await db.collection('package_orders').doc(orderId).get();
  if (isFulfillIdempotent(latest.data)) {
    return { errcode: 0, errmsg: 'ok' };
  }

  const payYuan = Number(order.payAmountFen || 0) / 100;
  const recorded = await recordPackageWechatConsume(db, {
    member,
    memberId: order.memberId,
    payYuan,
    title: order.packageName || '套餐消费',
    channel: CHANNEL.WECHAT_JSAPI,
    packageId: order.packageId,
    couponId: order.couponId,
    orderId,
    outTradeNo,
    now: Date.now(),
  });

  if (order.couponId) {
    await markUserCouponUsed(order.couponId, recorded.appliedAt);
  }

  const entitled = attachFulfillmentEntitlement(
    {
      ...order,
      ...latest.data,
      transactionId,
      balanceTxId: recorded.transactionId,
      paidAt: order.paidAt || now,
    },
    {
      pkg: {
        id: order.packageId,
        name: order.packageName,
        ...(order.packageSnapshot || {}),
      },
      fulfilledAt: recorded.appliedAt,
      validityDays: order.validityDays,
      principalPaid: payYuan,
      bonusPaid: 0,
      payAmountYuan: payYuan,
    },
  );

  await db.collection('package_orders').doc(orderId).update({
    data: {
      status: entitled.status,
      transactionId,
      balanceTxId: recorded.transactionId,
      fulfilledAt: entitled.fulfilledAt,
      expiresAt: entitled.expiresAt,
      validityDays: entitled.validityDays,
      packageSnapshot: entitled.packageSnapshot,
      payAmountYuan: entitled.payAmountYuan,
      principalPaid: entitled.principalPaid,
      bonusPaid: entitled.bonusPaid,
      paidAt: order.paidAt || now,
      updatedAt: recorded.appliedAt,
    },
  });

  return { errcode: 0, errmsg: 'ok' };
};
