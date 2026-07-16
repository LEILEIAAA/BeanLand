# 活动微信自动退款 + 套餐未核销可退

**日期：** 2026-07-17  
**状态：** 已确认（按推荐；选项 1/3 不做，只做选项 2）

## 目标

1. 活动报名微信取消：调用云支付退款 API，不再依赖店主人工在商户平台退完再点确认。  
2. 套餐未核销：会员可主动退款；过期后不可主动退，仅保留过期自动退。

## 决策

| 项 | 决策 |
|----|------|
| 活动余额取消 | 不变：立刻退余额 → `cancelled` |
| 活动微信取消 | 先 `refund_pending` 并释放名额 → 调 `cloudPay.refund` → 成功 `refunded`；失败保留 `refund_pending` |
| 活动店主操作 | `adminConfirmActivityRefund` 改为「重试微信退款」（调 API），不再是「确认已人工退」 |
| 套餐主动退 | 会员对 `fulfilled` 且未过期单发起；余额退余额，微信调退款 API |
| 套餐过期 | 保留 `expirePackageOrders` 自动退；过期后不可主动退 |
| 不做 | 店主代退未核销套餐、手续费/截止规则、充值退款 |

## 状态增量（套餐）

```
fulfilled → user_refunding → user_refunded
                 ↓
           user_refund_pending
```

过期路径 `expired_*` 不变。会员「已过期」Tab 同时展示 `user_*` 与 `expired_*` 退款记录。

## 云函数

- 改：`cancelActivityRegistration`、`adminConfirmActivityRefund`
- 增：`refundPackageOrder`
- 改：`listMyPackageOrders`（Tab 匹配含 `user_*`）
