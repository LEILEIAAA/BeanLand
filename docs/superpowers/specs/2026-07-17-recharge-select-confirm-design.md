# 充值选档确认与自由额度 设计规格

**日期：** 2026-07-17  
**状态：** approved（方案 1，用户确认执行）

## 目标

- 去掉每档独立支付按钮，改为点选后底栏确认充值
- 提供自由额度：最低 1 元；向下取最近档赠送

## 规则

| 场景 | 实付 | 赠金 |
|------|------|------|
| 选预设档 | `plan.rechargeAmount` | `plan.bonusAmount` |
| 自由额度 | 用户输入（≥1） | 在 `rechargeAmount ≤ 输入` 的档中取最高档的 `bonusAmount`；无则 0 |

自定义订单快照：`planId = 'custom'`，`rechargeAmount` / `bonusAmount` 为解析结果。

## 接口

`createRechargeOrder`：`planId` 与 `customAmount` 二选一。

## 非范围

管理端代充 UI、调试档数据清理、退款。
