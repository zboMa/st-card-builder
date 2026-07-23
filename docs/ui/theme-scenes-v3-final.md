# 精品场景主题 · 最终方案 v3

> **状态：M1+M2 已实施**（tier 基建 + 水墨 L2/L3 标杆）；M3–M5 待续  
> 取代 [`theme-scenes-v2.md`](./theme-scenes-v2.md) 的 Phase 2/3 规划；v2 Phase 1 已落地。  
> 关联：[`design-system.md`](./design-system.md) · `src/lib/theme/` · `src/styles/theme/`

---

## 0. 设计目标（一句话）

用户切换主题后，应进入 **一种完整、可沉浸的创作场景**——有辨识度、有材质、有动效语法、有操作反馈；  
**绝不是**「同一套 UI 换 OKLCH 色相」，也 **绝不是**「关特效就退回同质深色 IDE」。

---

## 1. 对用户需求的回应

### 1.1 你真正要的是什么

| 维度 | 目标 | 反模式（严禁） |
|---|---|---|
| **沉浸** | 像换了一间创作室/案台/锻炉，不是换皮肤 | 只有背景渐变变色 |
| **场景全覆盖** | 侧栏、面板、按钮、Modal、助手、移动顶栏、遮罩都有场景材质 | 只改 `body` 背景 |
| **特效契合** | 水墨=墨流/溅墨；烈焰=余烬/火星；碎冰=霜裂/棱光；翠竹=风纹/剑意 | 四套共用同一粒子引擎只换 RGB |
| **交互突出** | 点按、切换、提交有场景化反馈 | 仅 hover 变色 |
| **差异化** | 五套主题 **形、动、触、色** 四维可辨 | 八色块式同质「庭」 |

### 1.2 「降级」还要不要？

**要，但必须重定义。**

降级 ≠ 回到「只换色」；降级 = **在同一主题身份下，减少 motion/算力，不减少场景认同**。

```
L3 沉浸  ─  Canvas 流体/粒子 + 全触点材质 + 交互 FX + 切换叙事
L2 _SCENE  ─  全触点静态场景 + 轻量过渡（无 Canvas rAF）  ← 默认保底档
L1  essential ─  token + 每主题 1 个签名视觉锚点（如山形/冰裂/余烬/竹影）
L0  none     ─  夜庭 nocturne（无 scene 层，保留现有雾紫粒子可选）
```

| 触发 | 结果 |
|---|---|
| 用户选「场景特效：开」+ 设备允许 | **L3** |
| 用户选「场景特效：关」| **L2**（仍全覆盖静态场景，不是换色） |
| `prefers-reduced-motion: reduce` | 强制最高 **L2**；禁止 L3 Canvas |
| `prefers-reduced-transparency: reduce` | L2 内关 blend/半透明叠层，保留实底材质 |
| `saveData` / 可选「省流模式」| 建议 L2，可手动开 L3 |
| 夜庭 `nocturne` | L0；可选夜庭粒子（独立，不与其他 scene 混用） |

**结论**：性能开关管的是 **算力档（L3↔L2）**，不是 **场景身份有无**。  
关特效后仍应是「静态水墨案台」，不是「褐色 nocturne」。

---

## 2. 反同质宪法（实施与验收硬约束）

任一 scene 主题上线前，必须满足：

1. **形**：至少 1 个 **独有 silhouette**（SVG 山/冰裂/竹/火纹），非纯 gradient。
2. **动**：至少 1 种 **独有 motion grammar**（墨晕 spread / 霜雾 drift / 余烬 rise / 竹影 sway），L3 再加 Canvas 层。
3. **触**：至少 2 种 **独有 interaction**（如点击溅墨 + 切换主题墨 bloom；烈焰点击火星 + 主按钮热晕 pulse）。
4. **色**：accent 语义不同（朱砂 / 冰刃青 / 琥珀焰 / 翠玉），且 **禁止** 仅 hue 旋转复制 token 块。
5. **覆盖**：「壳层覆盖清单」≥ 90% 触点有 scene 规则（见 §4）。
6. **禁抄**：不得把 A 主题 CSS/FX 模块 copy 改色当 B 主题；共享只允许 `_shared` 基础设施。

