# 升级路线图（执行跟踪）

> 产品/工程分阶段 PR；**Phase 6C（TS/checkJs/ESLint 全量）不做**。  
> 每阶段开工前需确认范围；合并顺序见下文。

## 阶段总览

| Phase | 主题 | 状态 |
|---|---|---|
| 0 | 基线文档与度量 | 进行中 |
| 1 | 云同步与本地保存（1A→1C→1B→1D 可选） | 待做 |
| 2 | 保存链收敛 | 待做 |
| 3 | 大模块拆分 | 待做 |
| 4 | 前端性能 | 待做 |
| 5 | 服务端与云存储 | 待做 |
| 6 | 质量工程（**不含 6C**） | 待做 |
| 7 | 领域内容 NSFW/NTL | 待做 |
| 8 | AI 与助手 | 待做 |
| 9 | Story Studio / 小说工坊 | 待做 |
| 10 | 安全与运维 | 待做 |

## 并行轨道（参考）

- **Track A（产品稳定）**：0 → 1 → 2  
- **Track B（工程健康）**：0 → 6 → 3 → 4  
- **Track C（内容/AI）**：7、8 与 A/B 并行  
- **Track D（长期）**：5、9、10 在后  

## 不做项

- **Phase 6C**：核心目录 JSDoc + `tsc --checkJs` 或 ESLint 全量引入  

## 相关 SoT

- 保存触发：[`../architecture/card-builder.md`](../architecture/card-builder.md#本地草稿保存触发矩阵)  
- 云同步：[`../systems/cloud-sync.md`](../systems/cloud-sync.md)  
- 基线度量：[`baseline-metrics.md`](./baseline-metrics.md)  
- 回归清单：[`regression-checklist.md`](./regression-checklist.md)  
