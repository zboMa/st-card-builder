#!/usr/bin/env bash
# CouchDB 逻辑备份：用户库前缀 + 公共分享库 + 管理库
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/server/.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

COUCHDB_URL="${COUCHDB_URL:-http://127.0.0.1:5984}"
COUCHDB_USER="${COUCHDB_USER:-admin}"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD:-adminpass}"
OUT_DIR="${1:-$ROOT/backups/$(date +%Y%m%d-%H%M%S)}"
AUTH="${COUCHDB_USER}:${COUCHDB_PASSWORD}"

mkdir -p "$OUT_DIR"
echo "[backup] → $OUT_DIR"

dbs=$(curl -sf -u "$AUTH" "$COUCHDB_URL/_all_dbs")
echo "$dbs" | tee "$OUT_DIR/all_dbs.json" >/dev/null

python3 - <<'PY' "$dbs" "$OUT_DIR" "$COUCHDB_URL" "$AUTH" || {
  # 无 python 时退化为逐库 curl
  true
}
import json, sys, subprocess, os
dbs = json.loads(sys.argv[1])
out, url, auth = sys.argv[2], sys.argv[3], sys.argv[4]
want = []
for name in dbs:
    if name.startswith('userdb-stcb-') or name in ('stcb-public-shares', 'stcb-admin'):
        want.append(name)
open(os.path.join(out, 'selected_dbs.json'), 'w').write(json.dumps(want, indent=2))
for name in want:
    dest = os.path.join(out, name + '.json')
    cmd = ['curl', '-sf', '-u', auth, f'{url}/{name}/_all_docs?include_docs=true']
    with open(dest, 'wb') as f:
        subprocess.check_call(cmd, stdout=f)
    print('[backup]', name)
PY

echo "[backup] done: $OUT_DIR"
