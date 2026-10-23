const seed = require('../../data/seed');
const api = require('../../utils/api');
const { tierLabel, tierStyleClass } = require('../../utils/memberTier');
const { buildActions } = require('../../utils/memberActions');
const { buildMemberHighlight } = require('../../utils/memberHighlight');
const {
  isValidPhone,
  maskPhone,
  isRegistrationComplete,
} = require('../../utils/memberProfile');
const { openMemberRegister } = require('../../utils/memberRegisterGate');
const {
  DEFAULT_AVATAR,
  ensureDefaultProfile,
  displayAvatar,
} = require('../../utils/wxProfile');
const { buildWorksCardPreview } = require('../../utils/worksView');
const { syncTabBar } = require('../../utils/tabBar');
const { formatYuan } = require('../../utils/money');
const {
  findActiveMemberSession,
  activeElapsedLabelFromSessions,
} = require('../../utils/seatSessionHistory');
const { countActiveSchedule } = require('../../utils/memberScheduleCount');

function buildStampDots(count, target) {
  return Array.from({ length: target }, (_, index) => ({
    index,
    filled: index < count,
  }));
}

function buildStampHint(count, target) {
  const left = Math.max(target - count, 0);
  if (left === 0) return '已集满，到店兑换小礼或主题局优先';
  return `再集 ${left} 枚，可兑换店内小礼`;
}

function emptyMemberView() {
  return {
    totalBalance: 0,
    totalBalanceText: '0',
    principalBalance: 0,
    bonusBalance: 0,
    totalSpent: 0,
    totalRecharge: 0,
    stampCount: 0,
    stampTarget: 5,
    tier: 'member',
    phone: '',
    nickName: '',
    avatarUrl: '',
    coupons: [],
    appointments: [],
  };
}

function emptyHighlight() {
  return buildMemberHighlight({
    activeSession: null,
    scheduleCount: 0,
    packageCount: 0,
    availableCount: 0,
  });
}

