# 设计哲学跟踪档案（2026-08）

> **不是契约，不要当作现行依据。**
> 从 `architecture/core-design-philosophy.md` 移出的现状快照、讨论议程、PR 排期和票表。
> 仍然有效的原则与已决契约留在原文（含 §5.3 群像试聊）。

## 5. 现状：已对齐与结构性缺口

### 5.1 已对齐（2026-08）

| 能力 | 说明 |
|------|------|
| 工坊 → 主卡 | 人物 **一律 worldbook**；默认 sync 重定向，不再 merge 进 charDesc |
| 试聊 runtime | 群像 Continue / 焦点 NPC / person 前缀；ST 世界书/正则/MVU 对齐 |
| 试聊 → Story | Episode IDB、选段弹窗、verbatim 归档、`promote_chat_episode` |
| Promotion L0 | `promotionLog.mjs`、`list_promotions`、删卡级联 |
| 投影链 | worldbook `sourceRef` / dirty / entity→worldbook 带来源 |
| Story↔卡三向桥 | 种子图谱、工坊开 Story、Story→卡 sync + 助手工具 + UI 按钮 |
| 助手 location | `locationBlock` + `assistantLocationRules` + cardProgress 摘要 |
| 试聊 session | localStorage 持久化、选段、fixes 校验（D15） |
| cardProgress / journey | `computeCardProgress` + 制作路线 tip |
| 图谱 mode | `graphViz` workshop/card/story-ref；Story Ref 只读；卡「关系一览」 |
| 文案（§2.0） | promptCanon / AI 引擎三阶段 / 角色面板 / 助手字段提示 |
| Story 存储 | 与卡相对独立；删卡可选删 Story；分享稿可复制为本地草稿 |
| 图谱 UI | 工坊分析与 Story 创作共用 G6（`novel/graphViz.mjs`） |
| 助手 | 跨模块工具；试聊回流改卡（校验后 apply） |
| 侧栏命名 | **小说工坊** 与 **小说创作** 并列 |

### 5.2 结构性缺口（演进 backlog）

> §9.1 PR 族 **已落地**；下列为 **Phase 2 / 增强**，非阻塞主闭环。

1. **Story Ref 拉工坊最新**：Ref 节点展示应实时读 entity SoT（当前为占位 + 去工坊跳转）。
2. **群像试聊 Phase 2**：焦点 selective 提权、自动轮换焦点（§5.3.2）。
3. **Narrative 升格 entity**：Story 节点 → 工坊 Review 流程（§6.4.1 层 B）。
4. **分域术语表 UI**：§6.6.1 助手按域解释（文档已决，专用 chip 可加强）。

## 8. 推荐优先落地项

若只选一件事先做：**D16（投影链 + Promotion L0）+ D17（Story↔卡三向桥）** — 对应 §3.8 + §6.2.1，是焊接四种玩法的 **哲学核心**（§8 原「Entity + sourceRef + 对称 Promote」）。

试聊闭环：**D15 → D12**（session / 选段 / 归档 Story）。  
体验导航：**D10 → D13 / D6**（progress + location + journey）。  
多人原生体验：**D3–D5**（文案）+ **D1**（工坊 sync）+ **D2**（群像试聊，可并行）。

正式 PR 顺序见 **§9.1**。

后续讨论与 PR 方案应引用本文章节号（如 §3.8.1、§6.2.2、§6.3.8），并在实现时更新 §5.1 / §5.2 现状表。

## 9. 讨论议程（建议顺序）

对象模型（§3）定稿后，建议按 **依赖顺序** 逐项细化；每项讨论产出：用户路径、数据契约、UI 触点、与现有代码差距、是否改 SoT。

| 顺序 | 议题 | 状态 | 关键决策点 |
|------|------|------|------------|
| **1** | **Canonical Entity 绑卡 vs 绑「世界观」** | **已决：绑卡**（§3.8） | 跨卡 = 复制/快照；不引入 worldId SoT |
| **2** | **Projection `sourceRef` + dirty 语义** | **已决：默认不切断**（§3.8） | 显式 detach + 破坏性编辑自动 detach；resync 用 overwrite/merge/skip |
| **3** | **Promotion 事件是否持久化 audit** | **已决：L0 only，不回滚**（§3.8） | IDB 摘要 log；不上云 snapshot |
| **4** | **§6.2 Story↔卡 对称桥** | **已决**（§6.2.1） | 三向做全；不写 charDesc；同槽 merge |
| **5** | **§6.1 卡进度状态机** | **已决**（§6.1） | 助手优先；metric 不设达标线；UI 轻量 |
| **6** | **§6.4 共享 Entity Graph UI** | **已决**（§6.4） | 层 A 三 mode；Story Ref 只读；Narrative 可编 |
| **7** | **§6.3 试聊 → Story 归档** | **已决**（§6.3） | 卡无状态；plotLedger + 章草稿 B 变体 |
| **8** | **§6.5 助手与试聊** | **已决**（§6.5、§6.3.6） | 全局助手+location；checkbox 选段；回流 A；试聊仅本地 |
| **9** | **§6.6 版本发布** | **已决**（§6.6） | 三家语义不统一；§6.1 路径可对齐 |
| **10** | **设计文档齐套 / PR 排期** | **已决**（§9.1） | D16–D18 已入 §11；排期表已定 |

