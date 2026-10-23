# 活动筛选关键字 实现计划

> **面向 AI 代理的工作者：** 按任务顺序 TDD 实现。步骤使用复选框跟踪。

**目标：** 用活动 `keyword` 驱动会员活动页筛选项，替换写死分类与后台 category 枚举。

**架构：** 云函数持久化 `keyword`；前端 `activityFilters` 纯函数生成筛选项并过滤；后台编辑页改为输入框。

**技术栈：** 微信小程序、云函数 Node、node:test

## 文件

- 创建：`miniprogram/utils/activityFilters.js`
- 创建：`tests/activityFilters.test.js`
- 修改：`cloudfunctions/adminSaveActivity/activityForm.js`
- 修改：`tests/activityForm.test.js`
- 修改：`cloudfunctions/adminSaveActivity/index.js`（update 时 remove `category`）
- 修改：`miniprogram/pages/admin/activities/edit.js` / `edit.wxml`
- 修改：`miniprogram/pages/activities/index.js`
- 修改：`miniprogram/data/seed.js`（本地种子补 keyword）
- 过程：`task-docs/plan-活动页-功能-筛选关键字-20260717-123011.md`

### 任务 1：筛选纯函数 TDD

- [ ] 写失败测试 `buildActivityFilters` / `filterActivities`
- [ ] 实现 `activityFilters.js`
- [ ] 测试通过

### 任务 2：云表单 keyword TDD

- [ ] 改 `activityForm.test.js`：category → keyword
- [ ] 改 `activityForm.js`；update remove category
- [ ] 测试通过

### 任务 3：后台编辑 + 会员页

- [ ] 编辑页关键字输入
- [ ] 活动页动态 filters
- [ ] seed 补 keyword
- [ ] 全量相关测试通过
