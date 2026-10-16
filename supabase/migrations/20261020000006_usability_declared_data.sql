-- Decisioni della nutrizionista (seconda revisione):
--  · utilizzabilità ≠ qualità dei dati ≠ verifica della ricetta: un prodotto con dati parziali o stimati si può attivare;
--    l'importazione applica l'attivazione indicata nel file (mai per un prodotto «da completare», controllo a fine transazione);
--  · integratori: si verificano i DATI DICHIARATI; energia non dichiarata ed etichetta con soli additivi non impediscono
--    la verifica; i valori con base da confermare (es. «per kg») restano «dati parziali»;
--  · stato «cotto al vapore»; forma chimica, metodo e unità originali conservati per ogni valore.
-- Le stesse regole sono in src/engine/catalogStatus.ts e src/data/catalogImport.ts.

alter table public.foods drop constraint if exists foods_processing_state_check;
alter table public.foods add constraint foods_processing_state_check
  check (processing_state in ('raw','cooked_boiled','cooked_steamed','cooked_baked','cooked_other','dried','canned','raw_or_unspecified'));

create or replace function public.processing_group(state text) returns text
language sql immutable as $$
  select case
    when state = 'raw' then 'raw'
    when state in ('cooked_boiled','cooked_steamed','cooked_baked','cooked_other','canned') then 'cooked'
    when state = 'dried' then 'any'
  end
$$;

alter table public.food_nutrients add column if not exists chemical_form text;
alter table public.supplement_nutrients add column if not exists chemical_form text, add column if not exists method text;

create or replace function public.supplement_status_of(s public.supplements) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  reasons text[] := '{}';
  hard text[] := '{}';
  n_declared integer;
  n_est integer;
  n_nosrc integer;
  n_basis integer;
  ready boolean;
begin
  select count(*),
         count(*) filter (where value_status not in ('measured','label','calculated','analytical_zero')),
         count(*) filter (where nullif(trim(source_id), '') is null),
         count(*) filter (where coalesce(method, '') like '%PER_KG_ASSUMED_CONFIRM%')
    into n_declared, n_est, n_nosrc, n_basis
    from supplement_nutrients where supplement_id = s.id and amount_per_unit is not null;
  if n_declared = 0 then hard := hard || 'composizione per dose'::text; end if;
  if nullif(trim(s.label_source), '') is null then hard := hard || 'etichetta o scheda tecnica'::text; end if;
  if n_est > 0 then reasons := reasons || format('%s valori stimati o di qualità non dichiarata', n_est); end if;
  if n_nosrc > 0 then reasons := reasons || format('%s valori senza fonte', n_nosrc); end if;
  if coalesce(array_length(hard, 1), 0) > 0 then
    return jsonb_build_object('status', 'to_complete', 'reasons', to_jsonb(array['mancano: ' || array_to_string(hard, ', ')] || reasons), 'ready', false);
  end if;
  if s.dose_unit not in ('g','ml') and s.mass_per_unit_g is null then reasons := reasons || 'peso della singola unità non indicato'::text; end if;
  -- energia non dichiarata e «solo additivi aggiunti»: informazioni, non motivi (si verificano i dati dichiarati)
  if n_basis > 0 then reasons := reasons || 'base quantitativa degli additivi da confermare (es. «per kg»)'::text; end if;
  if nullif(trim(s.product_version), '') is null then reasons := reasons || 'variante/lotto o versione del prodotto non indicati'::text; end if;
  ready := coalesce(array_length(reasons, 1), 0) = 0;
  if s.validated_at is null and s.status <> 'test_fixture' then reasons := reasons || 'non ancora convalidato da un amministratore'::text; end if;
  return jsonb_build_object('status', case when coalesce(array_length(reasons, 1), 0) = 0 then 'verified' else 'partial' end,
                            'reasons', to_jsonb(reasons), 'ready', ready);
end $$;

-- importazione: applica l'attivazione indicata nel file e conserva forma chimica e metodo dei valori
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
                                   max_daily_source, label_source, label_added_only, product_version, status, notes, usable_for_optimization, profile_changed_at)
      values (p ->> 'id', p ->> 'name_it', p ->> 'brand', p ->> 'product_variant', p ->> 'class', p ->> 'dose_unit', (p ->> 'mass_per_unit_g')::numeric,
              (p ->> 'kcal_per_unit')::numeric, coalesce((p ->> 'integer_dose')::boolean, false), (p ->> 'max_daily_units')::numeric, p ->> 'max_daily_source',
              p ->> 'label_source', coalesce((p ->> 'label_added_only')::boolean, false), p ->> 'product_version', coalesce(p ->> 'status', 'missing'), p ->> 'notes', coalesce((p ->> 'usable_for_optimization')::boolean, false), now())
      on conflict (id) do update set
        name_it = excluded.name_it, brand = excluded.brand, product_variant = excluded.product_variant, class = excluded.class, dose_unit = excluded.dose_unit,
        mass_per_unit_g = excluded.mass_per_unit_g, kcal_per_unit = excluded.kcal_per_unit, integer_dose = excluded.integer_dose,
        max_daily_units = excluded.max_daily_units, max_daily_source = excluded.max_daily_source, label_source = excluded.label_source,
        label_added_only = excluded.label_added_only, product_version = excluded.product_version, status = excluded.status, notes = excluded.notes,
        usable_for_optimization = coalesce((p ->> 'usable_for_optimization')::boolean, t.usable_for_optimization);
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
