-- Schema definitivo dell'importazione (nutrizionista, 19/10/2026).
-- - URL della fonte in un campo dedicato (alimenti e integratori): reimportare dati identici non crea versioni;
-- - integratori: massa del CONTENUTO per unità (mass_per_unit_g) distinta dalla massa LORDA con involucro;
-- - integratori: qualità e provenienza dei dati del profilo (data_status), distinta da utilizzabilità, completezza e convalida;
-- - valori degli integratori: base quantitativa originale (source_basis) conservata con la conversione applicata.

alter table public.foods add column if not exists source_url text;
alter table public.supplements
  add column if not exists source_url text,
  add column if not exists gross_mass_per_unit_g numeric check (gross_mass_per_unit_g is null or gross_mass_per_unit_g > 0),
  add column if not exists data_status text check (data_status is null or data_status in ('unverified','estimated','review_required'));
alter table public.supplement_nutrients add column if not exists source_basis text;
comment on column public.supplements.mass_per_unit_g is 'massa del contenuto di una unità di dose (es. olio nella capsula), g';
comment on column public.supplements.gross_mass_per_unit_g is 'massa complessiva di una unità con involucro (capsula intera), g; null se non documentata';

create or replace function public.on_food_profile_update() returns trigger
language plpgsql as $$
begin
  if (old.kcal_me_per_100g, old.processing_state, old.edible_portion, old.source_identifier, old.source_version, old.data_status, old.me_method, old.source_url)
     is distinct from (new.kcal_me_per_100g, new.processing_state, new.edible_portion, new.source_identifier, new.source_version, new.data_status, new.me_method, new.source_url) then
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
  if (old.dose_unit, old.mass_per_unit_g, old.kcal_per_unit, old.max_daily_units, old.product_version, old.status, old.label_source, old.label_added_only, old.dose_guide, old.gross_mass_per_unit_g, old.source_url, old.data_status)
     is distinct from (new.dose_unit, new.mass_per_unit_g, new.kcal_per_unit, new.max_daily_units, new.product_version, new.status, new.label_source, new.label_added_only, new.dose_guide, new.gross_mass_per_unit_g, new.source_url, new.data_status) then
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


create or replace function public.food_status_of(f public.foods) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  reasons text[] := '{}';
  hard text[] := '{}';
  n_missing integer;
  n_est integer;
  n_nosrc integer;
  ready boolean;
  me numeric := public.food_me(f);
begin
  if me is null then
    if f.processing_state = 'raw_or_unspecified' then hard := hard || 'energia metabolizzabile (stato crudo/cotto non indicato: non si calcola)'::text;
    elsif (public.food_energy_method(f)).id is null then hard := hard || 'energia metabolizzabile (nessun metodo energetico per questa tipologia)'::text;
    elsif not food_has(f.id, 'carbohydrate_available') then hard := hard || 'energia metabolizzabile (servono i carboidrati disponibili)'::text;
    else hard := hard || 'energia metabolizzabile'::text;
    end if;
  end if;
  if not food_has(f.id, 'protein') then hard := hard || 'proteine'::text; end if;
  if not food_has(f.id, 'fat') then hard := hard || 'grassi'::text; end if;
  select count(*) into n_missing from nutrients n where n.kind in ('core','advanced') and not food_has(f.id, n.id);
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
  -- l'EM calcolata ha il proprio metodo; quella inserita deve dire come è stata ottenuta
  if f.kcal_me_per_100g is not null and nullif(trim(f.me_method), '') is null then reasons := reasons || 'metodo di calcolo dell’energia non indicato'::text; end if;
  if nullif(trim(f.source_identifier), '') is null then reasons := reasons || 'fonte del profilo non indicata'::text; end if;
  if nullif(trim(f.source_version), '') is null then reasons := reasons || 'versione della fonte non indicata'::text; end if;
  if f.processing_state = 'raw_or_unspecified' then reasons := reasons || 'stato crudo/cotto non specificato'::text; end if;
  if nullif(trim(f.edible_portion), '') is null then reasons := reasons || 'parte edibile non indicata'::text; end if;
  if f.data_status = 'estimated' then reasons := reasons || 'profilo dichiarato come stima'::text; end if;
  if f.data_status = 'review_required' then reasons := reasons || 'profilo segnalato da rivedere'::text; end if;
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
  if s.dose_unit not in ('g','ml') and s.mass_per_unit_g is null then reasons := reasons || 'massa del contenuto della singola unità non indicata'::text; end if;
  if s.data_status = 'estimated' then reasons := reasons || 'profilo dichiarato come stima'::text; end if;
  if s.data_status = 'review_required' then reasons := reasons || 'profilo segnalato da rivedere'::text; end if;
  -- energia non dichiarata e «solo additivi aggiunti»: informazioni, non motivi (si verificano i dati dichiarati)
  if n_basis > 0 then reasons := reasons || 'base quantitativa degli additivi da confermare (es. «per kg»)'::text; end if;
  if nullif(trim(s.product_version), '') is null then reasons := reasons || 'variante/lotto o versione del prodotto non indicati'::text; end if;
  ready := coalesce(array_length(reasons, 1), 0) = 0;
  if s.validated_at is null and s.status <> 'test_fixture' then reasons := reasons || 'non ancora convalidato da un amministratore'::text; end if;
  return jsonb_build_object('status', case when coalesce(array_length(reasons, 1), 0) = 0 then 'verified' else 'partial' end,
                            'reasons', to_jsonb(reasons), 'ready', ready);
end $$;


-- importazione: URL della fonte, massa lorda, qualità dei dati degli integratori, base quantitativa dei valori
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
