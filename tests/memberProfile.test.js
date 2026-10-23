const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePhone,
  isValidPhone,
  maskPhone,
  isProfileComplete,
  canRecharge,
  pickWechatPhone,
} = require('../miniprogram/utils/memberProfile');

test('isValidPhone accepts mainland mobile', () => {
  assert.equal(isValidPhone('13812345678'), true);
  assert.equal(isValidPhone('138 1234 5678'), true);
  assert.equal(isValidPhone('１３８１２３４５６７８'), true);
  assert.equal(isValidPhone('12812345678'), false);
  assert.equal(isValidPhone('1381234567'), false);
  assert.equal(isValidPhone(''), false);
});

test('normalizePhone strips China country code', () => {
  assert.equal(normalizePhone('+86 13812345678'), '13812345678');
  assert.equal(normalizePhone('8613812345678'), '13812345678');
  assert.equal(normalizePhone('+8613812345678'), '13812345678');
  assert.equal(normalizePhone('13812345678'), '13812345678');
});

test('isValidPhone accepts +86 WeChat phoneNumber forms', () => {
  assert.equal(isValidPhone('+8613812345678'), true);
  assert.equal(isValidPhone('8613812345678'), true);
});

test('pickWechatPhone prefers purePhoneNumber then normalized phoneNumber', () => {
  assert.equal(
    pickWechatPhone({
      phoneNumber: '+8613812345678',
      purePhoneNumber: '13812345678',
      countryCode: '86',
    }),
    '13812345678',
  );
  assert.equal(
    pickWechatPhone({
      phoneNumber: '+8613999999999',
      purePhoneNumber: '',
      countryCode: '86',
    }),
    '13999999999',
  );
  assert.equal(pickWechatPhone({ phoneNumber: '', purePhoneNumber: '' }), '');
  assert.equal(pickWechatPhone(null), '');
});

test('maskPhone hides middle digits', () => {
  assert.equal(maskPhone('13812345678'), '138****5678');
  assert.equal(maskPhone('bad'), '');
});

test('isProfileComplete requires nickName and phone', () => {
  assert.equal(isProfileComplete({ nickName: '豆', phone: '13812345678' }), true);
  assert.equal(isProfileComplete({ nickName: '', phone: '13812345678' }), false);
  assert.equal(isProfileComplete({ nickName: '豆', phone: '' }), false);
  assert.equal(isProfileComplete({ nickName: 'Bean artist1', phone: '13812345678' }), false);
});

test('isRegistrationComplete also requires chosen avatar', () => {
  const {
    hasChosenAvatar,
    isRegistrationComplete,
  } = require('../miniprogram/utils/memberProfile');
  const def = '/assets/icons/bean.png';
  assert.equal(hasChosenAvatar(def, def), false);
  assert.equal(hasChosenAvatar('wxfile://tmp_avatar', def), true);
  assert.equal(
    isRegistrationComplete(
      { nickName: '豆', phone: '13812345678', avatarUrl: def },
      def,
    ),
    false,
  );
  assert.equal(
    isRegistrationComplete(
      { nickName: '豆', phone: '13812345678', avatarUrl: 'wxfile://tmp_avatar' },
      def,
    ),
    true,
  );
  assert.equal(
    isRegistrationComplete(
      {
        nickName: 'Bean artist3',
        phone: '13812345678',
        avatarUrl: 'wxfile://tmp_avatar',
      },
      def,
    ),
    false,
  );
});

test('canRecharge only checks phone', () => {
  assert.equal(canRecharge({ phone: '13812345678' }), true);
  assert.equal(canRecharge({ nickName: '豆', phone: '' }), false);
});

test('phoneAuthFailMessage maps common errMsg', () => {
  const { phoneAuthFailMessage } = require('../miniprogram/utils/memberProfile');
  assert.match(phoneAuthFailMessage('getPhoneNumber:fail user deny'), /取消/);
  assert.match(phoneAuthFailMessage('getPhoneNumber:fail no permission'), /未开通|权限/);
  assert.match(phoneAuthFailMessage('getPhoneNumber:fail'), /真机|重试/);
  assert.doesNotMatch(phoneAuthFailMessage('getPhoneNumber:fail'), /手填/);
});

