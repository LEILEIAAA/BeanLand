# 文创拼豆手作店小程序 Day 1 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在没有现成工程的工作区内，建立可运行、可测试、可继续扩展的微信小程序 MVP 基础工程。

**架构：** 第一阶段采用原生微信小程序目录结构，业务配置集中在 `miniprogram/data/seed.js`，核心经营逻辑集中在 `miniprogram/utils/business.js`。用户端和后台端页面先建立路由、视觉骨架和关键交互，后续再接入云开发或服务端数据。

**技术栈：** 微信小程序原生 WXML/WXSS/JS、Node.js 内置测试能力、CommonJS 业务模块。

---

## 文件职责

- `project.config.json`：微信开发者工具项目配置。
- `miniprogram/app.js`：小程序启动入口和全局数据。
- `miniprogram/app.json`：页面路由、窗口样式、底部导航。
- `miniprogram/app.wxss`：全局视觉系统、色彩、卡片、按钮、表单基础样式。
- `miniprogram/data/seed.js`：开业 MVP 的套餐、活动、时段、桌号、充值档位、会员示例数据。
- `miniprogram/utils/business.js`：预约、计时、储值、消费扣款等核心计算逻辑。
- `tests/business.test.js`：核心业务逻辑测试。
- `miniprogram/pages/**`：用户端与后台端页面骨架。
- `docs/progress/bean-shop-miniprogram-mvp-progress.md`：阶段性进度、风险、验证记录。

## 任务 1：建立核心业务测试

**文件：**
- 创建：`tests/business.test.js`
- 修改：无

- [ ] **步骤 1：编写失败的测试**

```javascript
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateExpectedEndTime,
  calculateOvertime,
  applyRecharge,
  spendBalance,
  createAppointmentSummary,
} = require('../miniprogram/utils/business');

test('calculateExpectedEndTime adds package duration to selected date and slot', () => {
  const result = calculateExpectedEndTime('2026-07-10', '13:00-15:00', 120);
  assert.equal(result.iso, '2026-07-10T15:00:00.000+08:00');
  assert.equal(result.display, '2026-07-10 15:00');
});

test('calculateOvertime returns zero before grace minutes and fee after overtime', () => {
  assert.deepEqual(calculateOvertime(120, 132, 15, 15), {
    overtimeMinutes: 0,
    fee: 0,
    billableUnits: 0,
  });

  assert.deepEqual(calculateOvertime(120, 166, 15, 15), {
    overtimeMinutes: 46,
    fee: 30,
    billableUnits: 2,
  });
});

test('applyRecharge separates principal and bonus balance', () => {
  const member = { principalBalance: 40, bonusBalance: 8, totalRecharge: 40, totalBonus: 8 };
  const result = applyRecharge(member, { rechargeAmount: 300, bonusAmount: 40 });

  assert.equal(result.member.principalBalance, 340);
  assert.equal(result.member.bonusBalance, 48);
  assert.equal(result.member.totalBalance, 388);
  assert.equal(result.transaction.type, 'recharge');
  assert.equal(result.transaction.principalDelta, 300);
  assert.equal(result.transaction.bonusDelta, 40);
});

test('spendBalance consumes bonus first then principal and records transaction', () => {
  const member = { principalBalance: 100, bonusBalance: 20, totalSpent: 0 };
  const result = spendBalance(member, 89, '标准拼豆体验');

  assert.equal(result.member.bonusBalance, 0);
  assert.equal(result.member.principalBalance, 31);
  assert.equal(result.member.totalBalance, 31);
  assert.equal(result.member.totalSpent, 89);
  assert.equal(result.transaction.bonusDelta, -20);
  assert.equal(result.transaction.principalDelta, -69);
});

test('createAppointmentSummary includes expected end time and meituan fields', () => {
  const summary = createAppointmentSummary({
    name: '小豆',
    packageName: '双人主题套餐',
    appointmentDate: '2026-07-10',
    timeSlot: '18:30-20:30',
    peopleCount: 2,
    durationMinutes: 120,
    isMeituan: true,
    meituanCode: 'MT123',
  });

  assert.equal(summary.title, '小豆的预约');
  assert.equal(summary.expectedEndTime.display, '2026-07-10 20:30');
  assert.equal(summary.tags.includes('美团来源'), true);
  assert.equal(summary.tags.includes('券码 MT123'), true);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/business.test.js`

预期：FAIL，报错找不到 `../miniprogram/utils/business` 或函数未定义。

## 任务 2：实现核心业务逻辑

**文件：**
- 创建：`miniprogram/utils/business.js`
- 测试：`tests/business.test.js`

- [ ] **步骤 1：编写最少实现代码**

实现函数：

```javascript
function calculateExpectedEndTime(date, timeSlot, durationMinutes) {
  const [start] = timeSlot.split('-');
  const [hour, minute] = start.split(':').map(Number);
  const startDate = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  return formatDateResult(endDate);
}
```

- [ ] **步骤 2：运行测试验证通过**

运行：`node --test tests/business.test.js`

预期：PASS，5 个测试通过。

## 任务 3：创建小程序基础工程配置

**文件：**
- 创建：`project.config.json`
- 创建：`miniprogram/app.js`
- 创建：`miniprogram/app.json`
- 创建：`miniprogram/app.wxss`

- [ ] **步骤 1：写入项目配置和路由**

页面必须包含用户端首页、套餐、活动、预约、路线、会员、充值，以及后台看板、预约管理、计时管理。

- [ ] **步骤 2：写入全局视觉系统**

设计标准：

- 主色：温暖奶油色、豆豆橙、天空蓝点缀。
- 触控区域：按钮最小高度 44 px。
- 卡片：圆角、轻阴影、清晰信息层级。
- 状态：成功、警告、危险、信息色明确。

## 任务 4：创建业务种子数据

**文件：**
- 创建：`miniprogram/data/seed.js`

- [ ] **步骤 1：固化 MVP 开业数据**

必须包含：

- 7 个套餐。
- 7 个活动类型。
- 5 个固定预约时段。
- 7 个桌号。
- 3 个充值档位。
- 会员标签、优惠券、集章规则。

## 任务 5：创建用户端页面骨架

**文件：**
- 创建：`miniprogram/pages/home/*`
- 创建：`miniprogram/pages/packages/*`
- 创建：`miniprogram/pages/activities/*`
- 创建：`miniprogram/pages/appointment/*`
- 创建：`miniprogram/pages/route/*`
- 创建：`miniprogram/pages/member/*`
- 创建：`miniprogram/pages/recharge/*`

- [ ] **步骤 1：实现页面关键内容**

首页要展示主视觉、套餐、活动、路线、预约入口。预约页要支持套餐、日期、时段、人数、来源、美团券码和同意规则。

## 任务 6：创建后台端页面骨架

**文件：**
- 创建：`miniprogram/pages/admin/dashboard/*`
- 创建：`miniprogram/pages/admin/appointments/*`
- 创建：`miniprogram/pages/admin/timer/*`

- [ ] **步骤 1：实现管理端核心视图**

后台看板展示今日预约、储值金额、活动报名、即将超时。预约管理展示状态流转。计时管理展示桌号、剩余时间、超时状态和操作按钮。

## 任务 7：验证并更新进度文档

**文件：**
- 修改：`docs/progress/bean-shop-miniprogram-mvp-progress.md`

- [ ] **步骤 1：运行验证**

运行：`node --test tests/business.test.js`

预期：PASS。

- [ ] **步骤 2：记录验证结果**

把命令、结果和下一步写入进度文档。
