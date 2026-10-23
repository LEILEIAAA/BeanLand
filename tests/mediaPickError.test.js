const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isMediaPickCancel,
  describeMediaPickError,
} = require('../miniprogram/utils/mediaPickError');

test('isMediaPickCancel detects cancel variants', () => {
  assert.equal(isMediaPickCancel({ errMsg: 'chooseMedia:fail cancel' }), true);
  assert.equal(isMediaPickCancel({ errMsg: 'chooseMedia:fail:cancel' }), true);
  assert.equal(isMediaPickCancel({ errMsg: 'chooseMedia:fail user cancel' }), true);
  assert.equal(isMediaPickCancel({ errMsg: 'chooseMedia:fail privacy permission is not authorized' }), false);
  assert.equal(isMediaPickCancel(null), false);
});

test('describeMediaPickError maps privacy / scope failures', () => {
  assert.match(
    describeMediaPickError({ errMsg: 'chooseMedia:fail privacy permission is not authorized' }),
    /隐私/,
  );
  assert.match(
    describeMediaPickError({ errMsg: 'chooseMedia:fail api scope is not declared in the privacy agreement' }),
    /隐私指引|照片/,
  );
  assert.match(
    describeMediaPickError({ errMsg: 'requirePrivacyAuthorize:fail' }),
    /隐私/,
  );
});

test('describeMediaPickError maps permission deny', () => {
  assert.match(
    describeMediaPickError({ errMsg: 'chooseMedia:fail auth deny' }),
    /相册|相机|权限/,
  );
});

test('describeMediaPickError default for other failures', () => {
  assert.equal(describeMediaPickError({ errMsg: 'chooseMedia:fail system error' }), '选图失败');
  assert.equal(describeMediaPickError({}), '选图失败');
});

test('describeMediaPickError maps cloud upload failures', () => {
  assert.equal(
    describeMediaPickError({ errMsg: 'cloud.uploadFile:fail network error' }),
    '上传失败',
  );
  assert.equal(
    describeMediaPickError({ errMsg: 'chooseMedia:fail system error' }, 'upload'),
    '上传失败',
  );
});
