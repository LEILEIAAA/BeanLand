const { isDefaultNickName } = require('./wxProfile');

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

/** 昵称已选用：非空且非 Bean artist 默认名；手机号齐即可充值引导；头像另算注册完成 */
function hasChosenNickName(nickName) {
  const name = String(nickName || '').trim();
  if (!name) return false;
  return !isDefaultNickName(name);
}

function isProfileComplete(member) {
  return !!(hasChosenNickName(member && member.nickName) && isValidPhone(member && member.phone));
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

const REGISTER_STEP_LABELS = [
  { key: 'avatar', label: '头像' },
  { key: 'nickName', label: '昵称' },
  { key: 'phone', label: '手机号' },
];

/** 注册页进度与底栏文案（与三项完成判定同源） */
function buildRegisterProgress(member, defaultAvatar) {
  const hasAvatar = hasChosenAvatar(member && member.avatarUrl, defaultAvatar);
  const hasNickName = hasChosenNickName(member && member.nickName);
  const hasPhone = isValidPhone(member && member.phone);
  const flags = { avatar: hasAvatar, nickName: hasNickName, phone: hasPhone };
  const missingLabels = REGISTER_STEP_LABELS.filter((step) => !flags[step.key]).map(
    (step) => step.label,
  );
  const doneCount = REGISTER_STEP_LABELS.length - missingLabels.length;
  const registrationComplete = missingLabels.length === 0;
  const finishHintText = registrationComplete
    ? '已完成 3/3'
    : `还需完善：${missingLabels.join('、')}`;
  return {
    hasAvatar,
    hasNickName,
    hasPhone,
    missingLabels,
    doneCount,
    registrationComplete,
    finishButtonText: '确认注册',
    finishHintText,
    finishToast: registrationComplete ? '' : finishHintText,
  };
}

/**
 * Only accept WeChat nickname fill (full replace), reject char-by-char typing.
 * @returns {{ accept: boolean, value: string, reason: string }}
 */
function resolveWechatNicknameInput(previousValue, nextValue) {
  const prev = String(previousValue || '');
  const next = String(nextValue || '').trim();
  if (!next) {
    return { accept: true, value: '', reason: '' };
  }
  if (!hasChosenNickName(next)) {
    return { accept: false, value: '', reason: 'default' };
  }
  const isTyping =
    next.length === prev.length + 1 && (prev === '' || next.startsWith(prev));
  if (isTyping) {
    return { accept: false, value: '', reason: 'typing' };
  }
  return { accept: true, value: next, reason: '' };
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
  hasChosenNickName,
  isRegistrationComplete,
  buildRegisterProgress,
  resolveWechatNicknameInput,
  canRecharge,
  phoneAuthFailMessage,
};
