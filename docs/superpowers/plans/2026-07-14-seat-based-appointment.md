# 座位预约制度 实现计划

> **面向 AI 代理的工作者：** 本仓库禁止 Task/子代理；在当前会话内联执行。步骤使用复选框跟踪进度。

**目标：** 实现固定时段下的座位级点选预约（同桌连座），用户端三态选座，店主端四态座位图，并以纯函数单测锁住规则。

**架构：** 从现有 `tables` 展开 `seats`；用 `occupancies` 表达时段占用；`utils/seats.js` 提供连座与状态映射；预约页接入选座；店主 timer 页展示四态。无后端阶段全部本地 seed + 纯函数。

**技术栈：** 微信小程序、Node `node --test`、现有 `business.js` 预计结束时间逻辑

**规格：** `docs/superpowers/specs/2026-07-14-seat-based-appointment-design.md`

**执行状态：** 已完成代码落地与单测验证（2026-07-14）；Commit 待用户指示。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `miniprogram/utils/seats.js` | 座位展开、连座、用户/店主状态、可约校验 |
| `tests/seats.test.js` | 上述纯函数测试 |
| `miniprogram/data/seed.js` | 导出 seats、示例 occupancies；标记日常可选桌 |
| `miniprogram/utils/business.js` | `createAppointmentSummary` 增加桌号/座位展示 |
| `tests/business.test.js` | 摘要含座位字段回归 |
| `miniprogram/pages/appointment/index.js` | 选座状态与提交校验 |
| `miniprogram/pages/appointment/index.wxml` | 选座 UI |
| `miniprogram/pages/appointment/index.wxss` | 三态样式 |
| `miniprogram/pages/admin/timer/index.js` | 店主四态座位数据 |
| `miniprogram/pages/admin/timer/index.wxml` | 座位图 |
| `miniprogram/pages/admin/timer/index.wxss` | 四态样式 |

---

### 任务 1：座位纯函数 — 展开与连座

**文件：**
- 创建：`miniprogram/utils/seats.js`
- 测试：`tests/seats.test.js`

- [x] **步骤 1：编写失败的测试**
- [x] **步骤 2：运行测试验证失败**
- [x] **步骤 3：编写最少实现代码**
- [x] **步骤 4：运行测试验证通过**
- [ ] **步骤 5：Commit**（仅当用户要求提交时执行）

---

### 任务 2：用户三态 / 店主四态与可约校验

**文件：**
- 修改：`miniprogram/utils/seats.js`
- 修改：`tests/seats.test.js`

- [ ] **步骤 1：编写失败的测试**

```js
const {
  getSeatUserStatus,
  getSeatAdminStatus,
  assertCanBookSeats,
} = require('../miniprogram/utils/seats');

describe('seat status mapping', () => {
  const seat = { id: 'W1-1', tableCode: 'W1', index: 1, maintenance: false };

  it('maps user three-state', () => {
    assert.equal(getSeatUserStatus(seat, { bookedSeatIds: new Set(), inUseSeatIds: new Set() }), 'available');
    assert.equal(getSeatUserStatus(seat, { bookedSeatIds: new Set(['W1-1']), inUseSeatIds: new Set() }), 'booked');
    assert.equal(getSeatUserStatus(seat, { bookedSeatIds: new Set(), inUseSeatIds: new Set(['W1-1']) }), 'unavailable');
    assert.equal(getSeatUserStatus({ ...seat, maintenance: true }, { bookedSeatIds: new Set(), inUseSeatIds: new Set() }), 'unavailable');
  });

  it('maps admin four-state with remaining minutes', () => {
    assert.equal(getSeatAdminStatus(seat, { reservedSeatIds: new Set(), inUse: {}, maintenanceIds: new Set() }), 'idle');
    assert.equal(getSeatAdminStatus(seat, { reservedSeatIds: new Set(['W1-1']), inUse: {}, maintenanceIds: new Set() }), 'reserved');
    const inUse = getSeatAdminStatus(seat, {
      reservedSeatIds: new Set(),
      inUse: { 'W1-1': { remainingMinutes: 42 } },
      maintenanceIds: new Set(),
    });
    assert.deepEqual(inUse, { status: 'in_use', remainingMinutes: 42 });
    assert.equal(getSeatAdminStatus(seat, { reservedSeatIds: new Set(), inUse: {}, maintenanceIds: new Set(['W1-1']) }), 'maintenance');
  });
});

describe('assertCanBookSeats', () => {
  const seats = buildSeatsFromTables([{ code: 'W1', area: '窗边区', capacity: 4, bookable: true }]);

  it('accepts contiguous available seats matching peopleCount', () => {
    const result = assertCanBookSeats({
      seats,
      seatIds: ['W1-1', 'W1-2'],
      peopleCount: 2,
      bookedSeatIds: new Set(),
      inUseSeatIds: new Set(),
      maintenanceIds: new Set(),
    });
    assert.equal(result.ok, true);
  });

  it('rejects conflict and non-contiguous', () => {
    assert.equal(assertCanBookSeats({
      seats,
      seatIds: ['W1-1', 'W1-2'],
      peopleCount: 2,
      bookedSeatIds: new Set(['W1-2']),
      inUseSeatIds: new Set(),
      maintenanceIds: new Set(),
    }).ok, false);

    assert.equal(assertCanBookSeats({
      seats,
      seatIds: ['W1-1', 'W1-3'],
      peopleCount: 2,
      bookedSeatIds: new Set(),
      inUseSeatIds: new Set(),
      maintenanceIds: new Set(),
    }).ok, false);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/seats.test.js`  
