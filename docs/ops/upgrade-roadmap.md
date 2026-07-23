# 升级路线图（执行跟踪）

> **Phase 6C（TS/checkJs/ESLint 全量）不做。**  
> 单线分支 `cursor/upgrade-plan-phases-1-10-5f2a` 合并为 **一个 PR**。

## 阶段总览

| Phase | 主题 | 状态 |
|---|---|---|
| 0 | 基线文档与度量 | ✅ 已合并 #71 |
| 1 | 云同步（冲突/stub/批量/1A–1C 已合并） | ✅ 本 PR 补全 1B+批量 |
| 2 | 保存链收敛 `writeDraftsMap` | ✅ 本 PR |
| 3 | 大模块拆分 | ⏭ 首期未拆 mega panel；Cloud 已独立模块 |
| 4 | 小说/Story 懒 boot | ✅ 本 PR |
| 5 | API 慢请求日志 | ✅ 本 PR |
| 6 | CI test job + 单测（**无 6C**） | ✅ 本 PR |
| 7 | 导出检查 NSFW/工坊提示 | ✅ 本 PR |
| 8 | 本地保存后提示手动上云 | ✅ 本 PR |
| 9 | 工坊 bindCard 跳过 init save | ✅ 本 PR |
| 10 | CI npm audit advisory | ✅ 本 PR |

## 后续迭代（未在本 PR）

- Phase 3 深拆：`assistant/panelBoot`、`worldbookShared`、`mvu/variableCardPanel`
- Phase 1D `contentRev` 云 dirty 主判据
- Phase 5B bundle 分片存储

## 相关 SoT

- [`../architecture/card-builder.md`](../architecture/card-builder.md)
- [`../systems/cloud-sync.md`](../systems/cloud-sync.md)
- [`regression-checklist.md`](./regression-checklist.md)
- [`baseline-metrics.md`](./baseline-metrics.md)
