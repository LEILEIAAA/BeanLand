# 套餐购后核销与开台设计规格

**日期：** 2026-07-16  
**状态：** 已确认（方案 1）  
**关联：** 套餐购买（余额/微信）已上线；预约登记不绑定套餐。

---

## 1. 目标

补齐「购买 → 到店核销 → 开台」闭环。不绑预约。

## 2. 产品决策

| 项 | 决策 |
|----|------|
| 使用方式 | 现场核销，不绑预约 |
| 操作方 | 仅店主核销；会员「我的套餐」只展示 |
| 核销后 | 核销成功后跳转座位管理开台（预填会员） |
| 有效期 | 全店默认 30 天（`store.packageValidityDays`）；仅影响新单 |
| 起算 | `fulfilledAt` |
| 过期 | 自动原路退：余额→退余额；微信→微信退款 |
| 套餐改版 | 订单带 `packageSnapshot`；已购按快照展示/核销 |
| 一单一核 | `fulfilled` 核一次 → `redeemed` |
| 开台失败 | 不回滚核销；可手动再开台 |

## 3. 状态机

```
created / paying → paid → fulfilled → redeemed
                              ↓（过期）
                    expired_refunding → expired_refunded
                              ↓（微信退款失败可挂起）
                    expired_refund_pending
```

可核销条件：`status === fulfilled` 且 `now < expiresAt`。

## 4. 订单字段（增量）

- `validityDays` / `expiresAt` / `packageSnapshot`
- `principalPaid` / `bonusPaid` / `payAmountYuan`（退款用）
- `redeemedAt` / `redeemedBy` / `redeemSessionId`
- `refundChannel` / `refundTxId` / `refundedAt` / `refundFailReason`

## 5. 店主流

看板「套餐核销」→ 找会员 → 未用套餐列表 →「核销并开台」→ `adminRedeemPackage` → 跳转 `admin/timer`（`memberId` + `packageOrderId`）。

## 6. 会员流

会员中心入口「我的套餐」：未使用 / 已使用 / 已过期退款。购买成功 Toast 后可引导进入该页。无自助核销。

## 7. 过期退款

- 定时云函数 `expirePackageOrders`（每日）+ 列表读取时懒过期
- 余额：立即退回本金/赠金快照
- 微信：调用云支付退款；失败则 `expired_refund_pending` 可重试

## 8. 明确不做

预约绑定、会员自助核销、扫码核销、改默认天数回溯旧单、核销页内嵌选座。
