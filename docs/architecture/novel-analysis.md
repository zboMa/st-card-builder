# 小说分析体系架构（完整方案）

> 状态：已确认方向（2026-07-18）  
> 范围：一次性完整落地；旧「人物扫描 / 世界书抽取」降级保留原位  
> RAG：方案 2（远程 Embedding + IndexedDB）+ 方案 4（关键词 ∪ 向量混合）

---

## 1. 产品目标

1. 将小说分析分解，提取 **人物 / 势力 / 地点 / 物品 / 事件 / 设定(lore) / NSFW(可选)** 等关键信息。  
2. 分门别类形成 **丰满条目**（含摘要、正文、触发词、类型字段、关系、原文溯源），尽量不丢关键信息。  
3. 用户可在 **AI 助手** 做问答式调整；问答时 **自动结合相关原文 + 相关实体**。  
4. 旧流水线作为降级方案保留，不删除入口。

---

## 2. 目标架构

```
                    模块化面板（src/lib/novel/panels/）
                    ─────────────────────────────────
原始资料 ──→ source.mjs（导入）
                 ↓
           chapters.mjs（拆章）
                 ↓
     ┌── Chunk 索引层（关键词倒排 + Embedding 向量）──┐
     │         IndexedDB 按 cardId 分桶                 │
     │         实现：src/lib/novel/rag/*.mjs             │
     └────────────────────┬────────────────────────────┘
                          ↓
              analyze.mjs（统一分析管线）
              骨架扫描 → 实体丰满化 → 关系/时间线
              实现：src/lib/novel/analyzePipeline.mjs
                          ↓
                   Entity Store（知识库）
              src/lib/novel/entityStore.mjs
              person / faction / location / item / event / lore / nsfw
                          ↓
        ┌─────────────────┼─────────────────┐
        │                 │                 │
 characters.mjs      graphViz.mjs      assistant RAG 问答
 + worldbook.mjs     （关系图/时间线）   （检索原文+实体后答/改）
 （分类浏览编辑）     graphMerge.mjs     实现：src/lib/assistant/*.mjs
        │                                   │
        │            src/lib/novel/rag/inject.mjs
        │                                   │
        └────────── 同步到主卡 ─────────────┘
           src/lib/novel/sync.mjs（角色设定 / 世界书条目）

降级路径（保留）：人物扫描、世界书抽取（旧一体分析已废止，能力由 `panels/analyze.mjs` 统一分析管线接替）

模块总览：
  src/lib/novel/panels/   source.mjs · chapters.mjs · setup.mjs · analyze.mjs · characters.mjs · worldbook.mjs · style.mjs
  src/lib/novel/          browserApp.mjs（~684 行 orchestrator）· stateMachine.mjs · shared/context.mjs · shared/bridge.mjs
  src/lib/novel/          state.mjs · schema.mjs · entityStore.mjs · analyzePipeline.mjs
  src/lib/novel/          chapters.mjs · recall.mjs · graphMerge.mjs · graphViz.mjs · sync.mjs · nsfwSupport.mjs
  src/lib/novel/rag/      chunker.mjs · embedClient.mjs · store.mjs · keywordSearch.mjs · vectorSearch.mjs · hybridSearch.mjs · indexBuild.mjs · inject.mjs · embeddingConfig.mjs
  src/lib/assistant/      tools.mjs · executor.mjs · risk.mjs · parser.mjs
```

**原则**

- **单一真相源**：实体库 `entities[]` + `relations[]`；图谱是视图，不是第三套数据。  
- **检索层共用**：AI 扩展、统一丰满化、助手问答共用同一 RAG。  
- **原文优先**：条目带 `provenance`；合并时事实摘录优先于「更长幻觉文本」。  
- **降级不破坏**：旧模块仍写兼容投影（见 §6），用户可继续用旧习惯。

---

## 3. 数据模型

### 3.1 Entity

