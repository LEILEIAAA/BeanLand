const api = require('../../../utils/api');

function formatDay(ts) {
  if (!ts) return '长期';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mapOrder(item) {
  const id = item._id || item.id;
  const name = item.displayName || item.packageName || (item.packageSnapshot && item.packageSnapshot.name) || '套餐';
  const pay = item.payAmountYuan != null
    ? Number(item.payAmountYuan)
    : Number(item.payAmountFen || 0) / 100;
  const leftMs = Number(item.expiresAt || 0) - Date.now();
  const leftDays = item.expiresAt ? Math.ceil(leftMs / (24 * 60 * 60 * 1000)) : null;
  const meta = leftDays == null
    ? `历史单 · 可核销`
    : `剩余 ${Math.max(leftDays, 0)} 天 · 至 ${formatDay(item.expiresAt)}`;
  return {
    id,
    name,
    meta,
    payText: pay.toFixed(2),
  };
}

Page({
  data: {
    phone: '',
    members: [],
    selectedId: '',
    selectedLabel: '',
    orders: [],
    loadingOrders: false,
    redeemingId: '',
  },
  onPhoneInput(event) {
    this.setData({ phone: event.detail.value });
  },
  async onSearch() {
    const phone = String(this.data.phone || '').trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    try {
      const result = await api.adminFindMember({ phone });
      const members = (result && result.ok && result.list) || [];
      if (!members.length) {
        this.setData({ members: [], selectedId: '', selectedLabel: '', orders: [] });
        wx.showToast({ title: '未找到会员', icon: 'none' });
        return;
      }
      const first = members[0];
      this.setData({
        members,
        selectedId: first._id,
        selectedLabel: `${first.nickName || '未命名'} · ${first.phone}`,
      });
      await this.loadOrders(first._id);
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '查找失败', icon: 'none' });
    }
  },
  async onPickMember(event) {
    const id = event.currentTarget.dataset.id;
    const member = this.data.members.find((item) => item._id === id);
    if (!member) return;
    this.setData({
      selectedId: member._id,
      selectedLabel: `${member.nickName || '未命名'} · ${member.phone}`,
    });
    await this.loadOrders(member._id);
  },
  async loadOrders(memberId) {
    this.setData({ loadingOrders: true });
    try {
      const result = await api.adminListMemberPackages({ memberId });
      const list = result && result.ok && Array.isArray(result.list) ? result.list : [];
      this.setData({ orders: list.map(mapOrder), loadingOrders: false });
    } catch (error) {
      console.warn('[admin-packages] load', error);
      this.setData({ orders: [], loadingOrders: false });
    }
  },
  onRedeem(event) {
    const { id, name } = event.currentTarget.dataset;
    if (!id || this.data.redeemingId) return;
    wx.showModal({
      title: '核销并开台',
      content: `确认核销「${name || '套餐'}」并进入开台？`,
      success: async (modal) => {
        if (!modal.confirm) return;
        this.setData({ redeemingId: id });
        try {
          const result = await api.adminRedeemPackage({ orderId: id });
          if (!result || !result.ok) {
            throw new Error((result && result.message) || '核销失败');
          }
          const member = this.data.members.find((item) => item._id === this.data.selectedId);
          const label = encodeURIComponent(this.data.selectedLabel || '会员');
          wx.navigateTo({
            url:
              `/pages/admin/timer/index` +
              `?memberId=${encodeURIComponent(this.data.selectedId || '')}` +
              `&memberLabel=${label}` +
              `&packageOrderId=${encodeURIComponent(id)}` +
              (member && member.phone ? `&phone=${encodeURIComponent(member.phone)}` : ''),
          });
          await this.loadOrders(this.data.selectedId);
        } catch (error) {
          wx.showToast({ title: (error && error.message) || '核销失败', icon: 'none' });
        } finally {
          this.setData({ redeemingId: '' });
        }
      },
    });
  },
});
