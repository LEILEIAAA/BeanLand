# 金额展示精度 实现计划

> **面向 AI 代理的工作者：** 在当前会话内联执行（禁止子代理）。步骤用复选框跟踪。

**目标：** 所有面向用户的金额展示消除浮点长尾，整数显示为 `99`，有小数最多两位。

**架构：** 在 `money.js` 增加权威 `formatYuan`；页面保留数值字段做比较，展示走格式化字段；删除各页重复的本地 `formatYuan`。

**技术栈：** 微信小程序 JS / WXML，Node `node:test`

---

### 任务 1：formatYuan 工具

**文件：**
- 修改：`miniprogram/utils/money.js`
- 测试：`tests/money.test.js`

- [x] **步骤 1：编写失败的测试**（含截图浮点 `0.060000000000000005` → `0.06`，`99` → `99`）
- [x] **步骤 2：运行确认失败**
- [x] **步骤 3：实现 `formatYuan`**
- [x] **步骤 4：运行确认通过**

### 任务 2：活动报名 / 套餐购买支付展示

**文件：**
- 修改：`miniprogram/pages/activities/register/index.js` + `.wxml`
- 修改：`miniprogram/pages/packages/index.js` + `.wxml`

- [x] 余额、实付、抵扣、价签、弹窗文案全部 `formatYuan`
- [x] 本地 `formatYuan` 改为引用 `utils/money`

### 任务 3：其余裸绑金额

**文件：** 后台充值/发券/核销、活动报名管理、会员行程、首页价签、充值预览、`adminMemberDisplay`、`seatSessionHistory` 等

- [x] 统一展示格式化
- [x] 更新受影响单测（如 `adminMemberDisplay`）
- [x] 跑 `node --test tests/money.test.js` 及相关测试并贴证据
