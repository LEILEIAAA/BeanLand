const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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

function pickWechatPhone(info) {
  const pure = normalizePhone(info && info.purePhoneNumber);
  if (isValidPhone(pure)) return pure;
  const raw = normalizePhone(info && info.phoneNumber);
  if (isValidPhone(raw)) return raw;
  return '';
}

/**
 * 用前端 getPhoneNumber 返回的 code 换取手机号。
 * 需小程序已开通「手机号快速验证」，企业主体更稳。
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', message: 'missing openid' };
  }

  const code = event && event.code;
  if (!code) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'code required' };
  }

  try {
    const result = await cloud.openapi.phonenumber.getPhoneNumber({ code });
    const info = (result && result.phoneInfo) || {};
    const phone = pickWechatPhone(info);
    if (!phone) {
      return { ok: false, code: 'EMPTY_PHONE', message: 'no phone in response', raw: result };
    }
    return {
      ok: true,
      phone,
      countryCode: info.countryCode || '',
    };
  } catch (error) {
    return {
      ok: false,
      code: 'PHONE_API_FAILED',
      message: (error && error.errMsg) || (error && error.message) || 'getPhoneNumber failed',
    };
  }
};
