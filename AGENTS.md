# AGENTS.md — ST Card Builder

Agent / 贡献者契约。**详细规则只维护在 `docs/` 真相源（SoT）**；改行为须同 PR 更新对应 SoT。

## 文档入口（必读）

→ **[`docs/README.md`](docs/README.md)**（索引 + SoT 表）

| 主题 | SoT |
|---|---|
| UI | [`docs/ui/design-system.md`](docs/ui/design-system.md) + `src/styles/ui-patterns.css` |
| 认证 | [`docs/systems/auth.md`](docs/systems/auth.md) |
| 同步 / Couch | [`docs/systems/cloud-sync.md`](docs/systems/cloud-sync.md) |
| NSFW / NTL | [`docs/domains/nsfw-ntl.md`](docs/domains/nsfw-ntl.md)（数量以 `src/lib/adult/**` 为准） |
| ST 字段 | [`docs/domains/st-card-fields.md`](docs/domains/st-card-fields.md) |
| 架构总览 | [`docs/architecture/overview.md`](docs/architecture/overview.md) |
| 部署 | [`docs/ops/production.md`](docs/ops/production.md) |

## Quick commands

```bash
npm run dev              # Astro → http://localhost:4321
npm run build            # → dist/ + dist-card / dist-card-admin
npm test                 # tests/**/*.test.mjs
npm --prefix server test # server/tests
npm run server:dev       # API :8787
npm run couch            # 本地 CouchDB
```

提交前：`npm test` 然后 `npm run build`（涉及 API 时再跑 `npm --prefix server test`）。无 lint/typecheck/pre-commit。

## 硬约束（不可违反）

1. **UI**：行内操作用 `.btn-inline`；复用 `ui-patterns.css`；禁止另起一套 tip/搜索/大按钮。
2. **作者注释字段** = `creatorNotes`（勿用 `postHistoryInstructions` 当独立字段）。
3. **NSFW/NTL UI 入口** = 侧栏「成人配置」`AdultConfigPanel`（不是 CharacterPanel；小说原始资料无此 UI）。
4. **浏览器 Couch 地址** = `PUBLIC_COUCH_URL`（或 `{PUBLIC_API_URL}/couch`），禁止把 `COUCHDB_URL=127.0.0.1` 发给前端。
5. **JS**：源码一律 `.mjs` + ESM；Astro 无 SSR；测试直跑 Node，无 DOM。
6. **`SecurityCordon`** 是故意软锁，勿随意删除。

## 架构一句话

Astro 5 静态 SPA；三栏布局；状态靠 `window.__get*__` / CustomEvent；卡侧 `initCardBuilder()`、小说 `initNovelWorkshop()`、管理端独立 `/admin`；可选云同步 = Express + Couch + Pouch。模块地图见 [`docs/architecture/overview.md`](docs/architecture/overview.md)。

## 关键目录（速查）

| Path | Purpose |
|---|---|
| `src/lib/card-builder/` | 制卡 boot + panels |
| `src/lib/novel/` | 小说工坊 |
| `src/lib/storyStudio/` | 小说创作 |
| `src/lib/assistant/` | 右栏助手 |
| `src/lib/sync/` | 云同步客户端 |
| `src/lib/adult/` | NSFW/NTL 目录与拼装 |
| `src/lib/admin/` | 管理端客户端 |
| `server/src/` | API：auth / sync / share / admin / couch |
| `src/styles/tokens.css` / `ui-patterns.css` | 设计 token + 共享控件 |
| `deploy/` | systemd / compose / nginx 示例 |

## Quirks

- GSAP 经 CDN 全局注入；G6 仅客户端图谱。
- AI 密钥在 localStorage；上云须口令加密（账户页「云同步」区块）。
- `beforeunload`/`pagehide` 存盘有 debounce——改保存逻辑要小心。
- **有** CI（`.github/workflows/deploy.yml`）与 Docker Compose（Couch）；细节见 ops 文档。
