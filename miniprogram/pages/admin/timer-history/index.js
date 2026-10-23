const api = require('../../../utils/api');
const { mapAdminSessionRow } = require('../../../utils/seatSessionHistory');

Page({
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
      const res = await api.adminListSeatSessions({ limit: 80 });
      if (!res || !res.ok) {
        this.setData({ sessions: [], emptyTip: (res && res.message) || '加载失败' });
        return;
      }
      const sessions = (res.list || []).map(mapAdminSessionRow);
      this.setData({
        sessions,
        emptyTip: sessions.length ? '' : '还没有结束的计时记录',
      });
    } catch (error) {
      console.warn('[timer-history] load failed', error);
      this.setData({ sessions: [], emptyTip: '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
