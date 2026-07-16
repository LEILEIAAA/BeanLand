# 优惠券云数据与状态专页 设计规格

**日期：** 2026-07-16  
**状态：** approved（用户确认直接改）  
**方案：** 独立 `user_coupons` 集合（方案 2）+ 店主手机号核销（B + A）

## 目标

将「我的优惠券」从本地 seed 改为云数据；在优惠券专页按生命周期分 Tab 展示；未使用内区分可用/不可用；店主可通过手机号查找会员并核销可用券。

## 范围

### In

- 新建集合 `user_coupons`
- 云函数：`listMyCoupons`、`adminListMemberCoupons`、`adminRedeemCoupon`
- 小程序 API 封装与上述对齐
- 会员优惠券专页 `pages/member/coupons`：三 Tab + 云拉数 + 下拉刷新
- 会员首页角标改为「未使用且 available」张数
- 店主看板入口 + 核销页 `pages/admin/coupons`（手机号找人 → 列未使用券 → 点选核销）
- 测试：角标计数、状态过滤、核销校验相关单测；一次性灌券方式（控制台说明或脚本）

### Out

- 发券规则 / 券模板表 / 注册自动发券
- 扫码核销、会员出示券码
- 强制核销不可用券
- 预约/下单时自动抵扣优惠券
- 全局关闭 `ALLOW_SEED_FALLBACK`（仅优惠券专页与流水页同策略：云失败不拿 seed 冒充真券）

## 数据

### `user_coupons`

| 字段 | 说明 |
|---|---|
| `_openid` / `memberId` | 所属会员 |
| `name` / `amount` / `scope` | 展示快照（本轮无模板表） |
| `status` | `unused` \| `used` \| `expired` |
| `available` | 仅 `unused` 有意义：`true` 可用 / `false` 暂不可用 |
| `unavailableReason` | 不可用文案（如「未到使用期」「仅双人套餐」） |
| `validFrom` / `expireAt` | 有效期日期范围（时间戳 ms）：开始日 ~ 结束日；列表展示为 `YYYY-MM-DD 至 YYYY-MM-DD` |
| `usedAt` / `redeemedBy` | 核销时间、店主 openid |
| `createdAt` / `updatedAt` | 审计 |

### 状态规则

- Tab：**未使用** = `unused`；**已使用** = `used`；**已过期** = `expired`
- **可用 / 不可用只在未使用 Tab 体现**；已使用、已过期不展示该维度
- 列表读取时：若 `status === unused` 且 `now > expireAt`，写回 `expired` 并移出未使用结果
- 列表读取时：若 `status === unused` 且 `now < validFrom`，有效 `available=false`，原因「未到使用期」（仍留在未使用 Tab）
- **套餐/场景限制写在 `scope` 文案**（如「限双人主题套餐」），不在钱包专页/到店核销标「不可用」；场景是否可用仅在套餐购买勾选时再判定（本轮不做）
- 核销仅允许：有效期内（未过期且已到 `validFrom`）
- 核销成功：`status = used`，写入 `usedAt`、`redeemedBy`、`updatedAt`

### 其它集合

沿用 `members`、`admins`。不改 `members.coupons` 嵌入数组作为真源（废弃前端对该字段的依赖）。

## 会员端：优惠券专页

路径：`pages/member/coupons`（会员中心二级**优惠券专页/详情页**，完整闭环，非首页内嵌片段）。

1. 顶栏 Tab：未使用 / 已使用 / 已过期
2. 调用 `listMyCoupons({ tab })`
3. 未使用：可用正常样式；不可用灰显 + `unavailableReason`
4. 已使用 / 已过期：名称、面额、范围、使用日或过期日；**不出现**可用/不可用
5. 空态按 Tab 区分；支持下拉刷新
6. 云失败：不展示 seed 真券；仅 `ALLOW_SEED_FALLBACK` 时允许本地 mock（与流水页一致）

### 角标

- 会员首页快捷入口角标 = `availableCount`（未使用且 `available === true`）
- 来源：`listMyCoupons` 返回值；会员 `onShow` 轻量拉取或专页返回后刷新
- `buildActions` 改为接收 `availableCount`（或等价字段），不再用 `member.coupons.length`

## 店主端：核销页

路径：`pages/admin/coupons`；店主看板新增入口「优惠券核销」。

1. 输入手机号 → `adminFindMember`（复用现有）
2. 选中会员 → `adminListMemberCoupons({ memberId })`，仅未使用
3. 可用可点核销；不可用灰显不可点
4. 二次确认（券名 + 面额）→ `adminRedeemCoupon({ couponId })`
5. 成功 toast，刷新该会员未使用列表
6. 权限：`admins` 白名单，与代充相同

## 云函数 / API

| 云函数 | 调用方 | 入参 | 出参 |
|---|---|---|---|
| `listMyCoupons` | 专页、角标 | `{ tab?: 'unused'\|'used'\|'expired' }`，默认 `unused` | `{ ok, list, availableCount }` |
| `adminListMemberCoupons` | 核销页 | `{ memberId }` | `{ ok, list }`（仅 unused） |
| `adminRedeemCoupon` | 核销页 | `{ couponId }` | 成功 `{ ok: true, coupon }`；失败带 `code` / `message` |

小程序 `api.js` 增加同名封装。

### 错误约定

| 场景 | code（示例） | 行为 |
|---|---|---|
| 无 openid | `NO_OPENID` | 拒绝 |
| 非店主调 admin 接口 | `FORBIDDEN` | 拒绝 |
| 券不存在 | `NOT_FOUND` | 拒绝 |
| 非 unused / 不可用 / 已过期 | `NOT_REDEEMABLE` | 拒绝核销 |
| memberId 缺失 | `INVALID_PAYLOAD` | 拒绝 |

核销建议用事务或条件更新，避免并发双核销。

## 测试数据

本轮不做发券接口。开发/联调通过云开发控制台或一次性脚本向 `user_coupons` 写入测试券，字段对齐上表；至少覆盖：可用 unused、不可用 unused、已过期（或即将过期）、已使用。

## 测试要点

- `buildActions`：角标来自 `availableCount`，为 0 时无 badge
- `listMyCoupons` 过滤与过期晋升逻辑（可抽纯函数单测）
- `adminRedeemCoupon`：不可用 / 已使用 / 非店主拒绝；可用成功翻 `used`

## 风险

- 云库需新建集合与必要索引（`_openid + status`、`memberId + status`）
- 历史若有人依赖 seed 优惠券展示，上线后无灌数则列表为空（预期）
- 店主核销页与代充页交互同构，注意复用查找会员体验、勿复制粘贴过重
