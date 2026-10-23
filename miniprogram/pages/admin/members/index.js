const api = require('../../../utils/api');
const { mapAdminMemberRow } = require('../../../utils/adminMemberDisplay');
const {
  ADMIN_MEMBER_SEARCH_DEBOUNCE_MS,
  shouldRemoteSearchMember,
} = require('../../../utils/adminMemberSearch');

Page({
  data: {
    keyword: '',
    list: [],
    loading: true,
  },
  onShow() {
    this.loadList();
  },
  onUnload() {
    this.clearSearchTimer();
  },
  clearSearchTimer() {
    if (this._memberSearchTimer) {
      clearTimeout(this._memberSearchTimer);
      this._memberSearchTimer = null;
    }
  },
  onKeywordInput(event) {
    const keyword = (event.detail && event.detail.value) || '';
    this.setData({ keyword });
    this.clearSearchTimer();
    const text = String(keyword || '').trim();
    if (!text) {
      this._memberSearchSeq = (this._memberSearchSeq || 0) + 1;
      this.loadList();
      return;
    }
    if (!shouldRemoteSearchMember(text)) {
      this._memberSearchSeq = (this._memberSearchSeq || 0) + 1;
      return;
    }
    this._memberSearchTimer = setTimeout(() => {
      this.loadList();
    }, ADMIN_MEMBER_SEARCH_DEBOUNCE_MS);
  },
  onSearch() {
    this.clearSearchTimer();
    const text = String(this.data.keyword || '').trim();
    if (text && !shouldRemoteSearchMember(text)) {
      wx.showToast({ title: '请至少输入4位手机号', icon: 'none' });
      return;
    }
    this.loadList();
  },
  async loadList() {
    const seq = (this._memberSearchSeq = (this._memberSearchSeq || 0) + 1);
    const keyword = String(this.data.keyword || '').trim();
    this.setData({ loading: true });
    try {
      const res = await api.adminListMembers({
        keyword,
        limit: 50,
      });
      if (seq !== this._memberSearchSeq) return;
      if (!res || !res.ok) {
        wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' });
        this.setData({ list: [] });
        return;
      }
      this.setData({
        list: (res.list || []).map(mapAdminMemberRow),
      });
    } catch (error) {
      if (seq !== this._memberSearchSeq) return;
      console.warn('[admin-members]', error);
      this.setData({ list: [] });
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      if (seq === this._memberSearchSeq) {
        this.setData({ loading: false });
      }
    }
  },
  goDetail(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/admin/members/detail?id=${encodeURIComponent(id)}`,
    });
  },
});
