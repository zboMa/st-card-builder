# Nginx（API + Couch 对外）

> 完整示例：[`../../deploy/nginx-card-api.conf.example`](../../deploy/nginx-card-api.conf.example)。  
> 部署清单：[`production.md`](./production.md)。

## 要点

| 路径 | 反代到 | 用途 |
|---|---|---|
| `/api/` | `127.0.0.1:8787` | Express API + Session Cookie |
| `/couch/` | `127.0.0.1:5984/`（**剥离** `/couch` 前缀） | 浏览器 Pouch ↔ Couch |

## 环境变量配对

```bash
COUCHDB_URL=http://127.0.0.1:5984          # 仅 API 本机
PUBLIC_API_URL=https://card-api.example
PUBLIC_COUCH_URL=https://card-api.example/couch   # 发给浏览器的 dbUrl 前缀
```

未设 `PUBLIC_COUCH_URL` 时，API 默认用 `{PUBLIC_API_URL}/couch`。

## CORS

主站 Origin 跨域打 `/couch` 时，Nginx 需反射 `Access-Control-Allow-*`（示例配置已含 OPTIONS）。

改完：`nginx -t && systemctl reload nginx`，并重启 API 使 env 生效。
