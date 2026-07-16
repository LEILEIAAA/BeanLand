# 一人一座 + 结伴批量开台 + 自动延时 实现计划

> 状态：已完成（2026-07-16）

**目标：** 将座位计时改为一人一座、结伴按序批量开台、过点自动延时累计；去掉手动延长与部分结束。

**架构：** 纯函数先改校验与时间计算；`adminStartSeatSession` 改为等长 `memberIds`/`seatIds` 整批原子开台；结束写 `totalMinutes`/`overtimeMinutes`；计时页多选会员/座位保持顺序并展示延时态。

**技术栈：** 微信小程序、云开发云函数、`node:test`

---

### 任务 1：纯函数 — 批量开台与延时计算

**文件：**
- 修改：`miniprogram/utils/seatSession.js`
- 测试：`tests/seatSession.test.js`

- [ ] 编写失败测试：`assertCanStartSeatBatch`、`buildStartPairs`、`calcSessionTime`、`buildEndSessionFields`
- [ ] 实现并通过 `node --test tests/seatSession.test.js`
- [ ] 同步拷贝到各座位云函数目录的 `seatSession.js`

### 任务 2：云函数开台 / 结束 / 看板

**文件：**
- 修改：`cloudfunctions/adminStartSeatSession/index.js`
- 修改：`cloudfunctions/adminEndSeatSession/index.js`
- 修改：`cloudfunctions/adminListSeatBoard/index.js`
- 修改：`miniprogram/utils/api.js`（入参形态）

- [ ] Start：`memberIds[]` + `seatIds[]` + `durationMinutes`；整批校验与写入
- [ ] End：写 `endedAt`/`totalMinutes`/`overtimeMinutes`；结束整场（唯一座位）
- [ ] Board：返回 `phase`/`overtimeMinutes`/`remainingMinutes`
- [ ] 部署三个云函数

### 任务 3：计时页 UI

**文件：**
- 修改：`miniprogram/pages/admin/timer/index.{js,wxml,wxss}`

- [ ] 有序多选会员 / 有序多选座位；人数≠座位数禁用开台
- [ ] 配对预览；去掉延长与部分结束
- [ ] 进行中展示剩余或已延时

### 任务 4：验证与收尾

- [ ] 跑通 `node --test tests/seatSession.test.js`
- [ ] 更新规格状态为已确认；写简短 impl 到 `task-docs/`（若跨文件）
- [ ] 部署完成证据
