/**
 * 会员页快捷入口构建。
 * @param {object} member
 * @param {{
 *   isAdmin?: boolean,
 *   availableCount?: number,
 *   packageCount?: number,
 *   scheduleCount?: number,
 *   activeElapsedLabel?: string,
 *   scheduleCount?: number,
 *   highlight?: {
 *     key?: string,
 *     actionDesc?: string,
 *     actionBadge?: string,
 *     actionBadgeIcon?: string,
 *   },
 * }} [options]
 */
function buildActions(member, options) {
  const availableCount = Number(
    options && options.availableCount != null
      ? options.availableCount
      : 0,
  );
  const packageCount = Number(
    options && options.packageCount != null
      ? options.packageCount
      : 0,
  );
  const scheduleCount = Number(
    options && options.scheduleCount != null
      ? options.scheduleCount
      : 0,
  );
  const activeElapsedLabel = String((options && options.activeElapsedLabel) || '');
  const actions = [
    {
      key: 'packages',
      label: '我的套餐',
      desc: '到店由店主核销开台',
      icon: '/assets/icons/package.png',
      badge: packageCount > 0 ? `${packageCount} 张` : '',
      badgeIcon: '',
    },
    {
      key: 'coupons',
      label: '优惠券',
      desc: '到店核销更划算',
      icon: '/assets/icons/ticket.png',
      badge: availableCount > 0 ? `${availableCount} 张` : '',
      badgeIcon: '',
    },
    {
      key: 'schedule',
      label: '我的预约',
      desc: '开拼预约与活动报名',
      icon: '/assets/icons/calendar.png',
      badge: scheduleCount > 0 ? `${scheduleCount} 条` : '',
      badgeIcon: '',
    },
    {
      key: 'seatSessions',
      label: '到店记录',
      desc: '开台座位、用时与消费记录',
      icon: '/assets/icons/stamp.png',
      badge: activeElapsedLabel,
      badgeIcon: activeElapsedLabel ? 'clock' : '',
    },
    {
      key: 'records',
      label: '消费明细',
      desc: '充值与到店消费流水',
      icon: '/assets/icons/receipt.png',
      badge: '',
      badgeIcon: '',
    },
    {
      key: 'settings',
      label: '设置',
      desc: '资料、协议与客服',
      icon: '/assets/icons/settings.png',
      badge: '',
      badgeIcon: '',
    },
  ];

  if (options && options.isAdmin) {
    actions.push({
      key: 'admin',
      label: '店主后台',
      desc: '预约、充值与座位管理',
      icon: '/assets/icons/users.png',
      badge: '',
      badgeIcon: '',
    });
  }

  const highlight = options && options.highlight;
  if (highlight && highlight.key) {
    const target = actions.find((item) => item.key === highlight.key);
    if (target) {
      // 到店记录副标题固定为简介，不跟亮点态覆盖成「进行中」
      if (highlight.actionDesc != null && target.key !== 'seatSessions') {
        target.desc = String(highlight.actionDesc);
      }
      if (highlight.actionBadge != null) target.badge = String(highlight.actionBadge);
      if (highlight.actionBadgeIcon != null) {
        target.badgeIcon = String(highlight.actionBadgeIcon);
      }
    }
  }

  return actions;
}

module.exports = {
  buildActions,
};
