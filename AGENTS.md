# AGENTS.md — ST Card Builder

## Quick commands

```bash
npm run dev          # Astro dev server → http://localhost:4321
npm run build        # Static build → dist/
npm run preview      # Preview static build
npm test             # Node.js native test runner (tests/**/*.test.mjs)
```

- Verify with `npm test` then `npm run build` before submitting changes.
- No lint, typecheck, or CI scripts. No pre-commit hooks.

## Conventions

- **All JS modules use `.mjs` extension and ESM imports.** There are no `.js` source files.
- Astro components use `.astro` extension with `---` frontmatter fences. Client-side code goes in `<script>` tags, not the frontmatter.
- **No SSR** — Astro output is static (`dist/`). Frontmatter code runs at build time only.
- Tests import directly from `../src/lib/*.mjs` — no transpilation, no DOM/browser environment.
- Run a single test file: `node --test tests/aiTaskCenter.test.mjs`
- The `SecurityCordon` component is an intentional soft-lock for incomplete features; bypassed by clicking N times. Do not remove without understanding the context.

## Architecture

- **Astro 5** single-page app (`src/pages/index.astro`). All views coexist in the DOM; switching toggles `data-view` visibility based on `window.location.hash`.
- **Three-column layout**: `AppSidebar` (left: sticky brand + scrollable nav + fixed config) | main views | `AssistantPanel` (right).
- `html`/`body` are `overflow: hidden`. Only inner panels scroll independently.
- **No state management library** — data flows through `window.__get*__` / `window.__set*__` bridges and `CustomEvent` dispatches (`card-builder-data-changed`, `card-draft-changed`, `nsfw-config-changed`).
- State persists to `localStorage` (drafts, config, prompts) and **IndexedDB** (`st-card-builder` db: `json` store for novel workshop, `blob` store for avatars).
- **Card-builder boot**: `src/lib/card-builder/browserApp.mjs` exports `initCardBuilder()` — the sole card-side startup (called from `index.astro`). Novel side: `NovelWorkshopApp` → `initNovelWorkshop()`. Large `.astro` panels (VariableCard / Assistant / StatusBar) are still bulky.

## Key directories

| Path | Purpose |
|---|---|
| `src/lib/utils.mjs` | Shared pure-function utilities: uid, escapeHtml, crc32, createTextChunk, deepCopy, strategyLabelZh, parseJsonLoose |
| `src/lib/idbReady.mjs` | IDB async wait helper (event-driven + 100ms poll fallback) |
| `src/lib/idbStore.mjs` | IndexedDB database open helper |
| `src/lib/avatarIdb.mjs` | Avatar blob read/write in IndexedDB |
| `src/lib/aiTaskCenter.mjs` | Global AI task queue with AbortController cancellation |
| `src/lib/assistant/` | AI assistant: tools, risk, reactParse, executor, session, ragInject, tokenEstimate, characterFields, toolTraceSummary |
| `src/lib/card-builder/` | Main card builder: state + stateMachine + shared context + panels (cardManager, character, worldbook, aiEngine, export) |
| `src/lib/novel/` | Novel workshop: state (IDB buckets) + stateMachine + shared (context, bridge) + panels (source, chapters, setup, analyze, characters, worldbook, style) + analysis pipeline, entity store, RAG, sync, NSFW/NTL |
| `src/lib/promptCanon.mjs` | Default prompt blocks shared across all generation pipelines |
| `src/lib/promptStore.mjs` | User prompt overrides persisted to `st_v3_builder_prompts` |
| `src/lib/statusBarThemes/` | 30 visual themes (15 aesthetics × single/multi), filtered by character count |
| `src/lib/statusBar.mjs` | Status bar designer: theme resolution, HTML generation, snippet building |
| `src/lib/charTags.mjs` | Character tag normalization and merging |
| `src/lib/tavernScripts.mjs` | Tavern helper scripts normalization |
| `src/lib/regexScripts.mjs` | Regex scripts normalization |
| `src/styles/tokens.css` | Design tokens ("Nocturne" dark theme) |
| `src/styles/ui-patterns.css` | Shared UI components (panels, buttons, chips, etc.) |
| `scripts/genStatusBarThemes.mjs` | Generates status bar theme CSS (standalone node script, not npm-registered) |

## ST card data conventions

- **Author's Note field** is `creatorNotes` (NOT ST's `postHistoryInstructions`). The assistant executor maps `postHistoryInstructions` writes to `creatorNotes`.
- Novel workshop data lives in IndexedDB keyed by cardId: `novelWorkshopV3:card:{cardId}`. It is **not** included in exported JSON/PNG card files.
- RAG index: IndexedDB `novelRagV1:card:{cardId}`.
- Draft localStorage key: `st_v3_builder_drafts`, current card: `st_v3_builder_current_id`.
- AI config localStorage key: `st_v3_builder_ai_config` (API keys, engine options, NSFW/NTL flavors).
- Worldbook entry `comment` field serves as the title/identifier for deduplication and sync.

## NSFW/NTL palette architecture

- Three-layer design: core persona palette → NSFW flavor items（最多 5，含反差向等 21 预设，首项为主调色盘 + 每项 note）→ NTL taboo layer（9 types 含百破，多选）. Layers are additive, not exclusive.
- 数据：`nsfwFlavorItems: [{ id, note }]`；旧单字段 `nsfwFlavor` 自动迁为首项；拼装见 `buildNsfwFlavorHintFromItems`。
- 口味丰满（对齐恶堕）：`src/lib/adult/flavors/`（`presets.mjs` + `enrichment.mjs`）；旧路径 `novel/nsfwFlavorEnrichment.mjs` 仅兼容 re-export。
- NTL 丰满：`src/lib/adult/ntl/`；含 `yuri_destruction`（百破）；旧路径 `novel/ntlTabooEnrichment.mjs` 仅兼容。
- 世界观成人载体：`src/lib/adult/vessels/`；Canon：`src/lib/adult/canon.mjs`。
- AI 引擎世界观预设：`src/lib/presets/worldviews/`（分组 data；扩展在对应文件追加）。
- **两管道隔离**：`protagonist`（角色设定/开场白）与 `worldbook`（世界书/人物条/恶堕）独立，默认同步互不写入。小说「同步到角色设定」已重定向为世界书人物条。
- **AdultConfigPanel（侧栏「成人配置」）** 是卡级 NSFW/NTL/恶堕唯一 UI，只服务世界书管道；口味为添加式多选。卡侧为真相源，小说工坊经 `nsfw-config-changed` 订阅；worldframe 区分 suggest（不强制）与 set（手动强制）。
- **恶堕进度**：只认 `[小说人物]`/`[人物]` 条；状态栏多人 cast 绑这些名字；每阶≥220字；`src/lib/corruptionProgress.mjs` + `generate_corruption_lore`。
- Novel source panel has NO NSFW/NTL UI — only chunking/recall/workflow config.
- Full design philosophy in `docs/architecture-and-design.md`.

## Dependencies & quirks

- **GSAP 3** loaded via CDN in `Layout.astro` (`<script is:inline src="...gsap.min.js">`) — available globally, not bundled.
- **@antv/g6 5.x** used client-side for relationship graphs in novel analysis.
- AI backend: OpenAI-compatible Chat Completions API (configured in-app, keys in localStorage, never in repo).
- `beforeunload`/`pagehide` refresh protection with 280ms debounce — be careful when modifying save logic.
- No CI/CD, no Docker files, no pre-commit hooks.
