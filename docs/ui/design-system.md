# 全站视觉 · 夜庭 Nocturne Atelier

> SoT：本文 + `src/styles/ui-patterns.css` + `src/styles/tokens.css`。索引见 [`../README.md`](../README.md)。

SillyTavern 卡片构建器壳层设计 token。状态栏 **30 套预览主题** 在 `src/lib/statusBarThemes/`，与本文档的壳层 token 分层独立。

**壳层换肤**：5 套精品场景主题（默认夜庭 + 水墨 / 碎冰寒霜 / 烈焰 / 翠竹风刀），`html[data-app-theme]` 语义色 + `html[data-app-scene]` 场景装饰；侧栏「外观」**单行入口** → 主题馆 Modal；持久化 `localStorage` key `st_v3_app_theme`。详见 [`theme-scenes-v2.md`](./theme-scenes-v2.md)（v1 方案见 [`theme-skins-plan.md`](./theme-skins-plan.md)）。

**所有 UI 变更须遵循本文档。** 新增控件优先复用 `ui-patterns.css` 共享类，禁止在局部再发明一套 tip / 搜索 / 行内按钮。

---

## 审美方向

- **基调**：略抬亮深靛底 + 双层雾紫光晕（透气、不赛博）
- **Accent**：`--color-accent` 雾紫玫瑰（低 chroma · OKLCH 310°）
- **材质**：侧栏 / 主面板 / 右栏助手统一轻磨砂玻璃（高透明 + 内高光边）
- **动效**：克制；粒子与任务徽章脉冲在 `prefers-reduced-motion: reduce` 下关闭
- **视图切换**：`GsapAnimations.astro` 仅对首屏视图播放入场；切换 `app-view-changed` 时立刻 `ensurePanelsInteractive`，清除 `opacity` / `clip-path` 残留，**面板须立即可点**
- **数据同步**：正则/酒馆面板写回默认 `silent`；MVU 预览扩展未变时不写，避免刷新循环

---

## 交互设计原则（设计师视角）

1. **一眼一层**：同一视区只有一个主任务；状态反馈贴在对象上（卡片角标），不抢工具条/筛选区。
2. **就地操作**：能点对象本身完成的事，不另开图标（例：点名称重命名）。
3. **密度一致**：卡片底栏所有操作同一行、同一高度；图标操作用 `btn-icon--sm`，文字操作用 `btn-inline`。
4. **控件同源**：搜索、空态、tip、角标全站同一套视觉，禁止「这一页一个样子」。
5. **错误可点**：检查/告警用紧凑角标 + 数字；详情进弹窗，不用全宽横条挡筛选。
6. **主栏无死区**：主内容区面板默认 **全宽铺满**（`width: 100%; max-width: none`）。禁止给整页面板设 `max-width: 960px` 之类留下右侧空白。长文可读宽度只约束正文列（如阅读区 `.ss-read-page`、写作 textarea）。

---

## 文本分层（强制）

| 层级 | 用途 | 类名 | 规格 |
|------|------|------|------|
| 标题 | 面板 h2 / 卡片名 | 原生 h2 / 覆盖层标题 | 面板标题用 `panel-header`；卡片名加粗、可截断 |
| 正文 | 表单内容、列表正文 | 默认 text | `--color-text` / `--color-text-secondary` |
| 面板导语 | 标题下一段说明 | `.ui-panel-lead` | ≈0.78rem muted；**一块即可**，勿堆第二段正文 |
| 行内 tip | 跟在 label 后 | `.ui-hint.ui-hint--inline` | ≈0.66rem；**同行**，不换行成第二段 |
| 强调 tip | 规则/禁忌说明 | `.adult-pref-tip` 或 `.ui-pref-tip` | 左色条 + 柔底 |
| 状态 tip | 操作反馈 | `.ui-status-tip` | 表单下方；ok/warn/err 变色 |
| 元信息 | 更新时间、发布态 | 覆盖层 / `.ui-meta` | ≈0.7rem muted |

**禁止**：用正文字号写 tip；把 tip 单独撑成整行横条挡交互；在 label 下一行再放一段可缩短的 tip（能放同行就放同行）。

---

