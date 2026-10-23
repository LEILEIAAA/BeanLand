# 用户端页面分享（好友 + 朋友圈）

## 目标

用户端每个页面右上角「转发」「分享到朋友圈」可用；按场景定制标题与落地路径；后台页不开启分享。

## 决策

| 项 | 选择 |
|----|------|
| 范围 | 仅非 `pages/admin/**` 的用户端页 |
| 渠道 | `onShareAppMessage` + `onShareTimeline` |
| 文案 | 分场景定制（公开页落到自身，敏感/私密页改落安全页） |
| 实现 | 公共 `shareBehavior` + `SHARE_BY_ROUTE` 配置表 |
| 分享图 | 统一本地 `/assets/background/images1.jpg` |

## 场景文案与落点

| 路由 | 分享标题 | 落地 path |
|------|----------|-----------|
| `pages/home/index` | Bean Land · 拼豆手作空间 | `/pages/home/index` |
| `pages/activities/index` | Bean Land · 近期活动 | `/pages/activities/index` |
| `pages/activities/register/index` | Bean Land · {活动名}（无名称时用「活动报名」） | `/pages/activities/register/index?activityId={id}` |
| `pages/packages/index` | Bean Land · 拼豆套餐 | `/pages/packages/index` |
| `pages/appointment/index` | Bean Land · 预约开拼 | `/pages/appointment/index` |
| `pages/route/index` | Bean Land · 到店路线 | `/pages/route/index` |
| `pages/member/index` | Bean Land · 会员中心 | `/pages/member/index` |
| `pages/recharge/index` | Bean Land · 会员储值 | `/pages/home/index` |
| `pages/member/register/index` | Bean Land · 拼豆手作空间 | `/pages/home/index` |
| `pages/member/settings/index` | Bean Land · 拼豆手作空间 | `/pages/home/index` |
| `pages/legal/agreement/index` | Bean Land · 拼豆手作空间 | `/pages/home/index` |
| `pages/legal/privacy/index` | Bean Land · 拼豆手作空间 | `/pages/home/index` |
| `pages/legal/refund/index` | Bean Land · 拼豆手作空间 | `/pages/home/index` |
| `pages/member/appointments/index` | Bean Land · 会员中心 | `/pages/member/index` |
| `pages/member/packages/index` | Bean Land · 会员中心 | `/pages/member/index` |
| `pages/member/coupons/index` | Bean Land · 会员中心 | `/pages/member/index` |
| `pages/member/stamps/index` | Bean Land · 会员中心 | `/pages/member/index` |
| `pages/member/works/index` | Bean Land · 会员中心 | `/pages/member/index` |
| `pages/member/records/index` | Bean Land · 会员中心 | `/pages/member/index` |
| `pages/member/seat-sessions/index` | Bean Land · 会员中心 | `/pages/member/index` |

未出现在表中的用户端路由：标题用「Bean Land · 拼豆手作空间」，落地当前页 path（若无 `options` 则无 query）。

朋友圈：`title` 与好友一致；`query` 与落地 path 的 query 一致（无 query 则为空字符串）。

## 技术结构

### `miniprogram/utils/share.js`

- 常量：`DEFAULT_SHARE_IMAGE`、`DEFAULT_TITLE`
- `SHARE_BY_ROUTE`：上表静态配置（活动报名标题由解析函数动态拼接）
- `resolveShareConfig(pageLike)`：输入含 `route`、`options`、`data` 的对象，输出：
  - `title`、`path`、`imageUrl`（好友）
  - `timelineTitle`、`timelineQuery`、`imageUrl`（朋友圈）
- `shareBehavior`：`onShareAppMessage` / `onShareTimeline` 调用 `resolveShareConfig(this)`

活动报名：`activityId` 优先 `data.activityId`，其次 `options.activityId`；活动名优先 `data.activity.name`。

### 页面接入

- 每个用户端 `Page` 增加 `behaviors: [shareBehavior]`（已有 behaviors 则追加）
- 每个用户端页面 json 增加：
  - `"enableShareAppMessage": true`
  - `"enableShareTimeline": true`
- `pages/admin/**` 不加 Behavior、不加上述 json 字段

### 测试

`tests/share.test.js` 覆盖：

- 公开页：标题与 path 落自身
- 充值/设置/协议：落首页
- 会员子页：落会员中心
- 活动报名：标题含活动名，path/query 含 `activityId`
- 未知用户端路由：默认标题 + 当前 path

## 非目标

- 不改后台页分享
- 不做页面内分享按钮 / 海报
- 不上传或按页切换自定义分享图
- 不改分享后的登录/权限逻辑
