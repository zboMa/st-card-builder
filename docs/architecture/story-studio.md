# 小说创作（Story Studio）

> SoT：本文 + `src/lib/storyStudio/*`。分享 API 见 [`../systems/cloud-sync.md`](../systems/cloud-sync.md)。

## 定位

与「小说工坊」（读原著拆解，**严格绑卡**、随卡包拉取）不同：Story Studio 是 **创作**（图谱 / 大纲 / 写作 / 阅读 / 管理）。

写出的小说与卡**相对独立**：

- 开卡 bundle **不含** Story 数据
- 进入创作视图 / 打开某部小说时再经 `/api/data/stories/*` 拉取
- 删卡时弹窗可勾选是否一并删除 Story（默认不删）

## Boot

`StoryStudioApp` → `src/lib/storyStudio/browserApp.mjs`。

## 模块

| 文件 | 职责 |
|---|---|
| `state.mjs` / `idb.mjs` | 本地状态（含分支 / 伏笔账本 / 写设置） |
| `branch.mjs` | 章节分支世界：开分支、解析可见章/大纲 |
| `tokenBudget.mjs` | 洋葱 Token 预算（近章全量、远章压缩） |
| `feedForward.mjs` | 章后摘要 / 开放线 / 张力 |
| `plotLedger.mjs` | 伏笔账本 |
| `quality.mjs` | 俗套启发式 + 软质检 / 张力曲线 |
| `checkpoint.mjs` | 章级快照（写前 / 改写前回滚） |
| `writePipeline.mjs` | 写章 4 步：策划→起草→记忆→质检 |
| `graphSeed.mjs` | 图谱种子 |
| `version.mjs` | 小说版本 / 增版 |
| `shareClient.mjs` | 分享链接客户端 |
| `exportTxt.mjs` | 导出文本（当前活动分支） |
| `mvuHook.mjs` | 与 MVU 钩子 |
| `prompts.mjs` | 创作提示组装 |

## 写章闭环

1. **起草**：注入图谱、近大纲、伏笔账本、章间 Feed-forward（洋葱预算）、上一章节选、分支方向。
2. **Feed-forward**：章后摘要 + 开放线 + 张力 1～10 + 伏笔 plant/pay/drop。
3. **软质检**：启发式俗套扫描 + AI 质检；可定向改写；可选质检失败熔断。
4. **连写 N 章**：从当前/下一空章起批量写，任务中心可取消。
5. **Checkpoint**：覆盖正文前自动快照（最多 5）。

## 分支世界

- `novel.branches[]` + `activeBranchId`；章 / 大纲项带 `branchId`。
- **从某章开分支**：继承分叉点及之前的父线章，其后为分支私有续写；可填「分支方向」驱动大纲/正文。
- 写作页可切换分支；阅读/导出跟随当前活动分支。
- 发布（release）仍对整部小说快照；读者分享暂不暴露分支切换 UI（作者侧管理）。

## 新书向导

管理「向导新建」或大纲页「新书向导」：确认方向 → 生成并审批大纲 → 进入写作（可跳过）。

## UI

- 视图：`story-manage` / `story-graph` / `story-outline` / `story-write` / `story-read`
- 面板全宽铺满主栏；工具栏用 `btn-inline`（见设计规范）

## 分享

工作稿 ≠ 读者可见；**发布快照**（release）后链接只读 release。细节在 cloud-sync「小说分享」节。
