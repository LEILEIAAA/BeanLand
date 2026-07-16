const cloud = require('wx-server-sdk');
const payConfig = require('./payConfig');
const {
  buildWechatRechargeDraft,
  STATUS,
  buildOutTradeNo,
} = require('./rechargeOrder');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function normalizePhone(phone) {
  let digits = String(phone || '')
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, '');
  if (digits.length >= 13 && digits.startsWith('86')) {
    const local = digits.slice(2);
    if (/^1[3-9]\d{9}$/.test(local)) {
      digits = local;
    }
  }
  return digits;
}

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(normalizePhone(phone));
}

async function loadSubMchId() {
  if (payConfig.subMchId) return payConfig.subMchId;
  try {
    const doc = await db.collection('pay_config').doc('main').get();
    if (doc && doc.data && doc.data.subMchId) return String(doc.data.subMchId);
  } catch (error) {
    // missing config
  }
  return '';
}

async function loadPlan(planId) {
  const col = db.collection('recharge_plans');
  try {
    const byId = await col.doc(planId).get();
    if (byId && byId.data) return { id: planId, ...byId.data };
  } catch (error) {
    // try where id
  }
  const found = await col.where({ id: planId }).limit(1).get();
  if (found.data && found.data.length) {
    const row = found.data[0];
    return { id: row.id || row._id, ...row };
  }
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const planId = event && event.planId;
  if (!planId) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'planId required' };
  }

  const memberFound = await db.collection('members').where({ _openid: OPENID }).limit(1).get();
  if (!memberFound.data || !memberFound.data.length) {
    return { ok: false, code: 'NOT_FOUND', message: 'member not found' };
  }
  const member = memberFound.data[0];
  if (!isValidPhone(member.phone)) {
    return { ok: false, code: 'PHONE_REQUIRED', message: 'phone required before recharge' };
  }

  const plan = await loadPlan(planId);
  if (!plan || !(Number(plan.rechargeAmount) > 0)) {
    return { ok: false, code: 'PLAN_NOT_FOUND', message: 'recharge plan not found' };
  }

  const subMchId = await loadSubMchId();
  if (!subMchId) {
    return {
      ok: false,
      code: 'PAY_CONFIG_MISSING',
      message: 'subMchId missing; set pay_config/main or payConfig.subMchId',
    };
  }

  const now = Date.now();
  const outTradeNo = buildOutTradeNo(member._id);
  const draft = buildWechatRechargeDraft({
    openid: OPENID,
    memberId: member._id,
    plan,
    now,
    outTradeNo,
  });

  const addRes = await db.collection('recharge_orders').add({ data: draft });
  const orderId = addRes._id;

  try {
    const payRes = await cloud.cloudPay.unifiedOrder({
      body: `Bean充值${draft.rechargeAmount}`,
      outTradeNo: draft.outTradeNo,
      spbillCreateIp: '127.0.0.1',
      subMchId,
      totalFee: draft.payAmountFen,
      envId: payConfig.envId,
      functionName: payConfig.notifyFunctionName,
      tradeType: 'JSAPI',
      nonceStr: Math.random().toString(36).slice(2),
    });

    const payment = payRes && (payRes.payment || payRes);
    if (!payment || !payment.paySign) {
      await db.collection('recharge_orders').doc(orderId).update({
        data: { status: STATUS.FAILED, updatedAt: Date.now() },
      });
      return {
        ok: false,
        code: 'UNIFIED_ORDER_FAILED',
        message: 'unifiedOrder missing payment',
        raw: payRes,
      };
    }

    await db.collection('recharge_orders').doc(orderId).update({
      data: { status: STATUS.PAYING, updatedAt: Date.now() },
    });

    return {
      ok: true,
      orderId,
      outTradeNo: draft.outTradeNo,
      payAmountFen: draft.payAmountFen,
      payment: {
        timeStamp: String(payment.timeStamp),
        nonceStr: payment.nonceStr,
        package: payment.package,
        signType: payment.signType || 'MD5',
        paySign: payment.paySign,
      },
    };
  } catch (error) {
    await db.collection('recharge_orders').doc(orderId).update({
      data: { status: STATUS.FAILED, updatedAt: Date.now() },
    });
    return {
      ok: false,
      code: 'UNIFIED_ORDER_FAILED',
      message: (error && error.errMsg) || (error && error.message) || 'unifiedOrder failed',
    };
  }
};
