-- Stato del catalogo (Verificato · Dati parziali · Da completare), convalida degli amministratori e importazione massiva.
-- I criteri sono gli stessi di src/engine/catalogStatus.ts.

alter table public.foods add column if not exists validated_by text, add column if not exists validated_at timestamptz;
alter table public.supplements add column if not exists validated_by text, add column if not exists validated_at timestamptz;

-- ───────────── la convalida decade a ogni nuova versione del profilo ─────────────
create or replace function public.bump_food_version(fid text) returns void
language plpgsql security definer set search_path = public as $$
declare
  f public.foods;
begin
  select * into f from public.foods where id = fid for update;
  if not found or f.profile_changed_at is not distinct from now() then return; end if;
  insert into public.food_profile_history(food_id, profile_version, profile, changed_by)
  values (fid, f.profile_version, public.food_profile_json(fid), auth.uid())
  on conflict (food_id, profile_version) do nothing;
  update public.foods set profile_version = profile_version + 1, profile_changed_at = now(), updated_at = now(),
         validated_at = null, validated_by = null
   where id = fid;
end $$;

create or replace function public.bump_supplement_version(sid text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.supplements;
begin
  select * into s from public.supplements where id = sid for update;
  if not found or s.profile_changed_at is not distinct from now() then return; end if;
  insert into public.supplement_profile_history(supplement_id, profile_version, profile, changed_by)
  values (sid, s.profile_version, public.supplement_profile_json(sid), auth.uid())
  on conflict (supplement_id, profile_version) do nothing;
  update public.supplements set profile_version = profile_version + 1, profile_changed_at = now(), updated_at = now(),
         validated_at = null, validated_by = null
   where id = sid;
end $$;

create or replace function public.on_food_profile_update() returns trigger
language plpgsql as $$
begin
  if (old.kcal_me_per_100g, old.processing_state, old.edible_portion, old.source_identifier, old.source_version, old.data_status, old.me_method)
     is distinct from (new.kcal_me_per_100g, new.processing_state, new.edible_portion, new.source_identifier, new.source_version, new.data_status, new.me_method) then
    if old.profile_changed_at is distinct from now() then
      insert into public.food_profile_history(food_id, profile_version, profile, changed_by)
      values (old.id, old.profile_version, public.food_profile_json(old.id), auth.uid())
      on conflict (food_id, profile_version) do nothing;
      new.profile_version := old.profile_version + 1;
      new.profile_changed_at := now();
    end if;
    new.validated_at := null;
    new.validated_by := null;
  end if;
  -- la convalida si imposta solo con validate_catalog_item()
  if (new.validated_at, new.validated_by) is distinct from (old.validated_at, old.validated_by)
     and new.validated_at is not null and coalesce(current_setting('app.validating', true), '') <> 'on' then
    raise exception 'La convalida si fa solo con validate_catalog_item()';
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.on_supplement_profile_update() returns trigger
language plpgsql as $$
begin
  if (old.dose_unit, old.mass_per_unit_g, old.kcal_per_unit, old.max_daily_units, old.product_version, old.status, old.label_source, old.label_added_only)
     is distinct from (new.dose_unit, new.mass_per_unit_g, new.kcal_per_unit, new.max_daily_units, new.product_version, new.status, new.label_source, new.label_added_only) then
    if old.profile_changed_at is distinct from now() then
      insert into public.supplement_profile_history(supplement_id, profile_version, profile, changed_by)
      values (old.id, old.profile_version, public.supplement_profile_json(old.id), auth.uid())
      on conflict (supplement_id, profile_version) do nothing;
      new.profile_version := old.profile_version + 1;
      new.profile_changed_at := now();
    end if;
    new.validated_at := null;
    new.validated_by := null;
  end if;
  if (new.validated_at, new.validated_by) is distinct from (old.validated_at, old.validated_by)
     and new.validated_at is not null and coalesce(current_setting('app.validating', true), '') <> 'on' then
    raise exception 'La convalida si fa solo con validate_catalog_item()';
  end if;
  new.updated_at := now();
  return new;
end $$;


-- ───────────── stato calcolato ─────────────
create or replace function public.food_status_of(f public.foods) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  reasons text[] := '{}';
  hard text[] := '{}';
  n_missing integer;
  n_est integer;
  n_nosrc integer;
  ready boolean;
begin
  if f.kcal_me_per_100g is null then hard := hard || 'energia metabolizzabile'::text; end if;
  if not exists (select 1 from food_nutrients where food_id = f.id and nutrient_id = 'protein' and amount_per_100g is not null) then hard := hard || 'proteine'::text; end if;
  if not exists (select 1 from food_nutrients where food_id = f.id and nutrient_id = 'fat' and amount_per_100g is not null) then hard := hard || 'grassi'::text; end if;
  select count(*) into n_missing from nutrients n
   where n.kind in ('core','advanced')
     and not exists (select 1 from food_nutrients fn where fn.food_id = f.id and fn.nutrient_id = n.id and fn.amount_per_100g is not null);
  select count(*) filter (where value_status not in ('measured','label','calculated','analytical_zero')),
         count(*) filter (where nullif(trim(source_id), '') is null)
    into n_est, n_nosrc
    from food_nutrients where food_id = f.id and amount_per_100g is not null;
  if n_missing > 0 then reasons := reasons || format('%s nutrienti richiesti senza valore', n_missing); end if;
  if n_est > 0 then reasons := reasons || format('%s valori stimati o di qualità non dichiarata', n_est); end if;
  if n_nosrc > 0 then reasons := reasons || format('%s valori senza fonte', n_nosrc); end if;
  if coalesce(array_length(hard, 1), 0) > 0 then
    return jsonb_build_object('status', 'to_complete', 'reasons', to_jsonb(array['mancano: ' || array_to_string(hard, ', ')] || reasons), 'ready', false);
  end if;
  if nullif(trim(f.me_method), '') is null then reasons := reasons || 'metodo di calcolo dell’energia non indicato'::text; end if;
  if nullif(trim(f.source_identifier), '') is null then reasons := reasons || 'fonte del profilo non indicata'::text; end if;
  if nullif(trim(f.source_version), '') is null then reasons := reasons || 'versione della fonte non indicata'::text; end if;
  if f.processing_state = 'raw_or_unspecified' then reasons := reasons || 'stato crudo/cotto non specificato'::text; end if;
  if nullif(trim(f.edible_portion), '') is null then reasons := reasons || 'parte edibile non indicata'::text; end if;
  if f.data_status = 'estimated' then reasons := reasons || 'profilo dichiarato come stima'::text; end if;
  ready := coalesce(array_length(reasons, 1), 0) = 0;
  if f.validated_at is null and f.data_status <> 'test_fixture' then reasons := reasons || 'non ancora convalidato da un amministratore'::text; end if;
  return jsonb_build_object('status', case when coalesce(array_length(reasons, 1), 0) = 0 then 'verified' else 'partial' end,
                            'reasons', to_jsonb(reasons), 'ready', ready);
end $$;

create or replace function public.supplement_status_of(s public.supplements) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  reasons text[] := '{}';
  hard text[] := '{}';
  n_declared integer;
  n_missing integer;
  n_est integer;
  n_nosrc integer;
  ready boolean;
begin
  select count(*),
         count(*) filter (where value_status not in ('measured','label','calculated','analytical_zero')),
         count(*) filter (where nullif(trim(source_id), '') is null)
    into n_declared, n_est, n_nosrc
    from supplement_nutrients where supplement_id = s.id and amount_per_unit is not null;
  select count(*) into n_missing from nutrients n
   where n.kind in ('core','advanced')
     and not exists (select 1 from supplement_nutrients sn where sn.supplement_id = s.id and sn.nutrient_id = n.id and sn.amount_per_unit is not null);
  if n_declared = 0 then hard := hard || 'composizione per dose'::text; end if;
  if s.dose_unit not in ('g','ml') and s.mass_per_unit_g is null then hard := hard || 'contenuto della singola dose'::text; end if;
  if nullif(trim(s.label_source), '') is null then hard := hard || 'etichetta o scheda tecnica'::text; end if;
  if n_missing > 0 then reasons := reasons || format('%s nutrienti richiesti senza valore', n_missing); end if;
  if n_est > 0 then reasons := reasons || format('%s valori stimati o di qualità non dichiarata', n_est); end if;
  if n_nosrc > 0 then reasons := reasons || format('%s valori senza fonte', n_nosrc); end if;
  if coalesce(array_length(hard, 1), 0) > 0 then
    return jsonb_build_object('status', 'to_complete', 'reasons', to_jsonb(array['mancano: ' || array_to_string(hard, ', ')] || reasons), 'ready', false);
  end if;
  if s.kcal_per_unit is null then reasons := reasons || 'energia per dose non indicata'::text; end if;
  if nullif(trim(s.product_version), '') is null then reasons := reasons || 'variante/lotto o versione del prodotto non indicati'::text; end if;
  if s.label_added_only then reasons := reasons || 'l’etichetta dichiara solo le quantità aggiunte: non è un’analisi completa'::text; end if;
  ready := coalesce(array_length(reasons, 1), 0) = 0;
  if s.validated_at is null and s.status <> 'test_fixture' then reasons := reasons || 'non ancora convalidato da un amministratore'::text; end if;
  return jsonb_build_object('status', case when coalesce(array_length(reasons, 1), 0) = 0 then 'verified' else 'partial' end,
                            'reasons', to_jsonb(reasons), 'ready', ready);
end $$;

create or replace view public.catalog_status with (security_invoker = true) as
select 'food'::text as kind, f.id, f.name_it, f.profile_version, f.available_to_formulate as active, f.validated_by, f.validated_at,
       st ->> 'status' as status, st -> 'reasons' as reasons, (st ->> 'ready')::boolean as ready_for_validation
from public.foods f, lateral public.food_status_of(f) st
union all
select 'supplement', s.id, s.name_it, s.profile_version, s.usable_for_optimization, s.validated_by, s.validated_at,
       st ->> 'status', st -> 'reasons', (st ->> 'ready')::boolean
from public.supplements s, lateral public.supplement_status_of(s) st;
grant select on public.catalog_status to authenticated;

-- un prodotto "da completare" non si attiva per la formulazione (controllo a fine transazione,
-- così un'importazione può aggiornare prima l'anagrafica e poi i valori)
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid in ('public.foods'::regclass, 'public.supplements'::regclass)
            and contype = 'c' and pg_get_constraintdef(oid) ilike '%available_to_formulate%' or
            (conrelid = 'public.supplements'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%usable_for_optimization%')
  loop
    execute format('alter table %s drop constraint %I',
      (select conrelid::regclass from pg_constraint where conname = c limit 1), c);
  end loop;
end $$;
alter table public.supplements add constraint supplements_usable_not_missing check (not usable_for_optimization or status <> 'missing');

create or replace function public.check_activation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  fid text;
  sid text;
begin
  if tg_table_name in ('foods', 'food_nutrients') then
    fid := coalesce(rec ->> 'food_id', rec ->> 'id');
    if exists (select 1 from public.foods f where f.id = fid and f.available_to_formulate and public.food_status_of(f) ->> 'status' = 'to_complete') then
      raise exception 'Alimento % da completare: non può essere attivo per la formulazione', fid;
    end if;
  else
    sid := coalesce(rec ->> 'supplement_id', rec ->> 'id');
    if exists (select 1 from public.supplements s where s.id = sid and s.usable_for_optimization and public.supplement_status_of(s) ->> 'status' = 'to_complete') then
      raise exception 'Integratore % da completare: non può essere attivo per la formulazione', sid;
    end if;
  end if;
  return null;
end $$;
create constraint trigger foods_activation after insert or update on public.foods
  deferrable initially deferred for each row execute function public.check_activation();
create constraint trigger food_nutrients_activation after insert or update or delete on public.food_nutrients
  deferrable initially deferred for each row execute function public.check_activation();
create constraint trigger supplements_activation after insert or update on public.supplements
  deferrable initially deferred for each row execute function public.check_activation();
create constraint trigger supplement_nutrients_activation after insert or update or delete on public.supplement_nutrients
  deferrable initially deferred for each row execute function public.check_activation();

-- amministratore dell'app, oppure accesso diretto al database (SQL Editor / chiave di servizio), che ha già pieni poteri
create or replace function public.is_catalog_admin() returns boolean
language sql stable set search_path = public as $$
  select public.is_admin() or current_user in ('postgres', 'service_role', 'supabase_admin');
$$;
grant execute on function public.is_catalog_admin() to authenticated;

-- ───────────── convalida esplicita ─────────────
create or replace function public.validate_catalog_item(item_kind text, item_id text) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  st jsonb;
  who text := coalesce(nullif(auth.jwt() ->> 'email', ''), auth.uid()::text, current_user);
begin
  if not public.is_catalog_admin() then raise exception 'Solo gli amministratori possono convalidare il catalogo'; end if;
  if item_kind = 'food' then
    select public.food_status_of(f) into st from public.foods f where f.id = item_id;
  elsif item_kind = 'supplement' then
    select public.supplement_status_of(s) into st from public.supplements s where s.id = item_id;
  else
    raise exception 'Tipo % non valido', item_kind;
  end if;
  if st is null then raise exception 'Prodotto % inesistente', item_id; end if;
  if not (st ->> 'ready')::boolean then
    raise exception 'Non convalidabile: %', (select string_agg(r, '; ') from jsonb_array_elements_text(st -> 'reasons') r where r <> 'non ancora convalidato da un amministratore');
  end if;
  perform set_config('app.validating', 'on', true);
  if item_kind = 'food' then
    update public.foods set validated_by = who, validated_at = now() where id = item_id;
  else
    update public.supplements set validated_by = who, validated_at = now() where id = item_id;
  end if;
  perform set_config('app.validating', 'off', true);
  return jsonb_build_object('validated_by', who, 'validated_at', now());
end $$;
grant execute on function public.validate_catalog_item(text, text) to authenticated;

-- ───────────── importazioni ─────────────
create table public.catalog_imports (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid default auth.uid(),
  kind text not null check (kind in ('foods','supplements')),
  file_name text,
  summary jsonb not null,
  products text[] not null,
  created_at timestamptz not null default now()
);
alter table public.catalog_imports enable row level security;
create policy catalog_imports_admin_read on public.catalog_imports for select to authenticated using (public.is_admin());
create policy catalog_imports_admin_insert on public.catalog_imports for insert to authenticated with check (public.is_admin());
grant select, insert on public.catalog_imports to authenticated;

-- Applica un piano già verificato nell'app (src/data/catalogImport.ts). Gira con i permessi di chi chiama (RLS):
-- tutto in una transazione, quindi o entra tutto o niente; i trigger controllano di nuovo unità, null/zero e attivazione,
-- creano una sola nuova versione per prodotto e ne conservano la precedente nello storico.
create or replace function public.admin_import_catalog(payload jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  p jsonb;
  v jsonb;
  ids text[] := '{}';
  kind text := payload ->> 'kind';
begin
  if not public.is_catalog_admin() then raise exception 'Solo gli amministratori possono importare nel catalogo'; end if;
  if kind not in ('foods','supplements') then raise exception 'Tipo di importazione non valido'; end if;
  for p in select * from jsonb_array_elements(coalesce(payload -> 'products', '[]'::jsonb)) loop
    ids := ids || (p ->> 'id');
    if kind = 'foods' then
      insert into public.foods as t (id, name_it, category_id, subcategory_id, species_cut, processing_state, preparation, edible_portion,
                             kcal_me_per_100g, me_method, source_identifier, source_version, data_status, uncertainty, notes, available_to_formulate, profile_changed_at)
      values (p ->> 'id', p ->> 'name_it', p ->> 'category_id', p ->> 'subcategory_id', p ->> 'species_cut', p ->> 'processing_state', p ->> 'preparation',
              p ->> 'edible_portion', (p ->> 'kcal_me_per_100g')::numeric, p ->> 'me_method', p ->> 'source_identifier', p ->> 'source_version',
              coalesce(p ->> 'data_status', 'unverified'), p ->> 'uncertainty', p ->> 'notes', false, now())
      on conflict (id) do update set
        name_it = excluded.name_it, category_id = excluded.category_id, subcategory_id = excluded.subcategory_id, species_cut = excluded.species_cut,
        processing_state = excluded.processing_state, preparation = excluded.preparation, edible_portion = excluded.edible_portion,
        kcal_me_per_100g = excluded.kcal_me_per_100g, me_method = excluded.me_method, source_identifier = excluded.source_identifier,
        source_version = excluded.source_version, data_status = excluded.data_status, uncertainty = excluded.uncertainty, notes = excluded.notes,
        available_to_formulate = t.available_to_formulate and coalesce((p ->> 'available_to_formulate')::boolean, true);
    else
      insert into public.supplements as t (id, name_it, brand, product_variant, class, dose_unit, mass_per_unit_g, kcal_per_unit, integer_dose, max_daily_units,
                                   max_daily_source, label_source, label_added_only, product_version, status, notes, usable_for_optimization, profile_changed_at)
      values (p ->> 'id', p ->> 'name_it', p ->> 'brand', p ->> 'product_variant', p ->> 'class', p ->> 'dose_unit', (p ->> 'mass_per_unit_g')::numeric,
              (p ->> 'kcal_per_unit')::numeric, coalesce((p ->> 'integer_dose')::boolean, false), (p ->> 'max_daily_units')::numeric, p ->> 'max_daily_source',
              p ->> 'label_source', coalesce((p ->> 'label_added_only')::boolean, false), p ->> 'product_version', coalesce(p ->> 'status', 'missing'), p ->> 'notes', false, now())
      on conflict (id) do update set
        name_it = excluded.name_it, brand = excluded.brand, product_variant = excluded.product_variant, class = excluded.class, dose_unit = excluded.dose_unit,
        mass_per_unit_g = excluded.mass_per_unit_g, kcal_per_unit = excluded.kcal_per_unit, integer_dose = excluded.integer_dose,
        max_daily_units = excluded.max_daily_units, max_daily_source = excluded.max_daily_source, label_source = excluded.label_source,
        label_added_only = excluded.label_added_only, product_version = excluded.product_version, status = excluded.status, notes = excluded.notes,
        usable_for_optimization = t.usable_for_optimization and coalesce((p ->> 'usable_for_optimization')::boolean, true);
    end if;
  end loop;
  for v in select * from jsonb_array_elements(coalesce(payload -> 'values', '[]'::jsonb)) loop
    if not ((v ->> 'product_id') = any(ids)) then raise exception 'Valore per un prodotto non incluso nell''importazione: %', v ->> 'product_id'; end if;
    if kind = 'foods' then
      insert into public.food_nutrients (food_id, nutrient_id, amount_per_100g, unit, value_status, source_value, source_unit, source_basis, conversion_rule, source_id, method)
      values (v ->> 'product_id', v ->> 'nutrient_id', (v ->> 'amount')::numeric, v ->> 'unit', v ->> 'value_status', (v ->> 'source_value')::numeric,
              v ->> 'source_unit', v ->> 'source_basis', v ->> 'conversion_rule', v ->> 'source_id', v ->> 'method')
      on conflict (food_id, nutrient_id) do update set
        amount_per_100g = excluded.amount_per_100g, unit = excluded.unit, value_status = excluded.value_status, source_value = excluded.source_value,
        source_unit = excluded.source_unit, source_basis = excluded.source_basis, conversion_rule = excluded.conversion_rule, source_id = excluded.source_id,
        method = excluded.method, verified_by = null, verified_at = null;
    else
      insert into public.supplement_nutrients (supplement_id, nutrient_id, amount_per_unit, unit, value_status, declared_total_or_added, source_value, source_unit, conversion_rule, source_id)
      values (v ->> 'product_id', v ->> 'nutrient_id', (v ->> 'amount')::numeric, v ->> 'unit', v ->> 'value_status', v ->> 'declared_total_or_added',
              (v ->> 'source_value')::numeric, v ->> 'source_unit', v ->> 'conversion_rule', v ->> 'source_id')
      on conflict (supplement_id, nutrient_id) do update set
        amount_per_unit = excluded.amount_per_unit, unit = excluded.unit, value_status = excluded.value_status,
        declared_total_or_added = excluded.declared_total_or_added, source_value = excluded.source_value, source_unit = excluded.source_unit,
        conversion_rule = excluded.conversion_rule, source_id = excluded.source_id, verified_by = null, verified_at = null;
    end if;
  end loop;
  -- un prodotto che torna "da completare" non resta attivo
  if kind = 'foods' then
    update public.foods f set available_to_formulate = false where f.id = any(ids) and f.available_to_formulate and public.food_status_of(f) ->> 'status' = 'to_complete';
  else
    update public.supplements s set usable_for_optimization = false where s.id = any(ids) and s.usable_for_optimization and public.supplement_status_of(s) ->> 'status' = 'to_complete';
  end if;
  insert into public.catalog_imports(kind, file_name, summary, products) values (kind, payload ->> 'file_name', coalesce(payload -> 'summary', '{}'::jsonb), ids);
  return jsonb_build_object('products', cardinality(ids), 'values', jsonb_array_length(coalesce(payload -> 'values', '[]'::jsonb)));
end $$;
grant execute on function public.admin_import_catalog(jsonb) to authenticated;
