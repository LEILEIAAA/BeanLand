# 预约登记（去用户选座）设计规格

**日期：** 2026-07-16  
**状态：** 已确认并实现  
**关联：** 取代 C 端自主选座占座路径；店主确认选座复用现有选座 UI；座位数据与「座位管理」同源。  
**前序文档：** `2026-07-14-seat-based-appointment-design.md`（用户选座方案）在 C 端路径上由本文替代。

---

## 1. 目标

将首页「预约开拼」从**用户自主选座占座**改为**意向登记**，避免占座与信用问题影响店铺经营。排座权在店主：确认时复用现有选座页；到店后与座位管理状态同步。

## 2. 范围

### 2.1 要做

- C 端：会员登记（无座位图、无占座、无信用）
- 店主看板 · 预约管理：列表 + 确认 / 拒绝 / 去开台
- 确认时进入现有选座 UI（`mode=assign`），写入 `seatIds`
- 开台成功自动将预约转为已到店（不再单独「标已到店」）
- 会员「我的预约」查看状态；待确认可取消

### 2.2 明确不做（第一版）

- 用户选座、锁座、信用扣减
- 时段人数软限流（后续可加）
- 登记备注、套餐、美团券码字段
- 预约页内计时 / 续时（仍归座位管理 timer）
- 到店自动开台

## 3. 产品决策摘要

| 项 | 决策 |
|----|------|
| 容量策略 | 先纯登记，软限流以后再加 |
| 登记字段 | 日期 + 时段 + 人数 + 姓名 + 手机 + 来源（无备注） |
| 手机号 | 预填会员注册号，可改 |
| 日期 | 仅今天、明天；UI 为两个选项，无日历选择器 |
| 准入 | 必须先成为会员 |
| 确认选座 | 复用 `pages/appointment` 选座能力，`mode=assign` |
| 座位数据 | 与座位管理一致：`api.getSeats()`（云库 `seats`） |
| 到店 | 状态转换并同步座位管理待开台 |

## 4. 用户流

1. 会员点首页「预约开拼」→ 登记表单（今/明二选一、时段连续多选、人数、姓名、手机预填、来源）→ 提交 → `pending`
2. 店主在预约管理看到列表 → 确认（进选座）/ 拒绝 /（已确认后）去开台
3. 确认选座成功 → `confirmed` + `seatIds`；座位管理显示 reserved
4. 去开台并开台成功 → 自动 `arrived`，清除预约占位，进入体验中
5. 用户可在 `pending` 时取消 → `cancelled`

## 5. 页面与联动

### 5.1 C 端预约页（register）

- 去掉座位图步骤
- 日期：两个选项「今天」「明天」
- 时段：保留连续多选
- 人数：1–6
- 提交不写 `seatIds`

### 5.2 店主预约管理

- 入口：店主看板 → 预约管理（现有 `admin/appointments` 做成真列表）
- 操作：确认 / 拒绝 / 去开台（开台成功自动已到店）

### 5.3 确认选座联动

```
店主点「确认」
  → /pages/appointment/index?mode=assign&appointmentId=xxx
  → 预填并锁定：日期、时段、人数
  → 仅展示座位图（复用现网 map UI）
  → 座位列表：api.getSeats()（与座位管理同源）
  → 选满 peopleCount 个座位 →「确认排座」
  → 写回 seatIds、tableCode，status → confirmed
  → 返回店主看板
```

| | C 端 register | 店主 assign |
|--|--|--|
| 座位图 | 无 | 有 |
| 日期时段人数 | 用户填 | 预填锁定 |
| 座位数据 | 不涉及 | `api.getSeats()` |
| 结果 | pending | confirmed + seatIds |

**禁止**预约页再单独 `require(seed)` 座位表。

## 6. 状态机

```
pending ──确认选座──► confirmed ──开台成功──► arrived
   │
   ├──拒绝──► rejected
   └──用户取消──► cancelled
```

| 预约状态 | 座位管理 |
|----------|----------|
| pending | 不占座 |
| confirmed | seatIds + 时段 → reserved |
| arrived | 由开台写入；会话为体验中（in_use） |
| rejected / cancelled | 释放占用 |

**硬规则：** `adminStartSeatSession` 传入 `appointmentId` 时，开台成功后自动将预约改为 `arrived` 并清除预约占位；列表不再提供单独「标已到店」。

## 7. 数据字段

| 字段 | 说明 |
|------|------|
| memberId / openid | 会员 |
| name | 姓名/昵称 |
| phone | 预填可改；`/^1\d{10}$/` |
| appointmentDate | 今天或明天 |
| timeSlots[] | 连续时段 |
| peopleCount | 1–6 |
| source | 来源枚举 |
| status | pending / confirmed / rejected / cancelled / arrived |
| seatIds[] | 仅确认后写入 |
| tableCode | 由 seatIds 推导 |
| confirmedAt / arrivedAt / rejectedAt / createdAt | 时间戳 |

## 8. 校验

- C 端：已登录会员；日期为今或明；时段非空且连续；人数 1–6；姓名、手机合法；不校验座位
- 店主确认：`seatIds.length === peopleCount`；`assertCanBookSeats`；座位来自 `api.getSeats()`
- 拒绝/用户取消：仅 pending
- 开台转已到店：仅 confirmed（已 arrived 则跳过更新）

## 9. 错误处理

- 未会员 → 引导注册/登录后回预约
- 非法字段 → toast，不提交
- 选座冲突 → toast，留在选座页
- 无 seatIds 点到店 → 禁止
- 到店同步失败 → 失败提示，预约与座位管理状态保持一致（不出现半更新）

## 10. 验收标准

1. C 端无座位图、无备注；今/明二选一 + 时段 + 人数 + 姓名 + 预填手机 + 来源可提交 → pending
2. 店主可确认（进选座）/ 拒绝 / 去开台
3. 确认后座位管理显示 reserved；开台成功预约自动已到店
4. 拒绝/取消后座位管理无该占用
5. pending 用户可取消；非会员不可登记

## 11. 风险与后续

- 云库 `seats` 若与本地 seed 不一致，以云库（座位管理实际展示）为准；实现时预约选座必须走 API
- 软限流、确认后改座、到店自动开台：非第一版
- 历史「用户选座」样例数据/文案需清理，避免演示歧义
