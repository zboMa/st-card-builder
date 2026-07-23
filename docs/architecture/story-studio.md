# 小说创作（Story Studio）

> SoT：本文 + `src/lib/storyStudio/*`。分享 API 见 [`../systems/cloud-sync.md`](../systems/cloud-sync.md)。

## 定位

与「小说工坊」（读原著拆解，**严格绑卡**、随卡包拉取）不同：Story Studio 是 **创作**（图谱 / 大纲 / 写作 / 阅读 / 管理）。

写出的小说与卡**相对独立**：

- 开卡 bundle **不含** Story 数据
- 进入创作视图 / 打开某部小说时再经 `/api/data/stories/*` 拉取
- 删卡时弹窗可勾选是否一并删除 Story（默认不删）

## Boot

`StoryStudioApp` → `src/lib/storyStudio/browserApp.mjs`（`initStoryStudio` + 事件绑定）。分享读者壳：`ShareReaderPanel`（`#share/{token}`）。

大纲/章文长任务与切书/删书等 lifecycle 走 Action Engine 硬禁互斥 → [`action-engine.md`](./action-engine.md)。

## 浏览器控制器（拆自 `browserApp.mjs`）

| 文件 | 职责 |
|---|---|
| `browserApp.mjs` | boot、`bindEvents`、`window.__storyStudio__` |
| `shared.mjs` | 共享 `state` / `ui`、持久化、AI 调用、DOM 工具 |
| `renderViews.mjs` | 五视图渲染（manage / graph / outline / write / read） |
| `writeBranchUi.mjs` | 写作页、分支树浮层 |
| `manageActions.mjs` | CRUD、增版、发布、分享、导出 |
| `writeActions.mjs` | 图谱/大纲收集、大纲生成、写章/连写、开分支 |

## 版本模型（卡 / 小说一致）

- **唯一草稿** + **`versions[]` 正式列表**（每版快照 + `published`；**已发条目不可变**）
- **保存**：只写草稿，不写 `versions`；`updatedAt` 仅在真实落盘时刷新
- **切版 / 增版 / 发布**：才把当前草稿写入 `versions`（若草稿坐在已发号上会先 fork）
- **发布**：标记已发布，草稿自动再升一版；升版号须 **> 全局最大已发号**；云失败则回滚本地
- **分享**：`latest` 固定链对接最新已发；另有带版本号链接；读者进度按 token+版本隔离
- 实现：`cardVersions.mjs` / `novelVersions.mjs`（开发期无旧数据兼容负担）

## 视图约定（UI）

- 各面板 **操作按钮在右上角**（`.ss-panel-actions`）
- **图谱**：与小说分析相同的 G6 力导向可视化（`graphView.mjs` → `novel/graphViz.mjs`）；列表编辑收纳在折叠区
- **大纲**：分段/续写先弹窗输入额外提示词；章节标题点击再编辑（非常驻输入框）
- **写作**：主区正文；选项/账本/快照折叠；分支树点击弹出竖排浮层（节点展开小卡片看摘要，可再看全文）
- **阅读**：目录默认隐藏，点「目录」浮动出现

## 模块

| 文件 | 职责 |
|---|---|
| `state.mjs` / `idb.mjs` | 本地状态（含分支 / 伏笔账本 / 写设置） |
| `branch.mjs` | 分支世界：开分支、解析可见章、发布裁剪、选项/结局 |
| `graphView.mjs` / `graphSeed.mjs` | G6 可视化 + 卡面种子 |
| `dialogs.mjs` | 自定义确认/输入/内容弹窗 |
| `sharePlay.mjs` | 读者选线进度、分享稿复制为可编辑草稿 |
| `version.mjs` | 版号 / **schema v2 树状 release** |
| `tokenBudget.mjs` / `feedForward.mjs` / `plotLedger.mjs` / `quality.mjs` / `checkpoint.mjs` / `writePipeline.mjs` | 写章闭环 |
| `novelVersions.mjs` | 草稿 / `versions[]`：切版、增版、发布 |
| `shareClient.mjs` | 分享 API（latest + 钉版本） |
| `exportTxt.mjs` | 导出（当前活动分支） |

## 分支与发布

- 工作稿：`branches[]`（`choiceLabel` / `kind: path|ending` / `publishReady`）+ 章 `branchId`
- **发布**：只打包 `publishReady` 支及其祖先 → `story-release`（`schemaVersion: 2`），并写入 `versions` 已发项；草稿自动升版
- 分享 token：`latest` 读最新已发；`#share/{token}/v/{ver}` 钉版本；读者在分叉章后**选线**；结局支展示结局页
- 读者选线进度：`sharePlay` 的 localStorage key 在钉版本时含版本号，避免与 latest 串进度（旧 token-only key 可读回退）
- **复制到本地创作**：读者可将分享树复制为本机可编辑小说（清 share/发布字段）

## 写章闭环

章后 Feed-forward、洋葱 Token、伏笔账本、4 步进度、软质检/改写、连写 N 章、checkpoint、新书向导（见既有说明）。

## UI

- 视图：`story-manage` / `story-graph` / `story-outline` / `story-write` / `story-read`
- 写作页含**分支树**（切换 / 发布勾选 / 选项文案 / 标结局）
- 工具栏 `btn-inline`

## 分享

工作稿 ≠ 读者可见；**发布快照**后链接只读 release（可含分支树）。细节在 cloud-sync「小说分享」节。
