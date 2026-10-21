-- Test del database: permessi (T11), limite ricette (T12), immutabilità, versioni dei profili, validazioni.
\set ON_ERROR_STOP 1
\pset tuples_only on
\o /dev/null

create or replace function pg_temp.expect_error(sql text, pattern text) returns void language plpgsql as $$
begin
  begin
    set constraints all immediate; -- anche i controlli "a fine transazione" scattano qui
    execute sql;
  exception when others then
    if sqlerrm !~* pattern then raise exception 'Errore inatteso per [%]: %', sql, sqlerrm; end if;
    return;
  end;
  raise exception 'Doveva fallire: %', sql;
end $$;
create or replace function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALLITO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;
grant execute on function pg_temp.check(boolean, text) to authenticated, anon;

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test'),
  ('00000000-0000-0000-0000-000000000001', 'u1@test'),
  ('00000000-0000-0000-0000-000000000002', 'u2@test');
insert into public.app_admins(user_id, note) values ('00000000-0000-0000-0000-00000000000a', 'test');

-- ── seed caricato fedelmente ──
select pg_temp.check((select lower_value from nutrient_limits where id = 'fediaf_min_calcium') = 1.45, 'FEDIAF calcio minimo 1,45');
select pg_temp.check((select count(*) from foods where data_status = 'unverified' and id not in ('onion','garlic','grapes_raisins','xylitol','chocolate','macadamia','olive_oil')) = 28, '28 alimenti del pacchetto, non verificati');
select pg_temp.check((select count(*) from foods where forbidden and not available_to_formulate) = 6, 'specifica v2: 6 alimenti vietati, mai utilizzabili');
select pg_temp.check((select count(*) from foods where available_to_formulate and data_status <> 'test_fixture') = 0, 'nessun alimento reale attivo');
select pg_temp.check((select count(*) from supplements where usable_for_optimization and status <> 'test_fixture') = 0, 'nessun integratore reale attivo');
select pg_temp.check((select count(*) from food_categories where secreting_offal) = 4, 'frattaglie secernenti distinte');

-- ── utente ordinario ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

select pg_temp.check((select count(*) from foods) > 0, 'U1 legge il catalogo');
-- T11: nessuna modifica al catalogo pubblico
update foods set kcal_me_per_100g = 999 where id = 'beef_lean';
select pg_temp.check((select kcal_me_per_100g from foods where id = 'beef_lean') is null, 'T11: U1 non modifica gli alimenti (RLS)');
select pg_temp.expect_error($$insert into foods(id, name_it, category_id, subcategory_id) values ('x','x','animal','muscle')$$, 'row-level security');
select pg_temp.expect_error($$insert into food_nutrients(food_id, nutrient_id, amount_per_100g, unit, value_status) values ('beef_lean','protein',20,'g','measured')$$, 'row-level security');
delete from nutrient_limits where id = 'fediaf_min_calcium';
select pg_temp.check(exists(select 1 from nutrient_limits where id = 'fediaf_min_calcium'), 'T11: U1 non elimina gli standard');
select pg_temp.expect_error($$insert into app_admins(user_id) values ('00000000-0000-0000-0000-000000000001')$$, 'row-level security');
select pg_temp.check(not public.is_admin(), 'U1 non è amministratore');
select pg_temp.check((select count(*) from audit_log) = 0, 'U1 non legge il registro modifiche');

-- T11: prezzi personali consentiti
insert into user_prices(product_kind, product_id, supplier, mode, price, package_grams) values ('supplement','qdiet','Negozio',  'package_mass', 24, 120);
select pg_temp.check((select count(*) from user_prices) = 1, 'T11: U1 inserisce il proprio prezzo');
update user_prices set price = 30;
select pg_temp.check((select price from user_prices) = 30, 'U1 modifica il proprio prezzo');
select pg_temp.expect_error($$insert into user_prices(product_kind, product_id, mode, price) values ('food','inesistente','per_kg',3)$$, 'non presente');

-- cane e T12
insert into dogs(id, name, weight_current_kg, weight_ideal_kg, kcal_target) values ('11111111-1111-1111-1111-111111111111', 'Fido', 30, 30, 1400);
-- adattato alla specifica v2 (§8): 200 ricette attive per cane [PROPOSTA], le archiviate non contano
do $$ begin
  for i in 1..200 loop
    insert into recipes(dog_id, name, is_primary) values ('11111111-1111-1111-1111-111111111111', 'Ricetta ' || i, i = 1);
  end loop;
