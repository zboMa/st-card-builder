# NSFW / NTL / 恶堕

> SoT（规则）：本文。SoT（数据与数量）：**仅** `src/lib/adult/**` 与相关拼装代码。  
> **禁止在文档里写死「有 N 种口味」**——数量以代码为准，扩目录走 [`../guides/catalog-quality-standards.md`](../guides/catalog-quality-standards.md)。

## 三层（加性，非互斥）

1. **核心人格调色盘** — 始终可存在，与是否开 NSFW 无关  
2. **NSFW 口味层** — 开启后叠加；多选有上限；首项可作主调  
3. **NTL 禁忌层** — 与 NSFW 开关解耦，可多选  

另有：**世界观成人载体**（`adult/vessels`）、**恶堕进度**（世界书人物条 + MVU，非独立口味）。

## UI 入口（唯一）

| 正确 | 错误 |
|---|---|
| 侧栏 **成人配置** → `AdultConfigPanel` | 把 NSFW/NTL 控件塞进 CharacterPanel / 小说原始资料 |

- 卡侧配置为真相源；变更派发 `nsfw-config-changed`  
- 小说工坊 **订阅** 该事件，原始资料面板 **没有** NSFW/NTL UI（只有分片/召回/工作流）

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
