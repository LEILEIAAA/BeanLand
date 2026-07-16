# 预约确认后 15 分钟保留 / 超时未到店设计规格

**日期：** 2026-07-16  
**状态：** 已确认（待实现）  
**关联：** 登记式预约 `2026-07-16-appointment-registration-design.md`；座位管理预约态 `seatSession.buildReservationsBySeatId`

---

## 1. 目标

商家确认排座后，从预约开始时间起预留座位 15 分钟；超时未到店则自动将预约标为「未到店」，释放座位占用，并在预约管理 / 座位管理 / 我的预约中可见。

同步文案：待确认 → 待商家确认；说明用户按时到店与超时规则。

## 2. 产品决策

| 项 | 决策 |
|----|------|
| 适用状态 | 仅 `confirmed`（已确认、已排座、未开台） |
| 起算点 | 预约首个时段开始时间（如 `10:00-12:00` → `10:00`，时区 +08:00） |
| 宽限 | 开始后 15 分钟（`HOLD_MINUTES = 15`） |
| 超时结果 | `confirmed` → `no_show`，展示「未到店」 |
| 座位 | 删除该预约对应 `seat_occupancies`（`type=reserved`），座位管理不再显示预约占用 |
| 触发 | 打开列表时结算：`adminListAppointments` / `adminListSeatBoard` / `listMyAppointments` 返回前先扫描并落库 |
| 用户取消 | 仍仅 `pending` 可取消；`no_show` 不可取消 |
| 开台 | `arrived` 不受影响；已开台不会被扫成未到店 |
| 与用户取消区分 | 新状态 `no_show`，不用 `cancelled` |

## 3. 文案

### 3.1 状态标签

| status | 展示 |
|--------|------|
| `pending` | 待商家确认 |
| `confirmed` | 已确认 |
| `arrived` | 已到店 |
| `rejected` | 已拒绝 |
| `cancelled` | 已取消 |
| `no_show` | 未到店 |

### 3.2 我的预约页说明

> 商家确认后请按时到店。预约开始后座位保留 15 分钟，超时未到将自动取消，以免影响其他客人。待商家确认状态可自行取消。

（「自动取消」对用户口语；系统状态为「未到店」，非 `cancelled`。）

### 3.3 取消弹窗等

涉及「待确认」处改为「待商家确认」（如取消确认文案）。

## 4. 状态机增量

在现有 `TRANSITIONS` 上：

- `no_show` 为终态（不可 confirm / reject / cancel / arrive）
- 超时路径不走用户 `cancel` 迁移，由结算函数直接写 `no_show`
- `reservationPhaseFromStatus`：`no_show` 与 `cancelled` / `rejected` 一样不占座

可选落库字段（便于审计）：

- `noShowAt: number`
- `cancelReason: 'timeout'`（仅超时路径；用户取消可不写或写 `user`）

## 5. 纯函数（`appointmentRegistration.js`）

| 函数 | 职责 |
|------|------|
| `HOLD_MINUTES` | 常量 `15` |
| `resolveNoShowDeadline(appointmentDate, timeSlots)` | 取首段 `start`，拼 `date + start +08:00` → 截止毫秒（开始 + 15 分钟） |
| `shouldMarkNoShow(appt, now)` | `status === confirmed` 且 `now >= deadline` |
| `buildNoShowFields(now)` | `{ status: no_show, noShowAt, cancelReason: 'timeout', updatedAt }` |

多时段：截止点只看**第一个**时段的开始，不看末段。

## 6. 云侧结算

共享逻辑（可放在各云函数复制的 `appointmentRegistration.js`，或抽小模块同步）：

1. 查询相关 `confirmed` 预约（座位看板：今日；列表：当前查询结果或今日范围）
2. 对 `shouldMarkNoShow` 为真的文档：`update` 为 `no_show` 字段
3. 删除 `seat_occupancies` 中 `appointmentId` 匹配且 `type === 'reserved'` 的记录（按占用 `_id` 或查询后删）
4. 再组装列表 / 座位汇总返回

入口：

- `listMyAppointments`
- `adminListAppointments`
- `adminListSeatBoard`（保证座位图与预约态一致）

幂等：已是 `no_show` 的跳过；占用已删则忽略。

## 7. UI

| 面 | 行为 |
|----|------|
| 会员「我的预约」 | 说明文案更新；`no_show` 显示「未到店」；无取消按钮 |
| 店主「预约管理」 | 「未到店」标签；无确认/拒绝/开台 |
| 座位管理 | 结算后该座不再出现预约占用 / 待开台 |

## 8. 范围外（本轮不做）

- 云定时触发器
- 订阅消息 / 短信提醒
- 爽约次数限制或黑名单
- `pending` 超时自动取消

## 9. 验收

1. `confirmed` + 当前时间 ≥ 首段开始 + 15 分钟 → 打开任一列表后变为「未到店」，占用清除
2. 未满 15 分钟 → 仍「已确认」，座位仍 reserved
3. `pending` / `arrived` / `cancelled` 不被误标
4. 用户端说明文案与「待商家确认」标签正确
5. 单测覆盖截止计算、`shouldMarkNoShow`、座位汇总忽略 `no_show`

## 10. 测试要点

- 截止时间：单时段 / 多时段取首段
- `now` 边界：刚好 15 分钟、差 1 分钟
- 状态过滤：非 `confirmed` 不转换
- `buildReservationsBySeatId`：`no_show` 不产生 phase
