function normalizePhone(phone) {
  let digits = String(phone || '')
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, '');
  // 微信 phoneNumber 常带中国区号 86 / +86
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

/** 从微信 phoneInfo 取出可入库的 11 位手机号 */
function pickWechatPhone(info) {
  const pure = normalizePhone(info && info.purePhoneNumber);
  if (isValidPhone(pure)) return pure;
  const raw = normalizePhone(info && info.phoneNumber);
  if (isValidPhone(raw)) return raw;
  return '';
}

function maskPhone(phone) {
  const digits = normalizePhone(phone);
  if (!isValidPhone(digits)) {
    return '';
  }
  return `${digits.slice(0, 3)}****${digits.slice(7)}`;
}

/** 昵称 + 手机号齐即可充值引导；头像另算注册完成 */
function isProfileComplete(member) {
  const nickName = String((member && member.nickName) || '').trim();
  return !!(nickName && isValidPhone(member && member.phone));
}

const DEFAULT_AVATAR_MARKERS = [
  '/assets/icons/bean.png',
  '/assets/icons/default-avatar.png',
  'bean.png',
  'default-avatar.png',
];

function hasChosenAvatar(avatarUrl, defaultAvatar) {
  const url = String(avatarUrl || '').trim();
  if (!url) return false;
  if (defaultAvatar && url === defaultAvatar) return false;
  return !DEFAULT_AVATAR_MARKERS.some((marker) => url.endsWith(marker) || url === marker);
}

/** 注册完成：头像已选 + 昵称 + 手机号 */
function isRegistrationComplete(member, defaultAvatar) {
  return (
    hasChosenAvatar(member && member.avatarUrl, defaultAvatar) &&
    isProfileComplete(member)
  );
}

function canRecharge(member) {
  return isValidPhone(member && member.phone);
}

/** 把 getPhoneNumber 的 errMsg 转成可读提示 */
function phoneAuthFailMessage(errMsg) {
  const msg = String(errMsg || '');
  if (!msg || msg === 'getPhoneNumber:ok') {
    return '';
  }
  if (/user deny|deny|cancel|取消/i.test(msg)) {
    return '你取消了手机号授权';
  }
  if (/no permission|permission|没有权限|未开通|not enough/i.test(msg)) {
    return '未开通手机号权限，请检查公众平台配置';
  }
  if (/privacy|隐私/i.test(msg)) {
    return '需在公众平台配置隐私协议';
  }
  if (/fail/i.test(msg)) {
    return '授权失败，请用真机重试';
  }
  return '授权未成功，请重试';
}

module.exports = {
  normalizePhone,
  isValidPhone,
  pickWechatPhone,
  maskPhone,
  isProfileComplete,
  hasChosenAvatar,
  isRegistrationComplete,
  canRecharge,
  phoneAuthFailMessage,
};
