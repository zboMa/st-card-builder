/**
 * 旧同步凭证接口：已改为 /api/data REST。
 * 保留路由以免旧前端硬崩溃；返回 410 + 引导。
 */
import { Router } from 'express';

export var syncRouter = Router();

function gone(req, res) {
  res.status(410).json({
    ok: false,
    error: 'sync_credentials_removed',
    message: '已升级为产品化云端存取，请使用 /api/data/*，浏览器不再直连 Couch。',
    replacement: '/api/data',
  });
}

syncRouter.get('/credentials', gone);
syncRouter.all('*', gone);
