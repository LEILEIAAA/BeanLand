# 文创拼豆手作店小程序 MVP 开发进度

> 进度文档用于阶段性记录开发计划执行情况、验证结果、风险和下一步安排。来源需求：`docs/strategy/bean-shop-miniprogram-mvp-dev-plan.md`。

## 当前状态

- 项目阶段：Day 1，工程初始化与业务模型落地
- 当前日期：2026-07-05
- 执行策略：先完成可运行的小程序基础工程，再逐步补齐用户端、后台端和核心经营逻辑
- 协同技能：`brainstorming`、`ui-ux-pro-max`、`writing-plans`、`test-driven-development`、`verification-before-completion`

## 阶段里程碑

| 阶段 | 目标 | 状态 | 验证方式 |
|---|---|---|---|
| Day 1 | 项目骨架、业务常量、核心计算逻辑、页面路由 | 已完成基础版 | 单元测试、文件结构检查 |
| Day 2 | 用户端首页、套餐、活动、预约、路线页面可用 | 待深化 | 小程序开发者工具预览、表单测试 |
| Day 3 | 后台预约、套餐、活动管理 MVP | 未开始 | 管理端流程走查 |
| Day 4 | 会员、储值、余额流水、充值记录 | 进行中（注册+微信/代充订单已实现，待部署联调） | 余额流水测试 + 真机支付 |
| Day 5 | 座位计时、消费核销、续时补费 | 未开始 | 计时与订单测试 |
| Day 6 | 数据看板、内容完善、开业配置 | 未开始 | 开业检查清单 |
| Day 7 | 联调、验收、试运行、版本冻结 | 未开始 | 全流程验收 |

## 今日目标

1. 建立微信小程序基础目录结构。
2. 固化套餐、活动、桌号、预约时段、会员权益等业务配置。
3. 建立预约预计结束时间、超时、余额扣款等核心逻辑的可测试实现。
4. 创建首批用户端和后台端页面入口。
5. 记录验证命令和结果。

## 已完成

- 已确认当前工作区主要包含策略文档和技能文件，没有现成小程序工程结构。
- 已创建小程序基础目录：`miniprogram/`、`miniprogram/pages/`、`miniprogram/data/`、`miniprogram/utils/`。
- 已创建测试目录：`tests/`。
- 已创建微信小程序基础配置：`project.config.json`、`miniprogram/app.js`、`miniprogram/app.json`、`miniprogram/app.wxss`。
- 已固化开业 MVP 种子数据：套餐、活动、预约时段、桌号、充值档位、会员标签、优惠券、集章规则。
- 已实现核心业务逻辑：预约预计结束时间、超时费用、充值余额、余额消费、预约确认摘要。
- 已创建用户端页面骨架：首页、套餐、活动、预约、路线、会员中心、充值。
- 已创建后台端页面骨架：店主看板、预约管理、座位计时。
- 已创建第一阶段工程执行计划：`docs/superpowers/plans/2026-07-05-bean-shop-miniprogram-day-1.md`。
- 已完成 Day 2 的首批深化：首页信息层级、预约表单校验、会员信息密度、充值展示优化。

## 进行中

- 座位预约制度首版已落地：时段 × 座位、同桌连座、用户三态选座、店主四态座位图；后续接云库唯一约束与真实计时联动。

## 最近完成（2026-07-14）

- 规格：`docs/superpowers/specs/2026-07-14-seat-based-appointment-design.md`
- 计划：`docs/superpowers/plans/2026-07-14-seat-based-appointment.md`
- 核心：`miniprogram/utils/seats.js` + `tests/seats.test.js`（9 项规则测试）
- 用户端预约页支持选座；店主 timer 页展示四态座位图
- 验证：`node --test tests/seats.test.js tests/business.test.js` → 16 pass / 0 fail

## 阻塞与风险

| 风险 | 影响 | 处理方式 |
|---|---|---|
| 云集合未导入 / 云函数未部署 | 读走 seed fallback；写函数返回 PHASE0_STUB | 开发者工具完成导入与部署 |
| `ALLOW_SEED_FALLBACK=true` | 生产可能掩盖空库 | Phase 1 联调后改为 false |
| 美团官方自动核销未接入 | 需商家端人工核销 | 按设计记账 + 打标 |

## 验证记录

| 时间 | 命令 | 结果 | 说明 |
|---|---|---|---|
| 2026-07-05 | `node --test tests/business.test.js` | 失败，1 个模块缺失 | TDD 红灯验证，确认测试先失败 |
| 2026-07-05 | `node --test tests/business.test.js` | 失败，5 通过 / 1 失败 | 暴露超时计费测试参数与规则单位不一致 |
| 2026-07-05 | `node --test tests/business.test.js` | 通过，6 通过 / 0 失败 | 核心业务逻辑测试通过 |
| 2026-07-05 | IDE 诊断检查 | 无 linter errors | 检查 `miniprogram/`、`tests/business.test.js` 与进度文档 |
| 2026-07-05 | `node --test tests/business.test.js` | 通过，6 通过 / 0 失败 | Day 2 修改后回归验证通过 |
| 2026-07-14 | `node --test tests/seats.test.js tests/business.test.js` | 通过，16 通过 / 0 失败 | 座位预约规则 + 摘要回归 |
| 2026-07-15 | `node --test tests/cloudbaseIds.test.js tests/seats.test.js tests/business.test.js` | 通过，19 通过 / 0 失败 | 云开发 Phase 0 + 回归 |
| 2026-07-15 | `node --test` | 通过，49 pass / 0 fail | 连续时段多选 + 全量回归 |

## 最近完成（2026-07-15）

- 会员注册页：点头像进入，分步完成头像/昵称/手机号，齐了自动返回会员页
- 充值前校验手机号；云函数 `getPhoneNumber`
- **连续时段多选**：方案 A 无缝 2h；预约页可连选；同座占用并集；结束时间取末场
- 规格：`docs/superpowers/specs/2026-07-15-contiguous-time-slots-design.md`

## 下一步

1. 配置并部署微信支付：`pay_config.subMchId` + 云开发支付 + 部署 `createRechargeOrder` / `payRechargeNotify` / `getRechargeOrder` / `adminRecharge`
2. 部署注册相关：`getPhoneNumber` + `ensureMember`；开通手机号快速验证
3. 真机走：会员注册 → 微信支付充值 → 余额/流水；店长代充写 `recharge_orders`
4. 套餐购买（余额 / 微信 + 优惠券）——前端与云函数已落地，待部署联调；预约占座仍独立
5. 云库若已导入旧时段，重新导入 `time_slots` / `seat_occupancies`
