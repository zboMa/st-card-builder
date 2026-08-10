# 操作引擎（Action Engine）

> SoT：全站写操作注册、策略互斥、统一 apply / 硬拒。实现：`src/lib/actionEngine/**`。

## 职责边界

| 系统 | 管什么 | 不管什么 |
|---|---|---|
| **Action Engine** | 操作能否点、显隐/disabled、lifecycle 硬禁、scope 占用 | Abort / 进度条 / 任务列表 UI |
| **AI Task Center** | 排队、进度、取消、`AbortSignal` | 按钮门禁（仅作 lease 输入源） |

主站：`window.__actionEngine__`（`bootMainActionEngine`）。  
管理端：独立实例同契约（`bootAdminActionEngine`，`/admin`）。

## 核心概念

- **actionId**：目录见 `catalog.mjs`（与本文 action 表同步维护）。
- **tier**：`lifecycle` | `heavy` | `local_ai` | `safe`
- **scope**：`card:{id}` | `story:{id}` | `admin:global`
- **lease**：`beginScope` 或 Task Center active 任务派生；同 scope 重叠即触发互斥。

## 运行时 API

```js
engine.register({ id, elId|el|selector, onView? })
engine.beginScope({ ownerActionId, label?, scope?, tier? })
engine.endScope(ownerActionId)
engine.refresh()
engine.evaluate(id) → { allowed, enabled, visible, reason, label? }
engine.assertAllowed(id)  // 抛 ActionDeniedError
engine.run(id, fn)
engine.getSnapshot()
```

面板侧便捷：`src/lib/actionEngine/helpers.mjs`（`engineTryAllowed` / `engineBegin` / `engineEnd`）。

## 硬禁矩阵（已锁定产品决策）

- 任意占用当前 `card:*` 的写任务 / heavy / local_ai：**硬禁**切卡、删卡、复制、新建、导入、切版本/增版；工坊源文清空/重置/上传、章节破坏性批处理、图谱清空；助手 `__assistantCardApi__` 同名操作抛错。
- 任意占用当前 `story:*`：**硬禁**创作侧打开/新建/删除/重命名/增版/切版本/发布；其它 story heavy 互斥。
- **不**提供「取消后继续切换」；取消只走任务中心。
- 未配置 AI：`requiresAi` 操作 disabled + tip。
- 工坊 `getPipelineGates`：无源文/未拆章 → extract 类 disabled；gate 横幅由 apply 驱动。

## 接入约定（硬约束）

1. **新写操作必须**在 `catalog.mjs` 登记并 `register`，禁止面板私自用 `disabled=` 当门禁真相源。
2. 长任务：`runTracked` / Task Center **与** `beginScope`/`endScope` 双源均可；lease 按 `ownerActionId|scope` 去重。
3. 程序入口（助手 API、`panel.patch` 等）必须 `engineTryAllowed` / `assertAllowed`，不能只靠 UI disabled。
4. Loading 文案经 `view.label` / busyLabel，由 `apply` 写回 DOM。

## 与模块关系

- 小说工坊：`browserApp.renderGates` → `engine.refresh()`；扫描/抽取/分析等 begin/end。
- 制卡：`cardManagerCrud` / Render / Bind / AI 引擎 / 导入 boot。
- 创作：`manageActions` + `writeActions`。
- 试聊 / 助手：`card.chat.reply` / `card.assistant.react`。
- 管理端：ops + 备份 busy scope。

## 验证

```bash
npm test   # 含 tests/actionEngine*.test.mjs
npm run build
```
