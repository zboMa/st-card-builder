# 精品场景主题方案 v2

> 状态：**Phase 1 已实施**（单行入口 + 主题馆 Modal + 5 主题 catalog + 场景 CSS 骨架；水墨最完整）  
> 前置：[`theme-skins-plan.md`](./theme-skins-plan.md)（token 基建可复用，UI/主题清单需重做）

---

## 1. 现状问题

| 问题 | 说明 |
|---|---|
| 侧栏占区 | 4×2 swatch 网格 + 说明文字，挤占导航与配置区 |
| 缺乏精品感 | 仅改 OKLCH token，无光晕纹理、无场景装饰、无材质层次 |
| 主题过多且同质 | 8 套「庭」差异主要是色相，用户难以形成记忆点 |
| 与产品气质不符 | 制卡/小说/仙侠 RP 用户更认 **场景皮肤**，不是 IDE 配色方案 |

**结论**：保留 token 换色能力作为 **底层**，上层改为 **少量精品场景主题** + **紧凑入口**。

---

## 2. 产品定位

```
底层：语义 token（可读性、对比度、按钮态）  ← 已有 tokens-themes
中层：场景材质（纸纹 / 冰裂 / 焰纹 / 竹影）  ← v2 核心
上层：壳层装饰（侧栏缘饰、面板角花、背景意象）← v2 核心
```

用户感知应是：**「换了一种创作环境的场景」**，不是「换了一套颜色变量」。

---

## 3. 主题清单（精品 4 + 默认 1）

| id | 名称 | 场景关键词 | 与 v1 关系 |
|---|---|---|---|
| `nocturne` | **夜庭** | 默认雾紫玻璃 · 制卡器原生 | 保留为默认，无场景层 |
| `sumi-ink` | **水墨** | 宣纸、墨晕、远山、枯笔 | 替代 `ink`；非简单褐金换色 |
| `frost-shard` | **碎冰寒霜** | 冰晶、霜裂、冷雾、刃光 | 替代 `frost` |
| `ember-blaze` | **烈焰** | 余烬、流火、暖浪、锻铁 | 新增 |
| `bamboo-edge` | **翠竹风刀** | 竹影、剑意、翠色、风纹 | 替代 `jade` |

**下架/隐藏**（不再出现在选择器）：`rose` `neon` `slate` `daybreak` 及 v1 同名弱差异色板。  
已选旧 id 迁移见 §8。

---

## 4. 各场景视觉规范（要「看得见场景」）

### 4.1 水墨 · `sumi-ink`

**意象**：半干宣纸上的墨晕与留白，像铺开一张创作稿纸。

| 层 | 实现要点 |
|---|---|
| 纸底 | `--color-paper` 暖灰米 + **低频 paper-grain**（CSS `repeating-linear-gradient` 或内联 SVG noise，opacity 3–5%） |
| 墨晕 | `body::before` 大椭圆 radial 2 层：浓墨（低 chroma 黑）+ 淡墨扩散；位置偏左上 |
| 侧栏 | 右缘 **枯笔刷痕** SVG mask（1px 宽装饰条）；选中项左侧 **墨点** 指示（非纯 accent 条） |
| 面板 | `border-radius` 略大；内 inset **淡墨框**（double border  illusion）；标题下 optional **极淡横批线** |
| Accent | 非饱和「朱砂点题」oklch(52% 0.12 25) 仅用于主 CTA / 选中，不全屏铺紫 |
| 字体 | 面板标题 optional `font-weight: 600` + 略增字距；**不**全局换书法体（可读性优先） |
| 动效 | 切换主题时墨晕 **400ms 扩散**；`prefers-reduced-motion` 静态 |

### 4.2 碎冰寒霜 · `frost-shard`

**意象**：寒霜结在玻璃上，裂纹里透着冷蓝刃光。

| 层 | 实现要点 |
|---|---|
| 冰底 | 深蓝灰底 + **冰裂纹理** overlay（SVG path 随机裂纹，`mix-blend-mode: overlay`） |
| 光 | 侧栏/面板 **棱镜高光**（linear-gradient 135° 细线，hover 时 shimmer 一次） |
| 玻璃 | `--color-glass` 更高透明 + **冷白外发光** `box-shadow: 0 0 24px oklch(85% 0.04 220 / 0.08)` |
| 装饰 | 面板四角 **碎冰折角**（伪元素 clip-path 小三角，opacity 低） |
| Accent | 冰刃青 oklch(78% 0.11 220)；危险态偏 **冻裂红蓝** 而非纯红 |
| 动效 | 背景 **极慢** 霜雾 drift（translate 20px / 60s）；reduced-motion 关闭 |