end $$;
select pg_temp.expect_error($$insert into recipes(dog_id, name) values ('11111111-1111-1111-1111-111111111111', 'Duecentounesima')$$, 'al massimo 200');
select pg_temp.check((select count(*) from recipes) = 200, 'T12: 201ª rifiutata, le altre 200 intatte');
update recipes set archived = true where name = 'Ricetta 200';
insert into recipes(dog_id, name) values ('11111111-1111-1111-1111-111111111111', 'Dopo l''archiviazione');
select pg_temp.check((select count(*) from recipes) = 201, 'v2: le archiviate non contano nel limite');
select pg_temp.expect_error($$update recipes set archived = false where name = 'Ricetta 200'$$, 'al massimo 200');
delete from recipes where name = 'Dopo l''archiviazione';
select pg_temp.expect_error($$update recipes set is_primary = true where name = 'Ricetta 2'$$, 'duplicate key');

-- versioni immutabili
insert into recipe_versions(id, recipe_id, revision, origin, suggested_items, chosen_items, audit, snapshot, author)
select '22222222-2222-2222-2222-222222222222', id, 1, 'engine', '[]', '[]', '{}', '{}', 'u1' from recipes where name = 'Ricetta 1';
update recipe_versions set chosen_items = '[{"x":1}]';
delete from recipe_versions;
select pg_temp.check((select chosen_items from recipe_versions) = '[]'::jsonb, 'versioni non modificabili né eliminabili dall''utente (RLS)');
reset role;
select pg_temp.expect_error($$update recipe_versions set chosen_items = '[{"x":1}]'$$, 'immutabili');
select pg_temp.expect_error($$delete from recipe_versions$$, 'non si eliminano');
set role authenticated;
update recipes set current_version_id = '22222222-2222-2222-2222-222222222222' where name = 'Ricetta 1';
delete from recipes where name = 'Ricetta 1';
select pg_temp.check((select count(*) from recipe_versions) = 0, 'eliminando la ricetta si eliminano le sue versioni');
select pg_temp.check((select count(*) from recipes where not archived) = 198, 'ora c''è posto per una nuova ricetta');
update recipes set archived = false where name = 'Ricetta 200';
select pg_temp.check((select count(*) from recipes where not archived) = 199, 'ripristino dall''archivio entro il limite');

-- diario (specifica v2, precisazione 1): una sola voce per cane e data, sostituibile; la ricetta deve essere del cane
insert into diary_entries(dog_id, date, recipe_id, recipe_name, revision, day) select '11111111-1111-1111-1111-111111111111', '2026-10-20', id, name, 1, '{"kcal": 1340}' from recipes where name = 'Ricetta 2';
select pg_temp.expect_error($$insert into diary_entries(dog_id, date, recipe_name, revision, day) values ('11111111-1111-1111-1111-111111111111', '2026-10-20', 'doppia', 1, '{}')$$, 'duplicate key');
insert into diary_entries(dog_id, date, recipe_name, revision, day) values ('11111111-1111-1111-1111-111111111111', '2026-10-20', 'sostituita', 1, '{"kcal": 1300}')
  on conflict (dog_id, date) do update set recipe_name = excluded.recipe_name, recipe_id = null, day = excluded.day;
select pg_temp.check((select count(*) || ':' || max(recipe_name) from diary_entries) = '1:sostituita', 'diario: una sola voce per data, la nuova sostituisce');
insert into diary_entries(dog_id, date, recipe_id, recipe_name, revision, day) select '11111111-1111-1111-1111-111111111111', '2026-10-21', id, name, 1, '{"kcal": 1340}' from recipes where name = 'Ricetta 3';
delete from recipes where name = 'Ricetta 3';
select pg_temp.check((select recipe_id is null and (day ->> 'kcal')::numeric = 1340 from diary_entries where date = '2026-10-21'), 'diario: eliminando la ricetta il giorno resta con il suo profilo');

-- ── secondo utente: segregazione ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select pg_temp.check((select count(*) from dogs) = 0, 'U2 non vede i cani di U1');
select pg_temp.check((select count(*) from user_prices) = 0, 'U2 non vede i prezzi di U1');
select pg_temp.expect_error($$insert into recipes(owner_id, dog_id, name) values ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'intrusa')$$, 'row-level security|proprietario');
select pg_temp.check((select count(*) from diary_entries) = 0, 'U2 non vede il diario di U1');
select pg_temp.expect_error($$insert into diary_entries(owner_id, dog_id, date, recipe_name, revision, day) values ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '2026-10-22', 'intrusa', 1, '{}')$$, 'row-level security|proprietario');
update dogs set weight_ideal_kg = 99;
reset role;
select pg_temp.check((select weight_ideal_kg from dogs) = 30, 'U2 non modifica il cane di U1');

