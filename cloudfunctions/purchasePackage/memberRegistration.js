const DEFAULT_NICK_PREFIX = 'Bean artist';
const DEFAULT_AVATAR_MARKERS = [
  '/assets/icons/bean.png',
  '/assets/icons/default-avatar.png',
  'bean.png',
  'default-avatar.png',
];

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

function isDefaultNickName(nickName) {
  return String(nickName || '').trim().startsWith(DEFAULT_NICK_PREFIX);
}

function hasChosenNickName(nickName) {
  const name = String(nickName || '').trim();
  if (!name) return false;
  return !isDefaultNickName(name);
}

function hasChosenAvatar(avatarUrl) {
  const url = String(avatarUrl || '').trim();
  if (!url) return false;
  return !DEFAULT_AVATAR_MARKERS.some((marker) => url.endsWith(marker) || url === marker);
}

function isRegistrationComplete(member) {
  if (!member) return false;
  return (
    hasChosenAvatar(member.avatarUrl) &&
    hasChosenNickName(member.nickName) &&
    isValidPhone(member.phone)
  );
}

function assertMemberRegistered(member) {
  if (!member) {
    return { ok: false, code: 'NOT_MEMBER', message: '请先注册会员' };
  }
  if (!isRegistrationComplete(member)) {
    return { ok: false, code: 'REGISTER_REQUIRED', message: '请先完成会员注册' };
  }
  return { ok: true };
}

module.exports = {
  normalizePhone,
  isValidPhone,
  hasChosenNickName,
  hasChosenAvatar,
  isRegistrationComplete,
  assertMemberRegistered,
};
