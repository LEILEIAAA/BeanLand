# 注册页完成提示与手机号按钮 实现计划

> **面向 AI 代理的工作者：** 本仓库禁用子代理；在当前会话内联执行。步骤用复选框跟踪。

**目标：** 注册页底栏按缺口提示文案，已授权手机号改为弱链接，不抢主 CTA。

**架构：** 在 `memberProfile.js` 增加纯函数 `buildRegisterProgress`（缺口标签、doneCount、finishButtonText、toast）；注册页 `refreshFlags` 消费；WXML/WXSS 按 `hasPhone` 切换手机号按钮样式。

**技术栈：** 微信小程序 JS / WXML / WXSS，Node `node:test`

---

## 文件

- 修改：`miniprogram/utils/memberProfile.js` — `buildRegisterProgress`
- 修改：`tests/memberProfile.test.js` — 缺口文案用例
- 修改：`miniprogram/pages/member/register/index.js` — 消费 progress
- 修改：`miniprogram/pages/member/register/index.wxml` — 按钮文案与手机号双态
- 修改：`miniprogram/pages/member/register/index.wxss` — 弱链接样式

### 任务 1：buildRegisterProgress（TDD）

- [x] 写失败测试：缺手机号 → `还需完善：手机号`；齐 → `完成注册并返回`
- [x] 实现 `buildRegisterProgress(member, defaultAvatar)`
- [x] `node --test tests/memberProfile.test.js` 通过

### 任务 2：注册页接线 + 手机号弱链接

- [x] `refreshFlags` 写入 `finishButtonText` / `finishToast`
- [x] WXML 底栏用 `finishButtonText`；手机号 `hasPhone` 时 `btn-phone-link`
- [x] WXSS 弱链接对齐 nickname-sync-label
- [x] 回归 `node --test tests/memberProfile.test.js`
