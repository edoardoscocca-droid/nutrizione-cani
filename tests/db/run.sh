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
grep -q "da convertire" "$DATA/bad.log" && grep -q "non riconosciuto" "$DATA/bad.log" && grep -q "inesistente" "$DATA/bad.log" || { echo "FALLITO: errori non segnalati"; cat "$DATA/bad.log"; exit 1; }
echo "ok: errori mostrati prima di importare (unità, nutriente, prodotto)"
( cd "$ROOT" && npx tsx scripts/import-catalog.ts alimenti "$DATA/full.json" 2>/dev/null ) > "$DATA/full.sql"
"${PSQL[@]}" -d t -c "$ADMIN" -f "$DATA/full.sql" >/dev/null
[ "$(q "select status || ':' || profile_version from catalog_status where id = 'imported_lamb'")" = "partial:1" ] || { echo "FALLITO: nuovo prodotto"; exit 1; }
[ "$(q "select available_to_formulate from foods where id = 'imported_lamb'")" = "t" ] || { echo "FALLITO: attivazione indicata nel file"; exit 1; }
echo "ok: nuovo prodotto creato (versione 1, dati parziali finché non convalidato, utilizzabile come chiede il file)"
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
# ── dati reali del 16/10/2026: import da SQL Editor (utente postgres) ──
"${PSQL[@]}" -d t -f "$ROOT/supabase/data/2026-10-16_alimenti.sql" >/dev/null
"${PSQL[@]}" -d t -f "$ROOT/supabase/data/2026-10-16_integratori.sql" >/dev/null
R=$("${PSQL[@]}" -d t -tA -c "select string_agg(id || ':' || status, ' ' order by id) from catalog_status where id in ('beef_03','beef_15','beef_30','oat_dry','carrot_cooked','pumpkin_cooked','qdiet','omegor_vitality','bone_meal')")
[ "$R" = "beef_03:partial beef_15:partial beef_30:partial bone_meal:partial carrot_cooked:partial oat_dry:partial omegor_vitality:partial pumpkin_cooked:partial qdiet:partial" ] || { echo "FALLITO: stati dati reali: $R"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select count(*) from food_nutrients where food_id in ('beef_03','beef_15','beef_30','oat_dry','carrot_cooked','pumpkin_cooked')")" = "265" ] || { echo "FALLITO: valori importati"; exit 1; }
# D4: EM calcolata dal metodo FEDIAF 2025 4/9/4, mai salvata come «inserita»
[ "$("${PSQL[@]}" -d t -tA -c "select string_agg(food_id || ':' || kcal_me_in_use || ':' || kcal_me_origin, ' ' order by food_id) from food_completeness where food_id in ('beef_03','oat_dry')")" = "beef_03:114.9:calculated oat_dry:341.7:calculated" ] || { echo "FALLITO: EM calcolata"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select count(*) from foods where kcal_me_per_100g is not null and id in ('beef_03','beef_15','beef_30','oat_dry','carrot_cooked','pumpkin_cooked')")" = "0" ] || { echo "FALLITO: EM calcolata salvata nel profilo"; exit 1; }
# il metodo energetico non cambia i fattori senza una nuova versione; le associazioni solo per amministratori
"${PSQL[@]}" -d t -c "do \$\$ begin update energy_methods set fat = 8.5 where id = 'fediaf_2025_ingredienti_naturali'; raise exception 'accettato'; exception when others then if sqlerrm = 'accettato' then raise; end if; end \$\$" >/dev/null || { echo "FALLITO: fattori cambiati senza versione"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);" -c "do \$\$ begin perform admin_set_energy_assignments('[]'); raise exception 'accettato'; exception when others then if sqlerrm = 'accettato' then raise; end if; end \$\$; select count(*) from energy_method_assignments" | tail -1)" = "7" ] || { echo "FALLITO: associazioni modificabili da un utente"; exit 1; }
# D19: vitamina D µg → UI × 40, vitamina E mg → UI con la forma chimica
[ "$("${PSQL[@]}" -d t -tA -c "select amount_per_100g || ':' || source_value || source_unit from food_nutrients where food_id = 'beef_03' and nutrient_id = 'vitamin_d'")" = "4:0.1µg" ] || { echo "FALLITO: vitamina D convertita"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select amount_per_unit from supplement_nutrients where supplement_id = 'omegor_vitality' and nutrient_id = 'vitamin_e'")" = "14.9" ] || { echo "FALLITO: vitamina E per forma"; exit 1; }
# utilizzabilità ≠ qualità dei dati: i 6 alimenti (dati parziali) sono attivi; gli integratori restano da attivare
[ "$("${PSQL[@]}" -d t -tA -c "select count(*) from foods where available_to_formulate and id in ('beef_03','beef_15','beef_30','oat_dry','carrot_cooked','pumpkin_cooked')")" = "6" ] || { echo "FALLITO: alimenti non attivi"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select processing_state from foods where id = 'carrot_cooked'")" = "cooked_steamed" ] || { echo "FALLITO: cottura al vapore"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select chemical_form || ':' || source_value || source_unit from food_nutrients where food_id = 'beef_03' and nutrient_id = 'vitamin_e'")" = "d_alpha_tocopherol:0.17mg" ] || { echo "FALLITO: forma chimica e unità originali"; exit 1; }
# integratori: energia non dichiarata ed etichetta «solo additivi» non sono motivi; la base «per kg» da confermare sì
R2=$("${PSQL[@]}" -d t -tA -c "select reasons::text from catalog_status where id = 'qdiet'")
echo "$R2" | grep -q "base quantitativa" && ! echo "$R2" | grep -q "energia per dose" && ! echo "$R2" | grep -q "quantità aggiunte" || { echo "FALLITO: motivi Q-Diet: $R2"; exit 1; }
echo "ok: dati reali del 16/10/2026 (265 valori alimenti): EM calcolata con FEDIAF 2025 4/9/4, vitamine D/E convertite con i fattori approvati, integratori sulla composizione dichiarata"
echo "Test database: tutti superati"
