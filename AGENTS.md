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
- **`browserApp.mjs`** is a 4200+ line monolith — the main app controller. Plan to split before adding significant code.

## Key directories

| Path | Purpose |
|---|---|
| `src/lib/aiTaskCenter.mjs` | Global AI task queue with AbortController cancellation |
| `src/lib/assistant/` | AI assistant: tools registry, risk classifier, ReAct parser, executor, session snapshots |
| `src/lib/novel/` | Novel workshop: state (IDB buckets), analysis pipeline, entity store, RAG, sync, NSFW/NTL support |
| `src/lib/promptCanon.mjs` | Default prompt blocks shared across all generation pipelines |
| `src/lib/promptStore.mjs` | User prompt overrides persisted to `st_v3_builder_prompts` |
| `src/lib/statusBarThemes/` | 30 visual themes (15 aesthetics × single/multi), filtered by character count |
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

- Three-layer design: core persona palette → NSFW flavor palette (20 presets) → NTL taboo layer (8 types, multi-select). Layers are additive, not exclusive.
- **CharacterPanel is the sole UI entry point** for NSFW/NTL config. Changes dispatch `nsfw-config-changed` → `browserApp` listens and syncs `state.adultMode`/`ntlMode`/`nsfwFlavor`/`ntlTabooTypes` to novel workshop pipeline.
- Novel source panel has NO NSFW/NTL UI — only chunking/recall/workflow config.
- Full design philosophy in `docs/architecture-and-design.md`.

## Dependencies & quirks

- **GSAP 3** loaded via CDN in `Layout.astro` (`<script is:inline src="...gsap.min.js">`) — available globally, not bundled.
- **@antv/g6 5.x** used client-side for relationship graphs in novel analysis.
- AI backend: OpenAI-compatible Chat Completions API (configured in-app, keys in localStorage, never in repo).
- `beforeunload`/`pagehide` refresh protection with 280ms debounce — be careful when modifying save logic.
- No CI/CD, no Docker files, no pre-commit hooks.
