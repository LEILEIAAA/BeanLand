# 优惠券结构化发放 实现计划

> **面向 AI 代理的工作者：** 按任务顺序实现；步骤使用复选框跟踪。

**目标：** 店主发券改为「主类型 → 折扣类型 → 填变量」，券名自动生成，展示小时/折扣。

**架构：** 纯函数 `buildIssueCouponPayload` / `formatBenefitText` 为真源；云函数与小程序共用副本；UI 只收集结构化字段。

**技术栈：** 微信小程序 + 云函数 + Node test

**规格：** `docs/superpowers/specs/2026-07-16-coupon-structured-issue-design.md`

---

## 文件

- 修改：`miniprogram/utils/coupons.js`
- 同步：`cloudfunctions/*/coupons.js`（4 处）
- 修改：`cloudfunctions/adminIssueCoupon/index.js`
- 修改：`miniprogram/pages/admin/coupons/index.{js,wxml}`
- 修改：`miniprogram/pages/member/coupons/index.js`
- 修改：`tests/coupons.test.js`
- 修改：`scripts/sample-user-coupons.js`

### 任务 1：纯函数 RED → GREEN

- [x] 改写 `buildIssueCouponPayload` 相关测试（结构化入参）
- [x] 新增 `formatBenefitText` / `buildCouponName` 测试
- [x] 实现并通过 `node --test tests/coupons.test.js`

### 任务 2：云函数与发券 UI

- [x] `adminIssueCoupon` 传新字段
- [x] 店主页 picker：主类型 / 折扣类型 / 变量 / 日期

### 任务 3：列表展示

- [x] 会员 / 店主列表用 `formatBenefitText`
- [x] 更新灌数脚本样例

### 任务 4：验证

- [x] `node --test tests/coupons.test.js tests/api.coupons.test.js`
