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
- **世界书条目（草稿 V2）**  
  - 真相字段：`id`、`kind`、`owner`、`ownerSlot`、`displayName` + ST 参数字段（`content`、`keys`、`strategy`…）  
  - **草稿内不持久化 `comment`**；导出 ST / 试聊 / AI JSON 仍使用键名 **`comment`**，由 `src/lib/worldbook/worldbookEntryBridge.mjs` 映射  
  - 系统条 upsert：`owner + ownerSlot`（或 registry `id`）；用户条 `owner: user`  
  - 旧草稿（无 V2 字段）加载时整表清空并提示重新生成/导入（不自动迁移）  
  - AI 返回 JSON 仍写 `comment`；可选 **`type`**（与引擎大纲同一枚举）→ 落盘 `kind: outline_*`、`owner: user`；无 `type` 则为 `kind: user`  
  - 侧栏 **family 唯一入口** `entryFamily(entry)`：`outline_*` 仅据 `owner` 分 `engine` / `user`，禁止用裸 `kindToFamily(outline_*)`  
  - 解析时映射为 `displayName`，禁止用 `comment` 当合并键
- 导出 JSON/PNG：**不含** 小说工坊 IndexedDB 桶、RAG 索引

## 本地键（摘录）

| Key | 用途 |
|---|---|
| IndexedDB `cardDraftsV1` | 卡草稿唯一权威（整 map；不经 localStorage） |
| `st_v3_builder_current_id` | 当前卡 |
| `st_v3_builder_ai_config` | AI / 成人相关配置 |
| `st_v3_builder_prompts` | 提示词覆写 |
| `novelWorkshopV3:card:{cardId}` | 小说工坊 IDB |
| `novelRagV1:card:{cardId}` | RAG 索引 IDB |

## 相关

- 助手：[`../architecture/assistant.md`](../architecture/assistant.md)
- 卡侧：[`../architecture/card-builder.md`](../architecture/card-builder.md)
