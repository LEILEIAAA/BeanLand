# 微信充值云打通 实现计划

> **面向 AI 代理的工作者：** 子代理在本仓库禁用，于当前会话顺序执行。步骤用复选框跟踪。

**目标：** 会员注册保持云打通；充值支持微信支付主路径 + 店长代充，二者均写入 `recharge_orders`。

**架构：** 纯逻辑放 `miniprogram/utils/rechargeOrder.js`（可单测）；云函数经 `cloudfunctions/common` 共用入账；`createRechargeOrder` + `payRechargeNotify` 走云支付；`adminRecharge` 写代充订单。

**技术栈：** 微信小程序、云开发 `cloud.cloudPay`、Node test runner

---

## 文件

| 文件 | 职责 |
|---|---|
| `miniprogram/utils/rechargeOrder.js` | 订单草稿、状态、金额分、幂等判定 |
| `tests/rechargeOrder.test.js` | 上述纯逻辑测试 |
| `cloudfunctions/common/memberCredit.js` | 入账 + 升级 + 流水字段 |
| `cloudfunctions/common/payConfig.js` | envId / subMchId |
| `cloudfunctions/createRechargeOrder/*` | 建单 + unifiedOrder |
| `cloudfunctions/payRechargeNotify/*` | 支付回调入账 |
| `cloudfunctions/getRechargeOrder/*` | 查单 |
| `cloudfunctions/adminRecharge/index.js` | 代充写订单 |
| `miniprogram/utils/api.js` | 封装新接口 |
| `miniprogram/pages/recharge/*` | requestPayment |
| `scripts/cloudbase-seed-export/pay_config.example.json` | 商户号配置示例 |

### 任务 1：rechargeOrder 纯逻辑（TDD）

- [x] 失败测试：分换算、建草稿、状态可迁移、credited 幂等
- [x] 实现 `rechargeOrder.js`
- [x] 绿灯

### 任务 2：common 入账模块 + 云函数

- [x] `memberCredit.js` / `payConfig.js`
- [x] `createRechargeOrder` / `payRechargeNotify` / `getRechargeOrder`
- [x] 改造 `adminRecharge` 写 `recharge_orders`

### 任务 3：前端

- [x] `api.js` 对接
- [x] 充值页微信支付 + 文案
- [x] 流水展示 channel（若已有字段则映射文案）

### 任务 4：文档与验证

- [x] `node --test tests/rechargeOrder.test.js` + 相关回归
- [x] task-docs plan/impl 回写
