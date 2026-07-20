# ST Card Builder — 架构与设计手册

> 本文件供新 Agent 会话载入，涵盖项目架构、NSFW/NTL 设计哲学、已完成的改动、当前状态。

---

## 项目概览

- **Astro 5** 单页应用，`src/pages/index.astro` 入口，纯静态输出到 `dist/`
- 所有视图常驻 DOM，`data-view` 切换，`html/body` 锁死 `overflow:hidden`
- 三栏布局：AppSidebar（左）| 主视图 | AssistantPanel（右）
- 状态管理无框架：`window.__get*__/__set*__` 桥接 + CustomEvent + localStorage/IndexedDB
- AI 后端：OpenAI 兼容 Chat Completions API，密钥存 localStorage

## 关键目录

| 路径 | 用途 |
|---|---|
| `src/lib/aiTaskCenter.mjs` | 全局 AI 任务队列，AbortController 取消 |
| `src/lib/assistant/` | AI 助手：工具注册/风险分级/ReAct 解析/执行器/会话 |
| `src/lib/novel/` | 小说工坊：状态/分析管道/实体库/RAG/同步 |
| `src/lib/promptCanon.mjs` | 默认提示词块 |
| `src/lib/novel/nsfwSupport.mjs` | NSFW/NTL 模板、口味预设、质量门、调色盘引导 |
| `src/lib/card-builder/` | 制卡域：state / panels / `browserApp.mjs`（唯一启动入口） |
| `src/styles/tokens.css` | 设计 token（"夜庭 Nocturne" 暗色调） |
| `src/styles/ui-patterns.css` | 共享 UI 组件 |

## 数据惯例

- **作者注释** = `creatorNotes`（非 ST 的 `postHistoryInstructions`）
- 小说工坊存 IndexedDB：`novelWorkshopV3:card:{cardId}`，**不包含在导出 JSON/PNG 中**
- 草稿 localStorage：`st_v3_builder_drafts`，当前卡：`st_v3_builder_current_id`
- 世界书条目 `comment` = 标题，用于去重和同步
- AI 配置：`st_v3_builder_ai_config`
- RAG 索引：IndexedDB `novelRagV1:card:{cardId}`

---

## NSFW/NTL 设计哲学

### 三层调色盘架构

```
第一层：角色核心调色盘（始终存在，与 NSFW 无关）
  └─ persona_layers / tension_pairs / core_desire

第二层：NSFW 口味（开启 NSFW 后叠加）
  └─ desire_palette / sexual_psychology / situational_modulation / aftercare

第三层：NTL 禁忌层（开启 NTL 后叠加，与 NSFW 解耦）
  └─ 8 种禁忌类型 + attrs.ntl
```

### 核心思想

**不是给人物加标签，而是给 AI 一个调色盘**。用 `primary_hue`（主色调）、`accent_hue`（对比色）、`temperature`（冷暖）、`texture`（触感）来描述欲望——
同一张 Kinks 牌在不同调色盘下读起来完全不同。

### 20 种 NSFW 口味预设

```
情绪基调（8）：纯爱/甜蜜/日常/救赎/恣意/虐恋/暗黑/绝望
关系动态（8）：调教/叛逆/温柔支配/臣服/狩猎/引导/沦陷/敌对
特殊风味（4）：惩戒/羞耻/架空/本能
```

每种口味定义：`group / label / description / palette(temperature, texture, intensity) / focus[] / avoid[]`

### NTL 禁忌类型（8 种，多选）

```
年龄差 / 身份差 / 情感禁忌 / 道德冲突 / 情境禁忌 / 权力胁迫 / 隐秘关系 / 俘获救赎
```

### 恶堕进度（世界书 + MVU，非独立 NSFW 口味）

```
默认 5 阶：未触碰 → 动摇 → 越界 → 沉沦 → 彻底恶堕
可选：简洁 3 / 细腻 7 / 自定义描述生成（2–9 阶）

世界书：
  · 常驻「恶堕进度总则」1 条
  · 每角色「恶堕档案·{名}」1 条（全阶段合集；靠角色名触发）
状态栏模块：corruption_stage（恶堕进度）——变量选当前阶段
入口：CharacterPanel NSFW 区块内；默认仅女角色；助手工具 generate_corruption_lore
实现：src/lib/corruptionProgress.mjs
```

### NSFW_information 扩展结构