```js
{
  id: 'ent_xxx',
  type: 'person'|'faction'|'location'|'item'|'event'|'lore'|'nsfw',
  name: string,
  aliases: string[],
  summary: string,          // ≤120 字
  content: string,          // 丰满正文，指导 RP
  keys: string[],           // 世界书触发词
  attrs: object,            // 类型特有（人物可挂附录1 profile）
  layer: 'green'|'blue',    // 同步世界书时的策略倾向
  confidence: number,       // 0~1
  provenance: [             // 原文溯源（至少 1 条才算「已丰满」可配置）
    { chapterId, chunkId, quote, score? }
  ],
  syncStatus: 'unsynced'|'synced'|'dirty',
  selected: boolean,
  updatedAt: ISO8601,
  source: 'analyze'|'legacy_scan'|'legacy_wb'|'assistant'|'manual'
}
```

### 3.2 Relation

```js
{
  id: 'rel_xxx',
  fromId, toId,
  rel: string,              // 如 隶属/对立/位于/参与
  evidence: string[],       // 短摘录或 quote 引用
  updatedAt
}
```

### 3.3 类型特有 attrs（最低要求）

| type | attrs 关键字段 |
|------|----------------|
| person | `profile`（附录1 全字段，可渐进填满）；成人：`nsfwMeta:{inferred,confidence,lastPass}` |
| faction | `members[]`, `opponents[]`, `goals`, `territory`；成人：`adult` 维 |
| location | `region`, `controlledBy`, `features`；成人：`adult` 维 |
| item | `owner`, `abilities`, `plotRole`；成人：`adult` 维 |
| event | `when`, `where`, `participants[]`, `cause`, `effect`, `order`（时间序）；亲密：`intimate` |
| lore | `aspect`（worldview/rule/history/setting…）；成人：`adult` 维 |
| nsfw | `kind` rule/place/item/dynamic/taboo/consent；按 kind 最低字段；`rules[]` `limits[]` `consent` `triggers[]` `atmosphere` `playIdeas[]` `relatedNames[]`；仅成人模式产出 |

**非人物通用成人维 `attrs.adult`**（item/location/lore/faction）：

`eroticRole` · `atmosphere` · `triggers[]` · `limits[]` · `playIdeas[]` · `relatedPersons[]` · `inferred` · `lastPass`

**分步推断（AdultMode）**：骨架出 NSFW/`adult` 草稿 → 丰满用 RAG+已有摘要修订 → 关系补亲密边 → 抽取/扩展同规则；优先级：原文 → 实体互证 → 合理虚构；禁止整块「原文未提及」。

### 3.4 状态扩展（`src/lib/novel/state.mjs`）

在现有 novel state 上增加（hydrate 兼容）：

```js
entities: [],                 // 主知识库
relations: [],
analyzeShardMode / analyzeChunkSize / analyzeChaptersPerShard,
adultMode: false,             // 全局 NSFW（仅原始资料·全局配置；联动分析/世界书/文风）
ntlMode: false,               // 全局 NTL 禁忌张力（与 NSFW 解耦，可叠加）
analyzeIncludeAdult: false,   // 与 adultMode 同步（兼容旧字段）
rag: {
  enabled: true,              // 助手问答启用小说 RAG
  budget: 12000,              // 注入字数预算
  indexStatus: 'idle'|'building'|'ready'|'error',
  indexUpdatedAt: '',
  chunkCount: 0,
  embedModel: '',             // 实际使用的 embedding 模型名
},
// 兼容投影（由 entities 派生或双向同步）
characters: [],               // 降级 UI / 旧同步仍可读
wbEntries: [],
knowledgeGraph: { nodes, edges, updatedAt },  // 由 entities+relations 投影
```

**投影规则**

- `person` ↔ `characters[]`（name/aliases/profile）  
- 非 person → `wbEntries[]`（category 映射见下）  
- `relations` + 实体 → `knowledgeGraph`（G6，挂在小说分析页）

| entity.type | wb category |
|-------------|-------------|
| faction | faction |
| location | location |
| item | item |
| event | event（**新增**） |
| lore | worldview/setting/history（按 attrs.aspect） |
| nsfw | nsfw |
| person | （同步到角色或 `[小说人物]` 条目，不进普通 wb 列表为主） |

