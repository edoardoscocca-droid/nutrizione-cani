-- 1) Met+Cys e Phe+Tyr: un valore composto conta come presente anche se ci sono entrambe le parti (allegato F).
-- 2) Capsule/compresse: il peso della singola unità non è necessario per i nutrienti (dichiarati per unità);
--    se manca, il prodotto è «dati parziali» invece che «da completare».

create or replace function public.compound_parts(nid text) returns text[]
language sql immutable as $$
  select case nid
    when 'epa_dha' then array['epa','dha']
    when 'methionine_cystine' then array['methionine','cystine']
    when 'phenylalanine_tyrosine' then array['phenylalanine','tyrosine']
  end
$$;

create or replace function public.food_has(fid text, nid text) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from food_nutrients where food_id = fid and nutrient_id = nid and amount_per_100g is not null)
      or (compound_parts(nid) is not null
          and (select count(*) from food_nutrients where food_id = fid and nutrient_id = any(compound_parts(nid)) and amount_per_100g is not null) = 2)
$$;

create or replace function public.supplement_has(sid text, nid text) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from supplement_nutrients where supplement_id = sid and nutrient_id = nid and amount_per_unit is not null)
      or (compound_parts(nid) is not null
          and (select count(*) from supplement_nutrients where supplement_id = sid and nutrient_id = any(compound_parts(nid)) and amount_per_unit is not null) = 2)
$$;

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
  select count(*) into n_missing from nutrients n where n.kind in ('core','advanced') and not supplement_has(s.id, n.id);
  if n_declared = 0 then hard := hard || 'composizione per dose'::text; end if;
  if nullif(trim(s.label_source), '') is null then hard := hard || 'etichetta o scheda tecnica'::text; end if;
  if n_missing > 0 then reasons := reasons || format('%s nutrienti richiesti senza valore', n_missing); end if;
  if n_est > 0 then reasons := reasons || format('%s valori stimati o di qualità non dichiarata', n_est); end if;
  if n_nosrc > 0 then reasons := reasons || format('%s valori senza fonte', n_nosrc); end if;
  if coalesce(array_length(hard, 1), 0) > 0 then
    return jsonb_build_object('status', 'to_complete', 'reasons', to_jsonb(array['mancano: ' || array_to_string(hard, ', ')] || reasons), 'ready', false);
  end if;
  if s.dose_unit not in ('g','ml') and s.mass_per_unit_g is null then reasons := reasons || 'peso della singola unità non indicato'::text; end if;
  if s.kcal_per_unit is null then reasons := reasons || 'energia per dose non indicata'::text; end if;
  if nullif(trim(s.product_version), '') is null then reasons := reasons || 'variante/lotto o versione del prodotto non indicati'::text; end if;
  if s.label_added_only then reasons := reasons || 'l’etichetta dichiara solo le quantità aggiunte: non è un’analisi completa'::text; end if;
  ready := coalesce(array_length(reasons, 1), 0) = 0;
  if s.validated_at is null and s.status <> 'test_fixture' then reasons := reasons || 'non ancora convalidato da un amministratore'::text; end if;
  return jsonb_build_object('status', case when coalesce(array_length(reasons, 1), 0) = 0 then 'verified' else 'partial' end,
                            'reasons', to_jsonb(reasons), 'ready', ready);
end $$;
