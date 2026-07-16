const cloud = require('wx-server-sdk');
const payConfig = require('./payConfig');
const { creditMemberPackageRefund } = require('./memberCredit');
const {
  STATUS,
  PAY_METHOD,
  canUserRefundPackageOrder,
  beginUserPackageRefund,
  completeUserPackageRefund,
  markUserPackageRefundPending,
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
  const outRefundNo = `PU${Date.now()}${String(order._id || '').slice(-6)}`.slice(0, 32);
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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
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
  if (order._openid !== OPENID) {
    return { ok: false, code: 'FORBIDDEN', message: 'not your order' };
  }

  const now = Date.now();
  if (order.status === STATUS.USER_REFUNDED) {
    return { ok: true, orderId, status: order.status, idempotent: true };
  }

  let working = order;
  if (working.status === STATUS.FULFILLED) {
    if (!canUserRefundPackageOrder(working, now)) {
      return { ok: false, code: 'CANNOT_REFUND', message: '仅未核销且未过期可退' };
    }
    working = beginUserPackageRefund(working, now);
    await db.collection('package_orders').doc(orderId).update({
      data: {
        status: working.status,
        refundChannel: working.refundChannel,
        refundReason: working.refundReason,
        updatedAt: working.updatedAt,
      },
    });
  } else if (
    working.status !== STATUS.USER_REFUNDING
    && working.status !== STATUS.USER_REFUND_PENDING
  ) {
    return { ok: false, code: 'INVALID_STATUS', message: '当前状态不可退款' };
  }

  try {
    let refundTxId = '';
    if (working.refundChannel === PAY_METHOD.BALANCE || working.payMethod === PAY_METHOD.BALANCE) {
      const memberRes = await db.collection('members').doc(working.memberId).get();
      if (!memberRes.data) {
        throw new Error('member not found');
      }
      let principalPaid = Number(working.principalPaid || 0);
      let bonusPaid = Number(working.bonusPaid || 0);
      // 历史单可能未写本金/赠金拆分：按实付退回本金
      if (!(principalPaid > 0 || bonusPaid > 0)) {
        const payYuan = working.payAmountYuan != null
          ? Number(working.payAmountYuan)
          : Number(working.payAmountFen || 0) / 100;
        principalPaid = payYuan > 0 ? payYuan : 0;
        bonusPaid = 0;
      }
      const credited = await creditMemberPackageRefund(db, {
        member: memberRes.data,
        memberId: working.memberId,
        principalPaid,
        bonusPaid,
        title: `${working.packageName || '套餐'} 退款`,
        orderId,
        outTradeNo: working.outTradeNo,
        now,
      });
      refundTxId = credited.transactionId;
    } else {
      const wechat = await refundWechat(working);
      refundTxId = wechat.refundId || wechat.outRefundNo || '';
    }

    const done = completeUserPackageRefund(working, { now, refundTxId });
    await db.collection('package_orders').doc(orderId).update({
      data: {
        status: done.status,
        refundTxId: done.refundTxId,
        refundedAt: done.refundedAt,
        refundFailReason: '',
        updatedAt: done.updatedAt,
      },
    });
    return { ok: true, orderId, status: done.status };
  } catch (error) {
    const pending = markUserPackageRefundPending(working, {
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
      ok: false,
      code: 'REFUND_FAILED',
      orderId,
      status: pending.status,
      message: pending.refundFailReason,
    };
  }
};
