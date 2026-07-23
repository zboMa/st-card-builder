# 产品路线图 v1（执行跟踪）

> 单线分支 `cursor/product-roadmap-v1-5f2a` — 涵盖方案 1/2/3/4/6。

| 模块 | 主题 | 状态 |
|---|---|---|
| 6A | 配额 policy + `/api/data/quota` + 拦截 | ✅ |
| 1 | 同步中心 + 冲突摘要 API/UI + index contentRev | ✅ |
| 2 | 发布门禁 + 绑卡向导 + 云 dirty 提示 | ✅ |
| 3 | 助手变更事件 + 任务中心（侧栏已有 badge） | ✅ |
| 4 | 分享创建配额 + 读者加载态（已有） | ✅ |
| 6B | 云数据导出 + Bearer 设备列表/吊销 | ✅ |

## 后续

- 冲突三路合并 UI、账户注销
- Story 生命周期统一弹窗 copy
- 管理端改用户 `quotaTier`
- Phase 3 深拆 / 5B bundle 分片

## SoT

- [`../systems/quota.md`](../systems/quota.md)
- [`../systems/cloud-sync.md`](../systems/cloud-sync.md)
