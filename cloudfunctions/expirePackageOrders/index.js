const cloud = require('wx-server-sdk');
const payConfig = require('./payConfig');
const { creditMemberPackageRefund } = require('./memberCredit');
const {
  STATUS,
  PAY_METHOD,
  isPackageOrderExpired,
  beginExpirePackageRefund,
  completeExpirePackageRefund,
  markExpirePackageRefundPending,
} = require('./packagePurchase');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function loadSubMchId() {
  if (payConfig.subMchId) return payConfig.subMchId;
  try {
    const doc = await db.collection('pay_config').doc('main').get();
    if (doc && doc.data && doc.data.subMchId) return String(doc.data.subMchId);
  } catch (error) {
    // missing
  }
  return '';
}

async function refundWechat(order) {
  const subMchId = await loadSubMchId();
  if (!subMchId) {
    throw new Error('subMchId missing');
  }
  const totalFee = Number(order.payAmountFen || 0);
  if (!(totalFee > 0)) {
    return { refundId: 'zero', skipped: true };
  }
  const outRefundNo = `PR${Date.now()}${String(order._id || '').slice(-6)}`.slice(0, 32);
  const res = await cloud.cloudPay.refund({
    subMchId,
    outTradeNo: order.outTradeNo,
    outRefundNo,
    totalFee,
    refundFee: totalFee,
    refundFeeType: 'CNY',
  });
  if (res && (res.returnCode === 'SUCCESS' || res.return_code === 'SUCCESS')
    && (res.resultCode === 'SUCCESS' || res.result_code === 'SUCCESS')) {
    return { refundId: res.refundId || res.refund_id || outRefundNo, outRefundNo };
  }
  const msg = (res && (res.returnMsg || res.errCodeDes || res.errmsg)) || 'wechat refund failed';
  throw new Error(msg);
}

async function processOne(order, now) {
  const orderId = order._id;
  let working = order;

  if (working.status === STATUS.FULFILLED && isPackageOrderExpired(working, now)) {
    working = beginExpirePackageRefund(working, now);
    await db.collection('package_orders').doc(orderId).update({
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
    return { orderId, skipped: true };
  }

  try {
    let refundTxId = '';
    if (working.refundChannel === PAY_METHOD.BALANCE || working.payMethod === PAY_METHOD.BALANCE) {
      const memberRes = await db.collection('members').doc(working.memberId).get();
      if (!memberRes.data) {
        throw new Error('member not found');
      }
      const credited = await creditMemberPackageRefund(db, {
        member: memberRes.data,
        memberId: working.memberId,
        principalPaid: working.principalPaid,
        bonusPaid: working.bonusPaid,
        title: `${working.packageName || '套餐'} 过期退款`,
        orderId,
        outTradeNo: working.outTradeNo,
        now,
      });
      refundTxId = credited.transactionId;
    } else {
      const wechat = await refundWechat(working);
      refundTxId = wechat.refundId || wechat.outRefundNo || '';
    }

    const done = completeExpirePackageRefund(working, { now, refundTxId });
    await db.collection('package_orders').doc(orderId).update({
      data: {
        status: done.status,
        refundTxId: done.refundTxId,
        refundedAt: done.refundedAt,
        refundFailReason: '',
        updatedAt: done.updatedAt,
      },
    });
    return { orderId, status: done.status };
  } catch (error) {
    const pending = markExpirePackageRefundPending(working, {
      now,
      refundFailReason: (error && error.message) || 'refund failed',
    });
    await db.collection('package_orders').doc(orderId).update({
      data: {
        status: pending.status,
        refundFailReason: pending.refundFailReason,
        updatedAt: pending.updatedAt,
      },
    });
    return {
      orderId,
      status: pending.status,
      error: pending.refundFailReason,
    };
  }
}

exports.main = async () => {
  const now = Date.now();
  const fulfilled = await db
    .collection('package_orders')
    .where({ status: STATUS.FULFILLED })
    .limit(100)
    .get();
  const pending = await db
    .collection('package_orders')
    .where({ status: STATUS.EXPIRED_REFUND_PENDING })
    .limit(50)
    .get();
  const refunding = await db
    .collection('package_orders')
    .where({ status: STATUS.EXPIRED_REFUNDING })
    .limit(50)
    .get();

  const candidates = []
    .concat(fulfilled.data || [])
    .concat(pending.data || [])
    .concat(refunding.data || []);

  const results = [];
  for (const row of candidates) {
    if (row.status === STATUS.FULFILLED && !isPackageOrderExpired(row, now)) {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    results.push(await processOne(row, now));
  }

  return { ok: true, processed: results.length, results };
};
