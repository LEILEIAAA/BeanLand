# 座位管理（座位会话）设计规格

> 日期：2026-07-16  
> 状态：已确认（含预约态+开台时段提示）  
> 范围：店主「座位管理」页；与预约解耦；会话绑定 `members`

## 1. 目标

店主按**座位**开台 / 结束 / 维护，不依赖预约单。计时页不出现预约概念与入口。

开台对象必须是**已注册会员**（`members`）。**单会员可多座**，多座合并为**一条会话**一并结算；结伴到店仍支持**一次批量开台**（多人多座按序配对，每人独立会话），开台后各自独立计时。

超过开台原定时长后**自动标记延时**，结束时累计总时长；**不做**手动 +15/+30 延长。

座位编号：`F1-A1…A6` / `F1-B1-B2` / `F1-C1…C6` / `F2-A|B|C1…6`。

## 2. 非目标

- 从预约单「到店开台」
- 计时页展示或筛选预约
- 超时自动扣费、付费续时（本版只记延时时长，不扣费）
- 手动延长按钮（+15 / +30）
- 物联网占座
- **本版不做**用户端「我的计时」页面
- **本版不做**结伴组绑定（`partyId`）、整组结束、整组延长
- **本版不做**会话内部分结束连座（多座须一并结算）

## 3. 领域模型

### 3.1 会员约束

- 开台对象必须是 `members` 文档；未注册不可开台。
- 同一会员同一时刻至多 **1** 条 `active` 会话。
- 开台写入会员快照：`memberId` / `memberOpenid` / `memberPhone` / `memberNickname`。

### 3.2 `seat_sessions`（座位会话）

| 字段 | 说明 |
|------|------|
| `_id` | 会话 ID |
| `memberId` | `members` 文档 `_id` |
| `memberOpenid` | 会员 openid |
| `memberPhone` / `memberNickname` | 开台快照 |
| `tableCode` | 该座位所属区号（由座位推导） |
| `seatIds` | 座位数组；单会员可多座如 `['F1-A1','F1-A3']`，结伴时长度 1 |
| `startedAt` | 开台时间（ms） |
| `expectedEndAt` | **原定**结束时间 = `startedAt + durationMinutes`（开台后不再被手动改写） |
| `durationMinutes` | 开台原定时长（不变） |
| `status` | `active` \| `ended` |
| `endedAt` | 实际结束时间（ms） |
| `totalMinutes` | 结束时写入：`floor((endedAt - startedAt) / 60000)` |
| `overtimeMinutes` | 结束时写入：`max(0, totalMinutes - durationMinutes)` |

进行中不落库「当前延时」；由客户端/列表接口用 `now` 现算：

- `elapsedMinutes = floor((now - startedAt) / 60000)`
- `remainingMinutes = max(0, floor((expectedEndAt - now) / 60000))`
- `overtimeMinutesLive = max(0, floor((now - expectedEndAt) / 60000))`
- `phase`：`within`（未到点）| `overtime`（已过点）

约束：

- 同一座位同一时刻至多一个 `active` 会话。
- 同一会员同一时刻至多一个 `active` 会话。
- **不写**结伴组字段（本版）。

### 3.3 `seat_occupancies` / 预约

- 开台：该座 `type: in_use` + `sessionId`。
- 结束：释放该座占用。
- **预约**：来自今日预约单（`appointmentDate`/`date` + `timeSlot`/`timeSlots` + `seatIds`）或 `seat_occupancies.type=reserved`；座位图展示「有预约」及时段；筛选含「预约」。
- 开台若选中预约座位：弹窗提示该座今日预约时段，确认后仍可开台。

## 4. 开台 / 结束 / 延时规则

### 4.1 开始计时（支持结伴批量）

**单人多座**：选 1 会员 + 多空闲座 → 开台，合并为 **1** 条 `active` 会话。

**单人单座**：选 1 会员 + 1 空闲座 → 开台。

**结伴**：

