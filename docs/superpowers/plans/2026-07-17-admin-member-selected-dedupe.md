# 会员查找去掉「当前选中」实现计划

> **面向 AI 代理的工作者：** 本任务为纯 WXML/WXSS 展示层改动，可直接按任务顺序实现。

**目标：** 三处店主后台会员查找页去掉与结果行重复的「当前选中」块。

**架构：** 只删 UI；JS 选中状态字段保留。

**技术栈：** 微信小程序 WXML / WXSS

---

### 任务 1：套餐核销

**文件：**
- 修改：`miniprogram/pages/admin/package-redeem/index.wxml`
- 修改：`miniprogram/pages/admin/package-redeem/index.wxss`

- [x] 删除「当前选中」`field` 块
- [x] 删除 `.selected-box`；`.member-row.active` 补 `border-radius`

### 任务 2：优惠券

**文件：**
- 修改：`miniprogram/pages/admin/coupons/index.wxml`
- 修改：`miniprogram/pages/admin/coupons/index.wxss`

- [x] 删除「当前选中」`field` 块
- [x] 选择器从 `.selected-box, .preview-box` 改为仅 `.preview-box`

### 任务 3：转账代充

**文件：**
- 修改：`miniprogram/pages/admin/recharge/index.wxml`

- [x] 删除「当前选中」`field` 块

### 任务 4：验证

- [x] 静态检查三页 WXML 无「当前选中」
- [x] `selectedLabel` 仍在 JS 中用于业务（尤其 package-redeem 跳转）
