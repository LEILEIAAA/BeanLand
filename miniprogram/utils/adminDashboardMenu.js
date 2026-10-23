const SECTIONS = [
  {
    key: 'ops',
    title: '现场运营',
    emphasis: true,
    items: [
      { key: 'timer', label: '座位管理', url: '/pages/admin/timer/index' },
      { key: 'timerHistory', label: '订单管理', url: '/pages/admin/timer-history/index' },
    ],
  },
  {
    key: 'booking',
    title: '预约活动',
    emphasis: false,
    items: [
      { key: 'appointments', label: '预约管理', url: '/pages/admin/appointments/index' },
      { key: 'activityRegs', label: '活动管理', url: '/pages/admin/activity-registrations/index' },
    ],
  },
  {
    key: 'marketing',
    title: '营销核销',
    emphasis: false,
    items: [
      { key: 'packages', label: '套餐核销', url: '/pages/admin/package-redeem/index' },
      { key: 'coupons', label: '优惠券管理', url: '/pages/admin/coupons/index' },
    ],
  },
  {
    key: 'member',
    title: '会员资金',
    emphasis: false,
    items: [
      { key: 'members', label: '会员管理', url: '/pages/admin/members/index' },
      { key: 'transactions', label: '储值流水', url: '/pages/admin/transactions/index' },
    ],
  },
  {
    key: 'content',
    title: '内容配置',
    emphasis: false,
    items: [
      { key: 'activityConfig', label: '活动配置', url: '/pages/admin/activities/index' },
      { key: 'packageConfig', label: '套餐配置', url: '/pages/admin/packages/index' },
      { key: 'homeBanners', label: '首页轮播', url: '/pages/admin/home-banners/index' },
    ],
  },
];

function formatDashboardBadgeCount(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n > 99) return '99+';
  return String(Math.floor(n));
}

function buildAdminDashboardMenu() {
  return SECTIONS.map((section) => ({
    key: section.key,
    title: section.title,
    emphasis: section.emphasis,
    items: section.items.map((item) => ({ ...item, badge: '' })),
  }));
}

function applyAdminDashboardBadges(sections, counts) {
  const appointmentsBadge = formatDashboardBadgeCount(
    counts && counts.appointmentsPending,
  );
  const activityRegsBadge = formatDashboardBadgeCount(
    counts && counts.activityRegsPending,
  );
  const badgeByKey = {
    appointments: appointmentsBadge,
    activityRegs: activityRegsBadge,
  };

  return (sections || []).map((section) => ({
    ...section,
    items: (section.items || []).map((item) => ({
      ...item,
      badge: badgeByKey[item.key] || '',
    })),
  }));
}

module.exports = {
  buildAdminDashboardMenu,
  formatDashboardBadgeCount,
  applyAdminDashboardBadges,
};
