# Nginx（API）

> 完整示例：[`../../deploy/nginx-card-api.conf.example`](../../deploy/nginx-card-api.conf.example)。  
> 部署清单：[`production.md`](./production.md)。

## 要点

| 路径 | 反代到 | 用途 |
|---|---|---|
| `/api/` | `127.0.0.1:8787` | Express API + Session Cookie（含 `/api/data`） |

> 产品化后浏览器**不再**直连 Couch。公网 `/couch/` 可下线；Couch 仅本机给 API（`COUCHDB_URL`）。

## 环境变量配对

```bash
COUCHDB_URL=http://127.0.0.1:5984          # 仅 API 本机
PUBLIC_API_URL=https://card-api.example
# PUBLIC_COUCH_URL 已不需要（旧 Pouch 复制已移除）
```

## CORS

主站 Origin 跨域打 `/api` 时，由 Express CORS 处理（`credentials: true`）。

改完：`nginx -t && systemctl reload nginx`，并重启 API 使 env 生效。
