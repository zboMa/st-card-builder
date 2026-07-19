# 全站视觉 · 夜庭 Nocturne Atelier



SillyTavern 卡片构建器壳层设计 token。状态栏 **30 套预览主题** 在 `src/lib/statusBarThemes/`，与本文档的壳层 token 分层独立。



## 审美方向



- **基调**：略抬亮深靛底 + 双层雾紫光晕（透气、不赛博）

- **Accent**：`--color-accent` 雾紫玫瑰（低 chroma · OKLCH 310°）

- **材质**：侧栏 / 主面板 / 右栏助手统一轻磨砂玻璃（高透明 + 内高光边）

- **动效**：克制；粒子与任务徽章脉冲在 `prefers-reduced-motion: reduce` 下关闭
- **视图切换**：`GsapAnimations.astro` 仅对首屏视图播放入场；切换 `app-view-changed` 时立刻 `ensurePanelsInteractive`，清除 `opacity` / `clip-path` 残留，**面板须立即可点**（正则、酒馆脚本等）
- **数据同步**：正则/酒馆面板写回默认 `silent`（不广播 `card-builder-data-changed`）；MVU 预览扩展未变时不写、监听侧用非 force 同步，避免 ~80ms 刷新循环



## Token 文件



| 文件 | 说明 |

|------|------|

| `src/styles/tokens.css` | 语义色、间距、圆角、阴影 |

| `src/styles/ui-patterns.css` | 共享 UI 类（chip、工具条、按钮层级） |



由 `Layout.astro` 全局 `@import`。



| Token | 用途 |

|-------|------|

| `--color-paper` | 页面底色 |

| `--color-surface` / `--color-glass` | 侧栏、面板背景 |

| `--color-surface-inset` | 嵌套分区（标签区、设置条） |

| `--color-accent` | 主按钮、选中态、滚动条 |

| `--color-chip-bg` / `--color-chip-border` | 标签 pill |
| `--color-msg-user-bg` / `--color-msg-char-bg` | 试聊气泡 |
| `--color-success-soft` / `--color-warning-soft` | 语义色浅底 |
| `--color-slider-track` / `--color-overlay` | 滑条 / 弹窗遮罩 |
| `--color-text` / `--color-text-muted` | 正文 / 次要文案 |

| `--color-border-subtle` | 分割线、输入框边 |

| `--radius-sm` / `--radius-md` / `--radius-lg` | 10 / 14 / 20px |

| `--space-*` | 4pt 间距刻度 |

| `--font-sans` / `--font-mono` | 系统 sans / 等宽 |



## 共享 UI 类（ui-patterns.css）



| 类名 | 用途 |

|------|------|

| `.panel-header` | 面板标题行 + 右侧徽章 |

| `.form-section` | inset 嵌套表单块 |

| `.avatar-upload` | 头像预览 + 文件选择 |

| `.ui-chip` / `.char-tag-chip` | 可移除标签 pill |

| `.chip-list` | 标签列表容器（含空态） |

| `.toolbar-row` | 输入 + 小按钮横排 |

| `.btn-primary` | 主操作（发送、开始试聊） |

| `.btn-ghost` | 次操作（清空、撤销、重置） |

| `.btn-toolbar` | 工具条内 accent 软底按钮（AI 生成） |

| `.btn-sm` | 小号按钮 |
| `.btn-icon` / `.btn-icon--primary` | 36×36 图标按钮；圆形 accent 主操作（助手发送/停止） |
| `.btn-icon--sm` | 32×32 紧凑图标（角色卡管理底栏等） |
| `.btn-ai-expand` | 未扩展骨架行内 AI 按钮（琥珀金，提示可展开）；已扩展条目不加此类 |
| `.composer-bar` | 输入框下：左快捷 + 右图标操作组 |
| `.ui-step-pills` / `.ui-step-pill` | 分步向导 pill（状态栏等） |
| `.ui-tabs` / `.ui-slider` / `.ui-pill-btn` | Tab / 滑条 / 计数 pill |
| `.ui-hint` / `.ui-status-tip` | 说明文案 / 状态提示 |



## 组件约定



1. **新样式**优先用 `var(--*)` 与 ui-patterns 类，避免散落 hex。

2. **按钮层级**：同一区域仅一个 `.btn-primary`；其余用 `.btn-ghost` / `.btn-fetch` / `.btn-add` / `.btn-delete`（在 `Layout.astro` 定义）。

3. **侧栏**：线性 SVG 图标（`AppSidebar.astro`），不用 emoji 作结构导航。

4. **面板标题**：纯文字 h2 + `panel-header`，不用 emoji 作结构图标。

5. **状态栏壳层**对齐全站 token（`StatusBarPanel.astro`）；**30 套预览主题**仍在 `statusBarThemes/*`，与壳层分层独立。

6. **AI 助手 composer**：发送/停止为同一 `.btn-icon--primary` 切换；撤销/清空为左侧 `.btn-icon`；Enter 发送。

7. **角色卡管理**：每张卡底栏左「复制/重命名」、右「JSON/PNG/删除」均为 `.btn-icon--sm` + `title`/`aria-label`，不再使用多色文字按钮。



## 相关文件



- `src/layouts/Layout.astro` — 全局样式与 `.panel` / `.btn`

- `src/components/AppSidebar.astro` — 导航

- `src/components/CharacterPanel.astro` — 标签区 form-section + chip

- `src/components/AssistantPanel.astro` — 底栏按钮层级

- `src/components/ChatPlayground.astro` — 试聊面板

- `src/components/novel/NovelWorkshopStyles.astro` — 小说工坊共用样式

- `src/components/ParticleCanvas.astro` — 背景星尘
- `src/components/GsapAnimations.astro` — 入场动画 + 视图切换面板可交互恢复

- `tests/designTokens.test.mjs` — token 契约测试
- `tests/gsapPanelInteraction.test.mjs` — GSAP 视图切换点击契约

