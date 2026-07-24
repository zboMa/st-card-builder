# 小说工坊

> SoT：本文（状态/面板）+ [`novel-analysis.md`](./novel-analysis.md)（分析管道设计）。

## Boot

`NovelWorkshopApp` → **懒加载** `novelWorkshopLazyBoot.mjs`，首次进入 `novel-*` 视图再 `initNovelWorkshop()`。  
`bindCard(..., { skipSave: true })` 用于 init 灌桶，避免无改动写 IDB。

## 列表性能

- **拆章** `#novelChapterList`、**主卡世界书** `#entriesList`、**工坊世界书** `#novelWbPreview`：`@tanstack/virtual-core` 虚拟列表（`src/lib/ui/virtualList.mjs` 适配）+ 容器事件委托。
- 行用 absolute 定位，避免 flex 压缩；`estimateSize` + `measureElement` 校正高度；`gap: 8`。
- 搜索 debounce ~200ms；拆章写操作优先只 `chapters.render()`，避免无差别 `renderAll()`。

未完成前置时后续禁用。视图 id 前缀 `novel-*`，勿与主卡 `character` / `greetings` 混淆。

门控与重任务互斥统一走 **Action Engine**（`renderGates` → `engine.refresh()`）；扫描/抽取/分析等须 `beginScope`/`endScope`。详见 [`action-engine.md`](./action-engine.md)。

## 状态

- IndexedDB 桶：`novelWorkshopV3:card:{cardId}`  
- RAG：`novelRagV1:card:{cardId}`  
- **不**进入导出卡文件  

## 结构（摘要）

| 路径 | 职责 |
|---|---|
| `state.mjs` / `stateMachine.mjs` | 状态与持久化 |
| `browserApp.mjs` | boot 入口 |
| `bootSetupGreetings.mjs` / `bootEvents.mjs` | 角色设定/开场白生成与事件 |
| `analyzePipeline.mjs` / `entityStore.mjs` / `rag/` | 分析与检索 |
| `panels/characters.mjs` + `charactersRender/Expand/ScanBind.mjs` | 人物面板 |
| `panels/analyze.mjs` + `analyzeShared/Render/Bind/Run.mjs` | 分析面板 |
| `panels/worldbook.mjs` + `worldbookExtractUtil/Render/Ai.mjs` | 世界书面板 |
| `shared/bridge.mjs` | barrel：字段写入 + `createBridge` |
| `shared/bridgeFields.mjs` / `bridgeCreate.mjs` / `bridgeSyncOutputs.mjs` | 桥接拆分 |
| `nsfwSupport.mjs` | barrel：实体模板 / 摘要 / 提示（配置来自卡侧事件） |
| `nsfwSupportAttrs.mjs` | 实体 attrs 模板、质量门、模式开关 |
| `nsfwSupportDigest.mjs` | 互喂摘要格式化 |
| `nsfwSupportHints.mjs` | 分步推断、口味/禁忌/载体提示块 |

## NSFW

原始资料面板 **无** NSFW/NTL UI；订阅 `nsfw-config-changed`。见 [`../domains/nsfw-ntl.md`](../domains/nsfw-ntl.md)。

## 相关

- 分析深文：[`novel-analysis.md`](./novel-analysis.md)
- 写卡指南小说段：[`../guides/card-writing-guide.md`](../guides/card-writing-guide.md)
