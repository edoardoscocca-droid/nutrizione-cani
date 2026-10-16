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
# ── importazione: stesso modulo dell'app + funzione admin_import_catalog ──
ADMIN="set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);"
q() { "${PSQL[@]}" -d t -tA -c "$ADMIN" -c "$1" | tail -1; }
( cd "$ROOT" && npx tsx tests/db/make-import-files.ts "$DATA" )
if ( cd "$ROOT" && npx tsx scripts/import-catalog.ts alimenti "$DATA/bad.csv" >/dev/null 2>"$DATA/bad.log" ); then echo "FALLITO: file errato accettato"; exit 1; fi
grep -q "non convertibile" "$DATA/bad.log" && grep -q "non riconosciuto" "$DATA/bad.log" && grep -q "inesistente" "$DATA/bad.log" || { echo "FALLITO: errori non segnalati"; cat "$DATA/bad.log"; exit 1; }
echo "ok: errori mostrati prima di importare (unità, nutriente, prodotto)"
( cd "$ROOT" && npx tsx scripts/import-catalog.ts alimenti "$DATA/full.json" 2>/dev/null ) > "$DATA/full.sql"
"${PSQL[@]}" -d t -c "$ADMIN" -f "$DATA/full.sql" >/dev/null
[ "$(q "select status || ':' || profile_version from catalog_status where id = 'imported_lamb'")" = "partial:1" ] || { echo "FALLITO: nuovo prodotto"; exit 1; }
[ "$(q "select available_to_formulate from foods where id = 'imported_lamb'")" = "f" ] || { echo "FALLITO: l'import non deve attivare"; exit 1; }
echo "ok: nuovo prodotto creato (versione 1, dati parziali finché non convalidato, non attivato)"
q "select validate_catalog_item('food', 'imported_lamb')" >/dev/null
[ "$(q "select status from catalog_status where id = 'imported_lamb'")" = "verified" ] || { echo "FALLITO: convalida"; exit 1; }
echo "ok: convalida dell'amministratore → verificato"
CAT="$DATA/cat.json"
"${PSQL[@]}" -d t -tA -c "select json_build_object('foods', json_agg(json_build_object('id', id, 'name', name_it, 'categoryId', category_id, 'subcategoryId', subcategory_id, 'processingState', processing_state, 'ediblePortion', edible_portion, 'kcalMePer100g', kcal_me_per_100g, 'meMethod', me_method, 'source', source_identifier, 'sourceVersion', source_version, 'dataStatus', data_status, 'availableToFormulate', available_to_formulate, 'profileVersion', profile_version, 'validatedAt', validated_at, 'nutrients', (select coalesce(json_object_agg(nutrient_id, json_build_object('value', amount_per_100g, 'status', value_status, 'source', source_id)), '{}') from food_nutrients where food_id = f.id)))) from foods f" > "$CAT"
( cd "$ROOT" && npx tsx scripts/import-catalog.ts alimenti "$DATA/full.json" "$CAT" 2>&1 >/dev/null ) | grep -q "Nessuna modifica" || { echo "FALLITO: reimport identico"; exit 1; }
echo "ok: reimportare lo stesso file non crea nulla (nessun duplicato, nessuna versione)"
( cd "$ROOT" && npx tsx scripts/import-catalog.ts alimenti "$DATA/change.csv" "$CAT" 2>/dev/null ) > "$DATA/change.sql"
"${PSQL[@]}" -d t -c "$ADMIN" -f "$DATA/change.sql" >/dev/null
[ "$(q "select profile_version || ':' || coalesce(validated_at::text, 'none') from foods where id = 'imported_lamb'")" = "2:none" ] || { echo "FALLITO: versione/convalida dopo modifica"; exit 1; }
[ "$(q "select amount_per_100g || ':' || source_unit || ':' || source_id from food_nutrients where food_id = 'imported_lamb' and nutrient_id = 'calcium'")" = "0.025:mg:TEST import 2" ] || { echo "FALLITO: valore aggiornato"; exit 1; }
[ "$(q "select count(*) from food_profile_history where food_id = 'imported_lamb' and profile_version = 1")" = "1" ] || { echo "FALLITO: storico"; exit 1; }
[ "$(q "select status from catalog_status where id = 'imported_lamb'")" = "partial" ] || { echo "FALLITO: stato dopo modifica"; exit 1; }
[ "$(q "select count(*) from catalog_imports")" = "2" ] || { echo "FALLITO: registro importazioni"; exit 1; }
echo "ok: aggiornamento senza duplicati, nome nutriente riconosciuto, mg→g, versione 2, convalida decaduta, storico e registro"
"${PSQL[@]}" -d t -tA -c "select json_build_object('foods', json_agg(json_build_object('id', id, 'name', name_it, 'categoryId', category_id, 'subcategoryId', subcategory_id, 'processingState', processing_state, 'ediblePortion', edible_portion, 'kcalMePer100g', kcal_me_per_100g, 'meMethod', me_method, 'source', source_identifier, 'sourceVersion', source_version, 'dataStatus', data_status, 'availableToFormulate', available_to_formulate, 'profileVersion', profile_version, 'validatedAt', validated_at, 'nutrients', (select coalesce(json_object_agg(nutrient_id, json_build_object('value', amount_per_100g, 'status', value_status, 'source', source_id)), '{}') from food_nutrients where food_id = f.id)))) from foods f" > "$CAT"
TS_STATUS=$(cd "$ROOT" && npx tsx tests/db/status-of.ts "$CAT")
DB_STATUS=$("${PSQL[@]}" -d t -tA -c "select id || ':' || status from catalog_status where kind = 'food' order by id collate \"C\"")
[ "$TS_STATUS" = "$DB_STATUS" ] || { echo "FALLITO: stati diversi tra app e database"; diff <(echo "$TS_STATUS") <(echo "$DB_STATUS"); exit 1; }
echo "ok: stessi stati nell'app e nel database per $(echo "$DB_STATUS" | wc -l) alimenti ($(echo "$DB_STATUS" | cut -d: -f2 | sort | uniq -c | tr -s ' ' | paste -sd, -))"
echo "Test database: tutti superati"
