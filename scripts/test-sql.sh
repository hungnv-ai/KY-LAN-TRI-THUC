#!/usr/bin/env bash
# Kiểm thử setup.sql trên một PostgreSQL tạm (cần cài PostgreSQL 16 trên máy dev).
# Dùng: npm run test:sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
chmod 777 "$TMP"
run() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
cleanup() { run "$PGBIN/pg_ctl -D $TMP/data stop -m fast" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
run "$PGBIN/initdb -D $TMP/data -A trust -U postgres --locale=C.UTF-8 -E UTF8" >/dev/null
run "$PGBIN/pg_ctl -D $TMP/data -o '-p $PORT -k $TMP -c timezone=UTC' -l $TMP/log start -w" >/dev/null
PSQL="PGOPTIONS=--client-min-messages=warning psql -h $TMP -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -X"
node "$ROOT/scripts/gen-seed.mjs" >/dev/null
cp "$ROOT/supabase/tests/auth_stub.sql" "$ROOT/supabase/setup.sql" "$ROOT/supabase/tests/test_game.sql" "$TMP/"
chmod 644 "$TMP"/*.sql
run "$PSQL -d postgres -f $TMP/auth_stub.sql"
run "$PSQL -d postgres -f $TMP/setup.sql" | tail -3
echo "— chạy lại setup.sql lần 2 (kiểm tra chạy lại được) —"
run "$PSQL -d postgres -f $TMP/setup.sql" | tail -1
run "$PSQL -d postgres -f $TMP/test_game.sql"
