# ST 卡字段契约

> SoT：本文 + `src/lib/assistant/characterFields.mjs` + 导出路径 `src/lib/card-builder/state.mjs`。

## 助手 / UI 规范字段

| 规范名 | 含义 |
|---|---|
| `charName` | 角色名 |
| `wbName` | 世界书名 |
| `charDesc` | 角色描述 |
| `firstMes` | 主开场白 |
| `creatorNotes` | **作者注释（Author's Note）** |
| `tags` | 标签数组 |
| `altGreetings` | 备选开场白数组 |

别名映射与拒绝未知字段：见 `characterFields.mjs`（`normalizeCharacterFieldKey` / `normalizeCharacterPatch`）。

## 易错点

- **作者注释 = `creatorNotes`**  
  - **不要**用 SillyTavern 的 `postHistoryInstructions` 当本应用的独立字段  
  - 助手若收到 `postHistoryInstructions` / `post_history_instructions`，应映射到 `creatorNotes`（executor 已做）
- 世界书条目标题/去重键：条目的 **`comment`** 字段
- 导出 JSON/PNG：**不含** 小说工坊 IndexedDB 桶、RAG 索引

## 本地键（摘录）

| Key | 用途 |
|---|---|
| `st_v3_builder_drafts` | （遗留）迁入 IndexedDB `cardDraftsV1` 后清除 |
| IndexedDB `cardDraftsV1` | 卡草稿权威（整 map） |
| `st_v3_builder_current_id` | 当前卡 |
| `st_v3_builder_ai_config` | AI / 成人相关配置 |
| `st_v3_builder_prompts` | 提示词覆写 |
| `novelWorkshopV3:card:{cardId}` | 小说工坊 IDB |
| `novelRagV1:card:{cardId}` | RAG 索引 IDB |

## 相关

- 助手：[`../architecture/assistant.md`](../architecture/assistant.md)
- 卡侧：[`../architecture/card-builder.md`](../architecture/card-builder.md)
