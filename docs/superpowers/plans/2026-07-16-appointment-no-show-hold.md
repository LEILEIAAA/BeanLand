# 预约超时未到店（15 分钟）实现计划

> **面向 AI 代理的工作者：** 在本会话内联执行（Cursor 禁止子代理）。步骤用复选框跟踪。

**目标：** `confirmed` 预约自首段开始时间起保留 15 分钟；超时打开列表时结算为 `no_show`（未到店）并清除 `reserved` 占用；文案改为待商家确认 + 到店说明。

**架构：** 纯函数扩展 `appointmentRegistration.js`；三处列表云函数返回前调用结算；`seatSession` 忽略 `no_show`；UI 只消费 `STATUS_LABEL`。

**技术栈：** 微信小程序 + 云函数 + Node test

**规格：** `docs/superpowers/specs/2026-07-16-appointment-no-show-hold-design.md`

---

## 文件

| 文件 | 职责 |
|------|------|
| `miniprogram/utils/appointmentRegistration.js` | STATUS/LABEL、截止计算、shouldMarkNoShow、buildNoShowFields |
| `miniprogram/utils/seatSession.js` | `no_show` 不占座 |
| `tests/appointmentRegistration.test.js` | 纯函数单测 |
| `tests/seatSession.test.js` | no_show 不汇总预约 |
| `cloudfunctions/*/appointmentRegistration.js` | 与小程序同步拷贝 |
| `cloudfunctions/listMyAppointments/index.js` | 结算后返回 |
| `cloudfunctions/adminListAppointments/index.js` | 结算后返回 |
| `cloudfunctions/adminListSeatBoard/index.js` | 结算后汇总座位 |
| `miniprogram/pages/member/appointments/*` | 说明与取消文案 |

---

### 任务 1：纯函数 + 失败测试

- [x] 写 `resolveNoShowDeadline` / `shouldMarkNoShow` / `buildNoShowFields` / LABEL 测试
- [x] 红 → 实现 → 绿
- [x] `seatSession`：`no_show` 不占座测试 + 实现

### 任务 2：云函数结算

- [x] 同步 `appointmentRegistration.js` 到相关云函数
- [x] 增加 `settleNoShowAppointments(db, rows, now)` 逻辑（各入口复用同一模式）
- [x] 接入三个 list 入口

### 任务 3：UI 文案

- [x] 我的预约说明 + 取消弹窗「待商家确认」
- [x] 验证 `STATUS_LABEL.pending` / `no_show`

### 任务 4：验证

- [x] `node --test tests/appointmentRegistration.test.js tests/seatSession.test.js`
- [x] 写 task-docs plan/impl；nova_guard / verify