### 4.3 烈焰 · `ember-blaze`

**意象**：锻炉余烬上的创作台，暖而不脏。

| 层 | 实现要点 |
|---|---|
| 底 | 深褐红底 + 底部 **余烬 radial**（橙→透明）；忌大面积高饱和红 |
| 面板 | 边框 **锻铁感**（dark border + inner warm highlight）；hover 轻 **热晕** |
| 侧栏 | 活跃项背后 **余烬光斑**（小 radial blur）；图标 optional 微暖 tint |
| 装饰 | 顶栏/品牌区下缘 **极淡火纹** divider（SVG wave） |
| Accent | 琥珀焰 oklch(72% 0.14 45)；主按钮像 ** heated metal** gradient |
| 动效 | 余烬 particle **3–5 个** CSS 点光 slow float（仅 shell 背景层）；reduced-motion 静态 |

### 4.4 翠竹风刀 · `bamboo-edge`

**意象**：竹林筛下的光，刃风过竹的飒意（仙侠制卡/小说气质）。

| 层 | 实现要点 |
|---|---|
| 底 | 深竹青底 + 右侧/左侧 **竹影 silhouette**（SVG bamboo stalks，opacity 6–8%） |
| 风 | 斜向 **风纹** 细线（45° repeating gradient，极淡） |
| 侧栏 | 选中项 **竹节** 竖条（3 段 mini segments）；分组标题 optional 竹叶 icon 12px |
| 面板 | 左上角 **剑意折线** 装饰（1px accent 折线，不挡内容） |
| Accent | 翠玉 oklch(70% 0.1 155) + 刃光 highlight oklch(88% 0.06 155) |
| 动效 | 竹影 **8s 轻微 sway**（transform rotate 0.3deg）；reduced-motion 关闭 |

---

## 5. UI 入口（不占侧栏大块）

### 5.1 侧栏：单行入口

```
┌ 外观 ─────────────────────┐
│ [缩略图]  碎冰寒霜    ›   │  ← 单行 btn-inline 风格
└───────────────────────────┘
```

- 仅 **一行**：当前主题缩略图（48×32 场景 preview）+ 名称 + chevron
- 点击 → 打开 **主题馆**（非侧栏内展开全部）

### 5.2 主题馆 Modal / Bottom Sheet

```
┌  选择创作场景          ✕  ┐
│  ┌──────┐  ┌──────┐       │
│  │ 夜庭 │  │ 水墨 │       │  大卡片：场景 preview 图/Canvas
│  │ 默认 │  │ 墨晕 │       │  + 名 + 一句场景文案
│  └──────┘  └──────┘       │
│  ┌──────┐  ┌──────┐       │
│  │碎冰寒霜│ │ 烈焰 │       │
│  └──────┘  └──────┘       │
│  ┌──────┐                  │
│  │翠竹风刀│                 │
│  └──────┘                  │
│  [应用] （选中即预览，点应用关闭）│
└────────────────────────────┘
```

- 桌面：**居中 Modal**（max-width 520px）；移动：**bottom sheet**
- 卡片 hover：**live preview** 在卡片内嵌 mini 壳层 mock（非仅色点）
- 选中态：场景边框 + 角标「当前」
- **禁止**在侧栏平铺 5+ 个小 swatch

### 5.3 Preview 缩略图生成

每主题提供 **静态 preview**（二选一）：

1. **CSS 微缩场景**（推荐）：`.theme-preview--sumi-ink` 等，在 80×56 容器内复刻纸纹+墨晕
2. **预渲染 WebP**（`public/theme-previews/*.webp`）— 更清晰但需维护资产

---

## 6. 技术架构

### 6.1 双层属性

```html
<html data-app-theme="sumi-ink" data-app-scene="sumi-ink">
```

| 属性 | 职责 |
|---|---|
| `data-app-theme` | token 语义色（对比度、accent、glass） |
| `data-app-scene` | 场景装饰层 ON/OFF + 场景专用 CSS 选择器 |

