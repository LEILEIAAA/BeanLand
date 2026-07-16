# 优惠券云数据与状态专页 实现计划

> **面向 AI 代理的工作者：** 在当前会话内联执行（Cursor 禁止子代理）。步骤用复选框跟踪。

**目标：** `user_coupons` 云集合 + 会员专页三 Tab + 店主手机号核销 + 角标 availableCount。

**架构：** 纯函数 `coupons.js` 承载过期晋升/过滤/可核销判定；云函数读写集合；小程序专页与店主页调 API。

**技术栈：** 微信小程序 + 云开发云函数 + Node test

**规格：** `docs/superpowers/specs/2026-07-16-coupons-cloud-design.md`

---

## 文件

| 文件 | 职责 |
|---|---|
| `miniprogram/utils/coupons.js` | 状态常量、过期晋升、Tab 过滤、可核销判定 |
| `tests/coupons.test.js` | 上述纯函数单测 |
| `miniprogram/utils/memberActions.js` | 角标改用 availableCount |
| `tests/memberActions.test.js` | 角标断言更新 |
| `cloudfunctions/listMyCoupons/` | 会员列表 |
| `cloudfunctions/adminListMemberCoupons/` | 店主列未使用 |
| `cloudfunctions/adminRedeemCoupon/` | 店主核销 |
| `miniprogram/utils/api.js` | 封装三个云函数 |
| `miniprogram/pages/member/coupons/*` | 专页三 Tab |
| `miniprogram/pages/member/index.js` | 拉取 availableCount |
| `miniprogram/pages/admin/coupons/*` | 核销页 |
| `miniprogram/pages/admin/dashboard/*` | 入口 |
| `miniprogram/app.json` / `cloudbaserc.json` | 注册页与云函数 |

### 任务 1：纯函数 + 角标

- [x] 写失败测试 → 实现 `coupons.js` → 改 `memberActions` → 绿

### 任务 2：云函数

- [x] `listMyCoupons` / `adminListMemberCoupons` / `adminRedeemCoupon`（内嵌 `coupons.js` 副本）
- [x] `api.js` + `cloudbaserc.json`

### 任务 3：前端

- [x] 会员专页三 Tab
- [x] 会员首页角标
- [x] 店主核销页 + 看板入口 + `app.json`

### 任务 4：验证

- [x] `node --test tests/coupons.test.js tests/memberActions.test.js` → 10 pass
- [x] 写 task-docs plan/impl
