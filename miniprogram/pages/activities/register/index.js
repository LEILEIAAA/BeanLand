const api = require('../../../utils/api');
const { DEFAULT_AVATAR } = require('../../../utils/wxProfile');
const {
  needsMemberRegister,
  openMemberRegister,
} = require('../../../utils/memberRegisterGate');
const { buildActivityDetailView } = require('../../../utils/activityDetail');
const { formatYuan } = require('../../../utils/money');
const {
  PAY_CHANNEL,
  canRegisterActivity,
  STATUS,
  STATUS_LABEL,
  listApplicableCoupons,
  pickBestCoupon,
  calcActivityQuote,
  resolveCouponOffAmount,
  assertUserCancelAllowed,
  calcCancelRefund,
  buildCancelConfirmContent,
} = require('../../../utils/activityRegistration');

function decorateQuote(quote) {
  if (!quote) return null;
  return {
    ...quote,
    listPriceText: formatYuan(quote.listPrice),
    couponAmountText: formatYuan(quote.couponAmount),
    payAmountText: formatYuan(quote.payAmount),
  };
}

const ACTIVITY_LOOK = {
  mayday: { accent: '#FFB80A', enLabel: 'LIVE', ink: '#18181b' },
  'squid-game': { accent: '#FF3D02', enLabel: 'GAME', ink: '#ffffff' },
  'craft-meetup': { accent: '#69D868', enLabel: 'MEET', ink: '#18181b' },
  birthday: { accent: '#FF3D02', enLabel: 'VIP', ink: '#ffffff' },
};

const DEFAULT_LOOK = { accent: '#FFB80A', enLabel: 'DROP', ink: '#18181b' };

// 角标配色预设，与云函数 ACCENT_THEMES 对齐；后台可切换。
const ACCENT_THEMES = {
  yellow: { accent: '#FFB80A', ink: '#18181b' },
  orange: { accent: '#FF3D02', ink: '#ffffff' },
  green: { accent: '#69D868', ink: '#18181b' },
};

