# ST Card Builder 分享导入（SillyTavern 扩展）

把构建器里「角色卡分享」信息链接导入到 SillyTavern。

## 安装

将本目录复制到酒馆扩展目录之一：

- 用户扩展：`data/<user>/extensions/sillytavern-card-share/`
- 或第三方：`public/scripts/extensions/third-party/sillytavern-card-share/`

然后在「扩展」中启用，刷新页面。

## 使用

1. 点 **Discord 登录**（与构建器同一账号；弹窗完成授权）。
2. 粘贴构建器复制的信息链接（或 token），如有分享密码则填写。
3. **读取信息** → 选择版本 → **导入 JSON**。
4. 若作者开启了 PNG 直链，可用 **导入 PNG 直链**（无需再带密码拉取 JSON）。

## 说明

- API 固定为 `https://card-api.taojiu.love`，扩展 UI **不提供** API 地址配置。
- 信息页与版本 JSON **必须登录**；可选分享密码。
- 卡版本号使用角色卡 `character_version`。
- 曾导入过的分享若云端版本更新，读取信息时会提示。