```yaml
NSFW_information:
  body: {overall, breasts, waist_hips, genitals, other_features}
  erogenous_zones: []
  sexual_personality: ""
  contrast: ""
  xp_kinks: []
  sensitive_triggers: []
  inner_erotic_thoughts: ""
  Sex_related_traits: {experiences, sexual_orientation, sexual_role, sexual_habits: []}
  Kinks: []
  Limits: []
  # === 调色盘层 ===
  desire_palette: {primary_hue, primary_intensity, accent_hue, accent_intensity, temperature, texture, forbidden_tint}
  sexual_psychology: {core_desire, core_fear, shame_sources, pride_sources, desire_expression, arousal_signature, fantasy_vs_reality, attachment_after}
  situational_modulation: {private_safe, private_charged, semi_public, post_conflict, first_time}
  aftercare: {needs, emotional_shift, relationship_impact}
```

### 角色档案新增字段

```yaml
persona_layers: {surface, social, intimate, under_stress, secret_self}
tension_pairs: [{trait_a, trait_b, resolution}]
core_desire: ""
```

---

## 全局配置 —— 角色设定是唯一入口

**NSFW 口味 / NTL 禁忌配置** 存储于 `st_v3_builder_ai_config`（和 API Key 同级），**角色设定面板（CharacterPanel）是唯一 UI 入口**。

```
CharacterPanel（唯一配置入口）
    ↓ 读写
st_v3_builder_ai_config (localStorage)
    ↓ nsfw-config-changed 事件
    ├→ 角色卡生成 prompt 注入（AI 引擎/开场白/世界书/标签）
    └→ 小说工坊 pipeline 同步（browserApp 监听事件 → state.adultMode/ntlMode/nsfwFlavor/ntlTabooTypes）
```

**小说工坊原始资料面板**不再包含任何 NSFW/NTL 配置 UI——只有分片/召回/处理模式等纯工作流配置。

---

## 已完成的关键改动

### Bug 修复
- `NovelCharactersPanel.astro` 缺失 `novelModalExpandMeta` 元素
- 图谱按钮（重布局/清空）在分析期间未禁态
- `beforeunload` / `pagehide` 刷新保护（防抖 280ms 丢失数据）
- AI 返回空内容无提示 → 抛明确错误
- 卡片管理封面图初始不显示 → `getDraftsForDisplay` 优先保留已存储的 avatar 字段 + 视图切换兜底刷新
- 标签行 AI 按钮过大 → 改为虚线边框小按钮

### NSFW/NTL 增强
- NTL 人物数据模型（`emptyNtlPersonAttrs/normalizeNtlPersonAttrs/mergeNtlPersonAttrs/isNtlPersonFilled`）
- RAG 增强搜索覆盖全部 7 个 pipeline 场景
- `isNsfwProfileFilled` 放宽 body 判定（任一子字段非占位即通过）
- Event 实体支持 `entityNeedsAdultAttrs`
- 20 种口味预设 + 8 种 NTL 禁忌类型

### 代码清理
- 删除 `listNeedingEnrich` 死导出
- 移除 entityStore.mjs 中冗余 `normalizeNsfwEntityAttrs` 调用
- `adultMode` 主字段化，legacy 字段仅旧桶兼容读取

### promptCanon 更新
- `contentCanon`：从标签清单改为调色盘引导（性格层叠→张力对→核心欲望）
- `nsfwPersonCanon`：扩展为全调色盘字段引导
- 所有人物生成/扩展 prompt 注入调色盘写作法

---

## 当前状态与待办

### 架构债（已识别，待处理）
1. ~~`browserApp.mjs` 巨石~~ → 已拆为 `card-builder/` + `novel/panels`；制卡侧由 `card-builder/browserApp.mjs` 的 `initCardBuilder()` 唯一启动（`index.astro` 仅调用入口）
2. entities/legacy 双份数据表示——需统一为 entities 唯一数据源
3. 三份重复的 alias 规范化函数和 uid 生成函数——需统一
4. 无 lint/typecheck 脚本
5. 超大 `.astro` 面板（VariableCard / Assistant / StatusBar）仍待继续拆分

### 功能缺口
- ~~状态栏 NSFW 草案无 NTL 版本~~ → 已提供 `buildStatusBarNtlDraftFromEntities` + 分析页「NTL→状态栏草案」
- ~~开场白面板的口味注入待完善~~ → GreetingPanel 展示当前口味；助手改写 / AI 引擎 / 小说开场白生成已注入
- 角色卡管理封面加载偶尔仍有问题（已加兜底，需验证）

---

## 开发命令

```bash
npm run dev        # 开发服务器 → http://localhost:4321
npm run build      # 静态构建 → dist/
npm test           # Node.js 原生 test runner (tests/**/*.test.mjs)
npm test -- tests/novelCore.test.mjs  # 单文件测试
```

- 提交前执行 `npm test && npm run build`
- 无 lint/typecheck，无 CI/CD，无 pre-commit hook
- VS Code 推荐插件：`astro-build.astro-vscode`