预期：FAIL（函数未导出）

- [ ] **步骤 3：实现状态映射与 assertCanBookSeats**

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test tests/seats.test.js`  
预期：PASS

---

### 任务 3：Seed 座位与示例占用

**文件：**
- 修改：`miniprogram/data/seed.js`

- [ ] **步骤 1：为 tables 增加 `bookable`，活动桌 false**

```js
const tables = [
  { code: 'W1', area: '窗边区', capacity: 4, bookable: true },
  { code: 'W2', area: '窗边区', capacity: 4, bookable: true },
  { code: 'A1', area: '日常体验区', capacity: 4, bookable: true },
  { code: 'A2', area: '日常体验区', capacity: 4, bookable: true },
  { code: 'A3', area: '日常体验区', capacity: 4, bookable: true },
  { code: 'A4', area: '日常体验区', capacity: 4, bookable: true },
  { code: 'L1', area: '长桌区', capacity: 8, bookable: true },
  { code: 'E1', area: '活动区', capacity: 12, bookable: false },
  { code: 'E2', area: '活动区', capacity: 12, bookable: false },
];
```

- [ ] **步骤 2：用 buildSeatsFromTables 生成 seats，并导出示例 occupancies**

```js
const { buildSeatsFromTables } = require('../utils/seats');
const seats = buildSeatsFromTables(tables);
const seatOccupancies = [
  { date: '2026-07-10', timeSlot: '13:00-15:00', seatId: 'W1-1', type: 'reserved' },
  { date: '2026-07-10', timeSlot: '13:00-15:00', seatId: 'W1-2', type: 'reserved' },
  { date: '2026-07-10', timeSlot: '13:00-15:00', seatId: 'A2-1', type: 'in_use', remainingMinutes: 58 },
  { date: '2026-07-10', timeSlot: '13:00-15:00', seatId: 'A3-4', type: 'maintenance' },
];
```

- [ ] **步骤 3：module.exports 增加 seats、seatOccupancies**

- [ ] **步骤 4：运行 `node --test tests/seats.test.js tests/business.test.js` 确认无回归**

---

### 任务 4：预约摘要带座位

**文件：**
- 修改：`miniprogram/utils/business.js`
- 修改：`tests/business.test.js`

- [ ] **步骤 1：扩展测试**

```js
it('includes table and seats in appointment summary', () => {
  const summary = createAppointmentSummary({
    name: '小豆',
    packageName: '双人主题套餐',
    appointmentDate: '2026-07-10',
    timeSlot: '13:00-15:00',
    peopleCount: 2,
    durationMinutes: 120,
    isMeituan: false,
    tableCode: 'W1',
    seatIds: ['W1-3', 'W1-4'],
  });
  assert.equal(summary.tableCode, 'W1');
  assert.deepEqual(summary.seatIds, ['W1-3', 'W1-4']);
  assert.equal(summary.seatLabel, 'W1-3、W1-4');
});
```

- [ ] **步骤 2：运行确认失败 → 实现 → 再跑通过**

---

### 任务 5：用户预约页选座 UI

**文件：**
- 修改：`miniprogram/pages/appointment/index.js`
- 修改：`miniprogram/pages/appointment/index.wxml`
- 修改：`miniprogram/pages/appointment/index.wxss`

- [ ] **步骤 1：页面加载 seats + 按当前日期时段计算用户三态**

- [ ] **步骤 2：按桌分组渲染座位；点击切换选择；人数/时段变化清空选择**

- [ ] **步骤 3：submit 调用 assertCanBookSeats，通过后 createAppointmentSummary 带 seatIds**

- [ ] **步骤 4：摘要区展示桌号与座位**

- [ ] **步骤 5：手动用开发者工具点选验证（或 `node` 抽逻辑已测则页面走查清单）**

---

### 任务 6：店主计时页四态座位图

**文件：**
- 修改：`miniprogram/pages/admin/timer/index.js`
- 修改：`miniprogram/pages/admin/timer/index.wxml`
- 修改：`miniprogram/pages/admin/timer/index.wxss`

- [ ] **步骤 1：用 seats + seatOccupancies 生成 admin 状态列表（含 remainingMinutes）**

- [ ] **步骤 2：按区域/桌渲染四态色块与剩余时间文案**

- [ ] **步骤 3：保留原有会话列表，座位图置于上方**

---

### 任务 7：全量验证

- [ ] **步骤 1：`node --test tests/seats.test.js tests/business.test.js`**
- [ ] **步骤 2：对照规格验收标准逐条勾选**
- [ ] **步骤 3：更新 `docs/progress/bean-shop-miniprogram-mvp-progress.md` 记录座位预约进展（若本轮有实质代码落地）**

---

## 自检

1. 规格覆盖：模型、三态/四态、连座、用户流、店主流、边界 → 任务 1–6  
2. 无占位符步骤  
3. 命名统一：`available|booked|unavailable` 与 `idle|reserved|in_use|maintenance`
