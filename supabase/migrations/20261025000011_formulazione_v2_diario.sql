-- Specifica v2 del 21/10/2026: campi del catalogo per la formulazione a gruppi, limite di 200 ricette per cane
-- (le archiviate non contano) e diario con una ricetta al giorno. Nessun dato esistente viene modificato.
-- Dopo questa migrazione eseguire supabase/data/2026-10-21/01_catalogo_v2.sql e 02_qdiet_b5.sql.

-- ───────────── Catalogo: tetti di quantità, alimenti vietati, avvertenze (§9) ─────────────
alter table public.foods
  add column if not exists max_fresh_weight_pct numeric check (max_fresh_weight_pct > 0 and max_fresh_weight_pct <= 100),
  add column if not exists max_g_per_1000_kcal numeric check (max_g_per_1000_kcal > 0),
  add column if not exists forbidden boolean not null default false,
  add column if not exists preparation_warning text,
  -- resa di preparazione documentata (g pronti per 1 g pesato), con fonte obbligatoria: serve ai tetti in % del peso
  add column if not exists prepared_yield numeric check (prepared_yield > 0 and prepared_yield <= 10),
  add column if not exists prepared_yield_source text;
alter table public.foods add constraint foods_prepared_yield_source check (prepared_yield is null or coalesce(prepared_yield_source, '') <> '');
-- un alimento vietato non è mai utilizzabile nel calcolo
alter table public.foods add constraint foods_forbidden_not_available check (not (forbidden and available_to_formulate));

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
                             kcal_me_per_100g, me_method, source_identifier, source_url, source_version, data_status, uncertainty, notes, available_to_formulate, profile_changed_at,
                             max_fresh_weight_pct, max_g_per_1000_kcal, forbidden, preparation_warning, prepared_yield, prepared_yield_source)
      values (p ->> 'id', p ->> 'name_it', p ->> 'category_id', p ->> 'subcategory_id', p ->> 'species_cut', p ->> 'processing_state', p ->> 'preparation',
              p ->> 'edible_portion', (p ->> 'kcal_me_per_100g')::numeric, p ->> 'me_method', p ->> 'source_identifier', p ->> 'source_url', p ->> 'source_version',
              coalesce(p ->> 'data_status', 'unverified'), p ->> 'uncertainty', p ->> 'notes', coalesce((p ->> 'available_to_formulate')::boolean, false) and not coalesce((p ->> 'forbidden')::boolean, false), now(),
              (p ->> 'max_fresh_weight_pct')::numeric, (p ->> 'max_g_per_1000_kcal')::numeric, coalesce((p ->> 'forbidden')::boolean, false), p ->> 'preparation_warning',
              (p ->> 'prepared_yield')::numeric, p ->> 'prepared_yield_source')
      on conflict (id) do update set
        name_it = excluded.name_it, category_id = excluded.category_id, subcategory_id = excluded.subcategory_id, species_cut = excluded.species_cut,
        processing_state = excluded.processing_state, preparation = excluded.preparation, edible_portion = excluded.edible_portion,
        kcal_me_per_100g = excluded.kcal_me_per_100g, me_method = excluded.me_method, source_identifier = excluded.source_identifier, source_url = excluded.source_url,
        source_version = excluded.source_version, data_status = excluded.data_status, uncertainty = excluded.uncertainty, notes = excluded.notes,
        available_to_formulate = coalesce((p ->> 'available_to_formulate')::boolean, t.available_to_formulate) and not excluded.forbidden,
        max_fresh_weight_pct = excluded.max_fresh_weight_pct, max_g_per_1000_kcal = excluded.max_g_per_1000_kcal,
        forbidden = excluded.forbidden, preparation_warning = excluded.preparation_warning,
        prepared_yield = excluded.prepared_yield, prepared_yield_source = excluded.prepared_yield_source;
    else
      insert into public.supplements as t (id, name_it, brand, product_variant, class, dose_unit, mass_per_unit_g, gross_mass_per_unit_g, kcal_per_unit, integer_dose, max_daily_units,
                                   max_daily_source, label_source, source_url, data_status, label_added_only, product_version, status, notes, usable_for_optimization, dose_guide, profile_changed_at)
      values (p ->> 'id', p ->> 'name_it', p ->> 'brand', p ->> 'product_variant', p ->> 'class', p ->> 'dose_unit', (p ->> 'mass_per_unit_g')::numeric,
              (p ->> 'gross_mass_per_unit_g')::numeric, (p ->> 'kcal_per_unit')::numeric, coalesce((p ->> 'integer_dose')::boolean, false), (p ->> 'max_daily_units')::numeric, p ->> 'max_daily_source',
              p ->> 'label_source', p ->> 'source_url', p ->> 'data_status', coalesce((p ->> 'label_added_only')::boolean, false), p ->> 'product_version', coalesce(p ->> 'status', 'missing'), p ->> 'notes', coalesce((p ->> 'usable_for_optimization')::boolean, false), p -> 'dose_guide', now())
      on conflict (id) do update set
        name_it = excluded.name_it, brand = excluded.brand, product_variant = excluded.product_variant, class = excluded.class, dose_unit = excluded.dose_unit,
        mass_per_unit_g = excluded.mass_per_unit_g, gross_mass_per_unit_g = excluded.gross_mass_per_unit_g, kcal_per_unit = excluded.kcal_per_unit, integer_dose = excluded.integer_dose,
        max_daily_units = excluded.max_daily_units, max_daily_source = excluded.max_daily_source, label_source = excluded.label_source, source_url = excluded.source_url, data_status = excluded.data_status,
        label_added_only = excluded.label_added_only, product_version = excluded.product_version, status = excluded.status, notes = excluded.notes,
        usable_for_optimization = coalesce((p ->> 'usable_for_optimization')::boolean, t.usable_for_optimization),
        dose_guide = excluded.dose_guide;
    end if;
  end loop;
  for v in select * from jsonb_array_elements(coalesce(payload -> 'values', '[]'::jsonb)) loop
    if not ((v ->> 'product_id') = any(ids)) then raise exception 'Valore per un prodotto non incluso nell''importazione: %', v ->> 'product_id'; end if;
    if kind = 'foods' then
      insert into public.food_nutrients (food_id, nutrient_id, amount_per_100g, unit, value_status, source_value, source_unit, source_basis, conversion_rule, source_id, method, chemical_form)
      values (v ->> 'product_id', v ->> 'nutrient_id', (v ->> 'amount')::numeric, v ->> 'unit', v ->> 'value_status', (v ->> 'source_value')::numeric,
              v ->> 'source_unit', v ->> 'source_basis', v ->> 'conversion_rule', v ->> 'source_id', v ->> 'method', v ->> 'chemical_form')
      on conflict (food_id, nutrient_id) do update set
        amount_per_100g = excluded.amount_per_100g, unit = excluded.unit, value_status = excluded.value_status, source_value = excluded.source_value,
        source_unit = excluded.source_unit, source_basis = excluded.source_basis, conversion_rule = excluded.conversion_rule, source_id = excluded.source_id,
        method = excluded.method, chemical_form = excluded.chemical_form, verified_by = null, verified_at = null;
    else
      insert into public.supplement_nutrients (supplement_id, nutrient_id, amount_per_unit, unit, value_status, declared_total_or_added, source_value, source_unit, source_basis, conversion_rule, source_id, method, chemical_form)
      values (v ->> 'product_id', v ->> 'nutrient_id', (v ->> 'amount')::numeric, v ->> 'unit', v ->> 'value_status', v ->> 'declared_total_or_added',
              (v ->> 'source_value')::numeric, v ->> 'source_unit', v ->> 'source_basis', v ->> 'conversion_rule', v ->> 'source_id', v ->> 'method', v ->> 'chemical_form')
      on conflict (supplement_id, nutrient_id) do update set
        amount_per_unit = excluded.amount_per_unit, unit = excluded.unit, value_status = excluded.value_status,
        declared_total_or_added = excluded.declared_total_or_added, source_value = excluded.source_value, source_unit = excluded.source_unit, source_basis = excluded.source_basis,
        conversion_rule = excluded.conversion_rule, source_id = excluded.source_id, method = excluded.method, chemical_form = excluded.chemical_form,
        verified_by = null, verified_at = null;
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

