const cloud = require('wx-server-sdk');
const payConfig = require('./payConfig');
const {
  STATUS,
  applyAdminConfirmRefund,
  markActivityRefundFailed,
  resolveWechatRefundFeeFen,
} = require('./activityRegistration');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return !!(result.data && result.data.length);
}

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

async function refundWechat(registration) {
  const subMchId = await loadSubMchId();
  if (!subMchId) {
    throw new Error('subMchId missing');
  }
  const totalFee = Number(registration.payAmountFen || 0);
  const refundFee = resolveWechatRefundFeeFen(registration);
  if (!(totalFee > 0) || !(refundFee > 0)) {
    return { refundId: 'zero', skipped: true };
  }
  const outRefundNo = `AR${Date.now()}${String(registration._id || '').slice(-6)}`.slice(0, 32);
  const res = await cloud.cloudPay.refund({
    subMchId,
    outTradeNo: registration.outTradeNo,
    outRefundNo,
    totalFee,
    refundFee,
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

  const isAdmin = await assertAdmin(OPENID).catch(() => false);
  if (!isAdmin) {
    return { ok: false, code: 'FORBIDDEN', message: 'admin only' };
  }

  const registrationId = event && event.registrationId;
  if (!registrationId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'registrationId required' };
  }

  let regDoc;
  try {
    regDoc = await db.collection('activity_registrations').doc(registrationId).get();
  } catch (error) {
    return { ok: false, code: 'NOT_FOUND', message: 'registration not found' };
  }
  if (!regDoc || !regDoc.data) {
    return { ok: false, code: 'NOT_FOUND', message: 'registration not found' };
  }

  const reg = { _id: registrationId, ...regDoc.data };
  if (reg.status !== STATUS.REFUND_PENDING) {
    return { ok: false, code: 'INVALID_STATUS', message: '仅待退款可重试' };
  }

  const now = Date.now();
  try {
    const wechat = await refundWechat(reg);
    const next = applyAdminConfirmRefund(reg, now);
    await db.collection('activity_registrations').doc(registrationId).update({
      data: {
        status: next.status,
        refundedAt: next.refundedAt,
        refundFailReason: '',
        refundTxId: wechat.refundId || wechat.outRefundNo || '',
        refundConfirmedBy: OPENID,
        updatedAt: now,
      },
    });
    return { ok: true, registrationId, status: next.status };
  } catch (error) {
    const failed = markActivityRefundFailed(reg, {
      now,
      refundFailReason: (error && error.message) || 'wechat refund failed',
    });
    await db.collection('activity_registrations').doc(registrationId).update({
      data: {
        status: failed.status,
        refundFailReason: failed.refundFailReason,
        updatedAt: now,
      },
    });
    return {
      ok: false,
      code: 'REFUND_FAILED',
      registrationId,
      status: failed.status,
      message: failed.refundFailReason,
    };
  }
};
