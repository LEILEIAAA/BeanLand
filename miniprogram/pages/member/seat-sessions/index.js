const api = require('../../../utils/api');
const { mapMemberSessionRow } = require('../../../utils/seatSessionHistory');

const { shareBehavior } = require('../../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    loading: true,
    sessions: [],
    emptyTip: '',
  },
  onShow() {
    this.load();
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },
  async load() {
    this.setData({ loading: true, emptyTip: '' });
    try {
      const res = await api.listMySeatSessions({ limit: 50 });
      if (!res || !res.ok) {
        this.setData({ sessions: [], emptyTip: (res && res.message) || '加载失败' });
        return;
      }
      const sessions = (res.list || []).map((row) => mapMemberSessionRow(row));
      this.setData({
        sessions,
        emptyTip: sessions.length ? '' : '还没有到店记录，开台体验后会出现在这里',
      });
    } catch (error) {
      console.warn('[member-seat-sessions] load failed', error);
      this.setData({ sessions: [], emptyTip: '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
