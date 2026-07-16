# 预约登记（去用户选座）实现计划

> **面向 AI 代理的工作者：** 本仓库禁止 Task/子代理；在当前会话内联执行。步骤使用复选框跟踪。

**目标：** C 端改为今明二选一登记（无选座）；店主确认复用选座 UI + `api.getSeats()`；到店同步座位管理待开台。

**架构：** 纯函数 `appointmentRegistration.js` 锁校验/状态机/占用文档；云函数 create/list/update/cancel 真实写 `appointments` + `seat_occupancies`；预约页双模式 register/assign；店主预约管理接云。

**技术栈：** 微信小程序、云开发、Node `node --test`

**规格：** `docs/superpowers/specs/2026-07-16-appointment-registration-design.md`

**Nova run：** `20260716-113708`

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `miniprogram/utils/appointmentRegistration.js` | 登记校验、状态流转、占用文档、tableCode |
| `tests/appointmentRegistration.test.js` | 单测 |
| `miniprogram/utils/seatSession.js` | 预约状态纳入 reserved/arrived 汇总 |
| `tests/seatSession.test.js` | 回归 |
| `cloudfunctions/createAppointment/` | 会员登记 → pending |
| `cloudfunctions/listMyAppointments/` | 我的预约 |
| `cloudfunctions/cancelAppointment/` | pending 取消 |
| `cloudfunctions/adminListAppointments/` | 店主列表 |
| `cloudfunctions/adminUpdateAppointment/` | confirm/reject/arrive + 占用同步 |
| `miniprogram/pages/appointment/*` | register / assign 双模式 |
| `miniprogram/pages/admin/appointments/*` | 店主看板 |
| `miniprogram/pages/member/appointments/*` | 我的预约接云 |

---

### 任务 1：纯函数 + 单测

- [ ] 编写失败测试 → 实现 → 绿灯
- [ ] 更新 `buildReservationsBySeatId`：confirmed=reserved，arrived=待开台标记；跳过 pending/cancelled/rejected

### 任务 2：云函数真实写入

- [ ] createAppointment：无 seatIds，写 appointments
- [ ] adminUpdateAppointment：confirm 写 seatIds + reserved 占用；reject/arrive；arrive 同步占用 type=arrived
- [ ] list/cancel/adminList

### 任务 3：C 端登记页

- [ ] 今/明二选一；去座位图/备注/套餐/美团；手机预填；会员门禁；调 createAppointment

### 任务 4：店主确认选座 + 列表

- [ ] admin/appointments 真列表与操作
- [ ] appointment `mode=assign` 用 api.getSeats()，确认排座调 adminUpdateAppointment

### 任务 5：验证 + 收尾文档

- [ ] `node --test tests/appointmentRegistration.test.js tests/seatSession.test.js`
- [ ] task-docs impl；nova_guard / verify

**执行状态：** `done`
