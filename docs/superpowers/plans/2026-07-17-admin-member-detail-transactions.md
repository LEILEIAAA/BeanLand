# 会员详情储值流水实现计划

> **面向 AI 代理的工作者：** 在当前会话内联执行（禁止子代理）。步骤使用复选框跟踪。

**目标：** 会员详情页嵌入该会员完整储值流水，支持类型筛选。

**架构：** 扩展 `adminListMemberTransactions` 接受 `memberId`，解析会员 `_openid` 后过滤流水；详情页并行加载并复用全店流水展示口径。

**技术栈：** 微信小程序 + 云函数（wx-server-sdk）+ Node test

---

## 文件

- 修改：`cloudfunctions/adminListMemberTransactions/transactionStats.js`
- 修改：`cloudfunctions/adminListMemberTransactions/index.js`
- 修改：`miniprogram/utils/adminTransactionStats.js`（保持与云函数纯逻辑同步）
- 修改：`miniprogram/pages/admin/members/detail.js|wxml|wxss`
- 测试：`tests/transactionStats.test.js`

### 任务 1：openid 过滤纯逻辑（TDD）

- [x] 步骤 1：写失败测试 `filterTransactionsByOpenid`
- [x] 步骤 2：跑测确认失败
- [x] 步骤 3：实现函数并导出
- [x] 步骤 4：跑测确认通过

### 任务 2：云函数 memberId

- [x] `buildWhere` 支持 `openid`
- [x] 入参 `memberId` 时查 `members` 取 `_openid`
- [x] fallback 内存过滤调用 `filterTransactionsByOpenid`

### 任务 3：详情页

- [x] 并行加载会员与流水
- [x] 类型芯片 + 列表展示
- [x] 空态与加载态

### 任务 4：验证与文档

- [x] `node --test tests/transactionStats.test.js`
- [x] 写 impl 文档，plan 标 done