test('buildRegisterProgress lists missing items in fixed order', () => {
  const { buildRegisterProgress } = require('../miniprogram/utils/memberProfile');
  const def = '/assets/icons/bean.png';

  const onlyPhoneMissing = buildRegisterProgress(
    { nickName: '豆', phone: '', avatarUrl: 'wxfile://tmp_avatar' },
    def,
  );
  assert.deepEqual(onlyPhoneMissing.missingLabels, ['手机号']);
  assert.equal(onlyPhoneMissing.doneCount, 2);
  assert.equal(onlyPhoneMissing.registrationComplete, false);
  assert.equal(onlyPhoneMissing.finishButtonText, '确认注册');
  assert.equal(onlyPhoneMissing.finishHintText, '还需完善：手机号');
  assert.equal(onlyPhoneMissing.finishToast, '还需完善：手机号');

  const avatarAndPhone = buildRegisterProgress(
    { nickName: '豆', phone: '', avatarUrl: def },
    def,
  );
  assert.deepEqual(avatarAndPhone.missingLabels, ['头像', '手机号']);
  assert.equal(avatarAndPhone.finishHintText, '还需完善：头像、手机号');
  assert.equal(avatarAndPhone.finishButtonText, '确认注册');

  const defaultNickMissing = buildRegisterProgress(
    {
      nickName: 'Bean artist1',
      phone: '13812345678',
      avatarUrl: 'wxfile://tmp_avatar',
    },
    def,
  );
  assert.equal(defaultNickMissing.hasNickName, false);
  assert.deepEqual(defaultNickMissing.missingLabels, ['昵称']);
  assert.equal(defaultNickMissing.finishHintText, '还需完善：昵称');

  const allMissing = buildRegisterProgress(
    { nickName: '', phone: '', avatarUrl: def },
    def,
  );
  assert.deepEqual(allMissing.missingLabels, ['头像', '昵称', '手机号']);
  assert.equal(allMissing.doneCount, 0);
  assert.equal(allMissing.finishHintText, '还需完善：头像、昵称、手机号');
  assert.equal(allMissing.finishButtonText, '确认注册');

  const complete = buildRegisterProgress(
    { nickName: '豆', phone: '13812345678', avatarUrl: 'wxfile://tmp_avatar' },
    def,
  );
  assert.deepEqual(complete.missingLabels, []);
  assert.equal(complete.doneCount, 3);
  assert.equal(complete.registrationComplete, true);
  assert.equal(complete.finishButtonText, '确认注册');
  assert.equal(complete.finishHintText, '已完成 3/3');
  assert.equal(complete.finishToast, '');
});

test('resolveWechatNicknameInput rejects typing and keeps WeChat fill', () => {
  const { resolveWechatNicknameInput } = require('../miniprogram/utils/memberProfile');

  assert.deepEqual(resolveWechatNicknameInput('', '张'), {
    accept: false,
    value: '',
    reason: 'typing',
  });
  assert.deepEqual(resolveWechatNicknameInput('张', '张三'), {
    accept: false,
    value: '',
    reason: 'typing',
  });
  assert.deepEqual(resolveWechatNicknameInput('', '拼豆小张'), {
    accept: true,
    value: '拼豆小张',
    reason: '',
  });
  assert.deepEqual(resolveWechatNicknameInput('旧名', '拼豆小张'), {
    accept: true,
    value: '拼豆小张',
    reason: '',
  });
  assert.deepEqual(resolveWechatNicknameInput('拼豆小张', ''), {
    accept: true,
    value: '',
    reason: '',
  });
  assert.deepEqual(resolveWechatNicknameInput('', 'Bean artist1'), {
    accept: false,
    value: '',
    reason: 'default',
  });
});
