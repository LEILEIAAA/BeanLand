const DEFAULT_SHARE_IMAGE = '/assets/background/images1.jpg';
const DEFAULT_TITLE = 'Bean Land · 拼豆手作空间';

const SHARE_BY_ROUTE = {
  'pages/home/index': {
    title: 'Bean Land · 拼豆手作空间',
    path: '/pages/home/index',
  },
  'pages/activities/index': {
    title: 'Bean Land · 近期活动',
    path: '/pages/activities/index',
  },
  'pages/packages/index': {
    title: 'Bean Land · 拼豆套餐',
    path: '/pages/packages/index',
  },
  'pages/appointment/index': {
    title: 'Bean Land · 预约开拼',
    path: '/pages/appointment/index',
  },
  'pages/route/index': {
    title: 'Bean Land · 到店路线',
    path: '/pages/route/index',
  },
  'pages/member/index': {
    title: 'Bean Land · 会员中心',
    path: '/pages/member/index',
  },
  'pages/recharge/index': {
    title: 'Bean Land · 会员储值',
    path: '/pages/home/index',
  },
  'pages/member/register/index': {
    title: DEFAULT_TITLE,
    path: '/pages/home/index',
  },
  'pages/member/settings/index': {
    title: DEFAULT_TITLE,
    path: '/pages/home/index',
  },
  'pages/legal/agreement/index': {
    title: DEFAULT_TITLE,
    path: '/pages/home/index',
  },
  'pages/legal/privacy/index': {
    title: DEFAULT_TITLE,
    path: '/pages/home/index',
  },
  'pages/legal/refund/index': {
    title: DEFAULT_TITLE,
    path: '/pages/home/index',
  },
  'pages/member/appointments/index': {
    title: 'Bean Land · 会员中心',
    path: '/pages/member/index',
  },
  'pages/member/packages/index': {
    title: 'Bean Land · 会员中心',
    path: '/pages/member/index',
  },
  'pages/member/coupons/index': {
    title: 'Bean Land · 会员中心',
    path: '/pages/member/index',
  },
  'pages/member/stamps/index': {
    title: 'Bean Land · 会员中心',
    path: '/pages/member/index',
  },
  'pages/member/works/index': {
    title: 'Bean Land · 会员中心',
    path: '/pages/member/index',
  },
  'pages/member/records/index': {
    title: 'Bean Land · 会员中心',
    path: '/pages/member/index',
  },
  'pages/member/seat-sessions/index': {
    title: 'Bean Land · 会员中心',
    path: '/pages/member/index',
  },
};

function buildQueryFromOptions(options) {
  const entries = Object.keys(options || {}).map((key) => `${key}=${options[key]}`);
  return entries.join('&');
}

function queryFromPath(path) {
  const idx = String(path || '').indexOf('?');
  if (idx < 0) return '';
  return path.slice(idx + 1);
}

function resolveActivityRegisterShare(pageLike) {
  const options = pageLike.options || {};
  const data = pageLike.data || {};
  const activityId = data.activityId || options.activityId || '';
  const activityName = (data.activity && data.activity.name) || '活动报名';
  const title = `Bean Land · ${activityName}`;
  const path = activityId
    ? `/pages/activities/register/index?activityId=${activityId}`
    : '/pages/activities/register/index';
  const timelineQuery = activityId ? `activityId=${activityId}` : '';
  return {
    title,
    path,
    imageUrl: DEFAULT_SHARE_IMAGE,
    timelineTitle: title,
    timelineQuery,
  };
}

function resolveShareConfig(pageLike) {
  const route = (pageLike && pageLike.route) || '';
  const options = (pageLike && pageLike.options) || {};

  if (route === 'pages/activities/register/index') {
    return resolveActivityRegisterShare(pageLike || {});
  }

  const mapped = SHARE_BY_ROUTE[route];
  if (mapped) {
    return {
      title: mapped.title,
      path: mapped.path,
      imageUrl: DEFAULT_SHARE_IMAGE,
      timelineTitle: mapped.title,
      timelineQuery: queryFromPath(mapped.path),
    };
  }

  const query = buildQueryFromOptions(options);
  const path = query ? `/${route}?${query}` : `/${route}`;
  return {
    title: DEFAULT_TITLE,
    path,
    imageUrl: DEFAULT_SHARE_IMAGE,
    timelineTitle: DEFAULT_TITLE,
    timelineQuery: query,
  };
}

const shareMethods = {
  onShareAppMessage() {
    const cfg = resolveShareConfig(this);
    return {
      title: cfg.title,
      path: cfg.path,
      imageUrl: cfg.imageUrl,
    };
  },
  onShareTimeline() {
    const cfg = resolveShareConfig(this);
    return {
      title: cfg.timelineTitle,
      query: cfg.timelineQuery,
      imageUrl: cfg.imageUrl,
    };
  },
};

const shareBehavior = typeof Behavior === 'function'
  ? Behavior({ methods: shareMethods })
  : { methods: shareMethods };

module.exports = {
  DEFAULT_SHARE_IMAGE,
  DEFAULT_TITLE,
  SHARE_BY_ROUTE,
  resolveShareConfig,
  shareBehavior,
};
