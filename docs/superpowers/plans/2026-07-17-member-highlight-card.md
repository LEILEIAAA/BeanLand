# 会员页智能亮点卡 实现计划

> **面向 AI 代理的工作者：** 在当前会话直接按任务实现（Cursor 禁止子代理）。步骤用复选框跟踪。

**目标：** 隐藏集章卡（可恢复），资产区下增加按优先级择优的亮点主卡，快捷列表软对齐。

**架构：** 纯函数 `buildMemberHighlight` 决定主卡；`buildActions` 接收 highlight 快照做软去重；会员页负责拉数与绑定。

**技术栈：** 微信小程序 + Node test

---

### 任务 1：亮点卡纯函数 + 测试

**文件：**
- 创建：`miniprogram/utils/memberHighlight.js`
- 测试：`tests/memberHighlight.test.js`

- [x] 编写失败测试（优先级与空态）
- [x] 实现 `buildMemberHighlight`
- [x] 测试通过

### 任务 2：快捷入口软去重

**文件：**
- 修改：`miniprogram/utils/memberActions.js`
- 测试：`tests/memberActions.test.js`

- [x] 测试：传入 highlight 时对应项 badge/desc 对齐
- [x] 实现最少改动
- [x] 测试通过

### 任务 3：会员页接线

**文件：**
- 修改：`miniprogram/pages/member/index.js`
- 修改：`miniprogram/pages/member/index.wxml`
- 修改：`miniprogram/pages/member/index.wxss`（复用 stamp 视觉，新增 highlight 类名；stamp 样式保留）

- [x] `showStampCard: false` 包裹原集章卡
- [x] 拉取行程计数 + active session 详情
- [x] 渲染亮点卡并跳转

### 任务 4：验证与文档

- [x] `node --test tests/memberHighlight.test.js tests/memberActions.test.js`
- [x] 写 task-docs plan/impl
