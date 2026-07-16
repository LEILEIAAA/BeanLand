# 会员注册与微信充值云打通 设计规格

**日期：** 2026-07-15  
**状态：** approved（方案 A，用户确认执行）

## 目标

本轮打通会员注册与储值充值的云数据链路；支持用户微信支付充值与店长代充两种渠道；不做预约/套餐购买支付。

## 范围

### In

- 会员注册云写读（`ensureMember` / `getPhoneNumber` / `getMyMember`）
- 充值档位云读（`recharge_plans`）
- 新建 `recharge_orders`；微信充值与代充均入此表，用 `channel` 区分
- 云函数：`createRechargeOrder`、`payRechargeNotify`、`getRechargeOrder`；改造 `adminRecharge`
- 充值页调起 `wx.requestPayment`；支付成功后以云回调入账为准刷新余额/流水

### Out

- 预约/套餐购买支付
- 自动退款、对账台、用户自助关单
- 全局关闭 `ALLOW_SEED_FALLBACK`（仅会员/充值主路径以云为准）

## 数据

### `recharge_orders`

| 字段 | 说明 |
|---|---|
| `_openid` / `memberId` | 会员 |
| `planId` / `rechargeAmount` / `bonusAmount` | 下单快照 |
| `payAmountFen` | 实付分 = rechargeAmount × 100 |
| `channel` | `wechat_jsapi` \| `transfer_manual` |
| `status` | 见状态机 |
| `outTradeNo` | 商户订单号（唯一） |
| `transactionId` | 微信支付单号（微信路径） |
| `balanceTxId` | 关联 `member_transactions._id` |
| `operatorOpenid` | 代充操作者（代充必填） |
| `createdAt` / `paidAt` / `creditedAt` / `updatedAt` | 时间戳 |

### 状态机

**微信：** `created → paying → paid → credited`；可至 `closed` / `failed`  
**代充：** `created → credited`（同请求内完成）

入账仅在进入 `credited` 时发生；`outTradeNo` 幂等。

### 其它集合

沿用 `members`、`member_transactions`、`recharge_plans`、`member_tier_rules`、`admins`。

## 流程

### 微信充值

1. 校验会员有合法手机号  
2. `createRechargeOrder` 建单 → `cloud.cloudPay.unifiedOrder` → 返回支付参数，状态 `paying`  
3. 前端 `wx.requestPayment`  
4. `payRechargeNotify` 验金额 → `paid` → 入账 → `credited`  
5. 前端 `getRechargeOrder` / `getMyMember` / `listMyTransactions` 刷新

前端支付成功不直接改余额。

### 代充

`adminRecharge`：鉴权 → 建 `transfer_manual` 订单并 `credited` → 入账 → 写流水。

入账逻辑（本金/赠金/升级/流水）两边共用。

## 错误与幂等

- 无手机号：拒绝下单，引导注册  
- 档位不存在：拒绝下单  
- 回调金额 ≠ `payAmountFen`：拒绝入账  
- 已 `credited`：回调直接成功返回  
- 支付取消：订单可留 `paying`；本轮不自动关单

## 配置依赖

- 云开发控制台开通微信支付，商户号已绑当前 AppID  
- `payConfig.subMchId`（或云库 `pay_config/main`）需配置商户号  
- `unifiedOrder.envId` 与小程序云环境一致；`functionName` = `payRechargeNotify`

## 验证

- 单元测试：订单草稿、状态迁移、金额换算、幂等判定、入账字段  
- 真机：注册 → 选档支付 → 余额/流水到账；店长代充同样写订单+流水  
