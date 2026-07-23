# 手动回归清单

> 发版或大改 sync/save/卡管理前勾选。自动化见 `npm test` + [`baseline-metrics.md`](./baseline-metrics.md)。

## 本地草稿与保存

- [ ] 角色文本 input 防抖后 LS 有更新；关页不丢最后一笔编辑  
- [ ] 刷新页面后**未编辑**时云标不误报「上云未同步」（`draftContentEqual` + `contentRev`）  
- [ ] 仅改工坊/头像/RAG、未改卡正文时云标变为「上云未同步」（`bundleTouch`）  
- [ ] 新建 / 复制 / 重命名 / 删卡行为正常  
- [ ] 导入 JSON/PNG 后本地可再编辑并保存  

## 云同步（已登录）

- [ ] 制作过程中**不**自动 PUT bundle（Network 无频繁 `/bundle`）  
- [ ] 卡管理「同步上云」成功后云标「已同步」  
- [ ] 刷新后仍「已同步」（无编辑）  
- [ ] 本地改内容 → 「上云未同步」→ 再同步上云 → 「已同步」  
- [ ] 「从云端覆盖」后本地与云一致；当前卡 DOM 刷新  
- [ ] 进入卡管理拉云端索引；仅云有的卡以 stub 出现  
- [ ] 账户「刷新云端列表」不上传本地卡包；outbox 可 flush  
- [ ] 未登录：完整离线制卡，云菜单禁用  

## 卡管理 / 版本 / 分享

- [ ] 增版 / 切版 / 发布 / 分享链路  
- [ ] 导出 JSON/PNG 与当前编辑一致  

## 小说工坊 / Story（ smoke ）

- [ ] 绑卡切换后工坊数据不串卡  
- [ ] Story 独立 catalog；删卡默认不删 Story  

## 构建

- [ ] `npm test`  
- [ ] `npm --prefix server test`（动 API 时）  
- [ ] `npm run build`  
