const { hydrateAppProfile } = require('./utils/wxProfile');
const { initCloud } = require('./utils/cloud');

App({
  globalData: {
    storeName: 'Bean Land',
    theme: 'warm-creative',
    cloudReady: false,
    userProfile: {
      avatarUrl: '',
      nickName: '',
    },
  },
  onLaunch() {
    this.globalData.cloudReady = initCloud();
    hydrateAppProfile(this);
  },
});
