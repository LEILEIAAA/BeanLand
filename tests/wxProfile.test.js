const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeProfile,
  isProfileSynced,
  needsProfileGuide,
  appointmentNameFromProfile,
  mergeProfile,
  formatDefaultNickName,
  ensureDefaultProfile,
  resolveNickNameUpdate,
  needsSyncHints,
  PROFILE_KEY,
  GUIDE_SKIP_KEY,
  ARTIST_SEQ_KEY,
  DEFAULT_AVATAR,
  DEFAULT_NICK_PREFIX,
} = require('../miniprogram/utils/wxProfile');

function createMemoryStorage(seed = {}) {
  const map = { ...seed };
  return {
    getStorageSync(key) {
      return map[key];
    },
    setStorageSync(key, value) {
      map[key] = value;
    },
    _data: map,
  };
}

describe('normalizeProfile', () => {
  it('trims nickname and fills defaults', () => {
    assert.deepEqual(normalizeProfile({ nickName: '  小豆  ', avatarUrl: '/a.png' }), {
      nickName: '小豆',
      avatarUrl: '/a.png',
    });
    assert.deepEqual(normalizeProfile({}), { nickName: '', avatarUrl: '' });
  });
});

describe('isProfileSynced', () => {
  it('requires nickname', () => {
    assert.equal(isProfileSynced({ nickName: '小豆' }), true);
    assert.equal(isProfileSynced({ nickName: '', avatarUrl: '/a.png' }), false);
    assert.equal(isProfileSynced({}), false);
  });
});

describe('needsProfileGuide', () => {
  it('shows guide only when unsynced and not skipped', () => {
    assert.equal(needsProfileGuide({ nickName: '' }, false), true);
    assert.equal(needsProfileGuide({ nickName: '' }, true), false);
    assert.equal(needsProfileGuide({ nickName: '小豆' }, false), false);
  });
});

describe('appointmentNameFromProfile', () => {
  it('returns trimmed nickname for form prefills', () => {
    assert.equal(appointmentNameFromProfile({ nickName: ' 豆豆 ' }), '豆豆');
    assert.equal(appointmentNameFromProfile({}), '');
  });
});

describe('mergeProfile', () => {
  it('merges partial updates over current profile', () => {
    assert.deepEqual(
      mergeProfile({ nickName: '旧', avatarUrl: '/old.png' }, { nickName: '新' }),
      { nickName: '新', avatarUrl: '/old.png' },
    );
  });
});

describe('formatDefaultNickName', () => {
  it('builds Bean artist + sequence suffix', () => {
    assert.equal(formatDefaultNickName(12), 'Bean artist12');
    assert.equal(formatDefaultNickName(1), 'Bean artist1');
  });
});

describe('ensureDefaultProfile', () => {
  it('assigns default avatar and sequential Bean artist nickname once', () => {
    const storage = createMemoryStorage();
    const first = ensureDefaultProfile(storage);
    assert.equal(first.nickName, 'Bean artist1');
    assert.equal(first.avatarUrl, DEFAULT_AVATAR);
    assert.equal(storage._data[ARTIST_SEQ_KEY], 1);
    assert.deepEqual(storage._data[PROFILE_KEY], first);

    const second = ensureDefaultProfile(storage);
    assert.deepEqual(second, first);
    assert.equal(storage._data[ARTIST_SEQ_KEY], 1);
  });

  it('increments sequence for a fresh empty profile store', () => {
    const storage = createMemoryStorage({ [ARTIST_SEQ_KEY]: 11 });
    const profile = ensureDefaultProfile(storage);
    assert.equal(profile.nickName, 'Bean artist12');
    assert.equal(storage._data[ARTIST_SEQ_KEY], 12);
  });

  it('fills missing avatar only when nickname already exists', () => {
    const storage = createMemoryStorage({
      [PROFILE_KEY]: { nickName: '老客', avatarUrl: '' },
    });
    const profile = ensureDefaultProfile(storage);
    assert.equal(profile.nickName, '老客');
    assert.equal(profile.avatarUrl, DEFAULT_AVATAR);
  });
});

describe('needsSyncHints', () => {
  it('hides hints after custom nickname or avatar sync', () => {
    assert.equal(
      needsSyncHints({ nickName: 'Bean artist1', avatarUrl: DEFAULT_AVATAR }),
      true,
    );
    assert.equal(
      needsSyncHints({ nickName: 'Ray', avatarUrl: DEFAULT_AVATAR }),
      false,
    );
    assert.equal(
      needsSyncHints({ nickName: 'Bean artist1', avatarUrl: 'wxfile://tmp/avatar.png' }),
      false,
    );
  });
});

describe('resolveNickNameUpdate', () => {
  it('keeps current nickname when incoming is empty', () => {
    assert.equal(resolveNickNameUpdate('', 'Bean artist12'), 'Bean artist12');
    assert.equal(resolveNickNameUpdate('  新昵称  ', 'Bean artist12'), '新昵称');
  });
});

describe('constants', () => {
  it('exposes stable storage keys and defaults', () => {
    assert.equal(PROFILE_KEY, 'wxProfile');
    assert.equal(GUIDE_SKIP_KEY, 'wxProfileGuideSkipped');
    assert.equal(ARTIST_SEQ_KEY, 'beanArtistSeq');
    assert.equal(DEFAULT_AVATAR, '/assets/icons/default-avatar.png');
    assert.equal(DEFAULT_NICK_PREFIX, 'Bean artist');
  });
});
