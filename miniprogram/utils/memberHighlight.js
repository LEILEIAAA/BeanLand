/**
 * 会员页智能亮点主卡（集章隐藏后的视觉焦点）。
 * 优先级：进行中到店 > 预约 > 套餐 > 券 > 空态引导预约
 *
 * @param {{
 *   activeSession?: { tableCode?: string, seatLabel?: string, durationLabel?: string } | null,
 *   scheduleCount?: number,
 *   packageCount?: number,
 *   availableCount?: number,
 * }} input
 */
function durationMetric(durationLabel) {
  const raw = String(durationLabel || '').trim();
  if (!raw) return '';
  return raw.replace(/^已进行\s*/, '');
}

function buildMemberHighlight(input) {
  const active = input && input.activeSession;
  const scheduleCount = Math.max(0, Number((input && input.scheduleCount) || 0));
  const packageCount = Math.max(0, Number((input && input.packageCount) || 0));
  const availableCount = Math.max(0, Number((input && input.availableCount) || 0));

  if (active) {
    const place = [active.tableCode, active.seatLabel].filter(Boolean).join(' · ');
    const durationLabel = String(active.durationLabel || '');
    const metric = durationMetric(durationLabel);
    return {
      key: 'seatSessions',
      title: '到店进行中',
      kicker: '进行中',
      tone: 'active',
      sub: place || '计时进行中',
      detail: place || '计时进行中',
      count: '',
      metric,
      metricUnit: metric ? '已进行' : '',
      showMetric: !!metric,
      foot: '实时计时中，结束后可回看',
      cta: '查看详情',
      routeKey: 'seatSessions',
      actionDesc: '开台座位、用时与消费记录',
      actionBadge: durationLabel,
      actionBadgeIcon: durationLabel ? 'clock' : '',
    };
  }

  if (scheduleCount > 0) {
    return {
      key: 'schedule',
      title: '我的预约',
      kicker: '预约',
      tone: 'schedule',
      sub: '开拼预约与活动报名',
      detail: '开拼预约与活动报名',
      count: String(scheduleCount),
      metric: String(scheduleCount),
      metricUnit: '条',
      showMetric: true,
      foot: `${scheduleCount} 条预约待查看`,
      cta: '查看全部',
      routeKey: 'schedule',
      actionDesc: '开拼预约与活动报名',
      actionBadge: `${scheduleCount} 条`,
      actionBadgeIcon: '',
    };
  }

  if (packageCount > 0) {
    return {
      key: 'packages',
      title: '我的套餐',
      kicker: '套餐',
      tone: 'asset',
      sub: '到店由店主核销开台',
      detail: '到店由店主核销开台',
      count: String(packageCount),
      metric: String(packageCount),
      metricUnit: '张',
      showMetric: true,
      foot: `${packageCount} 张待到店核销`,
      cta: '去查看',
      routeKey: 'packages',
      actionDesc: '到店由店主核销开台',
      actionBadge: `${packageCount} 张`,
      actionBadgeIcon: '',
    };
  }

  if (availableCount > 0) {
    return {
      key: 'coupons',
      title: '优惠券',
      kicker: '优惠券',
      tone: 'coupon',
      sub: '到店核销更划算',
      detail: '到店核销更划算',
      count: String(availableCount),
      metric: String(availableCount),
      metricUnit: '张',
      showMetric: true,
      foot: `${availableCount} 张可用`,
      cta: '去使用',
      routeKey: 'coupons',
      actionDesc: '到店核销更划算',
      actionBadge: `${availableCount} 张`,
      actionBadgeIcon: '',
    };
  }

  return {
    key: 'schedule',
    title: '去开一局',
    kicker: '推荐',
    tone: 'empty',
    sub: '预约开拼，到店更从容',
    detail: '预约开拼，到店更从容',
    count: '',
    metric: '',
    metricUnit: '',
    showMetric: false,
    foot: '现在预约，到店更从容',
    cta: '去预约',
    routeKey: 'schedule',
    actionDesc: '开拼预约与活动报名',
    actionBadge: '',
    actionBadgeIcon: '',
  };
}

module.exports = {
  buildMemberHighlight,
};
