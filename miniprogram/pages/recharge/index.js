const { rechargePlans } = require('../../data/seed');

Page({
  data: { rechargePlans },
  choose(event) {
    const { id } = event.currentTarget.dataset;
    const plan = this.data.rechargePlans.find((item) => item.id === id);
    wx.showModal({
      title: '到店充值确认',
      content: `选择 ${plan.rechargeAmount} 元档，到店后由店主录入，到账 ${plan.arrivalAmount} 元。`,
      showCancel: false,
    });
  },
});