**Reviewer 自问**：截图遮掉 accent 色条，能否凭构图/材质认出主题？不能则不合格。

---

## 3. 五主题场景身份卡（Scene Identity Kit）

每主题在 `themeCatalog.mjs` 扩展 `identity` 元数据（供 FX 模块、文档、测试共用）。

### 3.1 夜庭 · `nocturne`（L0 基准）

| 项 | 内容 |
|---|---|
| 隐喻 | 雾紫玻璃工坊，制卡器原生 |
| 签名形 | 双层雾紫光晕、玻璃内高光 |
| 材质 | 磨砂玻璃 + 软 glow |
| 动效 | 可选紫色粒子连线（现有 `ParticleCanvas`） |
| 交互 | 克制 fade；无炸裂 |
| 禁止借用到 | 其他 scene 的纸纹/冰裂/火焰 |

### 3.2 水墨 · `sumi-ink`

| 项 | 内容 |
|---|---|
| 隐喻 | 案头宣纸长卷，远山留白，正在落墨 |
| 签名形 | **三层远山 SVG silhouette** + 纸纤维纹理 |
| 材质 | 宣纸（matte paper，非 glass 主导） |
| L3 动效 | 2–4 墨团 **breath/flow**（Canvas metaball）；切换主题 **ink bloom** |
| 交互 | 点击 → **溅墨**（3–6 点向外扩散 fade）；导航选中 → 墨点；提交主按钮 → 可选「钤印」闪（朱砂方框 200ms） |
| 面板 | 淡墨框、标题下横批线、侧栏枯笔缘 |
| 禁止 | 霓虹 glow、冷蓝 glass、通用圆粒子 |

### 3.3 碎冰寒霜 · `frost-shard`

| 项 | 内容 |
|---|---|
| 隐喻 | 寒霜结在玻璃上，刃光从冰裂渗出 |
| 签名形 | **冰裂 SVG path 网** + 棱镜高光线 |
| 材质 | 高透明冷玻璃 + 霜 overlay |
| L3 动效 | 极慢 **霜雾 drift**；hover 面板 **shimmer 一次** |
| 交互 | 点击 → **冰晶迸裂**（细线 radial，非火星）；切换 → 霜从边缘 crawl |
| 面板 | 四角碎冰折角；危险态 **冻裂红蓝** |
| 禁止 | 暖色余烬、墨晕、竹影 |

### 3.4 烈焰 · `ember-blaze`

| 项 | 内容 |
|---|---|
| 隐喻 | 锻炉边的创作台，暖而不脏 |
| 签名形 | 底部 **余烬池 SVG 波纹** + 锻铁边框 |
| 材质 | heated metal gradient；忌大面积纯红 |
| L3 动效 | 底部 **余烬粒子上升**（30–50 池化）；ambient flicker |
| 交互 | 点击 → **火星迸溅**（8–12 粒 radial + 短闪）；主按钮 hover → 热晕 pulse |
| 面板 | inner warm highlight；活跃侧栏项背后余烬光斑 |
| 禁止 | 冷蓝冰裂、水墨山形 |

### 3.5 翠竹风刀 · `bamboo-edge`

| 项 | 内容 |
|---|---|
| 隐喻 | 竹林筛光，刃风过竹的飒意 |
| 签名形 | **竹影 silhouette** + 斜风纹 |
| 材质 | 深竹青底 + 半透明竹节 |
| L3 动效 | 竹影 **sway 8s**；风纹 slow scroll |
| 交互 | 点击 → **风切线**（1–2 条 accent 线划过 150ms）；导航 → 竹节竖条 |
| 面板 | 左上角剑意折线；仙侠气质但不换书法全局字体 |
| 禁止 | 复制水墨山形改绿；通用火焰粒子 |

---

## 4. 壳层全覆盖清单（Scene Coverage Map）

**原则**：场景化通过 **统一选择器** 覆盖共享类，禁止各 panel 私改。

### 4.1 环境层（Z0–Z1）

