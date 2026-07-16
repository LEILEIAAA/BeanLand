# 云数据库导入说明

环境：`cloudbase-d8gzrj9d3f09c5171`

1. 微信开发者工具 → 云开发 → 数据库，确认集合已创建。
2. 对各集合使用「导入」或逐条添加，对应本目录 JSON。
3. `store` 使用 `_id: main` 的单文档。
4. `time_slots` 使用 `_id: default`，字段 `slots` 为字符串数组。
5. `admins.example.json` 改名/复制为实际 openid 后导入 `admins`。
6. 导入 `member_tier_rules.json`（VIP 充500/消费300，SVIP 充1000/消费600）。
7. `seat_occupancies` 可先空着，或导入示例占用做联调。
8. 部署云函数：ensureMember / getMyMember / listMyTransactions / adminFindMember / adminRecharge

生成命令：`node scripts/export-seed-for-cloudbase.js`
