const test = require('node:test');
const assert = require('node:assert/strict');

test('needsMemberRegister is true when registration incomplete', () => {
  const { needsMemberRegister, REGISTER_URL } = require('../miniprogram/utils/memberRegisterGate');
  const def = '/assets/icons/bean.png';

  assert.equal(REGISTER_URL, '/pages/member/register/index');
  assert.equal(needsMemberRegister(null, def), true);
  assert.equal(needsMemberRegister(undefined, def), true);
  assert.equal(
    needsMemberRegister(
      { nickName: '豆', phone: '13812345678', avatarUrl: def },
      def,
    ),
    true,
  );
  assert.equal(
    needsMemberRegister(
      { nickName: '豆', phone: '13812345678', avatarUrl: 'wxfile://tmp_avatar' },
      def,
    ),
    false,
  );
});

test('openMemberRegister blocks rapid second navigate before complete', () => {
  const {
    openMemberRegister,
    resetMemberRegisterOpenState,
    REGISTER_URL,
  } = require('../miniprogram/utils/memberRegisterGate');
  resetMemberRegisterOpenState();

  const calls = [];
  let completeFn = null;
  const wxApi = {
    navigateTo(opts) {
      calls.push(opts);
      completeFn = opts.complete;
    },
  };

  assert.equal(
    openMemberRegister({ wxApi, getCurrentPages: () => [], lockMs: 0 }),
    true,
  );
  assert.equal(
    openMemberRegister({ wxApi, getCurrentPages: () => [], lockMs: 0 }),
    false,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, REGISTER_URL);

  completeFn();
  assert.equal(
    openMemberRegister({
      wxApi,
      getCurrentPages: () => [{ route: 'pages/member/register/index' }],
      lockMs: 0,
    }),
    false,
  );
  assert.equal(calls.length, 1);

  assert.equal(
    openMemberRegister({ wxApi, getCurrentPages: () => [], lockMs: 0 }),
    true,
  );
  assert.equal(calls.length, 2);
  resetMemberRegisterOpenState();
});

test('openMemberRegister replace uses redirectTo once', () => {
  const {
    openMemberRegister,
    resetMemberRegisterOpenState,
    REGISTER_URL,
  } = require('../miniprogram/utils/memberRegisterGate');
  resetMemberRegisterOpenState();

  const calls = [];
  const wxApi = {
    redirectTo(opts) {
      calls.push(opts);
    },
    navigateTo() {
      assert.fail('should use redirectTo');
    },
  };

  assert.equal(
    openMemberRegister({
      replace: true,
      wxApi,
      getCurrentPages: () => [],
      lockMs: 0,
    }),
    true,
  );
  assert.equal(
    openMemberRegister({
      replace: true,
      wxApi,
      getCurrentPages: () => [],
      lockMs: 0,
    }),
    false,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, REGISTER_URL);
  resetMemberRegisterOpenState();
});

test('openMemberRegister unlocks immediately on navigate fail so retry works', () => {
  const {
    openMemberRegister,
    resetMemberRegisterOpenState,
    REGISTER_URL,
  } = require('../miniprogram/utils/memberRegisterGate');
  resetMemberRegisterOpenState();

  const calls = [];
  const wxApi = {
    navigateTo(opts) {
      calls.push(opts);
      if (calls.length === 1) {
        if (typeof opts.fail === 'function') opts.fail({ errMsg: 'navigateTo:fail' });
        if (typeof opts.complete === 'function') opts.complete();
        return;
      }
      if (typeof opts.success === 'function') opts.success();
      if (typeof opts.complete === 'function') opts.complete();
    },
  };

  assert.equal(
    openMemberRegister({ wxApi, getCurrentPages: () => [], lockMs: 400 }),
    true,
  );
  assert.equal(
    openMemberRegister({ wxApi, getCurrentPages: () => [], lockMs: 400 }),
    true,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, REGISTER_URL);
  resetMemberRegisterOpenState();
});
