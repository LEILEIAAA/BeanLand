# 套餐购后核销与开台 实现计划

> **面向 AI 代理的工作者：** 子代理在本仓库禁用，于当前会话顺序执行。步骤用复选框跟踪。

**目标：** 支付履约后生成可核销权益（30 天默认有效）；店主核销并跳转开台；过期原路自动退。

**架构：** 纯逻辑扩展 `packagePurchase.js`（有效期/可核销/核销/过期退草稿）；云函数履约写字段、`adminRedeemPackage`、`listMyPackageOrders`、`adminListMemberPackages`、`expirePackageOrders`；C 端「我的套餐」+ 店主「套餐核销」页复用找会员模式。

**技术栈：** 微信小程序、云开发、Node test runner

**规格：** `docs/superpowers/specs/2026-07-16-package-redeem-design.md`

---

## 文件

| 文件 | 职责 |
|------|------|
| `miniprogram/utils/packagePurchase.js` | 状态、有效期、可核销、核销、过期退纯逻辑 |
| `tests/packageRedeem.test.js` | 上述纯逻辑测试 |
| `cloudfunctions/*/packagePurchase.js` | 与 utils 同步副本 |
| `cloudfunctions/common/memberCredit.js` + 各副本 | `creditMemberPackageRefund` |
| `cloudfunctions/purchasePackage` / `payPackageNotify` | 履约写入 expiresAt 等 |
| `cloudfunctions/adminRedeemPackage` | 店主核销 |
| `cloudfunctions/listMyPackageOrders` | 会员列表（含懒过期） |
| `cloudfunctions/adminListMemberPackages` | 店主按会员列未用套餐 |
| `cloudfunctions/expirePackageOrders` | 定时过期退 |
| `miniprogram/pages/member/packages/*` | 我的套餐 |
| `miniprogram/pages/admin/packages/*` | 套餐核销 |
| `miniprogram/utils/memberActions.js` / `api.js` / `app.json` | 入口与接口 |

---

### 任务 1：纯逻辑 TDD

- [x] 失败测试：默认 30 天、可核销边界、核销态、过期退草稿、快照
- [x] 实现并同步云函数副本
- [x] 绿灯

### 任务 2：履约写字段 + 退款记账

- [x] `buildBalancePackageDraft` / 微信履约补 `expiresAt`、`validityDays`、`packageSnapshot`、支付拆分
- [x] `creditMemberPackageRefund`；余额购保存 principal/bonus
- [x] 回归 `packagePurchase` 测试

### 任务 3：核销 / 列表 / 过期云函数

- [x] `adminRedeemPackage`、`listMyPackageOrders`、`adminListMemberPackages`、`expirePackageOrders`
- [x] 注册 `cloudbaserc.json`；复制公共模块

### 任务 4：前端

- [x] 会员「我的套餐」+ 入口
- [x] 店主「套餐核销」+ 看板入口；核销后跳 timer
- [x] 购买成功引导（可选 Toast 文案）

### 任务 5：验证与文档

- [x] `node --test tests/packageRedeem.test.js tests/packagePurchase.test.js ...`
- [x] task-docs plan/impl 回写
