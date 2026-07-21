#!/usr/bin/env bash
# 部署时：校验本机 CouchDB；不可达则用 Docker Compose 拉起；无 Docker 则失败。
# 用法：ensure-couch.sh <APP_HOME>
# 依赖：APP_HOME/server/.env 含 COUCHDB_* ；可选 COUCH_AUTO_PROVISION=false 仅校验不拉起。
set -euo pipefail

APP_HOME="${1:?APP_HOME required}"
ENV_FILE="$APP_HOME/server/.env"
COMPOSE_FILE="$APP_HOME/deploy/docker-compose.couch.yml"
COUCH_DATA="$APP_HOME/couch-data"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[couch] 缺少 $ENV_FILE"
  exit 1
fi
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[couch] 缺少 $COMPOSE_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

COUCHDB_URL="${COUCHDB_URL:-http://127.0.0.1:5984}"
COUCHDB_URL="${COUCHDB_URL%/}"
COUCHDB_USER="${COUCHDB_USER:-admin}"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD:-}"
COUCH_AUTO_PROVISION="${COUCH_AUTO_PROVISION:-true}"

if [[ -z "$COUCHDB_PASSWORD" ]]; then
  echo "[couch] COUCHDB_PASSWORD 为空，请在 server/.env 填写"
  exit 1
fi

is_local_url() {
  local u="$1"
  case "$u" in
    http://127.0.0.1|http://127.0.0.1:*|https://127.0.0.1|https://127.0.0.1:*|\
    http://localhost|http://localhost:*|https://localhost|https://localhost:*)
      return 0 ;;
    *)
      return 1 ;;
  esac
}

couch_up() {
  curl -sf --max-time 5 -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "${COUCHDB_URL}/_up" >/dev/null 2>&1
}

docker_bin() {
  if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
      echo docker
      return 0
    fi
    if sudo -n docker info >/dev/null 2>&1; then
      echo "sudo docker"
      return 0
    fi
  fi
  return 1
}

compose_cmd() {
  local dbin="$1"
  # shellcheck disable=SC2086
  if $dbin compose version >/dev/null 2>&1; then
    echo "$dbin compose"
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo docker-compose
    return 0
  fi
  if sudo -n docker-compose version >/dev/null 2>&1; then
    echo "sudo docker-compose"
    return 0
  fi
  return 1
}

echo "[couch] 探活 ${COUCHDB_URL}/_up …"
if couch_up; then
  echo "[couch] 已健康，跳过拉起"
  exit 0
fi

echo "[couch] 当前不可达"

if [[ ! "$COUCH_AUTO_PROVISION" =~ ^(1|true|yes|on)$ ]]; then
  echo "[couch] COUCH_AUTO_PROVISION=false 且库不可达 → 部署失败"
  exit 1
fi

if ! is_local_url "$COUCHDB_URL"; then
  echo "[couch] COUCHDB_URL=$COUCHDB_URL 不是本机（127.0.0.1/localhost）"
  echo "[couch] 自动拉起仅支持同机；请先修复外置库或改为 http://127.0.0.1:5984"
  exit 1
fi

DBIN="$(docker_bin)" || {
  echo "[couch] 未检测到可用 Docker（docker info 失败）。同机自动部署需要 Docker，请先安装并确保当前用户可运行 docker。"
  exit 1
}
COMPOSE="$(compose_cmd "$DBIN")" || {
  echo "[couch] 未找到 docker compose / docker-compose"
  exit 1
}

echo "[couch] 使用 Docker 拉起：$COMPOSE -f deploy/docker-compose.couch.yml"
mkdir -p "$COUCH_DATA"
export COUCHDB_USER COUCHDB_PASSWORD
# shellcheck disable=SC2086
$COMPOSE --project-directory "$APP_HOME" -f "$COMPOSE_FILE" up -d

echo "[couch] 等待就绪（最多 90s）…"
for i in $(seq 1 45); do
  if couch_up; then
    echo "[couch] 已就绪（第 ${i} 次探测）"
    exit 0
  fi
  sleep 2
done

echo "[couch] 超时仍未就绪。检查：docker ps / docker logs stcb-couchdb / COUCHDB_* 凭据"
# shellcheck disable=SC2086
$COMPOSE --project-directory "$APP_HOME" -f "$COMPOSE_FILE" ps || true
exit 1