| 触点 | selector 挂载 | L2 | L3 额外 |
|---|---|---|---|
| 页面底 | `body`, `body::before/after` | 纸纹/冰裂/竹影/余烬 SVG+gradient | Canvas ambient |
| 粒子/流体 | `#sceneFxCanvas` | 隐藏 | 主题 FX 模块 |
| 移动顶栏 | `.app-mobile-topbar` | 场景 border/glow | — |
| 移动遮罩 | `#appShellBackdrop` | scene 色 scrim 微调 | — |

### 4.2 导航层

| 触点 | selector | L2 | L3 |
|---|---|---|---|
| 侧栏容器 | `.app-sidebar`, `::before` | 缘饰（枯笔/霜棱/竹节/火纹） | — |
| 导航项 | `.app-sidebar-item`, `.is-active` | 主题指示器（墨点/竹节/…） | active 微动效 |
| 外观入口 | `.theme-entry` | preview 缩略 | — |
| 品牌区 | `.app-sidebar-brand` | 场景 divider | — |

### 4.3 主内容层

| 触点 | selector | L2 | L3 |
|---|---|---|---|
| 主面板 | `.app-container > .panel` | 角花/淡墨框/冰角/锻铁边 | hover 材质 shimmer/热晕 |
| 面板头 | `.panel-header`, `h2` | 横批线/棱光/风纹 | — |
| 导语 | `.ui-panel-lead` | 略调 opacity/字距 | — |
| 表单区 | `.form-section` | inset 场景边 | — |
| 空态 | `.ui-empty-tip` | 主题小图标/纹理 | — |
| Tabs | `.ui-tabs`, `.ui-chip` | accent 场景色 | — |
| 搜索 | `.ui-search-bar` | 边框材质 | focus 场景反馈 |

### 4.4 控件层（仍用现有 btn 类，只覆写 token/伪元素）

| 触点 | 类 | 各主题差异示例 |
|---|---|---|
| 主按钮 | `.btn-primary` | 水墨朱砂 / 冰棱 / 锻铁 heat / 翠玉 |
| 行内 | `.btn-inline` | hover 场景边 |
| 图标 | `.btn-icon` | frost shimmer / ember warm |
| Modal | `.ui-modal-dialog`, backdrop | 场景框；backdrop 色调 |
| 主题馆 | `.theme-gallery-*` | live preview mini scene |

### 4.5 助手 & 对话

| 触点 | selector | 说明 |
|---|---|---|
| 助手面板 | `.assistant-panel` | 玻璃/纸/冰/锻/竹 材质变体 |
| Composer | `.composer-bar` | 发送按钮场景反馈 |
| FAB | `.assistant-fab` | 窄屏；场景 glow |
| 试聊气泡 | `--color-msg-user-bg` 等 | 已在 token；可加 subtle 边 |

### 4.6 切换叙事

| 事件 | 行为 |
|---|---|
| 换主题 | 各 theme 独有 **intro timeline**（300–600ms） |
| 换 view | 不另起 scene 动画（避免与 GsapAnimations 冲突） |
| 开/关 L3 | 600ms 交叉淡入 Canvas，不闪屏 |

### 4.7 明确不覆盖（避免爆炸）

- 卡内 **statusBar 30 套**（分层独立）
- NSFW/NTL 内容区业务 UI
- Admin 独立构建产物
- 各 panel 内部业务列表 **不重写布局**

---

## 5. 技术架构

### 5.1 四层属性

```html
<html
  data-app-theme="sumi-ink"
  data-app-scene="sumi-ink"
  data-scene-tier="immersive|scene|essential"
  data-scene-fx="on|off"
>
```

| 属性 | 含义 |
|---|---|
| `data-app-theme` | 语义 token（`tokens-themes.css`） |
| `data-app-scene` | 场景身份；`nocturne` → `none` |
| `data-scene-tier` | 算力档：`immersive`(L3) / `scene`(L2) / `essential`(L1) |
| `data-scene-fx` | 用户意图开关（映射 tier；与系统降级取 min） |

**有效 tier** = `min(用户意图, 系统上限)`。

### 5.2 模块结构

