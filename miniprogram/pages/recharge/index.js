const api = require('../../utils/api');
const seed = require('../../data/seed');
const { canRecharge } = require('../../utils/memberProfile');

Page({
  data: {
    rechargePlans: seed.rechargePlans,
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
      if (canRecharge(member)) {
        return true;
      }
    } catch (error) {
      console.warn('[recharge] guard phone', error);
    }

    wx.showModal({
      title: '先完善会员资料',
      content: '充值需要手机号，请先点头像完成注册（头像、昵称、手机号）。',
      confirmText: '去注册',
      showCancel: false,
      success: () => {
        wx.navigateTo({ url: '/pages/member/register/index' });
      },
    });
    return false;
  },
  async loadPlans() {
    try {
      const plans = await api.getRechargePlans();
      if (plans && plans.length) {
        this.setData({ rechargePlans: plans });
      }
    } catch (error) {
      console.warn('[recharge] load plans failed', error);
    }
  },
  async choose(event) {
    if (this.data.paying) return;
    const { id } = event.currentTarget.dataset;
    const plan = this.data.rechargePlans.find((item) => item.id === id || item._id === id);
    if (!plan) return;

    const planId = plan.id || plan._id;
    this.setData({ paying: true });
    wx.showLoading({ title: '下单中', mask: true });

    try {
      const order = await api.createRechargeOrder({ planId });
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
      this.setData({ paying: false });
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
