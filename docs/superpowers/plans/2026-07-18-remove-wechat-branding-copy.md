# 去除微信混淆文案 实现计划

**目标：** 清除登录/授权前置页及 C 端自有文案中的「微信」混淆表述；手机号按钮改为「手机号快捷登录」。

**技术栈：** 微信小程序 WXML / JS 文案

## 文件

| 文件 | 改动 |
|------|------|
| `miniprogram/pages/member/register/index.wxml` | 步骤标题/提示/按钮 |
| `miniprogram/pages/member/register/index.js` | toast |
| `miniprogram/components/privacy-popup/index.wxml` | 收集说明 |
| `miniprogram/pages/home/index.wxml` | 资料引导弹层 |
| `miniprogram/pages/appointment/index.wxml` | 昵称占位 |
| `miniprogram/pages/route/index.wxml` | 地图按钮 |
| `miniprogram/utils/storePublic.js` | routeTip |
| `scripts/cloudbase-seed-export/store.json` | routeTip 同步 |
| `miniprogram/pages/recharge/index.wxml` | 充值说明 |
| 套餐/活动报名支付文案 | 「微信支付」→「在线支付」 |
| 协议/退款页我方表述 | 去「微信」字样 |

## 验证

`rg "微信" miniprogram --glob "*.{wxml,js}"` 复核剩余项是否仅为合法残留（投诉指引等）。
