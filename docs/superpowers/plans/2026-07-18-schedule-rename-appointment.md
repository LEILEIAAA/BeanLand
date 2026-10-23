# 我的行程改我的预约 实现计划

> **面向 AI 代理的工作者：** 纯文案替换；先改断言测试再改实现。

**目标：** 用户可见「我的行程」改为「我的预约」，成功提示引导至「我的预约」。

**架构：** 仅改展示文案与对应单测断言，不改路由/数据结构。

**技术栈：** 微信小程序 + Node test

---

### 任务 1：测试断言

**文件：** `tests/memberActions.test.js`、`tests/memberHighlight.test.js`

- [x] 将「我的行程」「行程」相关断言改为「我的预约」「预约」
- [x] 跑测确认红灯

### 任务 2：实现文案

**文件：**

- `miniprogram/utils/memberActions.js`
- `miniprogram/utils/memberHighlight.js`
- `miniprogram/pages/member/appointments/index.json`
- `miniprogram/pages/member/appointments/index.wxml`
- `miniprogram/pages/appointment/index.wxml`
- `miniprogram/pages/activities/register/index.js`

- [x] 按设计文档替换文案
- [x] 跑测确认绿灯
