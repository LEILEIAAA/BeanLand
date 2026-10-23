const api = require('../../utils/api');
const { DEFAULT_AVATAR } = require('../../utils/wxProfile');
const {
  needsMemberRegister,
  openMemberRegister,
} = require('../../utils/memberRegisterGate');
const { syncTabBar, setTabBarHidden } = require('../../utils/tabBar');
const { formatYuan } = require('../../utils/money');
const {
  listApplicableCoupons,
  pickBestCoupon,
  calcPackageQuote,
  resolveCouponOffAmount,
  resolvePackageForSale,
  isOpeningCouponBlocked,
  PAY_METHOD,
} = require('../../utils/packagePurchase');

const EMPTY_PROMO = {
  active: false,
  discountRate: 0,
  label: '',
  tip: '',
};

function decorateQuote(quote) {
  if (!quote) return null;
  return {
    ...quote,
    listPriceText: formatYuan(quote.listPrice),
    couponAmountText: formatYuan(quote.couponAmount),
    payAmountText: formatYuan(quote.payAmount),
  };
}

function resolvePromoTip(promo) {
  if (!promo) return '';
  const tip = String(promo.tip || '').trim();
  const rate = Number(promo.discountRate);
  if ((!tip || /^全场[\d.]+折$/.test(tip)) && rate > 0 && rate < 10) {
    return `全场${formatYuan(rate)}折`;
  }
  return tip;
}

function buildPromoBanner(promo) {
  if (!promo || !promo.active) return '';
  const tip = resolvePromoTip(promo);
  return `${promo.label || '开业特惠'}${tip ? ` · ${tip}` : ''}`;
}

const { sortPackages } = require('../../utils/packageSort');

function decoratePackages(list, promo) {
  return sortPackages(list).map((item, index) => {
    const sale = resolvePackageForSale(item, promo);
    const weekendPrice = Number(item.weekendPrice || item.price || 0);
    const weekdayPrice = Number(item.weekdayPrice || item.price || 0);
    const durationLabel = Number(item.durationMinutes) > 0
      ? `${item.durationMinutes} 分钟`
      : (item.overtimeRule || '当日不限时');
    const isTodayWeekend = sale.dayType === 'weekend';
    const ribbonText = item.badge
      || (sale.promoActive ? `开业${formatYuan(sale.promoDiscountRate)}折` : '');
    // 有 badgeColor 配置则严格跟随；否则：自定义角标默认橙，开业自动角标默认黄。
    let ribbonTone = '';
    if (ribbonText) {
      if (item.badgeColor === 'yellow' || item.badgeColor === 'orange') {
        ribbonTone = item.badgeColor;
      } else {
        ribbonTone = item.badge ? 'orange' : 'yellow';
      }
    }
    return {
      ...sale,
      weekendPrice,
      weekdayPrice,
      weekendPriceText: formatYuan(weekendPrice),
      weekdayPriceText: formatYuan(weekdayPrice),
      salePriceText: formatYuan(sale.price),
      dayPriceText: formatYuan(sale.dayPrice),
      discountText: formatYuan(sale.promoDiscountRate),
      durationLabel,
      includeChips: Array.isArray(item.includedItems) ? item.includedItems : [],
      isTodayWeekend,
      dayTypeLabel: isTodayWeekend ? '周末' : '工作日',
      dropNo: String(index + 1).padStart(2, '0'),
      badge: ribbonText,
      ribbonTone,
      isRibbonYellow: ribbonTone === 'yellow',
      isRibbonOrange: ribbonTone === 'orange',
    };
  });
}