默认 `nocturne` 可 **无 scene 层** 或 `data-app-scene="none"`。

### 6.2 文件结构

```
src/styles/theme/
├── tokens-themes.css      # 5 套 token（精简自 8）
├── scenes/
│   ├── _shared.css        # 场景层 z-index、blend 约定
│   ├── nocturne.css       # 空或仅默认光晕
│   ├── sumi-ink.css
│   ├── frost-shard.css
│   ├── ember-blaze.css
│   └── bamboo-edge.css
└── theme-previews.css     # 主题馆卡片微缩 preview

src/lib/theme/
├── themeCatalog.mjs       # 5 条精品 meta + previewClass
├── themeSceneBoot.mjs     # 切换时 toggle scene class on body
├── themeGallery.mjs       # Modal 逻辑
└── themePickerBoot.mjs    # 改为单行入口 + 打开 gallery
```

### 6.3 装饰层挂载点（统一，避免各 panel 私改）

| 挂载点 | 用途 |
|---|---|
| `body::before` / `::after` | 全页纸纹 / 冰裂 / 余烬 / 竹影（pointer-events: none） |
| `.app-sidebar::before` | 侧栏缘饰（笔刷/霜棱/竹节） |
| `.panel::before` | 面板角花（可选，仅主面板 `.app-container > .panel`） |
| `#appShellBackdrop` | 移动遮罩可随 scene 微调色 |

**硬约束**：装饰层 **不得**挡点击；`z-index` 低于内容；对比度仍靠 token 保证。

### 6.4 性能与无障碍

- 纹理优先 **CSS + inline SVG**，禁止大图背景
- 粒子 ≤5 个 DOM 或纯 CSS pseudo
- `prefers-reduced-motion: reduce` → 关 drift/shimmer/粒子
- `prefers-reduced-transparency: reduce` → 关 blend overlay，保留 token 实底
- 每 scene 做 **WCAG AA** 抽检（正文 4.5:1）

---

## 7. 与状态栏 30 套的关系

不变：壳层 scene ≠ 卡内 statusBar 设计。  
主题馆内可加一句 tip：「状态栏预览样式在制卡面板单独设置」。

可选远期：scene 主题提供 **推荐 statusBar 族**（如 bamboo-edge → xianxia 族），一键应用，非 v2 必须。

---

## 8. 迁移（v1 → v2）

| 旧 id | 新 id |
|---|---|
| nocturne | nocturne |
| ink | sumi-ink |
| frost | frost-shard |
| jade | bamboo-edge |
| rose / neon / slate / daybreak | **nocturne**（回退默认） |

`localStorage` 读档时 map 一次；无效 id → `nocturne`。

---

## 9. 实施分期

### Phase 1 — UI 收口（小 PR）

- 侧栏改 **单行入口** + 主题馆 Modal 骨架
- catalog 改为 5 条；隐藏 8 swatch 网格
- 迁移 map；测试更新

### Phase 2 — 场景 CSS（4 PR 或 1 PR 分文件）

- 每 scene 独立 CSS + preview 微缩
- 先做 **水墨 + 碎冰**（差异最大、验证架构）
- 再做 **烈焰 + 翠竹风刀**

### Phase 3 — 打磨

- 主题馆内 hover live preview
- 云同步 `prefs.appTheme`
- 截图回归清单（5 主题 × 3 视图：卡管理 / 助手 / 小说工坊）

---

## 10. 验收标准

- [x] 侧栏外观区 **≤1 行**（+ 可选 1 行 hint）
- [ ] 5 套主题中 4 套 scene **肉眼可辨场景元素**（纸/冰/火/竹），非仅 hue 不同 — Phase 1 水墨较完整，其余待 Phase 2 加深
- [x] 切换无 FOUC；reduced-motion 无强动画
- [x] 主路径面板无装饰挡操作（`pointer-events: none`）
- [x] 旧 8 主题 localStorage 迁移正确

---

## 11. 不做

- 用户自定义上传背景图
- 每 panel 单独一套 scene（维护爆炸）
- 侧栏平铺全部主题
- 为 scene 另起一套按钮组件（仍用 `btn-inline` / `btn-primary` + token）

---

*方案版本：2026-07-23 v2*
