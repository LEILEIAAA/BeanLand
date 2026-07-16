/**
 * 会员页快捷入口构建。
 * @param {object} member
 * @param {{ isAdmin?: boolean, availableCount?: number, packageCount?: number }} [options]
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
  const appointmentCount = (member && member.appointments && member.appointments.length) || 0;
  const actions = [
    {
      key: 'packages',
      label: '我的套餐',
      desc: '到店由店主核销开台',
      icon: '/assets/icons/ticket.png',
      badge: packageCount > 0 ? `${packageCount} 张` : '',
    },
    {
      key: 'coupons',
      label: '优惠券',
      desc: '到店核销更划算',
      icon: '/assets/icons/ticket.png',
      badge: availableCount > 0 ? `${availableCount} 张` : '',
    },
    {
      key: 'records',
      label: '消费明细',
      desc: '充值与到店消费流水',
      icon: '/assets/icons/receipt.png',
    },
    {
      key: 'seatSessions',
      label: '到店记录',
      desc: '每次计时的座位、时长与消费',
      icon: '/assets/icons/receipt.png',
    },
    {
      key: 'appointments',
      label: '我的预约',
      desc: '查看近期场次状态',
      icon: '/assets/icons/calendar.png',
      badge: appointmentCount ? `${appointmentCount} 条` : '',
    },
    {
      key: 'activityRegs',
      label: '我的活动报名',
      desc: '主题局 / 搭子计划名额',
      icon: '/assets/icons/users.png',
    },
  ];

  if (options && options.isAdmin) {
    actions.push({
      key: 'admin',
      label: '店主后台',
      desc: '预约、充值与座位管理',
      icon: '/assets/icons/users.png',
    });
  }

  return actions;
}

module.exports = {
  buildActions,
};