**设计哲学议程 1–10 + 实现契约**：**已闭合**（含 §3.8.1、§5.3、§6.2.2、§6.3.7–§6.3.8.1、§6.4.3、§6.5.5）。余下为 §11 实现债。

### 9.1 PR 排期（议题 10 · 已决 2026-08）

> 每一 PR 本身须 **完整可合并**（含测试 + 更新 §5.1/§5.2）；禁止半桥 / 半 L0。

| 序 | PR 族 | D ID | 依赖 | 主要交付 |
|----|-------|------|------|----------|
| **1** | Promotion L0 基础 | **D16**（L0 段） | — | `promotionLog.mjs`、`list_promotions`、删卡级联 |
| **2** | 试聊 session + 选段 + fixes | **D15** | — | localStorage session、选段弹窗、fixes 校验 |
| **3** | 试聊归档 Story | **D12** | D15、D16(L0) | Episode IDB、Promote 弹窗、`promote_chat_episode`、verbatim |
| **4** | 投影链 sourceRef | **D16**（投影段） | PR-1 | worldbook `sourceRef`/dirty/detach、entity dirty 反向 |
| **5** | Story↔卡三向桥 | **D17** | D16 | 三向 UI + 三助手工具 + sync 映射 + L0 kinds |
| **6** | cardProgress | **D10** | — | `computeCardProgress`、signals |
| **7** | 助手 location + journey | **D13** + **D6** | D10（journey 消费 progress） | `locationBlock`、`cardJourney` suggestions |
| **8** | 图谱 mode | **D11** | D16 | `graphViz` mode、Story Ref 只读 / Narrative 可编 |
| **9** | 卡关系一览 | **D18** | D11、D16 | 制卡侧 read-only 关系图 |
| **10** | 多人原生文案 | **D3–D5** | — | promptCanon、AI 引擎、角色面板 |
| **11** | 工坊多人 sync | **D1** | D16 | 人物一律 worldbook |
| **12** | 群像试聊 | **D2** | — | Continue 契约、焦点 NPC（**可并行** PR-2 起） |

**并行建议**：D2 与 PR-2+ 无硬依赖；D3–D5 可与 PR-6 并行。  
**关键路径**：D16(L0) → D15 → D12；D16(投影) → D17 → D11 → D18。

## 11. 设计改进（文档与实现待对齐）

> 哲学已决（§2.1）；下列为 **须逐 PR 对齐** 的改进项。完成时在「状态」列打 ✅ 并链 PR。

| ID | 范围 | 改进内容 | 状态 |
|----|------|----------|------|
| **D1** | 工坊 sync | 多人落卡：**人物一律 worldbook**；`charName` 仅场景标识 | ✅ |
| **D2** | 试聊 `chatRuntime` | §5.3：Continue 契约、焦点 NPC、person 前缀 | ✅ |
| **D3** | `promptCanon.mjs` | 多人原生文案（charGen/wbSkeleton/greetingGen/buildGuide/feedback） | ✅ |
| **D4** | AI 引擎 UI | 三阶段：场景契约 / 卡司骨架 / 场景开场 | ✅ |
| **D5** | 角色设定面板 | charName/charDesc 多人语义 label + placeholder | ✅ |
| **D6** | `cardJourney` | 消费 `cardProgress.suggestions` + 制作路线 tip | ✅ |
| **D10** | **`cardProgress` 状态机** | `computeCardProgress`；助手 location 摘要 | ✅ |
| **D11** | 共享 Entity Graph | `graphViz` mode；Story Ref 只读 | ✅ |
| **D12** | 试聊 Episode → Story | Episode/Promote/verbatim/助手工具 | ✅ |
| **D13** | **全局助手 + 当前位置** | `locationBlock` + `assistantLocationRules` | ✅ |
| **D15** | **试聊 session + 选段** | session/弹窗/fixes 校验 | ✅ |
| **D16** | **Promotion L0 + 投影链** | `promotionLog` + `sourceRef`/dirty | ✅ |
| **D17** | **Story↔卡 / 工坊→Story 桥** | 三向 UI + 三助手工具 | ✅ |
| **D18** | **卡关系一览** | worldbook「关系一览」只读 G6 | ✅ |
| ~~**D14**~~ | ~~lifecycle 统一话术~~ | **取消**（议题 9：三家不统一）；改为分域术语表见 §6.6.1 | 取消 |
| **D7** | 写卡指南 | ✅ 已写入 §2.0、§3、§6、§20 | ✅ |
| **D8** | 助手 SoT | ✅ [`assistant.md`](../architecture/assistant.md) §6.5 / §6.3.6–§6.3.8.1 | ✅ |
| **D9** | 字段 SoT | ✅ [`st-card-fields.md`](../domains/st-card-fields.md) 多人语义表 | ✅ |

**依赖**：见 **§9.1** 排期表。摘要：D3–D5 可同 PR；D6 依赖 D10；D11 依赖 D16；D18 依赖 D11+D16；**D15 与 D12 共用选段**；D12 依赖 D16(L0)；D17 依赖 D16(投影)；D13 可与 D10 合并；D1 依赖 D16；D2 独立可并行。
