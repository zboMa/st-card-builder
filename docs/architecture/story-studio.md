# 小说创作（Story Studio）

> SoT：本文 + `src/lib/storyStudio/*`。分享 API 见 [`../systems/cloud-sync.md`](../systems/cloud-sync.md)。

## 定位

与「小说工坊」（读原著拆解，**严格绑卡**、随卡包拉取）不同：Story Studio 是 **创作**（图谱 / 大纲 / 写作 / 阅读 / 管理）。

写出的小说与卡**相对独立**：

- 开卡 bundle **不含** Story 数据
- 进入创作视图 / 打开某部小说时再经 `/api/data/stories/*` 拉取
- 删卡时弹窗可勾选是否一并删除 Story（默认不删）

## Boot

`StoryStudioApp` → `src/lib/storyStudio/browserApp.mjs`。分享读者壳：`ShareReaderPanel`（`#share/{token}`）。

## 模块

| 文件 | 职责 |
|---|---|
| `state.mjs` / `idb.mjs` | 本地状态（含分支 / 伏笔账本 / 写设置） |
| `branch.mjs` | 分支世界：开分支、解析可见章、发布裁剪、选项/结局 |
| `sharePlay.mjs` | 读者选线进度、分享稿复制为可编辑草稿 |
| `version.mjs` | 版号 / **schema v2 树状 release** |
| `tokenBudget.mjs` / `feedForward.mjs` / `plotLedger.mjs` / `quality.mjs` / `checkpoint.mjs` / `writePipeline.mjs` | 写章闭环 |
| `shareClient.mjs` | 分享 API |
| `exportTxt.mjs` | 导出（当前活动分支） |

## 分支与发布

- 工作稿：`branches[]`（`choiceLabel` / `kind: path|ending` / `publishReady`）+ 章 `branchId`
- **增版**：只打包 `publishReady` 支及其祖先 → `story-release`（`schemaVersion: 2`）
- 同一分享 token 读最新 release；读者在分叉章后**选线**；结局支展示结局页
- **复制到本地创作**：读者可将分享树复制为本机可编辑小说（清 share/发布字段）

## 写章闭环

章后 Feed-forward、洋葱 Token、伏笔账本、4 步进度、软质检/改写、连写 N 章、checkpoint、新书向导（见既有说明）。

## UI

- 视图：`story-manage` / `story-graph` / `story-outline` / `story-write` / `story-read`
- 写作页含**分支树**（切换 / 发布勾选 / 选项文案 / 标结局）
- 工具栏 `btn-inline`

## 分享

工作稿 ≠ 读者可见；**发布快照**后链接只读 release（可含分支树）。细节在 cloud-sync「小说分享」节。
