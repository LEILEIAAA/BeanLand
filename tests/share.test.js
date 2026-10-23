const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_SHARE_IMAGE,
  DEFAULT_TITLE,
  resolveShareConfig,
  shareBehavior,
} = require('../miniprogram/utils/share');

test('public pages share to themselves', () => {
  const home = resolveShareConfig({ route: 'pages/home/index', options: {}, data: {} });
  assert.equal(home.title, 'Bean Land · 拼豆手作空间');
  assert.equal(home.path, '/pages/home/index');
  assert.equal(home.imageUrl, DEFAULT_SHARE_IMAGE);
  assert.equal(home.timelineTitle, 'Bean Land · 拼豆手作空间');
  assert.equal(home.timelineQuery, '');

  const activities = resolveShareConfig({ route: 'pages/activities/index', options: {}, data: {} });
  assert.equal(activities.title, 'Bean Land · 近期活动');
  assert.equal(activities.path, '/pages/activities/index');

  const packages = resolveShareConfig({ route: 'pages/packages/index', options: {}, data: {} });
  assert.equal(packages.title, 'Bean Land · 拼豆套餐');
  assert.equal(packages.path, '/pages/packages/index');

  const appointment = resolveShareConfig({ route: 'pages/appointment/index', options: {}, data: {} });
  assert.equal(appointment.title, 'Bean Land · 预约开拼');
  assert.equal(appointment.path, '/pages/appointment/index');

  const route = resolveShareConfig({ route: 'pages/route/index', options: {}, data: {} });
  assert.equal(route.title, 'Bean Land · 到店路线');
  assert.equal(route.path, '/pages/route/index');

  const member = resolveShareConfig({ route: 'pages/member/index', options: {}, data: {} });
  assert.equal(member.title, 'Bean Land · 会员中心');
  assert.equal(member.path, '/pages/member/index');
});

test('sensitive pages fall back to home', () => {
  const cases = [
    { route: 'pages/recharge/index', title: 'Bean Land · 会员储值' },
    { route: 'pages/member/register/index', title: DEFAULT_TITLE },
    { route: 'pages/member/settings/index', title: DEFAULT_TITLE },
    { route: 'pages/legal/agreement/index', title: DEFAULT_TITLE },
    { route: 'pages/legal/privacy/index', title: DEFAULT_TITLE },
    { route: 'pages/legal/refund/index', title: DEFAULT_TITLE },
  ];
  for (const item of cases) {
    const cfg = resolveShareConfig({ route: item.route, options: {}, data: {} });
    assert.equal(cfg.title, item.title);
    assert.equal(cfg.path, '/pages/home/index');
    assert.equal(cfg.timelineQuery, '');
  }
});

test('member subpages fall back to member center', () => {
  const routes = [
    'pages/member/appointments/index',
    'pages/member/packages/index',
    'pages/member/coupons/index',
    'pages/member/stamps/index',
    'pages/member/works/index',
    'pages/member/records/index',
    'pages/member/seat-sessions/index',
  ];
  for (const route of routes) {
    const cfg = resolveShareConfig({ route, options: {}, data: {} });
    assert.equal(cfg.title, 'Bean Land · 会员中心');
    assert.equal(cfg.path, '/pages/member/index');
    assert.equal(cfg.timelineQuery, '');
  }
});

test('activity register uses activity name and activityId', () => {
  const cfg = resolveShareConfig({
    route: 'pages/activities/register/index',
    options: { activityId: 'act-from-options' },
    data: {
      activityId: 'act-1',
      activity: { name: '开业拼豆局' },
    },
  });
  assert.equal(cfg.title, 'Bean Land · 开业拼豆局');
  assert.equal(cfg.path, '/pages/activities/register/index?activityId=act-1');
  assert.equal(cfg.timelineTitle, 'Bean Land · 开业拼豆局');
  assert.equal(cfg.timelineQuery, 'activityId=act-1');
});

test('activity register falls back name and options activityId', () => {
  const cfg = resolveShareConfig({
    route: 'pages/activities/register/index',
    options: { activityId: 'act-opt' },
    data: {},
  });
  assert.equal(cfg.title, 'Bean Land · 活动报名');
  assert.equal(cfg.path, '/pages/activities/register/index?activityId=act-opt');
  assert.equal(cfg.timelineQuery, 'activityId=act-opt');
});

test('unknown user route uses default title and current path', () => {
  const cfg = resolveShareConfig({
    route: 'pages/misc/unknown',
    options: { foo: '1', bar: '2' },
    data: {},
  });
  assert.equal(cfg.title, DEFAULT_TITLE);
  assert.equal(cfg.path, '/pages/misc/unknown?foo=1&bar=2');
  assert.equal(cfg.timelineTitle, DEFAULT_TITLE);
  assert.equal(cfg.timelineQuery, 'foo=1&bar=2');
});

test('shareBehavior exposes share handlers', () => {
  assert.equal(typeof shareBehavior.methods.onShareAppMessage, 'function');
  assert.equal(typeof shareBehavior.methods.onShareTimeline, 'function');

  const pageLike = {
    route: 'pages/packages/index',
    options: {},
    data: {},
  };
  const friend = shareBehavior.methods.onShareAppMessage.call(pageLike);
  assert.equal(friend.title, 'Bean Land · 拼豆套餐');
  assert.equal(friend.path, '/pages/packages/index');
  assert.equal(friend.imageUrl, DEFAULT_SHARE_IMAGE);

  const timeline = shareBehavior.methods.onShareTimeline.call(pageLike);
  assert.equal(timeline.title, 'Bean Land · 拼豆套餐');
  assert.equal(timeline.query, '');
  assert.equal(timeline.imageUrl, DEFAULT_SHARE_IMAGE);
});
