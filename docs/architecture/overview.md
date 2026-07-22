# 架构总览

> SoT：壳层启动、布局、状态桥、模块地图。UI 细节见 [`../ui/design-system.md`](../ui/design-system.md)；同步见 [`../systems/cloud-sync.md`](../systems/cloud-sync.md)。

## 运行形态

- **Astro 5** 静态站：`src/pages/index.astro`（主站）、`src/pages/admin.astro`（管理端）
- 无 SSR；`dist/` → 打包为 `dist-card/` / `dist-card-admin/`
- 主站所有业务视图常驻 DOM，靠 `location.hash` ↔ `data-view` 切换
- 三栏：`AppSidebar` | 主区 | `AssistantPanel`；`html/body` `overflow: hidden`，仅内层滚动

## 启动路径

| 入口 | 启动 | 说明 |
|---|---|---|
| 主站卡侧 | `src/lib/card-builder/browserApp.mjs` → `initCardBuilder()` | `index.astro` 调用；卡侧唯一 boot |
| 小说工坊 | `NovelWorkshopApp` → `initNovelWorkshop()` | `src/lib/novel/browserApp.mjs` |
| 小说创作 | `StoryStudioApp` → storyStudio boot | `src/lib/storyStudio/` |
| 管理端 | `src/lib/admin/browserApp.mjs` | 独立页 `/admin` |
| API | `server/src/index.mjs` | Express + Couch；systemd 部署 |

## 状态与持久化

- **无** Redux/Pinia：`window.__get*__` / `__set*__` + `CustomEvent`
- 常用事件：`card-builder-data-changed`、`card-draft-changed`、`nsfw-config-changed`、`app-view-changed`
- localStorage：草稿、AI 配置、提示词覆写、助手会话
- IndexedDB：`st-card-builder`（小说桶、头像 blob）；Pouch：`stcb-pouch-v1`（云同步文档）

## 模块地图（摘要）

```
src/lib/
├── card-builder/     制卡：state / stateMachine / panels / initCardBuilder
├── novel/            小说工坊：分析管道、实体、RAG、面板
├── storyStudio/      小说创作：图谱/大纲/写作/分享
├── assistant/        右栏助手：tools / risk / react / executor / session
├── sync/             云同步：Pouch、凭证、密钥加密、镜像
├── adult/            NSFW/NTL/载体/恶堕目录与拼装（数量以代码为准）
├── admin/            管理端客户端
├── chatRuntime/      试聊与 ST 运行时对齐
├── mvu/              MVU 相关
├── aiTaskCenter.mjs  全局 AI 任务队列
└── promptCanon.mjs / promptStore.mjs

server/src/
├── auth/             Discord + 邮箱 + Session
├── sync/             /api/sync/credentials
├── share/            卡/小说分享
├── admin/            /api/admin/*
└── couch.mjs         用户库、注册表、email-auth
```

子系统深读：

- 卡侧 → [`card-builder.md`](./card-builder.md)
- 小说工坊 → [`novel-workshop.md`](./novel-workshop.md)、[`novel-analysis.md`](./novel-analysis.md)
- 助手 → [`assistant.md`](./assistant.md)
- 小说创作 → [`story-studio.md`](./story-studio.md)
- 试聊 → [`chat-runtime.md`](./chat-runtime.md)

## 硬约束（全局）

1. 作者注释字段是 **`creatorNotes`**（不是 ST `postHistoryInstructions`）→ [`../domains/st-card-fields.md`](../domains/st-card-fields.md)
2. NSFW/NTL UI 入口是 **AdultConfigPanel（侧栏成人配置）**，不是 CharacterPanel → [`../domains/nsfw-ntl.md`](../domains/nsfw-ntl.md)
3. 行内操作按钮用 **`btn-inline`** → [`../ui/design-system.md`](../ui/design-system.md)
4. 浏览器同步地址用 **`PUBLIC_COUCH_URL`**，禁止下发 `127.0.0.1` → [`../systems/cloud-sync.md`](../systems/cloud-sync.md)

## 验证

```bash
npm test && npm --prefix server test && npm run build
```
