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
| `state.mjs` / `idb.mjs` | 本地状态 |
| `graphSeed.mjs` | 图谱种子 |
| `version.mjs` | 小说版本 / 增版 |
| `shareClient.mjs` | 分享链接客户端 |
| `exportTxt.mjs` | 导出文本 |
| `mvuHook.mjs` | 与 MVU 钩子 |
| `prompts.mjs` | 创作提示 |

## UI

- 视图：`story-manage` / `story-graph` / `story-outline` / `story-write` / `story-read`
- 面板全宽铺满主栏；工具栏用 `btn-inline`（见设计规范）

## 分享

工作稿 ≠ 读者可见；**发布快照**（release）后链接只读 release。细节在 cloud-sync「小说分享」节。