-- ── anonimo ──
set role anon;
select pg_temp.expect_error($$select * from foods$$, 'permission denied');
reset role;

-- ── amministratore: D (acciughe) e versioni dei profili ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.check(public.is_admin(), 'amministratore riconosciuto');
-- validazioni
select pg_temp.expect_error($$insert into food_nutrients(food_id, nutrient_id, amount_per_100g, unit, value_status) values ('anchovies','calcium',150,'mg','measured')$$, 'Unità');
select pg_temp.expect_error($$insert into food_nutrients(food_id, nutrient_id, amount_per_100g, unit, value_status) values ('anchovies','calcium',null,'g','measured')$$, 'check');
select pg_temp.expect_error($$insert into food_nutrients(food_id, nutrient_id, amount_per_100g, unit, value_status) values ('anchovies','calcium',0,'g','estimated')$$, 'check');
select pg_temp.expect_error($$insert into food_nutrients(food_id, nutrient_id, amount_per_100g, unit, value_status) values ('anchovies','ca_p_ratio',1,'ratio','measured')$$, 'derivato');
select pg_temp.expect_error($$update foods set available_to_formulate = true where id = 'anchovies'$$, 'da completare');
-- inserimento in una transazione: una sola nuova versione
begin;
insert into food_nutrients(food_id, nutrient_id, amount_per_100g, unit, value_status, source_id) values
  ('anchovies','protein',20,'g','measured','TEST'), ('anchovies','fat',5,'g','measured','TEST');
commit;
select pg_temp.check((select profile_version from foods where id = 'anchovies') = 2, 'composizione modificata: versione 2');
select pg_temp.check((select count(*) from food_profile_history where food_id = 'anchovies') = 1, 'profilo precedente salvato nello storico');
update foods set kcal_me_per_100g = 130, data_status = 'estimated', available_to_formulate = true where id = 'anchovies';
select pg_temp.check((select profile_version from foods where id = 'anchovies') = 3, 'energia modificata: versione 3');
select pg_temp.check((select available_to_formulate from foods where id = 'anchovies'), 'D: acciughe attivate e selezionabili');
select pg_temp.check((select count(*) from audit_log where entity_name = 'food_nutrients' and entity_id like 'anchovies:%') = 2, 'registro modifiche amministrative');
select pg_temp.check((select required_known from food_completeness where food_id = 'anchovies') = 2, 'vista di completezza');
select pg_temp.check((select 'calcium' = any(required_missing) from food_completeness where food_id = 'anchovies'), 'completezza: calcio mancante');
-- stati del catalogo calcolati nel database
select pg_temp.check((select status from catalog_status where id = 'beef_lean') = 'to_complete', 'stato: alimento senza dati = da completare');
select pg_temp.check((select status from catalog_status where id = 'anchovies') = 'partial', 'stato: acciughe con energia e macro = dati parziali');
select pg_temp.check((select status from catalog_status where id = 'test_beef') = 'verified', 'stato: profilo completo di prova = verificato');
select pg_temp.check((select status from catalog_status where id = 'qdiet') = 'to_complete', 'stato: integratore senza etichetta = da completare');
select pg_temp.check((select reasons::text like '%stima%' from catalog_status where id = 'anchovies'), 'motivi dello stato elencati');
select pg_temp.expect_error($$select validate_catalog_item('food', 'anchovies')$$, 'Non convalidabile');
select pg_temp.expect_error($$update foods set validated_at = now(), validated_by = 'io' where id = 'anchovies'$$, 'validate_catalog_item');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select pg_temp.expect_error($$select admin_import_catalog('{"kind":"foods","products":[]}'::jsonb)$$, 'Solo gli amministratori');
select pg_temp.expect_error($$select validate_catalog_item('food', 'test_beef')$$, 'Solo gli amministratori');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
-- soglie non ufficiali mai rosse
select pg_temp.expect_error($$insert into nutrient_limits(id, reference_version_id, metric, unit, basis, limit_class, hardness, severity, source, lower_value) values ('x','PACCHETTO_C_v1.0','calcium','g','per_1000_kcal_me','NON_OFFICIAL_ATTENTION','hard','red','x',1)$$, 'check');
reset role;
\o
\echo 'tutti i controlli del database sono passati'