### 3.5 RAG 索引（IndexedDB，与小说桶分离）

键：`novelRagV1:card:{cardId}`

```js
{
  version: 1,
  cardId,
  embedModel,
  dims,
  updatedAt,
  chunks: [
    {
      id: 'chk_xxx',
      chapterId, chapterTitle, chapterIndex,
      start, end,
      text,
      embedding: number[],   // Float32 可序列化为数组
      terms: string[]        // 可选：抽到的专名
    }
  ]
}
```

改章 / 重置 / 手动「重建索引」时增量或全量重建。

---

## 4. RAG 层（方案 2 + 4）

### 4.1 模块职责

| 文件 | 职责 |
|------|------|
| `src/lib/novel/rag/chunker.mjs` | 章节 → chunk（默认 600 字，重叠 80） |
| `src/lib/novel/rag/embedClient.mjs` | 调用 `{apiUrl}/embeddings`，批量、重试、可取消 |
| `src/lib/novel/rag/store.mjs` | IndexedDB 读写索引 |
| `src/lib/novel/rag/keywordSearch.mjs` | 基于词的命中（复用/扩展 `src/lib/novel/recall.mjs`） |
| `src/lib/novel/rag/vectorSearch.mjs` | 余弦相似度 Top-K |
| `src/lib/novel/rag/hybridSearch.mjs` | RRF 合并关键词 ∪ 向量 |
| `src/lib/novel/rag/indexBuild.mjs` | 建索引流水线 + 任务中心类型 |
| `src/lib/novel/rag/inject.mjs` | 生成助手注入块 `【相关原文】`/`【相关实体】` |

### 4.2 Embedding API

- 复用页面 `apiUrl` / `apiKey`。  
- 模型：优先 `embeddingModel` 配置（AI 配置新增可选输入，默认空则尝试 `text-embedding-3-small` 或接口返回的第一个 embedding 模型）；失败时 **降级为纯关键词**，不阻断问答。  
- 批量：每批 ≤64 chunks；长文本按 API 限制截断。

### 4.3 混合检索

```
query
  → 关键词 hits（名称/别名/query 分词；无命中时可经实体名 extraTerms 二次检索）
  → query embedding → 向量 Top-K（默认 24；需 indexStatus=ready 且索引未过期）
  → RRF(k=60) 合并 → 按 budget 截断拼接
  → 附带命中实体（名称匹配 + relations 1-hop 图谱邻居 + 关系上下文行）
```

默认预算：助手 12k；实体丰满化 20k～30k（可用 `expandBudget`）。

索引未就绪 / 过期时：仍走关键词检索（仅启用且有正文的章节）；助手注入与预览会附带 `【索引状态】` 提示。

### 4.4 助手注入（每次用户提问）

在 `AssistantPanel.reactLoop` 组装 system 附加：

```
【相关原文】（混合检索，预算内；预览展示全部命中，注入回合会话去重）
【相关实体】（Top 实体摘要 + 图谱 relations 邻居，≤3k）
【相关关系（知识图谱）】（与命中实体相连的边，可选）
【使用规则】优先依据原文与实体；无命中须说明；改库用 patch 工具
```

开关：`state.rag.enabled`；UI：AI 配置或助手区「小说 RAG」。

---

## 5. 统一分析管线（主路径）

### 5.1 UI

| view | 标签 | 说明 |
|------|------|------|
| `novel-analyze` | **小说分析** | 主入口：建索引 + 分析 + **G6 关系图谱**（`d3-force` + 预散开/去重叠） |
| `novel-characters` | **人物列表** | 人物实体结果展示/编辑/「丰满所选」/同步；扫描为降级；无实体时行内 AI 扩展 |
| `novel-worldbook` | **世界书条目** | 非人物实体结果展示/类型筛选/丰满/同步；AI 抽取为降级 |

已移除独立「知识库 / 知识图谱」侧栏；图谱挂在小说分析页。旧一体分析已废止，由 `panels/analyze.mjs` 统一分析管线替代。人物工具栏不再提供批量「AI 扩展所选」。

### 5.2 流水线步骤

