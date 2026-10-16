#!/usr/bin/env bash
# Prova schema, seed e permessi su un Postgres locale temporaneo (serve PostgreSQL 15+).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
RUNAS=()
if [ "$(id -u)" = "0" ]; then chown postgres "$DATA"; RUNAS=(su postgres -s /bin/bash -c); fi
run() { if [ ${#RUNAS[@]} -gt 0 ]; then "${RUNAS[@]}" "$*"; else bash -c "$*"; fi; }
cleanup() { run "$PGBIN/pg_ctl -D $DATA -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
run "$PGBIN/initdb -D $DATA -U postgres --auth=trust" >/dev/null
run "$PGBIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp -c listen_addresses=' -w start" >/dev/null
PSQL=(psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c "create database t" postgres
"${PSQL[@]}" -d t -f "$HERE/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -d t -f "$f"; done
"${PSQL[@]}" -d t -f "$ROOT/supabase/seed.sql"
"${PSQL[@]}" -d t -f "$ROOT/supabase/seed_test_fixtures.sql"
"${PSQL[@]}" -d t -f "$HERE/tests.sql"
echo "Test database: tutti superati"