const { shareBehavior } = require('../../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    activityId: '',
    activity: null,
    loading: true,
    detail: {
      empty: true,
      highlights: [],
      audience: '',
      content: '',
      includes: [],
      notice: '',
    },
    look: DEFAULT_LOOK,
    statusLabel: '',
    seatLabel: '',
    canRegister: false,
    consulting: false,
    myRegistration: null,
    balance: 0,
    balanceText: '0',
    payChannel: PAY_CHANNEL.BALANCE,
    paying: false,
    cancelling: false,
    couponOptions: [],
    selectedCouponId: '',
    memberCoupons: [],
    quote: null,
  },
  onLoad(query) {
    const activityId = (query && query.activityId) || '';
    this.setData({ activityId });
  },
  onShow() {
    this.bootstrap();
  },
  applySeatSnapshot(snapshot) {
    if (!snapshot || snapshot.registeredCount == null || !this.data.activity) return;
    const capacity = Number(
      snapshot.capacity != null ? snapshot.capacity : this.data.activity.capacity || 0,
    );
    const registeredCount = Number(snapshot.registeredCount || 0);
    const activityStatus = snapshot.activityStatus || this.data.activity.status;
    const activity = {
      ...this.data.activity,
      registeredCount,
      capacity,
      status: activityStatus || this.data.activity.status,
    };
    const statusLabel =
      activity.status === 'recruiting'
        ? '招募中'
        : activity.status === 'full'
          ? '已满员'
          : activity.status === 'consulting'
            ? '咨询中'
            : STATUS_LABEL[activity.status] || activity.status;
    this.setData({
      activity,
      seatLabel: `${registeredCount}/${capacity}`,
      statusLabel,
    });
  },
  async loadMemberCoupons() {
    try {
      const result = await api.listMyCoupons({ tab: 'unused' });
      if (result && result.ok && Array.isArray(result.list)) {
        return result.list;
      }
    } catch (error) {
      console.warn('[activity-register] listMyCoupons failed', error);
    }
    return [];
  },
  buildCouponState(activity, coupons, couponId, payChannel, balance) {
    const rawCoupons = Array.isArray(coupons) ? coupons : [];
    const applicable = listApplicableCoupons(rawCoupons, activity);
    const selectedId = couponId === undefined
      ? ((pickBestCoupon(rawCoupons, activity) || {}).id || '')
      : couponId;
    const selectedCoupon = selectedId
      ? applicable.find((item) => String(item.id) === String(selectedId)) || null
      : null;
    const quote = calcActivityQuote(activity, selectedCoupon);
    const listPrice = Number((activity && activity.price) || 0);
    const couponOptions = [
      {
        key: 'none',
        id: '',
        name: '不使用优惠券',
        amount: 0,
        amountText: '原价报名',
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

    const balanceNum = Number(balance || 0);
    return {
      memberCoupons: rawCoupons,
      couponOptions,
      selectedCouponId: selectedId || '',
      payChannel: payChannel || PAY_CHANNEL.BALANCE,
      quote: decorateQuote(quote),
      balance: balanceNum,
      balanceText: formatYuan(balanceNum),
    };
  },
  async bootstrap() {
    const activityId = this.data.activityId;
    if (!activityId) {
      this.setData({ loading: false, activity: null });
      return;
    }

    this.setData({ loading: true });

    let activity = null;
    try {
      const rows = await api.getActivities();
      const found = (rows || []).find((item) => (item.id || item._id) === activityId);
      if (found) {
        activity = {
          ...found,
          id: found.id || found._id,
          priceText: formatYuan(found.price),
        };
      }
    } catch (error) {
      console.warn('[activity-register] load activity', error);
    }

    if (!activity) {
      this.setData({ loading: false, activity: null });
      wx.showToast({ title: '活动不存在', icon: 'none' });
      return;
    }

    const detail = buildActivityDetailView(activity);
    const baseLook = ACTIVITY_LOOK[activity.id] || DEFAULT_LOOK;
    const theme = ACCENT_THEMES[activity.accentTheme];
    const look = theme ? { ...baseLook, accent: theme.accent, ink: theme.ink } : baseLook;
    const registeredCount = Number(activity.registeredCount || 0);
    const capacity = Number(activity.capacity || 0);
    const consulting = activity.status === 'consulting';
    const canRegister = canRegisterActivity(activity) && !consulting;
    const statusLabel =
      activity.status === 'recruiting'
        ? '招募中'
        : activity.status === 'full'
          ? '已满员'
          : activity.status === 'consulting'
            ? '咨询中'
            : STATUS_LABEL[activity.status] || activity.status;

    let myRegistration = null;
    let balance = 0;
    let coupons = [];
    try {
      const memberRes = await api.ensureMember({});
      const member = memberRes && memberRes.ok ? memberRes.member : null;
      balance = Number((member && member.totalBalance) || 0);
      const listRes = await api.listMyActivityRegistrations();
      const list = (listRes && listRes.list) || [];
      myRegistration =
        list.find(
          (row) =>
            String(row.activityId) === String(activityId) &&
            (row.status === STATUS.PAID || row.status === STATUS.REFUND_PENDING),
        ) || null;
      if (myRegistration) {
        myRegistration = {
          ...myRegistration,
          statusLabel: STATUS_LABEL[myRegistration.status] || myRegistration.status,
        };
      }
      if (canRegister && !myRegistration) {
        coupons = await this.loadMemberCoupons();
      }
    } catch (error) {
      console.warn('[activity-register] load mine', error);
    }

    const couponState =
      canRegister && !myRegistration
        ? this.buildCouponState(activity, coupons, undefined, this.data.payChannel, balance)
        : {
            memberCoupons: [],
            couponOptions: [],
            selectedCouponId: '',
            quote: calcActivityQuote(activity, null),
            balance,
          };

    this.setData({
      activity,
      detail,
      look,
      statusLabel,
      seatLabel: `${registeredCount}/${capacity}`,
      canRegister: canRegister && !myRegistration,
      consulting,
      myRegistration,
      loading: false,
      ...couponState,
    });
  },
  selectPay(event) {
    const channel = event.currentTarget.dataset.channel;
    if (!channel || !this.data.activity) return;
    this.setData(
      this.buildCouponState(
        this.data.activity,
        this.data.memberCoupons,
        this.data.selectedCouponId,
        channel,
        this.data.balance,
      ),
    );
  },
  async selectCoupon(event) {
    const raw = event.currentTarget.dataset.id;
    const couponId = raw === 'none' || raw === undefined || raw === null ? '' : String(raw);
    if (!this.data.activity) return;
    const coupons = await this.loadMemberCoupons();
    this.setData(
      this.buildCouponState(
        this.data.activity,
        coupons,
        couponId,
        this.data.payChannel,
        this.data.balance,
      ),
    );
  },
  async guardPhone() {
    try {
      const result = await api.ensureMember({});
      const member = result && result.ok ? result.member : null;
      if (member && !needsMemberRegister(member, DEFAULT_AVATAR)) return member;
    } catch (error) {
      console.warn('[activity-register] guard phone', error);
    }
    openMemberRegister();
    return null;
  },
  async confirmRegister() {
    if (this.data.paying || !this.data.activity || !this.data.quote) return;
    if (this.data.consulting) {
      wx.showToast({ title: '请联系店主咨询', icon: 'none' });
      return;
    }
    if (!this.data.canRegister) {
      wx.showToast({ title: '暂不可报名', icon: 'none' });
      return;
    }

    const member = await this.guardPhone();
    if (!member) return;

    const activity = this.data.activity;
    const quote = this.data.quote;
    const couponId = this.data.selectedCouponId || '';
    let payChannel = this.data.payChannel;

    if (!quote.needPayment) {
      payChannel = PAY_CHANNEL.BALANCE;
    }

    if (payChannel === PAY_CHANNEL.BALANCE && quote.needPayment && this.data.balance < quote.payAmount) {
      wx.showModal({
        title: '余额不足',
        content: `当前余额 ¥${formatYuan(this.data.balance)}，实付 ¥${formatYuan(quote.payAmount)}。请先充值或改用在线支付。`,
        confirmText: '去充值',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/recharge/index' });
        },
      });
      return;
    }

    this.setData({ paying: true });
    wx.showLoading({
      title: payChannel === PAY_CHANNEL.WECHAT ? '下单中' : '报名中',
      mask: true,
    });

    try {
      const result = await api.createActivityRegistration({
        activityId: activity.id,
        payChannel,
        couponId,
      });
      if (!result || !result.ok) {
        const err = new Error((result && result.message) || '报名失败');
        err.code = result && result.code;
        throw err;
      }

      if (payChannel === PAY_CHANNEL.WECHAT && result.payment) {
        await this.requestPayment(result.payment);
        const fulfilled = await this.waitRegistrationPaid(activity.id);
        if (!fulfilled) {
          wx.showToast({ title: '支付处理中，请稍后在「我的预约」查看', icon: 'none' });
          await this.bootstrap();
          return;
        }
      } else if (result.registeredCount != null) {
        this.applySeatSnapshot({
          registeredCount: result.registeredCount,
          capacity: result.capacity,
          activityStatus: result.activityStatus,
        });
      }

      wx.hideLoading();
      wx.showToast({ title: '报名成功，前往我的预约查看', icon: 'success' });
      await this.bootstrap();
    } catch (error) {
      wx.hideLoading();
      const msg = (error && error.errMsg) || (error && error.message) || '';
      if (msg.includes('cancel')) {
        wx.showToast({ title: '已取消支付', icon: 'none' });
      } else if (error && error.code === 'BALANCE_INSUFFICIENT') {
        wx.showToast({ title: '余额不足', icon: 'none' });
      } else if (error && error.code === 'COUPON_INVALID') {
        wx.showToast({ title: '优惠券不可用', icon: 'none' });
        await this.bootstrap();
      } else if (error && error.code === 'ALREADY_REGISTERED') {
        wx.showToast({ title: '已报名', icon: 'none' });
        await this.bootstrap();
      } else if (error && error.code === 'FULL') {
        wx.showToast({ title: '已满员', icon: 'none' });
        await this.bootstrap();
      } else {
        console.warn('[activity-register] failed', error);
        wx.showToast({ title: (error && error.message) || '报名未完成', icon: 'none' });
      }
    } finally {
      this.setData({ paying: false });
    }
  },
  requestPayment(payment) {
    return new Promise((resolve, reject) => {
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
  },
  async waitRegistrationPaid(activityId) {
    for (let i = 0; i < 8; i += 1) {
      try {
        const listRes = await api.listMyActivityRegistrations();
        const list = (listRes && listRes.list) || [];
        const found = list.find(
          (row) =>
            String(row.activityId) === String(activityId) && row.status === STATUS.PAID,
        );
        if (found) return true;
      } catch (error) {
        // keep polling
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  },
  async cancelMine() {
    const reg = this.data.myRegistration;
    if (!reg || this.data.cancelling) return;
    if (reg.status !== STATUS.PAID) {
      wx.showToast({ title: '当前状态不可取消', icon: 'none' });
      return;
    }

    const startAt = Number((this.data.activity && this.data.activity.startAt) || 0);
    const gate = assertUserCancelAllowed(reg, startAt, Date.now());
    if (!gate.ok) {
      wx.showToast({ title: gate.message || '不可取消', icon: 'none' });
      return;
    }
    const refund = calcCancelRefund(reg, gate.policy);
    const confirmContent = buildCancelConfirmContent(gate.policy, refund);
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '取消报名？',
        content: confirmContent,
        success: (res) => resolve(!!res.confirm),
      });
    });
    if (!confirm) return;

    this.setData({ cancelling: true });
    wx.showLoading({ title: '取消中', mask: true });
    try {
      const result = await api.cancelActivityRegistration({ registrationId: reg._id });
      wx.hideLoading();
      if (!result || !result.ok) {
        wx.showToast({ title: (result && result.message) || '取消失败', icon: 'none' });
        return;
      }
      if (result.refundPending || result.status === STATUS.REFUND_PENDING) {
        wx.showToast({
          title: '已取消，退款失败请联系店主',
          icon: 'none',
        });
      } else {
        wx.showToast({ title: '已取消', icon: 'success' });
      }
      if (result.registeredCount != null) {
        this.applySeatSnapshot({
          registeredCount: result.registeredCount,
          capacity: result.capacity,
          activityStatus: result.activityStatus,
        });
      }
      await this.bootstrap();
    } catch (error) {
      wx.hideLoading();
      console.warn('[activity-register] cancel', error);
      wx.showToast({ title: '取消失败', icon: 'none' });
    } finally {
      this.setData({ cancelling: false });
    }
  },
});
