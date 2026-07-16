const cloud = require('wx-server-sdk');
const { creditMemberPackageRefund } = require('./memberCredit');
const {
  STATUS,
  PAY_METHOD,
  canRedeemPackageOrder,
  isPackageOrderExpired,
  beginExpirePackageRefund,
  completeExpirePackageRefund,
  markExpirePackageRefundPending,
} = require('./packagePurchase');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const TAB = {
  UNUSED: 'unused',
  USED: 'used',
  EXPIRED: 'expired',
};

function mapOrder(row) {
  const id = row._id || row.id;
  const snapshot = row.packageSnapshot || {};
  return {
    ...row,
    id,
    _id: id,
    packageName: row.packageName || snapshot.name || '套餐',
    displayName: row.packageName || snapshot.name || '套餐',
  };
}

function matchesTab(order, tab, now) {
  if (tab === TAB.UNUSED) {
    return canRedeemPackageOrder(order, now);
  }
  if (tab === TAB.USED) {
    return order.status === STATUS.REDEEMED;
  }
  if (tab === TAB.EXPIRED) {
    return [
      STATUS.EXPIRED_REFUNDED,
      STATUS.EXPIRED_REFUND_PENDING,
      STATUS.EXPIRED_REFUNDING,
      STATUS.USER_REFUNDED,
      STATUS.USER_REFUND_PENDING,
      STATUS.USER_REFUNDING,
    ].includes(order.status);
  }
  return false;
}

async function settleExpiredBalance(order, now) {
  let working = order;
  if (working.status === STATUS.FULFILLED && isPackageOrderExpired(working, now)) {
    working = beginExpirePackageRefund(working, now);
    await db.collection('package_orders').doc(working._id).update({
      data: {
        status: working.status,
        refundChannel: working.refundChannel,
        expireStartedAt: working.expireStartedAt,
        updatedAt: working.updatedAt,
      },
    });
  }

  if (
    working.status !== STATUS.EXPIRED_REFUNDING
    && working.status !== STATUS.EXPIRED_REFUND_PENDING
  ) {
    return working;
  }

  const channel = working.refundChannel || working.payMethod;
  if (channel !== PAY_METHOD.BALANCE) {
    return working;
  }

  try {
    const memberRes = await db.collection('members').doc(working.memberId).get();
    if (!memberRes.data) throw new Error('member not found');
    const credited = await creditMemberPackageRefund(db, {
      member: memberRes.data,
      memberId: working.memberId,
      principalPaid: working.principalPaid,
      bonusPaid: working.bonusPaid,
      title: `${working.packageName || '套餐'} 过期退款`,
      orderId: working._id,
      outTradeNo: working.outTradeNo,
      now,
    });
    const done = completeExpirePackageRefund(working, {
      now,
      refundTxId: credited.transactionId,
    });
    await db.collection('package_orders').doc(working._id).update({
      data: {
        status: done.status,
        refundTxId: done.refundTxId,
        refundedAt: done.refundedAt,
        refundFailReason: '',
        updatedAt: done.updatedAt,
      },
    });
    return { ...working, ...done };
  } catch (error) {
    const pending = markExpirePackageRefundPending(working, {
      now,
      refundFailReason: (error && error.message) || 'refund failed',
    });
    await db.collection('package_orders').doc(working._id).update({
      data: {
        status: pending.status,
        refundFailReason: pending.refundFailReason,
        updatedAt: pending.updatedAt,
      },
    });
    return { ...working, ...pending };
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid', list: [] };
  }

  const tab = (event && event.tab) || TAB.UNUSED;
  const now = Date.now();
  let result;
  try {
    result = await db
      .collection('package_orders')
      .where({ _openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
  } catch (error) {
    result = await db.collection('package_orders').where({ _openid: OPENID }).limit(100).get();
  }

  const rows = [];
  for (const row of result.data || []) {
    let current = { ...row, _id: row._id };
    if (isPackageOrderExpired(current, now) || current.status === STATUS.EXPIRED_REFUNDING) {
      // eslint-disable-next-line no-await-in-loop
      current = await settleExpiredBalance(current, now);
    }
    rows.push(current);
  }

  const list = rows.filter((row) => matchesTab(row, tab, now)).map(mapOrder);
  return { ok: true, list, tab };
};
