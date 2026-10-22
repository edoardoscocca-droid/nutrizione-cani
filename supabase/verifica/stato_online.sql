-- SOLA LETTURA: non modifica nulla. Mostra quali migrazioni e quali file di dati risultano applicati.
-- Supabase → SQL Editor → incolla ed esegui → copia la tabella del risultato (non contiene chiavi né dati personali).
with c(ordine, controllo, esito) as (
  select 1,  'migrazione 01 schema (tabella foods)', (to_regclass('public.foods') is not null)::text
  union all select 2,  'migrazione 02 regole e sicurezza (trigger unità)', exists(select 1 from pg_trigger where tgname = 'food_nutrients_unit')::text
  union all select 3,  'migrazione 03 stati e importazione (convalida)', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'foods' and column_name = 'validated_at')::text
  union all select 4,  'migrazione 04 composti e capsule', exists(select 1 from pg_proc where proname = 'compound_parts')::text
  union all select 5,  'migrazione 05 metodi energetici e conversioni', (to_regclass('public.unit_conversions') is not null)::text
  union all select 6,  'migrazione 06 utilizzabilità e forma chimica', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'food_nutrients' and column_name = 'chemical_form')::text
  union all select 7,  'migrazione 07 tabella d''impiego', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'supplements' and column_name = 'dose_guide')::text
  union all select 8,  'migrazione 08 schema d''importazione definitivo', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'foods' and column_name = 'source_url')::text
  union all select 9,  'migrazione 09 bozze diagnostiche', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'recipe_versions' and column_name = 'draft')::text
  union all select 10, 'migrazione 10 zeri calcolati', exists(select 1 from pg_constraint where conname = 'food_nutrients_zero_documented')::text
  union all select 11, 'migrazione 11 v2 e diario (tabella diary_entries)', (to_regclass('public.diary_entries') is not null)::text
  union all select 12, 'migrazione 11 v2 (resa di cottura nel catalogo)', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'foods' and column_name = 'prepared_yield')::text
  union all select 20, 'seed: nutrienti nel dizionario', (select count(*) from public.nutrients)::text
  union all select 21, 'seed: limiti FEDIAF 2025', (select count(*) from public.nutrient_limits where reference_version_id = 'FEDIAF_2025_adult_95_v1.0')::text
  union all select 22, 'dati 01_catalogo_v2: alimenti vietati', case when exists(select 1 from information_schema.columns where table_name = 'foods' and column_name = 'forbidden') then (select count(*) from public.foods where id in ('onion','garlic','grapes_raisins','xylitol','chocolate','macadamia'))::text else 'colonna assente' end
  union all select 23, 'dati: importazioni registrate (file, data)', coalesce((select string_agg(file_name || ' ' || to_char(created_at, 'YYYY-MM-DD'), '; ' order by created_at) from public.catalog_imports), 'nessuna')
  union all select 24, 'dati 02_qdiet_b5: B5 del QDiet (mg/g)', coalesce((select amount_per_unit::text || ' ' || coalesce(chemical_form, '') from public.supplement_nutrients where supplement_id = 'qdiet' and nutrient_id = 'vitamin_b5'), 'assente')
  union all select 25, 'dati 20/10: avena «dried»', coalesce((select processing_state from public.foods where id = 'oat_dry'), 'assente')
  union all select 30, 'utenti registrati', (select count(*) from auth.users)::text
  union all select 31, 'cani / ricette / versioni salvati', (select count(*) from public.dogs)::text || ' / ' || (select count(*) from public.recipes)::text || ' / ' || (select count(*) from public.recipe_versions)::text
  union all select 32, 'amministratori del catalogo', (select count(*) from public.app_admins)::text
)
select ordine, controllo, esito from c order by ordine;