**Step 0 · 确保索引**  
若索引过期或缺失 → `buildNovelRagIndex`（任务中心可停）。

**Step 1 · 骨架扫描（逐步分片）**  
- 提示词：`novelAnalyzeSkeleton`  
- 输入：本片原文 + 已有实体摘要 + 已有关系摘要  
- 输出：`{ entities:[{op,type,name,aliases,summary,keys}], relations:[] }`  
- 合并：别名归一 upsert；禁止清空已有库（**增量**）。

**Step 2 · 实体丰满化（按实体队列）**  
- 提示词：`novelEnrichEntity`  
- 对每个「未丰满」实体：hybridSearch(name+aliases) → 注入原文 → 输出完整 content/attrs/provenance  
- 人物：附录1；事件：强制 when/where/participants/cause/effect  
- 质量门（可开 `strictQuality`）：content≥120 字；provenance≥1；event 必填齐。

**Step 3 · 关系补全（可选一轮）**  
- 提示词：`novelAnalyzeRelations`  
- 基于实体列表 + 抽样原文补边。

**Step 4 · 投影刷新**  
- 写回 `characters` / `wbEntries` / `knowledgeGraph` 供旧 UI 与图谱使用。

### 5.3 任务类型

```
novel_rag_index          重建小说向量索引
novel_analyze_skeleton   骨架扫描
novel_analyze_enrich     实体丰满化
novel_analyze_relations  关系补全
```

（可合并显示为一个父任务 + 子进度。）

### 5.4 提示词（`src/lib/promptStore.mjs` 新增）

| id | 用途 |
|----|------|
| `novelAnalyzeSkeleton` | 分片骨架：实体清单+粗关系+禁止空壳名 |
| `novelEnrichEntity` | 单实体丰满：必须 provenance 引用片段 |
| `novelAnalyzeRelations` | 关系补全 |
| `assistantNovelRagHint` | 助手：有原文/实体时如何使用 |

旧 scan / wbExtract **保留**给降级路径；`novelUnifiedShard` 已废止，由 `panels/analyze.mjs` 统一分析管线替代。

---

## 6. 降级路径（保留原位）

| 模块 | 行为 |
|------|------|
| 人物扫描 + AI 扩展 | 逻辑保留；写 `characters` 后 **投影 upsert 到 entities(person)** |
| 世界书抽取 + 扩展 | 逻辑保留；写 `wbEntries` 后投影到 entities；**重跑改为增量 upsert**（修复清空 bug） |
| 角色设定/开场白 | **已实现**：下拉选实体 / 手填；`hybridSearch` 优先；无命中回退 `buildSetupCorpus` |

---

## 7. 同步到主卡

扩展 `src/lib/novel/sync.mjs`：

- `syncEntities({ types?, selected?, policy? })`  
- person → 角色设定 / `[小说人物]`  
- 其他 → 世界书（comment：`[小说{type}] {name}`）  
- event 条目写入世界书（新 category `event`，主卡世界书 UI 需识别或映射为 `setting`+标题前缀）  
- 文风逻辑不变  

合并策略：有 `provenance` 的字段优先；否则再比内容长度。

落卡约定（防污染 / 状态一致）：

- **多人 → 角色设定**：仅第一人写 `charName`；后续强制 `merge` 追加 `【小说人物·名】` 区块，避免互相覆盖。  
- **`formatProfileYaml`**：跳过空字段与「（原文未提及）」占位，不把骨架空值写入主卡。  
- **`syncStatus`**：以实体为准投影到列表；仅实际写入主卡后标 `synced`；skip 未写不标。  
- **扩展/保存档案**：回写实体 `attrs.profile`，`content` 用可读摘要（`profileContentDigest`），禁止 JSON 截断。  
- **世界书批量同步**：实体条目 + 未入库的 `wbEntries` 草稿按 comment 去重后一并落卡。

---

## 8. AI 助手工具（完整集）

### 新增

