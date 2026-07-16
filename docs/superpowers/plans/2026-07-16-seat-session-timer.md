# 座位会话计时 实现计划

> **面向 AI 代理的工作者：** 本仓库禁止 Task/子代理；在当前会话内联执行。步骤使用复选框跟踪。

**目标：** 店主座位计时：选已注册会员 → 选座开台 → 结束/部分结束/延长/维护；与预约解耦。

**架构：** 纯函数 `seatSession.js` 锁规则；云集合 `seat_sessions` + `seat_occupancies`；云函数 board/start/end/extend/maintenance；timer 页接云。

**技术栈：** 微信小程序、云开发、Node `node --test`

**规格：** `docs/superpowers/specs/2026-07-16-seat-session-timer-design.md`

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `miniprogram/utils/seatSession.js` | 开台/结束/延长纯函数 |
| `tests/seatSession.test.js` | 单测 |
| `cloudfunctions/adminListSeatBoard/` | 座位图 + active 会话 |
| `cloudfunctions/adminStartSeatSession/` | 开台 |
| `cloudfunctions/adminEndSeatSession/` | 整场/部分结束 |
| `cloudfunctions/adminExtendSeatSession/` | 延长 |
| `cloudfunctions/adminSetSeatMaintenance/` | 维护锁 |
| `miniprogram/utils/api.js` | 封装 |
| `cloudbaserc.json` | 注册函数 |
| `miniprogram/pages/admin/timer/*` | 店主 UI |

---

### 任务 1：纯函数 + 单测

- [x] 失败测试 → 实现 → 通过

### 任务 2：云函数五件套 + api + cloudbaserc

- [x] 实现并注册

### 任务 3：timer 页

- [x] 选会员、选座开台、进行中操作、维护

### 任务 4：验证 + 文档

- [x] `node --test tests/seatSession.test.js tests/seats.test.js`
- [x] plan/impl 收尾

**执行状态：** `done`