```
src/lib/theme/
├── themeCatalog.mjs          # + identity 元数据
├── themeBoot.mjs             # theme + scene + tier 同步
├── themeSceneTier.mjs        # NEW: tier 解析、降级、持久化
├── themeSceneFx/
│   ├── host.mjs              # mount/unmount/rAF/resize
│   ├── interact.mjs          # 全局 burst 委托
│   ├── sumiInk.mjs
│   ├── frostShard.mjs
│   ├── emberBlaze.mjs
│   └── bambooEdge.mjs
├── themeGalleryBoot.mjs      # + 特效开关 UI
└── themePickerBoot.mjs

src/styles/theme/
├── scenes/
│   ├── _shared.css           # z-index 约定；勿 app-shell z-index
│   ├── _chrome.css           # NEW: 全触点共享类 scene 化入口
│   ├── sumi-ink.css          # 环境 + 侧栏
│   ├── sumi-ink-chrome.css   # NEW: btn/modal/panel 覆盖
│   └── …（每 theme 可拆 env + chrome）
└── theme-previews.css

Layout.astro
├── #sceneFxCanvas            # NEW（或重构 #particleCanvas 为 scene-aware）
└── FOUC 脚本含 tier 默认值
```

### 5.3 SceneFx 模块接口（统一契约）

```javascript
/** @typedef {Object} SceneFxModule
 *  @property {(tier:'immersive'|'scene'|'essential') => void} applyTier
 *  @property {() => void} mount
 *  @property {() => void} destroy
 *  @property {(x:number,y:number,kind?:string) => void} burst
 *  @property {(type:'theme-enter') => void} playIntro
 */
```

- **host** 根据 `data-app-scene` 动态 import 对应模块（仅 L3 mount Canvas）。
- **interact** 监听：`click` on `.btn-primary`, `.app-sidebar-item`, `.theme-gallery-card` 等；按 scene 调 `burst`。
- 夜庭粒子：L0 独立路径，不与 scene FX 混 mount。

### 5.4 持久化 & 云同步

| Key | 值 | 说明 |
|---|---|---|
| `st_v3_app_theme` | theme id | 已有 |
| `st_v3_scene_fx` | `'1'` / `'0'` | 用户要否 L3（`'0'` → L2，非 L1） |
| `st_v3_fx_enabled` | 兼容 | 逐步迁移：夜庭粒子 + scene L3 共用或别名 |

`userPrefsMirror.mjs` 扩展：`appTheme`, `sceneFx`, `fxEnabled` 上云。

### 5.5 性能预算（L3）

| 项 | 上限 |
|---|---|
| Canvas | 1 个全屏 `#sceneFxCanvas` |
| rAF | 1 循环 / scene |
| 粒子 | 池化 ≤ 60 active |
| burst | 同时 ≤ 3，300ms 内回收 |
| 纹理 | inline SVG / CSS；禁止大图 |
| 移动端 | 默认 L2；主题馆内可开 L3（带 tip） |

### 5.6 无障碍

- `prefers-reduced-motion` → 最高 L2；burst 改静态 flash 或禁用。
- `prefers-reduced-transparency` → 关 mix-blend，保留实色材质。
- 所有装饰 `pointer-events: none`；FX canvas 不接收指针。
- 正文对比度 **WCAG AA** 每 theme 抽检。

### 5.7 z-index（延续已修约定）

- **禁止** `.app-shell { z-index }`。
- 移动：侧栏 8400、遮罩 8300、助手 8500、scene canvas 0（under chrome）。
- 详见 `ParticleCanvas.astro` 注释。

---

## 6. UI：主题馆升级

```
┌  选择创作场景                    ✕  ┐
│  [大卡片 grid — 每卡 embedded mini scene preview] │
│                                                   │
│  场景特效  [====●====]  开                        │
│  ℹ 开：流动墨/余烬/点击反馈；关：保留完整静态场景    │
│                                                   │
│  [取消]                              [应用]       │
└───────────────────────────────────────────────────┘
```

