Component({
  data: {
    visible: false,
  },
  lifetimes: {
    attached() {
      if (typeof wx.onNeedPrivacyAuthorization !== 'function') {
        return;
      }
      this._privacyHandler = (resolve) => {
        this._resolve = resolve;
        this.setData({ visible: true });
      };
      wx.onNeedPrivacyAuthorization(this._privacyHandler);
    },
    detached() {
      if (
        typeof wx.offNeedPrivacyAuthorization === 'function'
        && this._privacyHandler
      ) {
        wx.offNeedPrivacyAuthorization(this._privacyHandler);
      }
      this._privacyHandler = null;
      this._resolve = null;
    },
  },
  methods: {
    onAgree() {
      if (this._resolve) {
        this._resolve({ event: 'agree', buttonId: 'pp-agree-btn' });
        this._resolve = null;
      }
      this.setData({ visible: false });
    },
    onDisagree() {
      if (this._resolve) {
        this._resolve({ event: 'disagree' });
        this._resolve = null;
      }
      this.setData({ visible: false });
    },
    openContract() {
      if (typeof wx.openPrivacyContract === 'function') {
        wx.openPrivacyContract({});
      }
    },
    noop() {},
  },
});
