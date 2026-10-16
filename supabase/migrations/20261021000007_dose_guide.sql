-- Q.Diet Compensa standard (decisione della nutrizionista del 17/10/2026): tabella d'impiego del produttore per peso del cane.
-- Intervalli consigliati, non limiti tossicologici: nel calcolo il minimo è una preferenza, il massimo non si supera in automatico.
-- Formato: {"points": [{"weightKg": 5, "min": 1, "max": 1.5}, …], "source": "…", "note": "…"} nell'unità di dose del prodotto.

alter table public.supplements add column if not exists dose_guide jsonb;

-- una nuova tabella d'impiego è una nuova versione del profilo (le ricette vengono segnalate da ricalcolare)
create or replace function public.on_supplement_profile_update() returns trigger
language plpgsql as $$
begin
  if (old.dose_unit, old.mass_per_unit_g, old.kcal_per_unit, old.max_daily_units, old.product_version, old.status, old.label_source, old.label_added_only, old.dose_guide)
     is distinct from (new.dose_unit, new.mass_per_unit_g, new.kcal_per_unit, new.max_daily_units, new.product_version, new.status, new.label_source, new.label_added_only, new.dose_guide) then
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

-- importazione: anche la tabella d'impiego
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
              coalesce(p ->> 'data_status', 'unverified'), p ->> 'uncertainty', p ->> 'notes', coalesce((p ->> 'available_to_formulate')::boolean, false), now())
      on conflict (id) do update set
        name_it = excluded.name_it, category_id = excluded.category_id, subcategory_id = excluded.subcategory_id, species_cut = excluded.species_cut,
        processing_state = excluded.processing_state, preparation = excluded.preparation, edible_portion = excluded.edible_portion,
        kcal_me_per_100g = excluded.kcal_me_per_100g, me_method = excluded.me_method, source_identifier = excluded.source_identifier,
        source_version = excluded.source_version, data_status = excluded.data_status, uncertainty = excluded.uncertainty, notes = excluded.notes,
        available_to_formulate = coalesce((p ->> 'available_to_formulate')::boolean, t.available_to_formulate);
    else
      insert into public.supplements as t (id, name_it, brand, product_variant, class, dose_unit, mass_per_unit_g, kcal_per_unit, integer_dose, max_daily_units,
                                   max_daily_source, label_source, label_added_only, product_version, status, notes, usable_for_optimization, dose_guide, profile_changed_at)
      values (p ->> 'id', p ->> 'name_it', p ->> 'brand', p ->> 'product_variant', p ->> 'class', p ->> 'dose_unit', (p ->> 'mass_per_unit_g')::numeric,
              (p ->> 'kcal_per_unit')::numeric, coalesce((p ->> 'integer_dose')::boolean, false), (p ->> 'max_daily_units')::numeric, p ->> 'max_daily_source',
              p ->> 'label_source', coalesce((p ->> 'label_added_only')::boolean, false), p ->> 'product_version', coalesce(p ->> 'status', 'missing'), p ->> 'notes', coalesce((p ->> 'usable_for_optimization')::boolean, false), p -> 'dose_guide', now())
      on conflict (id) do update set
        name_it = excluded.name_it, brand = excluded.brand, product_variant = excluded.product_variant, class = excluded.class, dose_unit = excluded.dose_unit,
        mass_per_unit_g = excluded.mass_per_unit_g, kcal_per_unit = excluded.kcal_per_unit, integer_dose = excluded.integer_dose,
        max_daily_units = excluded.max_daily_units, max_daily_source = excluded.max_daily_source, label_source = excluded.label_source,
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
      insert into public.supplement_nutrients (supplement_id, nutrient_id, amount_per_unit, unit, value_status, declared_total_or_added, source_value, source_unit, conversion_rule, source_id, method, chemical_form)
      values (v ->> 'product_id', v ->> 'nutrient_id', (v ->> 'amount')::numeric, v ->> 'unit', v ->> 'value_status', v ->> 'declared_total_or_added',
              (v ->> 'source_value')::numeric, v ->> 'source_unit', v ->> 'conversion_rule', v ->> 'source_id', v ->> 'method', v ->> 'chemical_form')
      on conflict (supplement_id, nutrient_id) do update set
        amount_per_unit = excluded.amount_per_unit, unit = excluded.unit, value_status = excluded.value_status,
        declared_total_or_added = excluded.declared_total_or_added, source_value = excluded.source_value, source_unit = excluded.source_unit,
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
