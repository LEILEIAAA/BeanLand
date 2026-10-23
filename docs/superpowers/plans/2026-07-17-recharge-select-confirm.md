# 充值选档确认与自由额度 实现计划

> **面向 AI 代理的工作者：** 在当前会话内联执行（禁止子代理）。

**目标：** 充值页选档确认 + 自由额度（向下取档赠送）

**架构：** 纯逻辑 `resolveCustomRecharge` 前后端共用；云函数接受 `customAmount`；前端点选 + 底栏确认。

**技术栈：** 微信小程序、云开发、Node `node --test`

---

### 任务 1：resolveCustomRecharge

**文件：**
- 修改：`miniprogram/utils/rechargeOrder.js`
- 同步：`cloudfunctions/{common,createRechargeOrder,payRechargeNotify,adminRecharge}/rechargeOrder.js`
- 测试：`tests/rechargeOrder.test.js`

- [x] 红灯测试 → 实现 → 同步副本 → 绿灯

### 任务 2：云函数

**文件：** `cloudfunctions/createRechargeOrder/index.js`

- [x] 支持 `customAmount`，加载全部档位后解析

### 任务 3：充值页

**文件：** `miniprogram/pages/recharge/index.{js,wxml,wxss}`

- [x] 点选 + 自由额度输入 + 底栏确认 + 预览

### 任务 4：验证

- [x] `node --test tests/rechargeOrder.test.js` → 9 pass / 0 fail