const { shareBehavior } = require('../../utils/share');
Page({
  behaviors: [shareBehavior],
  data: {
    member: emptyMemberView(),
    tierLabel: '普通会员',
    tierClass: 'tier-member',
    loadingMember: true,
    isAdmin: false,
    avatarUrl: DEFAULT_AVATAR,
    nickName: '',
    phone: '',
    phoneMasked: '',
    hasPhone: false,
    registrationComplete: false,
    stampDots: buildStampDots(0, 5),
    stampHint: buildStampHint(0, 5),
    // 临时隐藏：改 showStampCard 为 true 可恢复集章卡
    showStampCard: false,
    showWorksCard: false,
    workCount: 0,
    previewThumbs: [],
    worksEmpty: true,
    worksHint: '还没有作品，去拍一张',
    availableCount: 0,
    highlight: emptyHighlight(),
    actions: buildActions(emptyMemberView(), {
      isAdmin: false,
      availableCount: 0,
      highlight: emptyHighlight(),
    }),
  },
  onLoad() {
    this.loadProfile();
  },
  onShow() {
    syncTabBar(this, 3);
    this.loadProfile();
    this.syncMember();
    if (this.data.showWorksCard) {
      this.loadWorksPreview();
    }
  },
  loadProfile() {
    const profile = ensureDefaultProfile();
    const app = getApp();
    app.globalData.userProfile = profile;
    this.setData({
      avatarUrl: displayAvatar(profile),
      nickName: profile.nickName || '',
    });
  },
  async syncMember() {
    this.setData({ loadingMember: true });
    try {
      const profile = ensureDefaultProfile();
      const [result, couponRes, packageRes, seatRes, appointmentList, activityRes] =
        await Promise.all([
          api.ensureMember({
            nickName: profile.nickName || this.data.nickName || '',
            avatarUrl: profile.avatarUrl || '',
          }),
          api.listMyCoupons({ tab: 'unused' }).catch(() => null),
          api.listMyPackageOrders({ tab: 'unused' }).catch(() => null),
          api.listMySeatSessions({ limit: 20 }).catch(() => null),
          api.listMyAppointments().catch(() => []),
          api.listMyActivityRegistrations().catch(() => null),
        ]);

      if (!result || !result.ok || !result.member) {
        throw new Error((result && result.message) || 'ensureMember failed');
      }

      const availableCount =
        couponRes && couponRes.ok && couponRes.availableCount != null
          ? Number(couponRes.availableCount)
          : 0;
      const packageCount =
        packageRes && packageRes.ok && Array.isArray(packageRes.list)
          ? packageRes.list.length
          : 0;
      const scheduleCount = countActiveSchedule({
        appointments: Array.isArray(appointmentList) ? appointmentList : [],
        activities:
          activityRes && activityRes.ok && Array.isArray(activityRes.list)
            ? activityRes.list
            : [],
      });
      const seatList =
        seatRes && seatRes.ok && Array.isArray(seatRes.list) ? seatRes.list : [];
      const activeSession = findActiveMemberSession(seatList);
      const activeElapsedLabel = activeElapsedLabelFromSessions(seatList);

      this.applyMember(result.member, {
        isAdmin: !!result.isAdmin,
        availableCount,
        packageCount,
        scheduleCount,
        activeSession,
        activeElapsedLabel,
      });
    } catch (error) {
      console.warn('[member] ensureMember fallback seed', error);
      if (api.ALLOW_SEED_FALLBACK) {
        const seedCoupons = (seed.memberProfile.coupons || []).filter(
          (item) => (item.status || 'unused') === 'unused' && item.available !== false,
        );
        this.applyMember(
          { ...seed.memberProfile, tier: 'member', phone: '', avatarUrl: '' },
          { isAdmin: false, availableCount: seedCoupons.length },
        );
      } else {
        wx.showToast({ title: '会员同步失败', icon: 'none' });
      }
    } finally {
      this.setData({ loadingMember: false });
    }
  },
  applyMember(member, options) {
    const isAdmin = !!(options && options.isAdmin);
    const availableCount = Number((options && options.availableCount) || 0);
    const packageCount = Number((options && options.packageCount) || 0);
    const scheduleCount = Number(
      options && options.scheduleCount != null
        ? options.scheduleCount
        : (member.appointments && member.appointments.length) || 0,
    );
    const activeSession = (options && options.activeSession) || null;
    const activeElapsedLabel = String((options && options.activeElapsedLabel) || '');
    const stampCount = Number(member.stampCount || 0);
    const stampTarget = Number(member.stampTarget || 5);
    const phone = member.phone || '';
    const nickName = member.nickName || this.data.nickName || '';
    const avatarUrl = member.avatarUrl || this.data.avatarUrl || DEFAULT_AVATAR;
    const registrationComplete = isRegistrationComplete(
      { nickName, phone, avatarUrl },
      DEFAULT_AVATAR,
    );
    const highlight = buildMemberHighlight({
      activeSession,
      scheduleCount,
      packageCount,
      availableCount,
    });
    this.setData({
      member: {
        ...member,
        totalBalanceText: formatYuan(member.totalBalance),
      },
      isAdmin,
      availableCount,
      tierLabel: tierLabel(member.tier || 'member'),
      tierClass: tierStyleClass(member.tier || 'member'),
      phone,
      phoneMasked: maskPhone(phone),
      hasPhone: isValidPhone(phone),
      nickName,
      avatarUrl: displayAvatar({ avatarUrl }),
      registrationComplete,
      stampDots: buildStampDots(stampCount, stampTarget),
      stampHint: buildStampHint(stampCount, stampTarget),
      highlight,
      actions: buildActions(member, {
        isAdmin,
        availableCount,
        packageCount,
        scheduleCount,
        activeElapsedLabel,
        highlight,
      }),
    });
  },
  onAvatarError() {
    if (this.data.avatarUrl === '/assets/icons/bean.png') return;
    this.setData({ avatarUrl: '/assets/icons/bean.png' });
  },
  goRegister() {
    openMemberRegister();
  },
  requireRegistered() {
    if (this.data.loadingMember) {
      wx.showToast({ title: '加载中', icon: 'none' });
      return false;
    }
    if (!this.data.registrationComplete) {
      this.goRegister();
      return false;
    }
    return true;
  },
  goSettings() {
    if (!this.requireRegistered()) return;
    wx.navigateTo({ url: '/pages/member/settings/index' });
  },
  goRecharge() {
    if (!this.requireRegistered()) return;
    wx.navigateTo({ url: '/pages/recharge/index' });
  },
  goStamps() {
    if (!this.requireRegistered()) return;
    wx.navigateTo({ url: '/pages/member/stamps/index' });
  },
  goHighlight() {
    if (!this.requireRegistered()) return;
    const key = this.data.highlight && this.data.highlight.routeKey;
    if (key) this.navigateByKey(key);
  },
  goWorks() {
    if (!this.requireRegistered()) return;
    wx.navigateTo({ url: '/pages/member/works/index' });
  },
  async loadWorksPreview() {
    try {
      const res = await api.listMyWorks({ limit: 3 });
      const list = res && res.ok && Array.isArray(res.list) ? res.list : [];
      const total = res && typeof res.total === 'number' ? res.total : list.length;
      const preview = buildWorksCardPreview(list);
      this.setData({
        ...preview,
        workCount: total,
        worksEmpty: total === 0,
        worksHint: total === 0 ? '还没有作品，去拍一张' : '把成品照留下来',
      });
    } catch (error) {
      console.warn('[member] works preview failed', error);
      this.setData(buildWorksCardPreview([]));
    }
  },
  navigateByKey(key) {
    if (!this.requireRegistered()) return;
    const routes = {
      packages: '/pages/member/packages/index',
      records: '/pages/member/records/index',
      seatSessions: '/pages/member/seat-sessions/index',
      coupons: '/pages/member/coupons/index',
      stamps: '/pages/member/stamps/index',
      schedule: '/pages/member/appointments/index',
      settings: '/pages/member/settings/index',
      admin: '/pages/admin/dashboard/index',
    };
    if (routes[key]) {
      wx.navigateTo({ url: routes[key] });
    }
  },
  onShortcut(event) {
    const { key } = event.currentTarget.dataset;
    this.navigateByKey(key);
  },
});
