function toErrMsg(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return String(error.errMsg || error.message || '');
}

function isMediaPickCancel(error) {
  const msg = toErrMsg(error);
  return /cancel/i.test(msg);
}

/**
 * Map chooseMedia / requirePrivacyAuthorize failures to short Chinese toasts.
 * Upload-stage errors should pass stage='upload'.
 */
function describeMediaPickError(error, stage) {
  const msg = toErrMsg(error);
  if (/privacy|隐私|scope is not declared|requirePrivacyAuthorize/i.test(msg)) {
    if (/scope is not declared/i.test(msg)) {
      return '隐私指引未声明照片，请在公众平台补全';
    }
    return '请先同意隐私授权后再选图';
  }
  if (/auth deny|authorize|permission|权限/i.test(msg)) {
    return '需要相册或相机权限';
  }
  if (stage === 'upload' || /uploadFile|cloud\.upload/i.test(msg)) {
    return '上传失败';
  }
  return '选图失败';
}

module.exports = {
  isMediaPickCancel,
  describeMediaPickError,
};