## 标准控件模式

### 搜索

列表筛选统一使用 **世界书同源** 搜索条：

```html
<div class="ui-search-bar wb-search-bar">
  <span class="ui-search-icon wb-search-icon" aria-hidden="true">🔍</span>
  <input class="ui-search-input wb-search-input" type="search" … />
  <button type="button" class="ui-search-clear wb-search-clear" hidden>✕</button>
</div>
```

- `.ui-search-*` 与 `.wb-search-*` 为同一视觉（双类名兼容旧面板）。
- 作用域芯片（标题/触发词…）仅世界书需要时使用 `.wb-search-scope`。
- **例外**：后台 admin 工具条极窄搜可保留 plain input，并在 PR 注明。

### 空态

居中 + tip 视觉，禁止左上角灰正文：

- `.ui-empty-tip`（或既有 `.wb-entries-empty` / `.card-manager-empty` / `.ss-empty--panel`）
- 虚线边 + accent 柔底 + 居中文案

### Label + tip

```html
<div class="char-tags-label-row"><!-- 或 .ui-label-row -->
  <label>…</label>
  <span class="ui-hint ui-hint--inline">…</span>
</div>
```

### 行内跳转 / 补齐

跟在说明文字后，用链接按钮（如 `.ai-engine-link-btn`），**不单开一行**。

### 按钮层级

| 层级 | 类 | 场景 |
|------|-----|------|
| L1 主 CTA | `.btn-primary` | 发送、开始、保存全部 |
| L2 面板工具 | `.btn-panel-tool` / `.btn-ai-engine` / `.btn-fetch` | 顶栏次要入口 |
| L3 行内文字 | `.btn-inline`（含发布/分享/增版） | 与图标同排的文字操作 |
| L4 元数据 | `.btn-meta` | 版本 bump、极次要 |
| 图标 | `.btn-icon` / `.btn-icon--sm` | 复制、导出、删除 |

同一区域 **仅一个** `.btn-primary`。  
卡片底栏 **禁止** 再用大块 `.btn` / `.btn-sm` 做发布/分享。

`.adult-btn-compact` 作为 `.btn-inline` 的别名保留，旧面板可渐进替换。

### 封面卡信息叠放

预览卡（角色卡管理）：

1. 名称 + 元信息叠在封面**下沿**（渐变遮罩），不单独占一块正文区。
2. 角标（检查 / 当前 / 版本）在封面**右上**，同一尺寸体系。
3. 底栏仅操作：左图标组（复制 / 删除）、右「云快捷（按状态）+ 更多」⋯，**一行**；更多菜单挂 `document.body` + `position: fixed`，避免卡片 `overflow: hidden` 裁切。云快捷仅额外入口，⋯ 内云菜单项不变。
4. 点名称 → 重命名；点封面其余区域 → 打开；不设独立重命名图标。
5. 标签筛选浮层：竖排可滚动列表，挂 body（高 z-index），避免被卡片网格盖住。
6. 操作反馈：普通提示用 **message toast**；重要/失败用 **notification**；禁止 `alert` / `confirm` / `prompt` 原生弹窗（角色卡管理走自定义对话框）。

小说管理无封面时：标题可点重命名；操作行规则与上相同。

### 状态角标（检查）

- 贴在对象上（当前卡右上，位于「当前」左侧）。
- 尺寸对齐其它角标；错误视觉（危/警色）+ 图标 + 数字。
- 点击打开详情弹窗；全宽横条不得挡筛选/下拉。

---

## Token 文件

| 文件 | 说明 |
|------|------|
| `src/styles/tokens.css` | 入口：`tokens-base.css` + `tokens-themes.css` + `theme/scenes.css` |
| `src/styles/tokens-base.css` | 间距、圆角、字体、动效 |
| `src/styles/tokens-themes.css` | 5 套 `[data-app-theme]` 语义色 |
| `src/styles/theme/scenes/*.css` | 4 套 `[data-app-scene]` 装饰层（纸纹 / 冰裂 / 焰纹 / 竹影） |
| `src/styles/ui-patterns.css` | 共享 UI 类（chip、工具条、按钮层级、搜索、空态、文本分层） |
| `src/styles/layout-chrome.css` | 壳层布局、三栏、移动端抽屉、`.panel` / `.btn` 基线（从 Layout 外提） |