| 工具 | 说明 |
|------|------|
| `search_novel_passages` | `{ query, limit?, budget? }` → 混合检索片段 |
| `list_novel_entities` | `{ type?, query? }` |
| `get_novel_entity` | `{ id\|name\|titleMatch }` |
| `patch_novel_entity` | 问答式改条目（confirm） |
| `merge_novel_entities` | 合并重复（confirm） |
| `run_novel_rag_index` | 重建索引（confirm） |
| `run_novel_analyze` | `{ phase?: 'all'\|'skeleton'\|'enrich'\|'relations' }`（confirm） |
| `enrich_novel_entity` | 单实体丰满化（confirm） |
| `sync_novel_entities` | 同步到主卡（confirm） |
| `set_novel_adult_mode` | 开关全局 NSFW（原始资料·全局配置） |
| `set_novel_ntl_mode` | 开关全局 NTL 禁忌张力（与 NSFW 解耦） |
| `draft_nsfw_statusbar` | 从人物 NSFW 生成状态栏变量草案（只读，不写入） |

### 行为

- 每次用户消息：**自动** hybrid 检索注入（即使未调工具）。  
- 工具结果可二次精读原文。  
- `get_novel_workspace` 摘要增加：entityCounts、rag.status、relationCount。

---

## 9. UI 改动清单

1. **AI 配置**：可选 Embedding 模型；小说 RAG 开关与预算（或放助手设置）。  
2. **小说分析**面板：建索引 / 开始分析 / 进度 / 成人勾选 / 分片配置。  
3. **人物列表 / 世界书条目**：承接实体展示、丰满、同步；扫描/抽取为降级。  
4. **图谱**：数据源为投影。  
5. **助手**：提示词增加 RAG 规则；发送前注入。  
6. **README / card-writing-guide**：侧栏与模块说明同步。

侧栏小说顺序：

```
原始资料 → 拆章 → 角色设定 → 开场白
→ 小说分析（含图谱）→ 人物列表 → 世界书条目
→ 文风蒸馏
```

---

## 10. 文件级实现清单（一次性）

### 新建

- `src/lib/novel/rag/chunker.mjs`
- `src/lib/novel/rag/embedClient.mjs`
- `src/lib/novel/rag/store.mjs`
- `src/lib/novel/rag/keywordSearch.mjs`
- `src/lib/novel/rag/vectorSearch.mjs`
- `src/lib/novel/rag/hybridSearch.mjs`
- `src/lib/novel/rag/indexBuild.mjs`
- `src/lib/novel/rag/inject.mjs`
- `src/lib/novel/entityStore.mjs`（CRUD、别名匹配、投影 characters/wb/graph）
- `src/lib/novel/analyzePipeline.mjs`（骨架/丰满/关系）
- `src/components/novel/NovelAnalyzePanel.astro`
- `tests/novelRag.test.mjs`
- `docs/architecture/novel-analysis.md`（本文）

### 修改

- `src/lib/novel/state.mjs`：entities/relations/rag/analyze*；NOVEL_VIEWS；summarize  
- `src/lib/novel/schema.mjs`：event/faction attrs 辅助（如需）  
- `src/lib/novel/recall.mjs`：导出通用 keyword 能力供 hybrid 复用  
- `src/lib/novel/graphMerge.mjs`：改为调用 entityStore 或保留作适配层  
- `src/lib/novel/sync.mjs`：`syncEntities`  
- `src/lib/novel/browserApp.mjs`（684 行 orchestrator）：索引/分析绑定；人物/世界书列表承接实体；旧路径投影；面板逻辑已拆分至 `src/lib/novel/panels/`（source/chapters/setup/analyze/characters/worldbook/style，合计 ~3,450 行）  
- `src/lib/promptStore.mjs`：新提示词 + META  
- `src/lib/aiTaskCenter.mjs`：新任务类型  
- `src/components/AppSidebar.astro` / `src/pages/index.astro` / `src/layouts/Layout.astro` / `src/components/novel/NovelWorkshopStyles.astro`  
- `src/components/AssistantPanel.astro`：注入 + bridge  
- `src/lib/assistant/tools.mjs` / `executor.mjs` / `risk.mjs`：新工具  
- `src/components/AIPanel.astro`：embeddingModel + RAG 选项（或独立小组件）  
- 世界书主面板：识别 `event` category（或映射显示）  
- `README.md` / `docs/guides/card-writing-guide.md`
- 相关测试：`tests/novelCore.test.mjs` / `tests/sidebarNav.test.mjs` / `tests/assistantCore.test.mjs` / `tests/promptStore.test.mjs` / `tests/aiTaskCenter.test.mjs`

