const api = require('../../../utils/api');
const { buildStampProgress } = require('../../../utils/stampProgress');

const { shareBehavior } = require('../../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    stampCount: 0,
    stampTarget: 5,
    progressPercent: 0,
    stampLogs: [],
    stampRules: [],
    loading: true,
  },
  onShow() {
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const [memberRes, rules] = await Promise.all([
        api.ensureMember({}),
        api.getStampRules(),
      ]);

      const member =
        memberRes && memberRes.ok && memberRes.member ? memberRes.member : null;
      const progress = buildStampProgress(member);

      this.setData({
        ...progress,
        stampLogs: Array.isArray(member && member.stampLogs) ? member.stampLogs : [],
        stampRules: Array.isArray(rules) && rules.length ? rules : [],
      });
    } catch (error) {
      console.warn('[stamps] load failed', error);
      this.setData({
        ...buildStampProgress(null),
        stampLogs: [],
      });
      wx.showToast({ title: '集章加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
