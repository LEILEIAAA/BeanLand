# 用户端页面分享 实现计划

> **面向 AI 代理的工作者：** 按任务顺序 TDD 实现。步骤使用复选框跟踪。

**目标：** 用户端每个页面启用好友转发与朋友圈分享，后台页不开启。

**架构：** `miniprogram/utils/share.js` 提供 `resolveShareConfig` + `shareBehavior`；各用户端 Page 挂 Behavior，json 开启分享开关。

**技术栈：** 微信小程序 Behavior、`node:test`

## 文件

- 创建：`miniprogram/utils/share.js`
- 创建：`tests/share.test.js`
- 修改：全部非 `pages/admin/**` 的用户端 `*.js` / `*.json`
- 过程：`task-docs/plan-通用-功能-用户端页面分享-20260719-030659.md`

### 任务 1：resolveShareConfig TDD

- [x] 写失败测试覆盖公开页、敏感页、会员子页、活动报名、未知路由
- [x] 实现 `share.js`（含 Behavior，Node 下可 require）
- [x] `node --test tests/share.test.js` 通过

### 任务 2：用户端页面接入

- [x] 每个用户端 Page 追加 `behaviors: [shareBehavior]`
- [x] 每个用户端 json 追加 `enableShareAppMessage` / `enableShareTimeline`
- [x] 确认 `pages/admin/**` 未改动

### 任务 3：验证与收尾

- [x] 重跑 `tests/share.test.js`
- [x] 扫描确认用户端 js/json 均已接入、admin 未接入
- [x] 写 impl 文档，更新 plan 状态