---

## 11. 质量与不丢信息策略

1. **增量合并**：任何分析不得以空数组覆盖已有 entities（除非用户确认「清空知识库」）。  
2. **别名归一**：`findEntityMatch(name, aliases)` 全库匹配。  
3. **provenance 强制（strict）**：丰满结果无摘录则标 `needsReview`，不标 synced。  
4. **分片失败**：记录 failedShards，结束后汇总提示，支持「仅重跑失败片」。  
5. **事件不丢**：骨架阶段强制挖掘 event；丰满阶段强制因果字段。  
6. **关系不丢**：边 evidence 追加不覆盖。  
7. **索引与正文一致性**：章节 hash/updatedAt 变化 → 提示重建索引。

---

## 12. 验收标准

- [x] 导入并拆章后可一键建索引；无 embeddings 时关键词检索仍可用。  
- [x] 「小说分析」产出多类型丰满实体，含 event，且带 provenance（strict 质量门 + 失败片可重跑）。  
- [x] 人物列表/世界书条目可编辑/丰满/同步；图谱与之一致。  
- [x] 助手提问自动带相关原文；可用工具改实体（`state.rag` 与 AI 配置对齐）。  
- [x] 旧人物扫描、世界书抽取入口仍在，且写入投影到实体库；世界书重跑不清空已有丰满条目。  
- [x] 角色设定/开场白：优先实体库选人 + RAG，无命中回退范围截取。  
- [x] 索引过期检测（章节指纹）；完整分析仅在缺失/过期时重建索引。  
- [x] `npm test` / `npm run build` 通过；文档已同步。  
- [x] 全局 NSFW/NTL 仅在原始资料配置；nsfw 实体结构化；人物 NSFW 质量门；亲密关系/事件；文风↔人物互喂；状态栏 NSFW 草案。  
- [x] 落卡修复：多人 charName、YAML 占位跳过、syncStatus 双向、扩展回写实体、世界书批量合并草稿。  
- [x] NSFW 分步推断体系：`attrs.adult` / `nsfwMeta`、kind 门槛、骨架→丰满→关系→抽取递进补全、成人质量门与丰满优先级。  
- [x] NTL 禁忌张力层：与 NSFW 解耦可叠加；`set_novel_ntl_mode`；提示块与 RAG 增强独立注入。  
- [x] 提示词描述体系（`src/lib/promptCanon.mjs`）：内容维 + NSFW/NTL 维公共块组装全链路默认提示词。

---

## 13. 实施顺序（同一次交付内的依赖序）

1. RAG 基建（chunk/embed/store/hybrid/inject）+ 测试  
2. Entity Store + 投影 + 状态扩展  
3. 分析管线 + 提示词 + 任务中心  
4. UI：分析 / 人物列表 / 世界书条目；图谱改投影  
5. 助手：自动注入 + 工具  
6. 同步扩展；旧路径投影与 wb 增量修复  
7. 配置项（embedding/RAG）  
8. 文档与全量测试、build  

---

## 14. 已确认决策

| # | 决策 |
|---|------|
| 1 | 统一分析；实体结果落在人物列表/世界书条目；旧扫描/抽取 **降级保留** |
| 2 | RAG 优先且与问答一起做；采用 **远程 Embedding + 本地索引 + 混合检索** |
| 3 | 本文件为仓库内方案真源 |
| 4 | 目标为 **一次性完整实现**（按 §13 依赖序在同一交付完成） |

---

## 15. 非目标（本交付不做）

- 云端向量库（Pinecone 等）  
- 本地 WASM  embedding 模型（可作为后续离线兜底）  
- 自动改写主卡而不经同步确认  
- 删除旧面板代码
