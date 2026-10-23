# 首页主推同源截取 实现计划

> **面向 AI 代理的工作者：** 在当前会话内联执行（禁止子代理）。步骤用复选框跟踪。

**目标：** 首页主推套餐与近期活动改用套餐页/活动页同源数据，各截取前 3 条。

**架构：** 抽出 `packageSort` 与 `homeFeatured` 纯函数；首页 `onShow` 拉 `api.getPackages` / `api.getActivities`（失败回退 seed）后组装展示数据。

**技术栈：** 微信小程序 + Node `node:test`

---

## 文件

- 创建：`miniprogram/utils/packageSort.js`
- 创建：`miniprogram/utils/homeFeatured.js`
- 创建：`tests/packageSort.test.js`
- 创建：`tests/homeFeatured.test.js`
- 修改：`miniprogram/pages/packages/index.js`（改用共享 sort）
- 修改：`miniprogram/pages/home/index.js`（异步同源加载）

### 任务 1：packageSort

- [ ] 写失败测试：排序与 PACKAGE_ORDER 一致，未知 id 靠后
- [ ] 实现 `sortPackages`
- [ ] 套餐页改用该函数
- [ ] 测试通过

### 任务 2：homeFeatured

- [ ] 写失败测试：套餐/活动各取前 3，字段满足首页 wxml
- [ ] 实现 `buildFeaturedPackages` / `buildFeaturedActivities`
- [ ] 测试通过

### 任务 3：首页接线

- [ ] `home/index.js` 去掉硬编码 ID，onShow 拉同源数据并 setData
- [ ] 跑相关测试验证
