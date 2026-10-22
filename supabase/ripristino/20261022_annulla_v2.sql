-- RIPRISTINO della specifica v2 (da usare SOLO se dopo l'aggiornamento del 22/10 qualcosa non va).
-- Annulla, in quest'ordine: 02_qdiet_b5.sql, 01_catalogo_v2.sql, migrazione 20261025000011.
-- ATTENZIONE: elimina il diario registrato con l'account (tabella diary_entries). Fare prima il backup.
-- Cani, ricette, versioni, prezzi e il resto del catalogo non vengono toccati.
-- Supabase → SQL Editor → eseguire tutto insieme: è un'unica transazione (o tutto o niente).
begin;

-- 1. 02_qdiet_b5.sql: la B5 del QDiet torna sconosciuta (il profilo precedente resta nello storico)
delete from public.supplement_nutrients where supplement_id = 'qdiet' and nutrient_id = 'vitamin_b5';

-- 2. 01_catalogo_v2.sql: voci nuove solo se non usate da ricette o prezzi
delete from public.foods f where f.id in ('onion','garlic','grapes_raisins','xylitol','chocolate','macadamia','olive_oil')
  and not exists (select 1 from public.food_nutrients n where n.food_id = f.id)
  and not exists (select 1 from public.user_prices p where p.product_kind = 'food' and p.product_id = f.id);
delete from public.supplements s where s.id in ('eggshell_powder','fish_oil','iodine_alga','vitamin_e_supplement')
  and not exists (select 1 from public.supplement_nutrients n where n.supplement_id = s.id)
  and not exists (select 1 from public.user_prices p where p.product_kind = 'supplement' and p.product_id = s.id);
delete from public.unit_conversions where id = 'calcium_d_pantothenate';
delete from public.food_categories c where c.id = 'other_generic' and not exists (select 1 from public.foods f where f.subcategory_id = c.id);

-- 3. migrazione 11: diario, regole delle ricette e importazione come prima, campi v2 del catalogo
drop table if exists public.diary_entries;
drop function if exists public.check_diary_rules();
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
  if tg_op = 'INSERT' or new.dog_id <> old.dog_id then
    select count(*) into n from public.recipes where dog_id = new.dog_id;
    if n >= 10 then
      raise exception 'Limite raggiunto: al massimo 10 ricette salvate per cane' using errcode = 'P0010';
    end if;
  end if;
  return new;
end $$;

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
                             kcal_me_per_100g, me_method, source_identifier, source_url, source_version, data_status, uncertainty, notes, available_to_formulate, profile_changed_at)
      values (p ->> 'id', p ->> 'name_it', p ->> 'category_id', p ->> 'subcategory_id', p ->> 'species_cut', p ->> 'processing_state', p ->> 'preparation',
              p ->> 'edible_portion', (p ->> 'kcal_me_per_100g')::numeric, p ->> 'me_method', p ->> 'source_identifier', p ->> 'source_url', p ->> 'source_version',
              coalesce(p ->> 'data_status', 'unverified'), p ->> 'uncertainty', p ->> 'notes', coalesce((p ->> 'available_to_formulate')::boolean, false), now())
      on conflict (id) do update set
        name_it = excluded.name_it, category_id = excluded.category_id, subcategory_id = excluded.subcategory_id, species_cut = excluded.species_cut,
        processing_state = excluded.processing_state, preparation = excluded.preparation, edible_portion = excluded.edible_portion,
        kcal_me_per_100g = excluded.kcal_me_per_100g, me_method = excluded.me_method, source_identifier = excluded.source_identifier, source_url = excluded.source_url,
        source_version = excluded.source_version, data_status = excluded.data_status, uncertainty = excluded.uncertainty, notes = excluded.notes,
        available_to_formulate = coalesce((p ->> 'available_to_formulate')::boolean, t.available_to_formulate);
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

alter table public.foods drop constraint if exists foods_forbidden_not_available;
alter table public.foods drop constraint if exists foods_prepared_yield_source;
alter table public.foods
  drop column if exists max_fresh_weight_pct,
  drop column if exists max_g_per_1000_kcal,
  drop column if exists forbidden,
  drop column if exists preparation_warning,
  drop column if exists prepared_yield,
  drop column if exists prepared_yield_source;

commit;
