const api = require('../../../utils/api');
const {
  isValidPhone,
  maskPhone,
  hasChosenAvatar,
  isRegistrationComplete,
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

Page({
  data: {
    avatarUrl: DEFAULT_AVATAR,
    nickName: '',
    phone: '',
    phoneMasked: '',
    hasAvatar: false,
    hasNickName: false,
    hasPhone: false,
    doneCount: 0,
    registrationComplete: false,
    phoneBusy: false,
    finishing: false,
  },
  onShow() {
    this.bootstrap();
  },
  async bootstrap() {
    const profile = ensureDefaultProfile();
    let localPhone = '';
    try {
      localPhone = wx.getStorageSync('beanMemberPhone') || '';
    } catch (error) {
      localPhone = '';
    }

    this.setData({
      avatarUrl: displayAvatar(profile),
      nickName: profile.nickName || '',
    });
    this.refreshFlags();

    try {
      const payload = {
        nickName: profile.nickName || '',
        avatarUrl: profile.avatarUrl || '',
      };
      if (isValidPhone(localPhone)) {
        payload.phone = normalizePhone(localPhone);
      }
      const result = await api.ensureMember(payload);
      if (result && result.ok && result.member) {
        this.applyState(result.member, profile);
        if (isValidPhone(result.member.phone)) {
          try {
            wx.setStorageSync('beanMemberPhone', normalizePhone(result.member.phone));
          } catch (storageError) {
            // ignore
          }
        }
      } else {
        this.refreshFlags();
      }
    } catch (error) {
      console.warn('[register] bootstrap', error);
      this.refreshFlags();
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
    });
    this.refreshFlags();
  },
  refreshFlags() {
    const hasAvatar = hasChosenAvatar(this.data.avatarUrl, DEFAULT_AVATAR);
    const hasNickName = !!String(this.data.nickName || '').trim();
    const hasPhone = isValidPhone(this.data.phone);
    const registrationComplete = isRegistrationComplete(
      {
        avatarUrl: this.data.avatarUrl,
        nickName: this.data.nickName,
        phone: this.data.phone,
      },
      DEFAULT_AVATAR,
    );
    const doneCount = [hasAvatar, hasNickName, hasPhone].filter(Boolean).length;
    this.setData({
      hasAvatar,
      hasNickName,
      hasPhone,
      doneCount,
      registrationComplete,
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
  finishAndBack(title) {
    if (this.data.finishing) return Promise.resolve();
    this.setData({ finishing: true });
    if (title) {
      wx.showToast({ title, icon: 'success', duration: 800 });
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        wx.navigateBack({
          fail: () => {
            wx.switchTab({ url: '/pages/member/index' });
          },
          complete: () => {
            this.setData({ finishing: false });
            resolve();
          },
        });
      }, title ? 700 : 0);
    });
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
        } else {
          this.refreshFlags();
        }
      } catch (error) {
        this.refreshFlags();
      }
      wx.showToast({ title: '头像已保存', icon: 'success' });
    };

    fs.saveFile({
      tempFilePath: tempPath,
      success: (res) => {
        saveAndSync(res.savedFilePath);
      },
      fail: () => {
        saveAndSync(tempPath);
      },
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
      } else {
        this.refreshFlags();
      }
    } catch (error) {
      this.refreshFlags();
    }
    wx.showToast({ title: '昵称已保存', icon: 'success' });
  },
  async onGetPhoneNumber(event) {
    if (this.data.phoneBusy) return;
    const detail = event.detail || {};
    console.info('[register] getPhoneNumber detail', detail);

    if (detail.errMsg && detail.errMsg !== 'getPhoneNumber:ok') {
      const tip = phoneAuthFailMessage(detail.errMsg);
      wx.showToast({ title: tip || '授权未成功，请重试', icon: 'none', duration: 2500 });
      return;
    }
    if (!detail.code) {
      // 开发者工具里经常 ok 但没有 code，或旧基础库
      wx.showToast({
        title: '未拿到code，请用真机授权',
        icon: 'none',
        duration: 2500,
      });
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
        console.warn('[register] ensureMember phone after wechat', result);
        wx.showToast({ title: String(reason).slice(0, 18) || '入库失败，请重试', icon: 'none' });
        return;
      }
      this.applyState(result.member);
      try {
        wx.setStorageSync('beanMemberPhone', normalizePhone(result.member.phone));
      } catch (storageError) {
        // ignore
      }
      wx.showToast({ title: '手机号已授权', icon: 'success' });
    } catch (error) {
      console.warn('[register] phone auth', error);
      wx.showToast({ title: '授权入库失败，请重试', icon: 'none' });
    } finally {
      this.setData({ phoneBusy: false });
    }
  },
  onFinish() {
    if (!this.data.registrationComplete) {
      wx.showToast({ title: '请完成头像、昵称、手机号', icon: 'none' });
      return;
    }
    this.finishAndBack('注册完成');
  },
});