- 选中卡片：**live preview** 临时升到 L3（3s 或至关闭 Modal）。
- 开关注释必须强调：**关 ≠ 只换色**。
- 移动：bottom sheet；开关与 foot 固定可见。

---

## 7. 实施分期（按依赖排序）

### M1 · 基建（必须先做）

- [ ] `themeSceneTier.mjs` + `data-scene-tier` / `data-scene-fx`
- [ ] 主题馆「场景特效」开关 + 云同步字段
- [ ] `#sceneFxCanvas` + `host.mjs` 空壳（无 art 也可测 tier）
- [ ] `_chrome.css` 骨架 + 覆盖清单 lint 测试
- [ ] 修复 `window.__fxEnabled__` 读真实开关
- [ ] 文档 supersede v2 Phase 2/3

### M2 · 水墨标杆（首个完整 scene，验收其他 theme 的模板）

- [ ] 远山 SVG + 纸纹 + 全触点 chrome（L2 达标）
- [ ] `sumiInk.mjs` L3：墨流 + bloom intro
- [ ] 交互：溅墨 + 钤印（主按钮）
- [ ] e2e：tier L2/L3 + 遮罩层级 + elementFromPoint

### M3 · 烈焰（验证「火」语法不同于墨）

- [ ] env + chrome 全套
- [ ] `emberBlaze.mjs`：余烬 rise + 火星 burst
- [ ] 禁止复用水墨 burst 代码路径（共享 pool only）

### M4 · 碎冰 + 翠竹（并行可拆两 PR）

- [ ] 各自 identity 全套 L2
- [ ] 各自 L3 + 交互语法

### M5 · 打磨

- [ ] 主题馆 hover live L3 preview
- [ ] 5 theme × 3 视图截图回归清单
- [ ] `saveData` 启发式提示
- [ ] 性能档位 telemetry（可选，仅 local debug）

---

## 8. 验收标准（最终）

### 8.1 沉浸 & 覆盖

- [ ] 4 个 scene 在 L2 下：**遮 accent 仍可辨主题**（人工 + 截图测试）
- [ ] 壳层覆盖清单 ≥ 90%（§4 自动化：grep 每 theme 的 chrome 文件含 `.btn-primary` 等规则）
- [ ] 关 L3 后 **仍是完整静态场景**，不得与 nocturne 同质

### 8.2 特效

- [ ] L3 水墨：可见墨流动 / 切换 bloom
- [ ] L3 烈焰：可见余烬上升 + 点击火星
- [ ] 交互 burst 各 theme **形态不同**（断言 FX 模块 id 不同）

### 8.3 性能 & 无障碍

- [ ] L3 off 时无 rAF；L3 on 单 canvas
- [ ] reduced-motion 强制无 L3
- [ ] 移动 drawer 不被遮罩盖住（e2e 已有，保持）

### 8.4 工程

- [ ] `npm test` + `npm run build`
- [ ] `node scripts/e2e-theme-mobile.mjs` 扩展 tier 用例
- [ ] 改行为同步更新本文 + `design-system.md`

---

## 9. 不做（边界）

- 用户上传背景图
- 每 panel 独立维护 scene CSS
- 壳层 scene 替代 statusBar 30 套
- 为 scene 新建一套按钮组件（仍 `btn-primary` / `btn-inline` + token/chrome 覆盖）
- 全局书法字体（可读性优先；仅标题 optional 字距/weight）
- WebGL 流体（v3 不做的复杂度；Canvas 2D 足够）

---

## 10. 与 v2 差异摘要

| v2 | v3 最终 |
|---|---|
| 主要 CSS 伪元素 | CSS **全触点** + Canvas FX 分层 |
| Phase 2 = 更多 gradient | M2–M4 每 theme **identity kit** 完整交付 |
| 粒子 ≤5 DOM | Canvas 池化 ≤60，burst 独立 |
| 二元 on/off 未定义 | **L3/L2/L1** 分级；关 FX = L2 非换色 |
| 无交互 FX | **每 theme ≥2 种** 独有交互 |
| 易同质 | **反同质宪法** §2 硬验收 |

---

*方案版本：2026-07-23 v3-final · 实施 SoT*
