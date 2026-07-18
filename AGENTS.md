# AGENTS.md — ST Card Builder

## Quick commands

```bash
npm run dev          # Astro dev server → http://localhost:4321
npm run build        # Static build → dist/
npm run preview      # Preview static build
npm test             # Node.js native test runner (tests/**/*.test.mjs)
```

- Verify with `npm test` then `npm run build` before submitting changes.
- No lint or typecheck script defined.

## Architecture

- **Astro 5** single-page app (`src/pages/index.astro`), no SSR — outputs to `dist/`.
- All views coexist in the DOM; switching toggles `data-view` visibility based on `window.location.hash`.
- **Three-column layout**: `AppSidebar` (left, sticky brand area + scrollable nav + fixed config) | main views | `AssistantPanel` (right).
- `html`/`body` are `overflow: hidden`. Only inner panels scroll independently.
- The app is client-side heavy. State lives in `localStorage` (drafts, config, prompts) and **IndexedDB** (`st-card-builder` db: `json` store for novel workshop, `blob` store for avatars).
- **No state management library** — data flows through `window.__get*__` / `window.__set*__` bridges and `CustomEvent` dispatches (`card-builder-data-changed`, `card-draft-changed`).

## Key directories

| Path | Purpose |
|---|---|
| `src/lib/aiTaskCenter.mjs` | Global AI task queue with AbortController cancellation |
| `src/lib/assistant/` | AI assistant: tools registry, risk classifier, ReAct parser, executor, session snapshots |
| `src/lib/novel/` | Novel workshop: state (IDB buckets), analysis pipeline, entity store, RAG, sync |
| `src/lib/promptCanon.mjs` | Default prompt blocks shared across all generation pipelines |
| `src/lib/promptStore.mjs` | User prompt overrides persisted to `st_v3_builder_prompts` |
| `src/lib/statusBarThemes/` | 30 visual themes (15 aesthetics × single/multi), filtered by character count |
| `src/styles/tokens.css` | Design tokens ("Nocturne" dark theme) |
| `src/styles/ui-patterns.css` | Shared UI components (panels, buttons, chips, etc.) |
| `scripts/genStatusBarThemes.mjs` | Generates status bar theme CSS |

## ST card data conventions

- **Author's Note field** is `creatorNotes` (NOT ST's `postHistoryInstructions`). The assistant executor maps `postHistoryInstructions` writes to `creatorNotes`.
- Novel workshop data lives in IndexedDB keyed by cardId: `novelWorkshopV3:card:{cardId}`. It is **not** included in exported JSON/PNG card files.
- Draft localStorage key: `st_v3_builder_drafts`, current card: `st_v3_builder_current_id`.
- Worldbook entry `comment` field serves as the title/identifier for deduplication and sync.

## Tests

- Use Node.js built-in test runner (`node --test`), files in `tests/`, `.mjs` extension.
- Pure logic tests only — no browser/DOM environment. No test framework fixtures or mocks needed.
- Run a single test file: `node --test tests/aiTaskCenter.test.mjs`

## Dependencies & quirks

- **GSAP 3** loaded via CDN in `Layout.astro` (`<script is:inline src="...gsap.min.js">`) — available globally, not bundled.
- **@antv/g6 5.x** for relationship graphs in novel analysis.
- AI backend: OpenAI-compatible Chat Completions API (configured in-app, keys in localStorage, never in repo).
- No CI/CD workflows in the repo. No pre-commit hooks. No Docker files.
- Recommended VS Code extension: `astro-build.astro-vscode`.
