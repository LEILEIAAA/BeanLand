const api = require('../../../utils/api');
const {
  isValidPhone,
  maskPhone,
  normalizePhone,
  phoneAuthFailMessage,
} = require('../../../utils/memberProfile');
const {
  DEFAULT_AVATAR,
  ensureDefaultProfile,
  writeProfile,
  displayAvatar,
  resolveNickNameUpdate,
} = require('../../../utils/wxProfile');

function formatMemberNo(id) {
  const raw = String(id || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!raw) return '';
  return raw.slice(-8).toUpperCase();
}

const { shareBehavior } = require('../../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    avatarUrl: DEFAULT_AVATAR,
    nickName: '',
    phone: '',
    phoneMasked: '',
    hasPhone: false,
    memberNo: '',
    phoneBusy: false,
  },
  onShow() {
    this.bootstrap();
  },
  async bootstrap() {
    const profile = ensureDefaultProfile();
    this.setData({
      avatarUrl: displayAvatar(profile),
      nickName: profile.nickName || '',
    });
    try {
      const result = await api.ensureMember({
        nickName: profile.nickName || '',
        avatarUrl: profile.avatarUrl || '',
      });
      if (result && result.ok && result.member) {
        this.applyState(result.member, profile);
      }
    } catch (error) {
      console.warn('[settings] bootstrap', error);
    }
  },
  applyState(member, localProfile) {
    const avatarUrl =
      (member && member.avatarUrl) ||
      (localProfile && localProfile.avatarUrl) ||
      this.data.avatarUrl ||
      DEFAULT_AVATAR;
    const nickName =
      (member && member.nickName) ||
      (localProfile && localProfile.nickName) ||
      this.data.nickName ||
      '';
    const phone = (member && member.phone) || this.data.phone || '';
    this.setData({
      avatarUrl: displayAvatar({ avatarUrl }),
      nickName,
      phone,
      phoneMasked: maskPhone(phone),
      hasPhone: isValidPhone(phone),
      memberNo: formatMemberNo(member && (member._id || member.id)) || this.data.memberNo,
    });
  },
  persistLocal(partial) {
    const next = writeProfile(partial, null, {
      avatarUrl: this.data.avatarUrl,
      nickName: this.data.nickName,
    });
    const app = getApp();
    app.globalData.userProfile = next;
    this.setData({
      avatarUrl: displayAvatar(next),
      nickName: next.nickName || '',
    });
    return next;
  },
  onChooseAvatar(event) {
    const tempPath = event.detail.avatarUrl;
    if (!tempPath) return;
    const fs = wx.getFileSystemManager();
    const saveAndSync = async (path) => {
      this.persistLocal({ avatarUrl: path });
      try {
        const result = await api.ensureMember({ avatarUrl: path });
        if (result && result.ok && result.member) {
          this.applyState(result.member);
        }
      } catch (error) {
        console.warn('[settings] avatar sync', error);
      }
      wx.showToast({ title: '头像已保存', icon: 'success' });
    };

    fs.saveFile({
      tempFilePath: tempPath,
      success: (res) => saveAndSync(res.savedFilePath),
      fail: () => saveAndSync(tempPath),
    });
  },
  async onNicknameBlur(event) {
    const nickName = resolveNickNameUpdate(event.detail.value, this.data.nickName);
    if (!nickName || nickName === this.data.nickName) return;
    this.persistLocal({ nickName });
    try {
      const result = await api.ensureMember({ nickName });
      if (result && result.ok && result.member) {
        this.applyState(result.member);
      }
    } catch (error) {
      console.warn('[settings] nickname sync', error);
    }
    wx.showToast({ title: '昵称已保存', icon: 'success' });
  },
  async onGetPhoneNumber(event) {
    if (this.data.phoneBusy) return;
    const detail = event.detail || {};

    if (detail.errMsg && detail.errMsg !== 'getPhoneNumber:ok') {
      const tip = phoneAuthFailMessage(detail.errMsg);
      wx.showToast({ title: tip || '授权未成功，请重试', icon: 'none', duration: 2500 });
      return;
    }
    if (!detail.code) {
      wx.showToast({ title: '未拿到code，请用真机授权', icon: 'none', duration: 2500 });
      return;
    }

    this.setData({ phoneBusy: true });
    try {
      const phoneRes = await api.fetchWechatPhone(detail.code);
      if (!phoneRes || !phoneRes.ok || !phoneRes.phone) {
        wx.showToast({
          title: (phoneRes && phoneRes.message) || '换号失败，请重试',
          icon: 'none',
          duration: 2500,
        });
        return;
      }
      const phone = normalizePhone(phoneRes.phone);
      if (!isValidPhone(phone)) {
        wx.showToast({ title: '手机号格式异常，请重试', icon: 'none', duration: 2500 });
        return;
      }
      const result = await api.ensureMember({ phone });
      if (!result || !result.ok || !result.member || !isValidPhone(result.member.phone)) {
        const reason = (result && (result.message || result.code)) || '云端未写入手机号';
        wx.showToast({ title: String(reason).slice(0, 18) || '入库失败，请重试', icon: 'none' });
        return;
      }
      this.applyState(result.member);
      try {
        wx.setStorageSync('beanMemberPhone', normalizePhone(result.member.phone));
      } catch (storageError) {
        // ignore
      }
      wx.showToast({ title: '手机号已登录', icon: 'success' });
    } catch (error) {
      console.warn('[settings] phone auth', error);
      wx.showToast({ title: '授权入库失败，请重试', icon: 'none' });
    } finally {
      this.setData({ phoneBusy: false });
    }
  },
  goAgreement() {
    wx.navigateTo({ url: '/pages/legal/agreement/index' });
  },
  goPrivacy() {
    wx.navigateTo({ url: '/pages/legal/privacy/index' });
  },
  goRefund() {
    wx.navigateTo({ url: '/pages/legal/refund/index' });
  },
});
