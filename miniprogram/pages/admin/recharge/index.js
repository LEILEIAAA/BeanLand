const api = require('../../../utils/api');
const {
  ADMIN_MEMBER_SEARCH_DEBOUNCE_MS,
  shouldRemoteSearchMember,
} = require('../../../utils/adminMemberSearch');
const { formatYuan } = require('../../../utils/money');

function decorateSearchMembers(list) {
  return (list || []).map((item) => ({
    ...item,
    totalBalanceText: formatYuan(item.totalBalance),
    totalRechargeText: formatYuan(item.totalRecharge),
  }));
}

Page({
  data: {
    phone: '',
    members: [],
    selectedId: '',
    selectedLabel: '',
    plans: [],
    planIndex: 0,
    rechargeAmount: '',
    bonusAmount: '',
    submitting: false,
  },
  onShow() {
    this.loadPlans();
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
  async loadPlans() {
    try {
      const plans = await api.getRechargePlans();
      this.setData({
        plans: plans || [],
        planIndex: 0,
        rechargeAmount: plans[0] ? String(plans[0].rechargeAmount) : '',
        bonusAmount: plans[0] ? String(plans[0].bonusAmount) : '',
      });
    } catch (error) {
      console.warn('[admin-recharge] plans', error);
    }
  },
  onPhoneInput(event) {
    const phone = event.detail.value;
    this.setData({ phone });
    this.clearSearchTimer();
    const text = String(phone || '').trim();
    if (!text) {
      this._memberSearchSeq = (this._memberSearchSeq || 0) + 1;
      this.setData({ members: [], selectedId: '', selectedLabel: '' });
      return;
    }
    if (!shouldRemoteSearchMember(text)) {
      this._memberSearchSeq = (this._memberSearchSeq || 0) + 1;
      return;
    }
    this._memberSearchTimer = setTimeout(() => {
      this.searchMembers({ silentEmpty: true });
    }, ADMIN_MEMBER_SEARCH_DEBOUNCE_MS);
  },
  onSearch() {
    this.clearSearchTimer();
    this.searchMembers({ silentEmpty: false });
  },
  async searchMembers({ silentEmpty }) {
    const phone = String(this.data.phone || '').trim();
    if (!phone) {
      if (!silentEmpty) {
        wx.showToast({ title: '请输入手机号或尾号', icon: 'none' });
      }
      return;
    }
    if (!shouldRemoteSearchMember(phone)) {
      if (!silentEmpty) {
        wx.showToast({ title: '请至少输入4位手机号', icon: 'none' });
      }
      return;
    }
    const seq = (this._memberSearchSeq = (this._memberSearchSeq || 0) + 1);
    try {
      const result = await api.adminFindMember({ phone });
      if (seq !== this._memberSearchSeq) return;
      if (!result || !result.ok) {
        wx.showToast({
          title: (result && result.message) || '查询失败',
          icon: 'none',
        });
        return;
      }
      const list = result.list || [];
      if (!list.length) {
        if (!silentEmpty) {
          wx.showToast({ title: '未找到会员', icon: 'none' });
        }
        this.setData({ members: [], selectedId: '', selectedLabel: '' });
        return;
      }
      const first = list[0];
      this.setData({
        members: decorateSearchMembers(list),
        selectedId: first._id,
        selectedLabel: `${first.nickName || '未命名'} · ${first.phone || phone} · ${first.tier || 'member'}`,
      });
    } catch (error) {
      if (seq !== this._memberSearchSeq) return;
      wx.showToast({ title: '查询失败（需店长权限）', icon: 'none' });
    }
  },
  onPickMember(event) {
    const { id } = event.currentTarget.dataset;
    const member = this.data.members.find((item) => item._id === id);
    if (!member) return;
    this.setData({
      selectedId: member._id,
      selectedLabel: `${member.nickName || '未命名'} · ${member.phone || ''} · ${member.tier || 'member'}`,
    });
  },
  onPlanChange(event) {
    const planIndex = Number(event.detail.value);
    const plan = this.data.plans[planIndex];
    this.setData({
      planIndex,
      rechargeAmount: plan ? String(plan.rechargeAmount) : '',
      bonusAmount: plan ? String(plan.bonusAmount) : '',
    });
  },
  onRechargeInput(event) {
    this.setData({ rechargeAmount: event.detail.value });
  },
  onBonusInput(event) {
    this.setData({ bonusAmount: event.detail.value });
  },
  async onSubmit() {
    if (this.data.submitting) return;
    const memberId = this.data.selectedId;
    const rechargeAmount = Number(this.data.rechargeAmount);
    const bonusAmount = Number(this.data.bonusAmount || 0);
    if (!memberId) {
      wx.showToast({ title: '请先查找并选择会员', icon: 'none' });
      return;
    }
    if (!(rechargeAmount > 0)) {
      wx.showToast({ title: '本金金额无效', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const plan = this.data.plans[this.data.planIndex];
      const result = await api.adminRecharge({
        memberId,
        planId: plan ? plan.id : '',
        rechargeAmount,
        bonusAmount,
        title: `充 ${rechargeAmount} 送 ${bonusAmount}`,
      });
      if (!result || !result.ok) {
        wx.showToast({
          title: (result && result.message) || '入账失败',
          icon: 'none',
        });
        return;
      }
      wx.showModal({
        title: '入账成功',
        content: `余额 ¥${formatYuan(result.member.totalBalance)}，等级 ${result.tier}`,
        showCancel: false,
      });
    } catch (error) {
      wx.showToast({ title: '入账失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
