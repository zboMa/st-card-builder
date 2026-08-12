# ST 卡字段契约

> SoT：本文 + `src/lib/assistant/characterFields.mjs` + 导出路径 `src/lib/card-builder/state.mjs`。

## 助手 / UI 规范字段

| 规范名 | 含义 |
|---|---|
| `charName` | 角色名（ST `name`） |
| `wbName` | 世界书名 |
| `charDesc` | 角色描述（ST `description`） |
| `firstMes` | 主开场白 |
| `creatorNotes` | **作者注释（Author's Note）** |
| `tags` | 标签数组 |
| `altGreetings` | 备选开场白数组 |

### 多人卡原生语义（本项目 · ST 槽位不变）

> 完整哲学：[`architecture/core-design-philosophy.md`](../architecture/core-design-philosophy.md) §2.1；写卡：[`guides/card-writing-guide.md`](../guides/card-writing-guide.md) §2.0。

| 字段 | ST 常见理解 | **本项目默认** |
|------|------------|--------------|
| `charName` | 角色名 | **卡/场景标识** |
| `charDesc` | 单一角色人设 | **场景帧 + RP 契约**；NPC 传记在 worldbook |
| worldbook | 补充设定 | **卡司 + 世界 SoT**（含 `[小说人物]`） |

助手 `characterFields.mjs` 字段名不变；**写入内容与引导**须符合上表。Promote（工坊/Story）**不**默认 patch `charName`/`charDesc`。

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
