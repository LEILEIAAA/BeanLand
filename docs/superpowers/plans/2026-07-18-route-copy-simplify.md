# 到店路线文案精简 实现计划

> **面向 AI 代理的工作者：** 按任务顺序实现；步骤用复选框跟踪。

**目标：** 路线页只保留地址指引与打电话；同步本地默认与云库 `routeTip`。

**架构：** 改 WXML 静态步骤 + `storePublic.DEFAULT_STORE.routeTip`；云库 `store/main` PATCH。

**技术栈：** 微信小程序 WXML；tcb nosql UPDATE

---

### 任务 1：页面与默认文案

**文件：**
- 修改：`miniprogram/pages/route/index.wxml`
- 修改：`miniprogram/utils/storePublic.js`
- 修改：`scripts/cloudbase-seed-export/store.json`
- 修改：`scripts/patch-store-route-tip.js`

- [x] 更新 Hero / 地图卡 / 三步指引
- [x] 同步 `routeTip`
- [x] `node --test tests/storePublic.test.js`
- [x] PATCH 云库并核实 `routeTip`