1. 按顺序多选会员（列表顺序有意义）。
2. 按顺序多选座位（顺序有意义；**不要求**同区、不要求连续）。
3. **人数必须等于座位数**；按序一一配对：`(member[i], seat[i])`。
4. 选定共用原定时长（默认 120，选项 `[30,60,90,120,150,180,210,240]`）。
5. 一次提交：为每一对创建**独立** `active` 会话（共 N 条）。
6. **整批原子**：任一对失败 → **全部不开台**。

取消的旧规则：一人多选连座；开台必须同区连续。

### 4.2 延时（自动，无手动延长）

- 未到 `expectedEndAt`：展示剩余分钟。
- 已过 `expectedEndAt` 且仍 `active`：标记为延时态，展示「已延时 X 分钟」；总已用 = 原定 + 延时。
- **无**「延长 +15/+30」入口；店员只需在适当时机点「结束」。
- 过点不自动结束、不自动扣费。

### 4.3 结束计时

- **仅单会话结束**：结束该会话 → 写 `endedAt` / `totalMinutes` / `overtimeMinutes` → 释放该会话下**全部**座位。
- **本版不做**整组一起结束。
- **本版不做**会话内部分结束。

### 4.4 维护

- 空闲座可锁/解锁维护；体验中座位须先结束再维护。

## 5. 店主 UI

### 5.1 选会员 / 选座位（有序多选）

- 会员、座位均保持点击顺序；人数 ≠ 座位数时禁用「开始计时」。
- 已有 active 的会员不可再选。

### 5.2 确认与进行中

- 开始前确认条：配对预览 + 原定时长。
- 进行中一人一行一座：
  - 未过点：`剩余 X 分钟`
  - 已过点：`已延时 X 分钟`（可同时标「延时」态）
- 操作：**结束**、维护；**无延长按钮**。

## 6. 云函数

| 函数 | 职责 |
|------|------|
| `adminListSeatBoard` | active 会话 + 维护 + in_use；返回 `remainingMinutes` / `overtimeMinutes` / `phase` |
| `adminStartSeatSession` | 批量：`memberIds[]` + `seatIds[]`（等长按序）+ `durationMinutes`；整批创建 |
| `adminEndSeatSession` | `sessionId` → 结束并写入 `totalMinutes` / `overtimeMinutes` |
| `adminSetSeatMaintenance` | 维护开关 |
| `adminFindMember` | 会员搜索 |

**下线产品路径**：`adminExtendSeatSession`（可保留云函数但本版 UI/API 不再调用；或部署后标废弃）。

## 7. 纯函数（可单测）

- `assertCanStartSeatBatch({ memberIds, seatIds, seatsById, blockedIds, busyMemberIds })`
- `buildStartPairs(memberIds, seatIds)`
- `calcSessionTime(startedAt, expectedEndAt, durationMinutes, now)` → `{ remainingMinutes, overtimeMinutes, elapsedMinutes, phase }`
- `buildEndSessionFields(session, endedAt)` → `{ totalMinutes, overtimeMinutes, status, endedAt }`

## 8. 验收标准

1. 单人 / 结伴按序配对开台正确；人数≠座位数拒绝；整批失败零写入。
2. 一人一座；同一会员不能两条 active。
3. 未过点显示剩余；过点显示已延时；无延长按钮。
4. 结束后 `totalMinutes` / `overtimeMinutes` 正确（含准时结束时 overtime=0）。
5. 仅单会话结束；无整组结束。
6. 计时页无预约文案。

## 9. 已锁定决策

| 议题 | 决策 |
|------|------|
| 落库 | 每人一条独立会话 |
| 座位约束 | 任意空闲座；不强制同区连续 |
| 结伴开台 | 一起开始；会员顺序 ↔ 座位顺序一一对应 |
| 结束 | 仅单人结束；一起结束暂不做 |
| 一人多座 | 不做 |
| 延时 | 过点自动标记延时；结束累计总时长；**不做手动 +15/+30** |
| 结伴组 / 整组操作 | 本版不做 |
