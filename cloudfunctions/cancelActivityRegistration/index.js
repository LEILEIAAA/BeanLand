const cloud = require('wx-server-sdk');
const payConfig = require('./payConfig');
const { creditMemberActivityRefund } = require('./memberCredit');
const {
  STATUS,
  PAY_CHANNEL,
  assertUserCancelAllowed,
  calcCancelRefund,
  applyUserCancel,
  applyReleaseSeat,
  applyAdminConfirmRefund,
  markActivityRefundFailed,
  resolveWechatRefundFeeFen,
} = require('./activityRegistration');
const { buildSeatSnapshot } = require('./activityList');

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

async function loadActivity(activityId) {
  const col = db.collection('activities');
  try {
    const byId = await col.doc(activityId).get();
    if (byId && byId.data) return { _docId: activityId, id: activityId, ...byId.data };
  } catch (error) {
    // try where
  }
  const found = await col.where({ id: activityId }).limit(1).get();
  if (found.data && found.data.length) {
    const row = found.data[0];
    return { _docId: row._id, id: row.id || row._id, ...row };
  }
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
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
  if (reg._openid !== OPENID) {
    return { ok: false, code: 'FORBIDDEN', message: 'not your registration' };
  }

  const now = Date.now();
  const activity = await loadActivity(reg.activityId);
  const startAt = activity ? Number(activity.startAt || 0) : 0;
  const gate = assertUserCancelAllowed(reg, startAt, now);
  if (!gate.ok) {
    return { ok: false, code: gate.code, message: gate.message };
  }

  const refund = calcCancelRefund(reg, gate.policy);
  const nextReg = applyUserCancel(reg, now, {
    tier: gate.policy.tier,
    feeFen: refund.feeFen,
    refundFen: refund.refundFen,
  });

  let seatActivity = null;
  if (activity) {
    const released = applyReleaseSeat(activity);
    await db.collection('activities').doc(activity._docId).update({
      data: {
        registeredCount: released.registeredCount,
        status: released.status,
        updatedAt: now,
      },
    });
    seatActivity = released;
  }

  const seatFields = seatActivity ? buildSeatSnapshot(seatActivity) : {};
  const cancelFields = {
    status: nextReg.status,
    cancelledAt: nextReg.cancelledAt,
    cancelTier: nextReg.cancelTier,
    cancelFeeFen: nextReg.cancelFeeFen,
    refundFeeFen: nextReg.refundFeeFen,
    updatedAt: now,
  };

  if (reg.payChannel === PAY_CHANNEL.BALANCE) {
    const memberFound = await db.collection('members').doc(reg.memberId).get();
    if (memberFound && memberFound.data) {
      const member = { _id: reg.memberId, ...memberFound.data };
      await creditMemberActivityRefund(db, {
        member,
        memberId: reg.memberId,
        principalPaid: refund.principalRefund,
        bonusPaid: refund.bonusRefund,
        title: `活动报名取消 · ${reg.activityName}`,
        registrationId,
        outTradeNo: reg.outTradeNo,
        now,
      });
    }
    await db.collection('activity_registrations').doc(registrationId).update({
      data: cancelFields,
    });
    return {
      ok: true,
      registrationId,
      status: nextReg.status,
      cancelTier: nextReg.cancelTier,
      cancelFeeFen: nextReg.cancelFeeFen,
      refundFeeFen: nextReg.refundFeeFen,
      ...seatFields,
    };
  }

  await db.collection('activity_registrations').doc(registrationId).update({
    data: cancelFields,
  });

  try {
    const wechat = await refundWechat({ ...reg, ...nextReg });
    const done = applyAdminConfirmRefund({ ...reg, ...nextReg }, now);
    await db.collection('activity_registrations').doc(registrationId).update({
      data: {
        status: done.status,
        refundedAt: done.refundedAt,
        refundFailReason: '',
        refundTxId: wechat.refundId || wechat.outRefundNo || '',
        updatedAt: now,
      },
    });
    return {
      ok: true,
      registrationId,
      status: done.status,
      cancelTier: nextReg.cancelTier,
      cancelFeeFen: nextReg.cancelFeeFen,
      refundFeeFen: nextReg.refundFeeFen,
      ...seatFields,
    };
  } catch (error) {
    const failed = markActivityRefundFailed(nextReg, {
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
      ok: true,
      registrationId,
      status: failed.status,
      refundPending: true,
      cancelTier: nextReg.cancelTier,
      cancelFeeFen: nextReg.cancelFeeFen,
      refundFeeFen: nextReg.refundFeeFen,
      message: failed.refundFailReason,
      ...seatFields,
    };
  }
};