-- ───────────── Ricette: massimo 200 per cane [PROPOSTA], le archiviate non contano (§8) ─────────────
create or replace function public.check_recipe_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dog_owner uuid;
  n integer;
begin
  select owner_id into dog_owner from public.dogs where id = new.dog_id for update;
  if dog_owner is null or dog_owner <> new.owner_id then
    raise exception 'La ricetta deve appartenere al proprietario del cane';
  end if;
  -- si conta solo chi diventa attivo: nuova ricetta, cambio di cane, ripristino dall'archivio
  if not new.archived and (tg_op = 'INSERT' or new.dog_id <> old.dog_id or old.archived) then
    select count(*) into n from public.recipes where dog_id = new.dog_id and not archived and id <> new.id;
    if n >= 200 then
      raise exception 'Limite raggiunto: al massimo 200 ricette salvate per cane (le archiviate non contano)' using errcode = 'P0010';
    end if;
  end if;
  return new;
end $$;

-- ───────────── Diario: una ricetta (razione giornaliera intera) per cane e per data (§7, precisazione 1) ─────────────
create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  date date not null,
  -- la ricetta può essere eliminata: il giorno registrato resta con il suo profilo congelato
  recipe_id uuid references public.recipes(id) on delete set null,
  version_id uuid references public.recipe_versions(id) on delete set null,
  recipe_name text not null,
  revision integer not null,
  -- apporti della versione registrata (istantanea): kcal, nutrienti noti, parti sconosciute, avvisi di livello A
  day jsonb not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dog_id, date)
);
create index on public.diary_entries(owner_id, dog_id, date);

create or replace function public.check_diary_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dog_owner uuid;
begin
  select owner_id into dog_owner from public.dogs where id = new.dog_id;
  if dog_owner is null or dog_owner <> new.owner_id then
    raise exception 'Il giorno del diario deve appartenere al proprietario del cane';
  end if;
  if new.recipe_id is not null and not exists (select 1 from public.recipes r where r.id = new.recipe_id and r.dog_id = new.dog_id) then
    raise exception 'La ricetta registrata non appartiene a questo cane';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger diary_rules before insert or update on public.diary_entries
  for each row execute function public.check_diary_rules();

alter table public.diary_entries enable row level security;
create policy diary_own on public.diary_entries for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on public.diary_entries to authenticated;
