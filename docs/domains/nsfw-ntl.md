# NSFW / NTL / 恶堕

> SoT（规则）：本文。SoT（数据与数量）：**仅** `src/lib/adult/**` 与相关拼装代码。  
> **禁止在文档里写死「有 N 种口味」**——数量以代码为准，扩目录走 [`../guides/catalog-quality-standards.md`](../guides/catalog-quality-standards.md)。

## 三层（加性，非互斥）

1. **核心人格调色盘** — 始终可存在，与是否开 NSFW 无关  
2. **NSFW 口味层** — 开启后叠加；多选有上限；首项可作主调  
3. **NTL 禁忌层** — 与 NSFW 开关解耦，可多选  

另有：**世界观成人载体**（`adult/vessels`）、**恶堕进度**（世界书人物条 + MVU，非独立口味）。

**恶堕档案两种形态**：
- **逐人档案**：勾选生成对象后，AI 为每人写「恶堕档案·{名}」（每阶≥`CORRUPTION_MIN_CHARS_PER_STAGE` 字）
- **通用档案**（`恶堕档案·通用`）：**不勾选任何角色时自动生成**，不绑名字、constant 常驻，按阶段写通用演绎框架；适用于所有/随机女角色。运行时阶段由 `NPC.{角色名}.恶堕进度` 变量记录并按名维护（AI 维护，不注入正则/脚本）；总则内含该规则的说明

## UI 入口（唯一）

| 正确 | 错误 |
|---|---|
| 侧栏 **成人配置** → `AdultConfigPanel` | 把 NSFW/NTL 控件塞进 CharacterPanel / 小说原始资料 |

- 卡侧配置为真相源；变更派发 `nsfw-config-changed`  
- 小说工坊 **订阅** 该事件，原始资料面板 **没有** NSFW/NTL UI（只有分片/召回/工作流）
- 桥接 `__setNsfwConfig__`（助手 `set_adult_config` 落地）写入时做一致性归并：恶堕开启自动补开 NSFW；`corruptionPreset` 非法值回退默认；`corruptionStageNames` 走 `resolveStageNames` 归一；NTL 条目按目录白名单过滤

## 新增条目交互（五类目统一）

世界观预设 / 口味 / 姿势语言 / 情趣话风 / NTL 禁忌的**添加**入口统一为 label 行右侧「＋ 新增」按钮 → 居中弹窗（`AdultConfigPanel` 的 `openAddModal`）：

- 弹窗表单行：**分组下拉（短，能看全分组）** + **条目下拉（长，选项显示 `标签 — 摘要`）** + **「确认添加」**，三者同一行
- 选中条目后下方展示**预览**（summary/description）与可选**备注**输入框
- 「确认添加」单步加入；重复条目/超上限（世界观 3、口味 5）给出提示
- 分割线下方是**全部已选列表**：与面板列表同款虚线卡，样式/操作一致（↑↓ 排序、移除、备注随时可改），非仅本次新增
- 无上限类目（姿势/话风/NTL）不设禁用；弹窗关闭后仍可在面板列表编辑备注

> 移除内联下拉与 NTL 芯片；`readNtlItemsFromUi` 以 state 为权威（不再读 `.active` 芯片）。

## 成人体系总纲（固化进卡）

把「世界与限定」选中的体系编译为 `[成人体系]` 前缀世界书条目（**constant 常驻，position=0 ↑Char，order 900 段**），导出卡即带；ST 运行时完整可读，**不依赖 AI 生成转写**。

- **6 类目**：世界观 / 载体框架 / NSFW 口味 / 姿势语言 / 情趣话风 / NTL 禁忌（空类目不生成）
- **内容**：每条含完整 `description` + `writingGuide` + `avoid/antiPatterns` + 用户备注；**不做体积截断**（体积 = 选择量的自然结果；口味≤5、世界观≤3 由前端约束）
- **差异化素材**：姿势/话风补 `覆盖要点`（mustCover，每条 preset 手写动作/语气必点）；载体框架含 `物化语汇`(lexicon) + `载体种子`(vesselSeeds 按器物/丹药/仪式/场所/规则/组织分列) + `禁语`(antiLexicon 现代穿模词)——全部复用各 preset/载体手写字段，禁止机械套模板
- **恶堕不独立成条**：为避免与既有「恶堕进度总则」（constant order=10）内容重叠，恶堕配置改由 `mergeCorruptionConfigNote` 并入进度总则条目末尾（`【恶堕配置摘要】`段：预设/阶段/自定义纲要/配置备注，幂等；`stripCorruptionConfigNote` 对称剥离）；进度总则不存在时宁缺勿动
- **入口（合并操作）**：面板「生成/更新体系总纲」按钮（已并入恶堕世界书生成，无独立「生成恶堕世界书」按钮）。内部顺序固定：**先写恶堕世界书**（`runGenerateCorruptionLore`：总则 + 勾选角色分期档案，需 AI；未启用恶堕/无目标/无 AI 时跳过并提示），**再编译** `[成人体系]` 6 条并 `mergeCorruptionConfigNote` 并入最新进度总则——避免先总纲后恶堕重建造成的摘要丢失；导出自动兜底（启用且无总纲时静默生成一次，已有则不动）
- **更新语义**：按 comment upsert，只覆盖对应类目；前端世界书面板识别 `[成人体系]` 前缀加「体系」标签
- **水合（R1）**：配置快照存 `cardBuilderExtensions['st-builder.adultConfig']`（随卡 `data.extensions`）；导入卡时自动覆盖本地并回填面板
- **保护**：智能整理排除受控前缀（`[initvar]`/`[mvu_update]`/`[成人体系]`/`恶堕进度总则`）；补触发词仅处理非 constant，天然豁免
- **排序**：生成时插入系统锚点区（`[成人体系]`/`[initvar]`/`[mvu_update]`/`恶堕进度总则` 之前），集中且靠前

## 两管道隔离

| 管道 | 用途 | 成人配置 |
|---|---|---|
| `protagonist` | 角色设定 / 开场白 | 禁止注入成人配置 |
| `worldbook` | 世界书 / 人物条 / 恶堕 | 可读卡级成人配置 |

默认同步互不串写。小说「同步到角色设定」已重定向为世界书人物条。

## 成年边界

- 禁止儿童性化  
- 世界观可写礼法成年制度；情欲仅限已完成设定成年礼的成人角色  
- 见 `src/lib/adult/shared/consentBoundary.mjs`

## 代码地图

| 路径 | 内容 |
|---|---|
| `src/lib/adult/flavors/` | 口味预设与 enrichment |
| `src/lib/adult/ntl/` | NTL 类型与 enrichment |
| `src/lib/adult/vessels/` | 世界观载体 |
| `src/lib/adult/canon.mjs` | Canon 拼装 |
| `src/lib/corruptionProgress.mjs` | 恶堕进度 |
| `src/lib/novel/nsfwSupport.mjs` | barrel：小说侧提示拼装 / 质量门 |
| `src/lib/novel/nsfwSupportAttrs.mjs` | 实体 attrs 与模式开关 |
| `src/lib/novel/nsfwSupportDigest.mjs` | 摘要互喂 |
| `src/lib/novel/nsfwSupportHints.mjs` | 推断与口味/禁忌提示 |

## 相关

- 架构总览：[`../architecture/overview.md`](../architecture/overview.md)
- 目录扩写质量：[`../guides/catalog-quality-standards.md`](../guides/catalog-quality-standards.md)
