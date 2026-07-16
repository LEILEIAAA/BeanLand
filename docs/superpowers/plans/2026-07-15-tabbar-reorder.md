# TabBar 重梳实现计划

> **面向 AI 代理的工作者：** 小改动，直接在当前会话执行即可。

**目标：** 底栏改为「首页 · 活动 · 套餐 · 会员」，预约页保留为普通页并修正跳转 API。

**架构：** 仅改 `app.json` tabBar 与相关 `switchTab`/`navigateTo`，不改预约业务逻辑。

## 文件

- `miniprogram/app.json` — tabBar 列表
- `miniprogram/pages/home/index.js` — 预约 / 活动 / 套餐跳转
- `miniprogram/pages/member/index.js` — 去预约
- `miniprogram/pages/member/appointments/index.js` — 去预约

## 任务

- [x] 规格：`docs/superpowers/specs/2026-07-15-tabbar-reorder-design.md`
- [x] 更新 tabBar
- [x] 修正跳转
- [x] 校验：配置含四 tab；无对预约的 switchTab；活动/套餐从首页走 switchTab