const { shareBehavior } = require('../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    packages: [],
    packageCount: 0,
    packagePromo: EMPTY_PROMO,
    promoBanner: '',
    dayHint: '',
    couponBlocked: false,
    couponBlockedTip: '',
    settleLabel: '结算价',
    dayMeta: '',
    paying: false,
    sheetOpen: false,
    selectedPackage: null,
    couponOptions: [],
    selectedCouponId: '',
    payMethod: PAY_METHOD.BALANCE,
    quote: null,
    balance: 0,
    balanceText: '0',
    memberCoupons: [],
  },
  onShow() {
    syncTabBar(this, 2);
    setTabBarHidden(this, !!this.data.sheetOpen);
    this.loadPackages();
  },
  async loadPackages() {
    let promo = EMPTY_PROMO;
    let rows = [];
    try {
      const res = await api.listPackagesWithPromo();
      if (res && res.ok) {
        if (Array.isArray(res.list)) rows = res.list;
        if (res.packagePromo) promo = res.packagePromo;
      }
    } catch (error) {
      console.warn('[packages] load failed', error);
    }
    const decorated = decoratePackages(rows, promo);
    const dayHint = decorated[0] && decorated[0].isTodayWeekend
      ? '今日周末价'
      : '今日工作日价';
    const promoBanner = buildPromoBanner(promo);
    this.setData({
      packages: decorated,
      packageCount: decorated.length,
      packagePromo: promo,
      promoBanner,
      dayHint,
    });
  },
  async guardPhone() {
    try {
      const result = await api.ensureMember({});
      const member = result && result.ok ? result.member : null;
      if (member && !needsMemberRegister(member, DEFAULT_AVATAR)) {
        return member;
      }
    } catch (error) {
      console.warn('[packages] guard phone', error);
    }
    openMemberRegister();
    return null;
  },
  async loadMemberCoupons() {
    try {
      const result = await api.listMyCoupons({ tab: 'unused' });
      if (result && result.ok && Array.isArray(result.list)) {
        return result.list;
      }
    } catch (error) {
      console.warn('[packages] listMyCoupons failed', error);
    }
    return [];
  },
  buildSheetState(pkg, member, coupons, couponId, payMethod) {
    const rawCoupons = Array.isArray(coupons) ? coupons : [];
    const promo = this.data.packagePromo || EMPTY_PROMO;
    const couponBlocked = isOpeningCouponBlocked(promo);
    const settleLabel = pkg && pkg.promoActive
      ? `结算打${formatYuan(pkg.promoDiscountRate)}折后`
      : '结算价';
    const dayMeta = pkg
      ? `${pkg.isTodayWeekend ? '周末价' : '工作日价'}${pkg.promoActive ? ` · 开业${formatYuan(pkg.promoDiscountRate)}折` : ''}`
      : '';

    if (couponBlocked) {
      const quote = calcPackageQuote(pkg, null);
      const balanceNum = Number((member && member.totalBalance) || 0);
      return {
        selectedPackage: pkg,
        memberCoupons: rawCoupons,
        couponOptions: [],
        selectedCouponId: '',
        couponBlocked: true,
        couponBlockedTip: '开业优惠期间不可使用优惠券',
        settleLabel,
        dayMeta,
        payMethod: payMethod || PAY_METHOD.BALANCE,
        quote: decorateQuote(quote),
        balance: balanceNum,
        balanceText: formatYuan(balanceNum),
        sheetOpen: true,
      };
    }

    const applicable = listApplicableCoupons(rawCoupons, pkg);
    const selectedId = couponId === undefined
      ? ((pickBestCoupon(rawCoupons, pkg) || {}).id || '')
      : couponId;
    const selectedCoupon = selectedId
      ? applicable.find((item) => String(item.id) === String(selectedId)) || null
      : null;
    const quote = calcPackageQuote(pkg, selectedCoupon);
    const listPrice = Number((pkg && pkg.price) || 0);
    const couponOptions = [
      {
        key: 'none',
        id: '',
        name: '不使用优惠券',
        amount: 0,
        amountText: '原价购买',
        selected: !selectedId,
        usable: true,
      },
      ...applicable.map((item) => {
        const off = resolveCouponOffAmount(listPrice, item);
        return {
          ...item,
          key: String(item.id),
          selected: String(item.id) === String(selectedId),
          usable: true,
          amount: off,
          amountText: off > 0 ? `-¥${formatYuan(off)}` : '',
        };
      }),
    ];

    const balanceNum = Number((member && member.totalBalance) || 0);
    return {
      selectedPackage: pkg,
      memberCoupons: rawCoupons,
      couponOptions,
      selectedCouponId: selectedId || '',
      couponBlocked: false,
      couponBlockedTip: '',
      settleLabel,
      dayMeta,
      payMethod: payMethod || PAY_METHOD.BALANCE,
      quote: decorateQuote(quote),
      balance: balanceNum,
      balanceText: formatYuan(balanceNum),
      sheetOpen: true,
    };
  },
  async buy(event) {
    if (this.data.paying) return;
    const { id } = event.currentTarget.dataset;
    const pkg = this.data.packages.find((item) => item.id === id || item._id === id);
    if (!pkg) return;

    const member = await this.guardPhone();
    if (!member) return;

    const coupons = await this.loadMemberCoupons();
    this.setData(this.buildSheetState(pkg, member, coupons));
    setTabBarHidden(this, true);
  },
  closeSheet() {
    if (this.data.paying) return;
    this.setData({ sheetOpen: false, selectedPackage: null, quote: null });
    setTabBarHidden(this, false);
  },
  noop() {},
  async refreshMember() {
    const result = await api.ensureMember({});
    return result && result.ok ? result.member : null;
  },
  async selectCoupon(event) {
    if (this.data.couponBlocked) return;
    const raw = event.currentTarget.dataset.id;
    const couponId = raw === 'none' || raw === undefined || raw === null ? '' : String(raw);
    const member = await this.refreshMember();
    if (!member || !this.data.selectedPackage) return;
    const coupons = await this.loadMemberCoupons();
    this.setData(
      this.buildSheetState(
        this.data.selectedPackage,
        member,
        coupons,
        couponId,
        this.data.payMethod,
      ),
    );
  },
  async selectPayMethod(event) {
    const method = event.currentTarget.dataset.method;
    const member = await this.refreshMember();
    if (!member || !this.data.selectedPackage) return;
    this.setData(
      this.buildSheetState(
        this.data.selectedPackage,
        member,
        this.data.memberCoupons,
        this.data.selectedCouponId,
        method,
      ),
    );
  },
  async confirmPay() {
    if (this.data.paying || !this.data.selectedPackage || !this.data.quote) return;

    const member = await this.guardPhone();
    if (!member) return;

    const pkg = this.data.selectedPackage;
    const quote = this.data.quote;
    const couponId = this.data.couponBlocked ? '' : (this.data.selectedCouponId || '');
    let payMethod = this.data.payMethod;

    if (!quote.needPayment) {
      payMethod = PAY_METHOD.BALANCE;
    }

    if (payMethod === PAY_METHOD.BALANCE && quote.needPayment && this.data.balance < quote.payAmount) {
      wx.showModal({
        title: '余额不足',
        content: `当前余额 ¥${formatYuan(this.data.balance)}，实付 ¥${formatYuan(quote.payAmount)}。请先充值或改用在线支付。`,
        confirmText: '去充值',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/recharge/index' });
          }
        },
      });
      return;
    }

    this.setData({ paying: true });
    wx.showLoading({ title: payMethod === PAY_METHOD.WECHAT ? '下单中' : '支付中', mask: true });

    try {
      if (payMethod === PAY_METHOD.WECHAT) {
        await this.payByWechat(pkg, couponId);
      } else {
        await this.payByBalance(pkg, couponId);
      }
      wx.hideLoading();
      this.setData({ sheetOpen: false, selectedPackage: null, quote: null });
      setTabBarHidden(this, false);
      wx.showToast({ title: '购买成功，可到「我的套餐」查看', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      const msg = (error && error.errMsg) || (error && error.message) || '';
      if (msg.includes('cancel')) {
        wx.showToast({ title: '已取消支付', icon: 'none' });
      } else if (error && error.code === 'INSUFFICIENT_BALANCE') {
        wx.showToast({ title: '余额不足', icon: 'none' });
      } else {
        console.warn('[packages] pay failed', error);
        wx.showToast({ title: (error && error.message) || '支付未完成', icon: 'none' });
      }
    } finally {
      this.setData({ paying: false });
    }
  },
  async payByBalance(pkg, couponId) {
    const order = await api.purchasePackage({
      packageId: pkg.id || pkg._id,
      couponId,
    });
    if (!order || !order.ok) {
      const err = new Error((order && order.message) || '余额支付失败');
      err.code = order && order.code;
      throw err;
    }
    return order;
  },
  async payByWechat(pkg, couponId) {
    const order = await api.createPackageOrder({
      packageId: pkg.id || pkg._id,
      couponId,
    });
    if (!order || !order.ok || !order.payment) {
      const err = new Error((order && order.message) || '下单失败');
      err.code = order && order.code;
      throw err;
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

    await this.waitFulfilled(order.orderId);
    return order;
  },
  async waitFulfilled(orderId) {
    for (let i = 0; i < 8; i += 1) {
      try {
        const res = await api.getPackageOrder({ orderId });
        if (res && res.ok && res.order && res.order.status === 'fulfilled') {
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
