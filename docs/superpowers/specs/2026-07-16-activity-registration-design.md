# 活动报名设计（独立于预约）

## 目标

落地真实活动报名：一人一报、余额/微信支付、可取消退款、活动页展示真实 `registeredCount`，与预约选座完全隔离。

## 决策摘要

- 独立集合 `activity_registrations`，不写 `appointments`
- 支付：余额即时 `paid`；微信 `pending_pay` → 回调后 `paid`
- 人数：仅 `paid` 时 +1；取消/退款完成路径中释放名额（微信取消进 `refund_pending` 时即 -1）
- 取消：余额原路退；微信 `refund_pending`，店主确认 → `refunded`（不接自动退款 API）
- `consulting` 活动不可在线报名

## 数据

见对话确认的字段与状态机（`pending_pay` / `paid` / `cancelled` / `refund_pending` / `refunded` / `expired` / `failed`）。
