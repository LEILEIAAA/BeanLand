# 会员详情储值流水设计

## 目标

店主后台「会员详情」页展示该会员完整储值流水（充值 / 消费 / 退款），口径与全店「储值流水」一致。

## 范围

- 扩展云函数 `adminListMemberTransactions`：支持可选 `memberId`
- 会员详情页嵌入流水列表 + 类型筛选（全部 / 充值 / 消费 / 退款）
- 复用既有标题解析与金额展示逻辑

## 非范围

- 时间筛选、顶部汇总
- 套餐核销 / 座位计时等非储值流水
- 会员端消费明细页改动
- 新建独立云函数

## 数据流

1. 详情页 `onShow` 并行请求：
   - `adminListMembers({ memberId })`
   - `adminListMemberTransactions({ memberId, type?, limit: 200 })`
2. 云函数根据 `memberId` 读取 `members` 文档，取 `_openid`，查询 `member_transactions` 时附加 `_openid` 条件
3. 无 `memberId` 时行为与现网全店流水一致（不受影响）

## 页面结构

1. 既有会员信息卡片
2. 类型筛选芯片
3. 流水列表：类型标签、摘要、时间/渠道、金额正负色、余额；空态「暂无流水」

## 错误与边界

- `memberId` 无效或会员不存在：流水返回空列表，详情页沿用现有「未找到该会员」
- 会员无 `_openid`：流水空列表
- 查询失败：toast「加载失败」

## 测试

- 纯逻辑：按 `_openid` 过滤流水
- 回归：既有 `transactionStats` 测试
- 页面契约：详情页请求带 `memberId`，切换类型筛选会重拉
