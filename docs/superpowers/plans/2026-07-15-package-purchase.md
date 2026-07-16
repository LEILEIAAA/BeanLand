# 套餐购买（余额 / 微信）实现计划

> **面向 AI 代理的工作者：** 子代理在本仓库禁用，于当前会话顺序执行。步骤用复选框跟踪。

**目标：** 套餐页购买不跳预约；支持优惠券抵扣；支付方式二选一（余额 / 微信支付）；不做混合支付。

**架构：** 纯逻辑放 `miniprogram/utils/packagePurchase.js`；云函数余额直购 `purchasePackage`、微信下单 `createPackageOrder` + 回调 `payPackageNotify` + 查单 `getPackageOrder`；套餐页弹层选券与支付方式。

**技术栈：** 微信小程序、云开发 `cloud.cloudPay`、Node test runner

---

## 文件

| 文件 | 职责 |
|---|---|
| `miniprogram/utils/packagePurchase.js` | 券匹配、计价、订单草稿、状态 |
| `tests/packagePurchase.test.js` | 纯逻辑测试 |
| `cloudfunctions/common/memberCredit.js` | 增加余额扣款 |
| `cloudfunctions/purchasePackage/*` | 余额购买 + 核销券 |
| `cloudfunctions/createPackageOrder/*` | 微信建单 |
| `cloudfunctions/payPackageNotify/*` | 支付回调履约 |
| `cloudfunctions/getPackageOrder/*` | 查单轮询 |
| `miniprogram/utils/api.js` | 封装接口 |
| `miniprogram/pages/packages/*` | 购买弹层 UI |
| `cloudbaserc.json` | 注册云函数 |

### 任务 1：packagePurchase 纯逻辑（TDD）

- [x] 失败测试：券匹配、最优券、计价、草稿、幂等
- [x] 实现 `packagePurchase.js`
- [x] 绿灯

### 任务 2：云扣款 + 云函数

- [x] `memberCredit.debitMemberSpend`
- [x] `purchasePackage` / `createPackageOrder` / `payPackageNotify` / `getPackageOrder`
- [x] 拷贝公共模块进各函数目录；更新 `cloudbaserc.json` / `payConfig`

### 任务 3：前端套餐页

- [x] `api.js` 对接
- [x] 弹层：选券、余额/微信、确认支付
- [x] 文案 CTA 改为立即购买

### 任务 4：验证与文档

- [x] `node --test tests/packagePurchase.test.js` + 相关回归
- [x] task-docs plan/impl 回写