由 `Layout.astro` 全局 `@import`（含 `layout-chrome.css`）。

| Token | 用途 |
|-------|------|
| `--color-paper` | 页面底色 |
| `--color-surface` / `--color-glass` | 侧栏、面板背景 |
| `--color-surface-inset` | 嵌套分区 |
| `--color-accent` | 主按钮、选中态 |
| `--color-chip-bg` / `--color-chip-border` | 标签 pill |
| `--color-msg-user-bg` / `--color-msg-char-bg` | 试聊气泡 |
| `--color-success-soft` / `--color-warning-soft` | 语义色浅底 |
| `--color-text` / `--color-text-muted` | 正文 / 次要 |
| `--color-border-subtle` | 分割线、输入框边 |
| `--radius-sm` / `--radius-md` / `--radius-lg` | 10 / 14 / 20px |
| `--space-*` | 4pt 间距 |
| `--font-sans` / `--font-mono` | sans / 等宽 |

---

## 共享 UI 类（ui-patterns.css）

| 类名 | 用途 |
|------|------|
| `.panel-header` | 面板标题行 + 右侧徽章 |
| `.form-section` | inset 嵌套表单块 |
| `.ui-panel-lead` | 面板导语（标题下） |
| `.ui-label-row` | label + 行内 tip |
| `.ui-search-bar` (+ `.wb-search-bar`) | 标准搜索条 |
| `.ui-empty-tip` | 居中空态 tip |
| `.ui-pref-tip` / `.adult-pref-tip` | 强调 tip |
| `.ui-chip` / `.char-tag-chip` | 可移除标签 |
| `.chip-list` | 标签列表 |
| `.toolbar-row` | 输入 + 小按钮横排 |
| `.btn-primary` / `.btn-ghost` / `.btn-toolbar` | 主/次/工具条 |
| `.btn-panel-tool` / `.btn-ai-engine` / `.btn-meta` | L3–L4 |
| `.btn-inline` / `.adult-btn-compact` | 行内紧凑文字按钮 |
| `.btn-icon` / `.btn-icon--sm` | 图标按钮 |
| `.ui-hint` / `.ui-hint--inline` / `.ui-status-tip` | 说明 / 行内 / 状态 |
| `.ui-tabs` / `.ui-slider` / `.ui-pill-btn` | Tab / 滑条 / pill |

---

## 组件约定

1. **新样式**优先用 `var(--*)` 与 ui-patterns 类，避免散落 hex。
2. **侧栏**：线性 SVG 图标，不用 emoji 作结构导航。
3. **面板标题**：纯文字 h2 + `panel-header`。
4. **状态栏壳层**对齐全站 token；30 套预览主题独立。
5. **AI 助手 composer**：发送/停止同一 `.btn-icon--primary`；Enter 发送。
6. **角色卡 / 小说管理**：底栏图标 + `btn-inline` 发布簇同行；点名重命名；检查用角标。
7. **小说创作（story-studio）**：五视图面板全宽铺满主栏；**操作在面板右上角**；空态用居中 tip；阅读正文列可限宽。图谱用 G6（同小说分析）；大纲标题点击编辑；写作用折叠/浮层收纳；阅读目录默认浮动隐藏。

---

## 相关文件

- `src/layouts/Layout.astro` — 壳层 HTML + `@import` tokens/ui-patterns/layout-chrome
- `src/lib/layout/chromeBoot.mjs` — 可搜索下拉 portal（从 Layout 外提）
- `src/components/AppSidebar.astro` — 导航
- `src/components/CardManagerPanel.astro` — 角色卡网格
- `src/components/CharacterPanel.astro` — 标签区 form-section + chip
- `src/components/WorldbookPanel.astro` — 搜索控件源模式
- `src/components/AssistantPanel.astro` — 底栏按钮层级（壳 + 样式；逻辑见 `panelBoot.mjs`）
- `src/components/novel/NovelWorkshopStyles.astro` — 小说工坊
- `tests/designTokens.test.mjs` — token / 共享类契约
