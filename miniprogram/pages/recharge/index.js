const api = require('../../utils/api');
const { formatYuan } = require('../../utils/money');
const { DEFAULT_AVATAR } = require('../../utils/wxProfile');
const {
  needsMemberRegister,
  openMemberRegister,
} = require('../../utils/memberRegisterGate');

function decoratePlans(plans) {
  return (plans || []).map((item) => {
    const rechargeAmount = Number(item.rechargeAmount || 0);
    const bonusAmount = Number(item.bonusAmount || 0);
    const arrival =
      item.arrivalAmount != null && item.arrivalAmount !== ''
        ? Number(item.arrivalAmount)
        : rechargeAmount + bonusAmount;
    return {
      ...item,
      rechargeAmount,
      bonusAmount,
      rechargeAmountText: formatYuan(rechargeAmount),
      arrivalAmountText: formatYuan(arrival),
    };
  });
}

const { shareBehavior } = require('../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    rechargePlans: [],
    selectedPlanId: '',
    previewPay: '',
    previewBonus: '',
    previewArrival: '',
    canConfirm: false,
    confirmLabel: '请选择充值档位',
    paying: false,
  },
  onShow() {
    this.guardPhone().then((ok) => {
      if (ok) this.loadPlans();
    });
  },
  async guardPhone() {
    try {
      const result = await api.ensureMember({});
      const member = result && result.ok ? result.member : null;
      if (member && !needsMemberRegister(member, DEFAULT_AVATAR)) {
        return true;
      }
    } catch (error) {
      console.warn('[recharge] guard phone', error);
    }

    wx.showModal({
      title: '先完善会员资料',
      content: '充值前请先完成会员注册（头像、昵称、手机号）。',
      confirmText: '去注册',
      showCancel: false,
      success: () => {
        openMemberRegister();
      },
    });
    return false;
  },
  async loadPlans() {
    try {
      const plans = await api.getRechargePlans();
      if (plans && plans.length) {
        this.setData({ rechargePlans: decoratePlans(plans) });
        this.refreshPreview();
      }
    } catch (error) {
      console.warn('[recharge] load plans failed', error);
    }
  },
  selectPlan(event) {
    if (this.data.paying) return;
    const { id } = event.currentTarget.dataset;
    this.setData({ selectedPlanId: id }, () => this.refreshPreview());
  },
  refreshPreview() {
    const { selectedPlanId, rechargePlans, paying } = this.data;
    const idleLabel = '请选择充值档位';

    const plan = rechargePlans.find(
      (item) => item.id === selectedPlanId || item._id === selectedPlanId
    );
    if (!plan) {
      this.setData({
        previewPay: '',
        previewBonus: '',
        previewArrival: '',
        canConfirm: false,
        confirmLabel: paying ? '支付中…' : idleLabel,
      });
      return;
    }

    const pay = Number(plan.rechargeAmount || 0);
    const bonus = Number(plan.bonusAmount || 0);
    const canConfirm = pay > 0;
    this.setData({
      previewPay: formatYuan(pay),
      previewBonus: formatYuan(bonus),
      previewArrival: formatYuan(pay + bonus),
      canConfirm,
      confirmLabel: paying ? '支付中…' : canConfirm ? `确认充值 ¥${formatYuan(pay)}` : idleLabel,
    });
  },
  async confirmPay() {
    if (this.data.paying || !this.data.canConfirm) return;

    const { selectedPlanId, rechargePlans } = this.data;
    const plan = rechargePlans.find(
      (item) => item.id === selectedPlanId || item._id === selectedPlanId
    );
    if (!plan) return;

    const payload = { planId: plan.id || plan._id };

    this.setData({ paying: true, confirmLabel: '支付中…' });
    wx.showLoading({ title: '下单中', mask: true });

    try {
      const order = await api.createRechargeOrder(payload);
      wx.hideLoading();

      if (!order || !order.ok || !order.payment) {
        wx.showToast({
          title: (order && order.message) || '下单失败',
          icon: 'none',
        });
        return;
      }

      const payment = order.payment;
      await new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: payment.timeStamp,
          nonceStr: payment.nonceStr,
          package: payment.package,
          signType: payment.signType || 'MD5',
          paySign: payment.paySign,
          success: resolve,
          fail: reject,
        });
      });

      await this.waitCredited(order.orderId);
      wx.showToast({ title: '充值成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/member/index' }) });
      }, 500);
    } catch (error) {
      wx.hideLoading();
      const msg = (error && error.errMsg) || '';
      if (msg.includes('cancel')) {
        wx.showToast({ title: '已取消支付', icon: 'none' });
      } else {
        console.warn('[recharge] pay failed', error);
        wx.showToast({ title: '支付未完成', icon: 'none' });
      }
    } finally {
      this.setData({ paying: false }, () => this.refreshPreview());
    }
  },
  async waitCredited(orderId) {
    for (let i = 0; i < 8; i += 1) {
      try {
        const res = await api.getRechargeOrder({ orderId });
        if (res && res.ok && res.order && res.order.status === 'credited') {
          return true;
        }
      } catch (error) {
        // keep polling
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  },
});
