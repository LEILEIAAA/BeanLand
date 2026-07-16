# 连续时段多选 实现计划

> **面向 AI 代理的工作者：** 按任务顺序实现；步骤用复选框跟踪。子代理在本仓库禁用，于当前会话顺序执行。

**目标：** 预约页支持墙钟无缝连续多选时段，同座贯穿，结束时间取末场结束。

**架构：** 抽出 `utils/timeSlots.js` 承载选择/区间/结束时间逻辑；`seats.js` 增加多时段占用并集；预约页用 `selectedSlotIndexes` 替换单 `slotIndex`；seed 换方案 A 时段表。

**技术栈：** 微信小程序、Node test runner

---

## 文件

| 文件 | 职责 |
|---|---|
| `miniprogram/utils/timeSlots.js` | 连续选择、区间展示、末场结束 |
| `miniprogram/utils/seats.js` | `buildOccupancyUnion` |
| `miniprogram/utils/business.js` | summary 支持 `timeSlots[]` |
| `miniprogram/data/seed.js` | 新时段 + 样例占用 |
| `miniprogram/pages/appointment/*` | UI 多选 |
| `tests/timeSlots.test.js` | 新逻辑 |
| `tests/seats.test.js` / `business.test.js` | 增补与回归 |

### 任务 1：timeSlots 工具（TDD）

- [x] 失败测试：连续 toggle、区间格式、末场结束
- [x] 实现 `timeSlots.js`
- [x] 绿灯

### 任务 2：占用并集（TDD）

- [x] 失败测试：`buildOccupancyUnion`
- [x] 实现并导出
- [x] 绿灯

### 任务 3：summary + seed + 页面

- [x] `createAppointmentSummary` 支持多时段
- [x] 更新 seed / timer 默认 viewSlot / 管理样例时间
- [x] 预约页多选绑定
- [x] 全量相关测试

### 任务 4：文档

- [x] plan/impl task-docs + 进度补记
