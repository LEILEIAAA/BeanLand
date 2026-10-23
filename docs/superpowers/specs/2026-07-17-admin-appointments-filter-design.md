# 预约管理：顶部压缩 + 状态筛选 + 列表间距

## 目标

压缩店主预约管理页顶部介绍；列表增加状态筛选；收紧卡片间距。

## 关键决策（已确认）

- 顶部：标题 + 一句短说明 + 座位管理按钮
- 筛选：全部 / 待确认 / 已确认 / 已结束；默认待确认
- 已结束 = rejected/cancelled/arrived/no_show/completed
- 间距：卡片间距约 16rpx，section 略收

## 实现要点

- 过滤逻辑抽 `adminAppointmentFilter.js`，本地过滤
- 页面：`allAppointments` 全量，`appointments` 为当前过滤结果
- 不改接口

## 非目标

会员端预约页、活动报名管理页
