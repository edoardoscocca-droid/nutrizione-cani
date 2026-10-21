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
grep -q "non convertibile" "$DATA/bad.log" && grep -q "non riconosciuto" "$DATA/bad.log" && grep -q "inesistente" "$DATA/bad.log" && grep -q "stato del valore mancante" "$DATA/bad.log" && grep -q "riservato ai prodotti di prova" "$DATA/bad.log" || { echo "FALLITO: errori non segnalati"; cat "$DATA/bad.log"; exit 1; }
echo "ok: errori mostrati prima di importare (unità, nutriente, prodotto, stato mancante, prodotto TEST)"
( cd "$ROOT" && npx tsx scripts/import-catalog.ts alimenti "$DATA/full.json" 2>/dev/null ) > "$DATA/full.sql"
"${PSQL[@]}" -d t -c "$ADMIN" -f "$DATA/full.sql" >/dev/null
[ "$(q "select status || ':' || profile_version from catalog_status where id = 'imported_lamb'")" = "partial:1" ] || { echo "FALLITO: nuovo prodotto"; exit 1; }
[ "$(q "select available_to_formulate from foods where id = 'imported_lamb'")" = "t" ] || { echo "FALLITO: attivazione indicata nel file"; exit 1; }
echo "ok: nuovo prodotto creato (versione 1, dati parziali finché non convalidato, utilizzabile come chiede il file)"
q "select validate_catalog_item('food', 'imported_lamb')" >/dev/null
[ "$(q "select status from catalog_status where id = 'imported_lamb'")" = "verified" ] || { echo "FALLITO: convalida"; exit 1; }
echo "ok: convalida dell'amministratore → verificato"
CAT="$DATA/cat.json"
"${PSQL[@]}" -d t -tA -c "select json_build_object('foods', json_agg(json_build_object('id', id, 'name', name_it, 'categoryId', category_id, 'subcategoryId', subcategory_id, 'processingState', processing_state, 'ediblePortion', edible_portion, 'kcalMePer100g', kcal_me_per_100g, 'meMethod', me_method, 'source', source_identifier, 'sourceUrl', source_url, 'sourceVersion', source_version, 'dataStatus', data_status, 'availableToFormulate', available_to_formulate, 'profileVersion', profile_version, 'validatedAt', validated_at, 'nutrients', (select coalesce(json_object_agg(nutrient_id, json_build_object('value', amount_per_100g, 'status', value_status, 'source', source_id, 'method', method, 'sourceValue', source_value, 'sourceUnit', source_unit, 'form', chemical_form, 'basis', source_basis)), '{}') from food_nutrients where food_id = f.id)))) from foods f" > "$CAT"
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
"${PSQL[@]}" -d t -tA -c "select json_build_object('foods', json_agg(json_build_object('id', id, 'name', name_it, 'categoryId', category_id, 'subcategoryId', subcategory_id, 'processingState', processing_state, 'ediblePortion', edible_portion, 'kcalMePer100g', kcal_me_per_100g, 'meMethod', me_method, 'source', source_identifier, 'sourceUrl', source_url, 'sourceVersion', source_version, 'dataStatus', data_status, 'availableToFormulate', available_to_formulate, 'profileVersion', profile_version, 'validatedAt', validated_at, 'nutrients', (select coalesce(json_object_agg(nutrient_id, json_build_object('value', amount_per_100g, 'status', value_status, 'source', source_id, 'method', method, 'sourceValue', source_value, 'sourceUnit', source_unit, 'form', chemical_form, 'basis', source_basis)), '{}') from food_nutrients where food_id = f.id)))) from foods f" > "$CAT"
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
# integratori: energia non dichiarata ed etichetta «solo additivi» non sono motivi; Q-Diet: base «per kg» confermata
R2=$("${PSQL[@]}" -d t -tA -c "select reasons::text from catalog_status where id = 'qdiet'")
! echo "$R2" | grep -q "base quantitativa" && ! echo "$R2" | grep -q "energia per dose" && ! echo "$R2" | grep -q "quantità aggiunte" || { echo "FALLITO: motivi Q-Diet: $R2"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select amount_per_unit || ':' || value_status from supplement_nutrients where supplement_id = 'qdiet' and nutrient_id = 'zinc'")" = "2:label" ] || { echo "FALLITO: zinco Q-Diet per g"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select amount_per_unit || ':' || source_value || source_unit || ':' || chemical_form from supplement_nutrients where supplement_id = 'qdiet' and nutrient_id = 'choline'")" = "67.14:90mg:choline_chloride" ] || { echo "FALLITO: colina da cloruro di colina"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select kcal_per_unit || ':' || jsonb_array_length(dose_guide -> 'points') from supplements where id = 'qdiet'")" = "0.96:5" ] || { echo "FALLITO: energia e tabella d'impiego Q-Diet"; exit 1; }
echo "ok: dati reali del 16/10/2026 (265 valori alimenti): EM calcolata con FEDIAF 2025 4/9/4, vitamine D/E convertite con i fattori approvati, integratori sulla composizione dichiarata"
# ── schema definitivo: modello JSON degli integratori (URL fonte, qualità dati, massa contenuto/lorda, base per kg, aggiunto/totale) ──
( cd "$ROOT" && npx tsx scripts/import-catalog.ts integratori docs/modelli-importazione/integratori.json 2>/dev/null ) > "$DATA/supp.sql"
"${PSQL[@]}" -d t -c "$ADMIN" -f "$DATA/supp.sql" >/dev/null
[ "$(q "select source_url || ':' || data_status || ':' || mass_per_unit_g || ':' || coalesce(gross_mass_per_unit_g::text, 'ignota') from supplements where id = 'esempio_olio_pesce_capsule'")" = "https://esempio.org/etichetta-olio.pdf:unverified:1:ignota" ] || { echo "FALLITO: campi integratore: $(q "select source_url || ':' || data_status || ':' || mass_per_unit_g || ':' || coalesce(gross_mass_per_unit_g::text, 'ignota') from supplements where id = 'esempio_olio_pesce_capsule'")"; exit 1; }
[ "$(q "select amount_per_unit || ':' || source_value || source_unit || ':' || source_basis || ':' || declared_total_or_added from supplement_nutrients where supplement_id = 'esempio_integratore_polvere' and nutrient_id = 'zinc'")" = "2:2000mg:per_kg (1 g di prodotto):added" ] || { echo "FALLITO: base per kg"; exit 1; }
echo "ok: modello integratori nel database (URL fonte, qualità dati, massa del contenuto, massa lorda ignota, base per kg → per g, aggiunto)"
# ── pacchetto del 20/10/2026 (verifica del menù di Ker): import controllato da SQL Editor ──
RV_BEFORE=$("${PSQL[@]}" -d t -tA -c "select count(*) || ':' || coalesce(md5(string_agg(id::text || chosen_items::text, ',' order by id)), '-') from recipe_versions")
for f in "$ROOT"/supabase/data/2026-10-20/*.sql; do "${PSQL[@]}" -d t -f "$f" >/dev/null; done
[ "$("${PSQL[@]}" -d t -tA -c "select string_agg(id || ':' || available_to_formulate, ' ' order by id) from foods where id in ('beef_05','beef_10','coconut_oil','flaxseed_oil')")" = "beef_05:false beef_10:false coconut_oil:false flaxseed_oil:false" ] || { echo "FALLITO: profili di confronto non disattivati"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select usable_for_optimization || ':' || coalesce(kcal_per_unit::text, 'ignota') from supplements where id = 'psyllium_erbavoglio_husk_bio'")" = "false:ignota" ] || { echo "FALLITO: psillio"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select processing_state from foods where id = 'oat_dry'")" = "dried" ] || { echo "FALLITO: avena"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select amount_per_100g || ':' || value_status from food_nutrients where food_id = 'beef_03' and nutrient_id = 'vitamin_d'")" = "3:calculated" ] || [ "$("${PSQL[@]}" -d t -tA -c "select amount_per_100g from food_nutrients where food_id = 'beef_03' and nutrient_id = 'vitamin_d'")" = "3" ] || { echo "FALLITO: vitamina D manzo"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select declared_total_or_added from supplement_nutrients where supplement_id = 'qdiet' and nutrient_id = 'calcium'")" = "total" ] || { echo "FALLITO: QDiet calcio total"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select coalesce(amount_per_unit::text, 'ignota') || ':' || value_status from supplement_nutrients where supplement_id = 'qdiet' and nutrient_id = 'fiber'")" = "ignota:unknown" ] || { echo "FALLITO: fibra QDiet sconosciuta"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select mass_per_unit_g || ':' || kcal_per_unit from supplements where id = 'omegor_vitality'")" = "1:9" ] || { echo "FALLITO: Omegor"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select count(*) from catalog_status where id in ('beef_03','beef_15','beef_30','oat_dry','carrot_cooked','pumpkin_cooked','beef_05','beef_10','coconut_oil','flaxseed_oil','qdiet','omegor_vitality','bone_meal','psyllium_erbavoglio_husk_bio') and status = 'verified'")" = "0" ] || { echo "FALLITO: convalida attribuita"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select count(*) || ':' || coalesce(md5(string_agg(id::text || chosen_items::text, ',' order by id)), '-') from recipe_versions")" = "$RV_BEFORE" ] || { echo "FALLITO: ricette modificate"; exit 1; }
echo "ok: pacchetto del 20/10 (Ker): profili di confronto e psillio non utilizzabili, avena «dried», QDiet calcio total e fibra sconosciuta, Omegor 1 g / 9 kcal, nessuna convalida, ricette invariate"
# ── specifica v2 del 21/10/2026: catalogo v2 e B5 del QDiet, da SQL Editor dopo la migrazione 11 ──
RV_BEFORE=$("${PSQL[@]}" -d t -tA -c "select count(*) || ':' || coalesce(md5(string_agg(id::text || chosen_items::text, ',' order by id)), '-') from recipe_versions")
for f in "$ROOT"/supabase/data/2026-10-21/*.sql; do "${PSQL[@]}" -d t -f "$f" >/dev/null; done
for f in "$ROOT"/supabase/data/2026-10-21/01_*.sql; do "${PSQL[@]}" -d t -f "$f" >/dev/null; done  # rieseguibile senza effetti
[ "$("${PSQL[@]}" -d t -tA -c "select amount_per_unit || ':' || source_value || source_unit || ':' || chemical_form || ':' || declared_total_or_added from supplement_nutrients where supplement_id = 'qdiet' and nutrient_id = 'vitamin_b5'")" = "0.414:450mg:calcium_d_pantothenate:added" ] || { echo "FALLITO: B5 QDiet"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select factor from unit_conversions where id = 'calcium_d_pantothenate'")" = "0.92" ] || { echo "FALLITO: conversione calcio D-pantotenato"; exit 1; }
"${PSQL[@]}" -d t -c "do \$\$ begin update foods set available_to_formulate = true where id = 'onion'; raise exception 'accettato'; exception when others then if sqlerrm = 'accettato' then raise; end if; end \$\$" >/dev/null || { echo "FALLITO: alimento vietato attivabile"; exit 1; }
[ "$("${PSQL[@]}" -d t -tA -c "select count(*) || ':' || coalesce(md5(string_agg(id::text || chosen_items::text, ',' order by id)), '-') from recipe_versions")" = "$RV_BEFORE" ] || { echo "FALLITO: ricette modificate"; exit 1; }
# importazione con i campi v2 del catalogo (tetti, vietato, avvertenza)
cat > "$DATA/v2.json" <<'JSON'
{ "foods": [ { "id": "fegato_tetto_prova", "name_it": "[prova] fegato con tetto", "category": "animal", "subcategory": "secreting_offal_liver", "max_fresh_weight_pct": 5, "max_g_per_1000_kcal": 30, "forbidden": false, "preparation_warning": "sempre cotto" } ] }
JSON
( cd "$ROOT" && npx tsx scripts/import-catalog.ts alimenti "$DATA/v2.json" 2>/dev/null ) > "$DATA/v2.sql"
"${PSQL[@]}" -d t -c "$ADMIN" -f "$DATA/v2.sql" >/dev/null
[ "$(q "select max_fresh_weight_pct || ':' || max_g_per_1000_kcal || ':' || forbidden || ':' || preparation_warning from foods where id = 'fegato_tetto_prova'")" = "5:30:false:sempre cotto" ] || { echo "FALLITO: campi v2 importati: $(q "select max_fresh_weight_pct || ':' || max_g_per_1000_kcal || ':' || forbidden || ':' || preparation_warning from foods where id = 'fegato_tetto_prova'")"; exit 1; }
echo "ok: specifica v2 — migrazione 11 e dati del 21/10: B5 del QDiet 0,414 mg/g dal calcio D-pantotenato, alimenti vietati non attivabili, tetti e avvertenze importati, limite 200 ricette (archiviate escluse), diario una voce per data con RLS, ricette invariate"
echo "Test database: tutti superati"
