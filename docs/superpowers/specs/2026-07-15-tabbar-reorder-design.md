# TabBar 重梳设计

## 目标

预约模块从底部导航移除，页面与业务逻辑保留；底栏改为更偏运营与转化的结构。

## 新 TabBar

1. 首页 — `pages/home/index`
2. 活动 — `pages/activities/index`
3. 套餐 — `pages/packages/index`
4. 会员 — `pages/member/index`

## 保留

- `pages/appointment/index` 仍在 `pages` 列表中，可从首页 CTA、套餐、活动、会员入口进入。
- 预约页、会员预约列表、店主预约管理均不删除。

## 跳转规则

- 进入预约：一律 `wx.navigateTo`（不再是 tab）。
- 进入活动 / 套餐 / 会员 / 首页：一律 `wx.switchTab`。
- 到店路线仍为二级页：`wx.navigateTo`。
