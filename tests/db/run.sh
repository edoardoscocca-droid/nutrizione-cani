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
( cd "$ROOT" && printf 'product_id,nutrient_id,value_per_100g,unit,basis,source_id,status\nsardines,calcium,382,mg,raw,TEST,\nsardines,protein,,g,raw,,\n' > "$DATA/i.csv" && npx tsx scripts/import-csv.ts alimenti "$DATA/i.csv" 2>/dev/null ) | "${PSQL[@]}" -d t
OK=$("${PSQL[@]}" -d t -tAc "select amount_per_100g = 0.382 and value_status = 'measured' and (select count(*) from food_nutrients where food_id = 'sardines') = 1 from food_nutrients where food_id = 'sardines' and nutrient_id = 'calcium'")
[ "$OK" = "t" ] || { echo "FALLITO: import CSV"; exit 1; }
echo "ok: import CSV (mg convertiti in g, valore vuoto non importato)"
echo "Test database: tutti superati"
