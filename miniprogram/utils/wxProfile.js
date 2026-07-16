const PROFILE_KEY = 'wxProfile';
const GUIDE_SKIP_KEY = 'wxProfileGuideSkipped';
const ARTIST_SEQ_KEY = 'beanArtistSeq';
const DEFAULT_AVATAR = '/assets/icons/default-avatar.png';
const DEFAULT_NICK_PREFIX = 'Bean artist';

function normalizeProfile(raw) {
  const source = raw || {};
  return {
    nickName: String(source.nickName || '').trim(),
    avatarUrl: source.avatarUrl || '',
  };
}

function isDefaultNickName(nickName) {
  return String(nickName || '').trim().startsWith(DEFAULT_NICK_PREFIX);
}

function isDefaultAvatarUrl(avatarUrl) {
  const url = String(avatarUrl || '').trim();
  if (!url) return true;
  return url === DEFAULT_AVATAR || url === '/assets/icons/bean.png';
}

function needsSyncHints(profile) {
  const current = normalizeProfile(profile);
  return isDefaultNickName(current.nickName) && isDefaultAvatarUrl(current.avatarUrl);
}

function isProfileSynced(profile) {
  return Boolean(normalizeProfile(profile).nickName);
}

function needsProfileGuide(profile, skipped) {
  return !isProfileSynced(profile) && !skipped;
}

function appointmentNameFromProfile(profile) {
  return normalizeProfile(profile).nickName;
}

function resolveNickNameUpdate(incoming, current) {
  const next = String(incoming || '').trim();
  if (!next) {
    return String(current || '').trim();
  }
  return next;
}

function mergeProfile(current, partial) {
  const base = normalizeProfile(current);
  const next = {
    ...base,
    ...(partial || {}),
  };
  return normalizeProfile(next);
}

function formatDefaultNickName(seq) {
  return `${DEFAULT_NICK_PREFIX}${Number(seq) || 1}`;
}

function getStorage() {
  return typeof wx !== 'undefined' ? wx : null;
}

function readProfile(storage) {
  const store = storage || getStorage();
  if (!store || typeof store.getStorageSync !== 'function') {
    return normalizeProfile({});
  }
  return normalizeProfile(store.getStorageSync(PROFILE_KEY) || {});
}

function writeProfile(partial, storage, current) {
  const store = storage || getStorage();
  const merged = mergeProfile(current || readProfile(store), partial);
  if (store && typeof store.setStorageSync === 'function') {
    store.setStorageSync(PROFILE_KEY, merged);
  }
  return merged;
}

function readGuideSkipped(storage) {
  const store = storage || getStorage();
  if (!store || typeof store.getStorageSync !== 'function') {
    return false;
  }
  return Boolean(store.getStorageSync(GUIDE_SKIP_KEY));
}

function writeGuideSkipped(skipped, storage) {
  const store = storage || getStorage();
  if (store && typeof store.setStorageSync === 'function') {
    store.setStorageSync(GUIDE_SKIP_KEY, Boolean(skipped));
  }
}

function nextArtistSeq(storage) {
  const store = storage || getStorage();
  const current = Number((store && store.getStorageSync(ARTIST_SEQ_KEY)) || 0);
  const next = current + 1;
  if (store && typeof store.setStorageSync === 'function') {
    store.setStorageSync(ARTIST_SEQ_KEY, next);
  }
  return next;
}

function ensureDefaultProfile(storage) {
  const store = storage || getStorage();
  const current = readProfile(store);
  const patch = {};

  if (!current.nickName) {
    patch.nickName = formatDefaultNickName(nextArtistSeq(store));
  }

  if (!current.avatarUrl) {
    patch.avatarUrl = DEFAULT_AVATAR;
  }

  if (!Object.keys(patch).length) {
    return current;
  }

  return writeProfile(patch, store, current);
}

function displayAvatar(profile) {
  return normalizeProfile(profile).avatarUrl || DEFAULT_AVATAR;
}

function hydrateAppProfile(app, storage) {
  const profile = ensureDefaultProfile(storage);
  if (!app.globalData) {
    app.globalData = {};
  }
  app.globalData.userProfile = profile;
  return profile;
}

module.exports = {
  PROFILE_KEY,
  GUIDE_SKIP_KEY,
  ARTIST_SEQ_KEY,
  DEFAULT_AVATAR,
  DEFAULT_NICK_PREFIX,
  normalizeProfile,
  isDefaultNickName,
  isDefaultAvatarUrl,
  needsSyncHints,
  isProfileSynced,
  needsProfileGuide,
  appointmentNameFromProfile,
  resolveNickNameUpdate,
  mergeProfile,
  formatDefaultNickName,
  nextArtistSeq,
  ensureDefaultProfile,
  readProfile,
  writeProfile,
  readGuideSkipped,
  writeGuideSkipped,
  displayAvatar,
  hydrateAppProfile,
};
