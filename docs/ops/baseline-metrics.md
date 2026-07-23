# 基线度量（Phase 0）

> 后续性能 PR 对照本表；更新方式：`npm run build && npm run measure:baseline`。

## 记录

| 日期 | 分支/备注 |
|---|---|
| 2026-07-23 | master @ Phase 0；脚本 `scripts/measure-baseline.mjs` |

## 主站 JS chunk（gzip Top，KB）

| gzip KB | 文件（hash 会变） | 说明 |
|---:|---|---|
| 416.8 | `ntl.*.js` | NTL/成人目录聚合 |
| 402.6 | `graphViz.*.js` | G6 图谱（Story Studio 等） |
| 153.5 | `index.*.js` | 共享 vendor 类 chunk |
| 67.1 | `index.astro_*` | 主站入口 boot |
| 47.0 | `NovelWorkshopApp.*` | 小说工坊 |
| 33.1 | `statusBarCatalog.*` | 状态栏目录 |
| 26.2 | `StoryStudioApp.*` | 小说创作 |
| 26.1 | `AssistantPanel.*` | 右栏助手 |

## saveDraft 耗时（Node 模拟，ms/次）

| 场景 | ms |
|---|---:|
| 小卡（仅 charName） | ~0.012 |
| 中卡（80 条世界书 × 短正文） | ~0.123 |

含 `draftContentEqual` 双快照路径；浏览器 + DOM sync 会更高，以 DevTools Performance 为准。

## 云 bundle（手工样本，待补）

| 项 | 典型值 | 备注 |
|---|---|---|
| PUT `/api/data/cards/:id/bundle` | _待测_ | 含头像+工坊+RAG 时记录 p50 体积 |

生产可在 API 慢日志中补 tag（Phase 5A）。
