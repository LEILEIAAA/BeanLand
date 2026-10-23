# 活动筛选关键字设计

## 目标

会员活动页筛选项由活动上的自由文本「关键字」动态生成；固定保留「全部」「招募中」。后台创建/编辑活动时用关键字输入框替换原分类下拉。

## 范围

- 活动文档字段：`keyword`（string，选填）替换 `category`
- 云函数 `adminSaveActivity` 归一化与持久化
- 后台活动编辑页：分类 picker → 关键字 input
- 会员活动页：动态筛选项 + 按关键字精确匹配

## 非范围

- 多关键字、模糊搜索、全局关键字字典
- 批量迁移历史 `category` 枚举值（零兜底：旧枚举不再参与筛选）

## 行为

1. 筛选项 = `[全部, 招募中]` + 当前列表非空 `keyword` 去重（按列表顺序首次出现）
2. `all`：全量；`recruiting`：`status === 'recruiting'`；其他：`item.keyword === filterId`
3. 空关键字活动只出现在「全部」
4. 关键字 trim 后存储；空串表示无

## 测试

- `normalizeActivityInput` / `buildActivityDoc` 携带 `keyword`，不再产出 `category`
- `buildActivityFilters` / `filterActivities` 覆盖去重、招募中、空关键字
