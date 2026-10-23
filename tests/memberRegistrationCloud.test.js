const test = require('node:test');
const assert = require('node:assert/strict');

test('assertMemberRegistered rejects missing or incomplete member', () => {
  const {
    assertMemberRegistered,
    isRegistrationComplete,
  } = require('../cloudfunctions/common/memberRegistration');

  assert.equal(isRegistrationComplete(null), false);
  assert.deepEqual(assertMemberRegistered(null), {
    ok: false,
    code: 'NOT_MEMBER',
    message: '请先注册会员',
  });

  assert.deepEqual(
    assertMemberRegistered({
      nickName: '豆',
      phone: '13812345678',
      avatarUrl: '/assets/icons/default-avatar.png',
    }),
    {
      ok: false,
      code: 'REGISTER_REQUIRED',
      message: '请先完成会员注册',
    },
  );

  assert.deepEqual(
    assertMemberRegistered({
      nickName: '豆',
      phone: '13812345678',
      avatarUrl: 'wxfile://tmp_avatar',
    }),
    { ok: true },
  );

  assert.equal(
    isRegistrationComplete({
      nickName: 'Bean artist1',
      phone: '13812345678',
      avatarUrl: 'wxfile://tmp_avatar',
    }),
    false,
  );
});
