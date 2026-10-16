-- Decisioni della nutrizionista del 16/10/2026:
--  D4  energia: metodi energetici versionati (FEDIAF 2025, 4/9/4 per gli ingredienti naturali) associati alla
--      tipologia di alimento e allo stato di preparazione; l'EM si calcola dai macronutrienti se non è inserita.
--  D19 conversioni approvate tra unità (vitamina D 1 µg = 40 UI; vitamina E per forma chimica).
--  D20 integratori: vale la composizione dichiarata; i nutrienti non dichiarati sono sconosciuti, non zero,
--      e non rendono il prodotto «da completare» né «dati parziali» (la ricetta li segnala dove contano).
-- Le stesse regole sono in src/engine/energy.ts e src/engine/catalogStatus.ts.

-- i fattori unici sostituiti dai metodi per tipologia
drop table if exists public.energy_factors cascade;

create table public.energy_methods (
  id text primary key,
  version text not null,
  label text not null,
  protein numeric not null check (protein > 0),
  fat numeric not null check (fat > 0),
  carbohydrate numeric not null check (carbohydrate > 0),
  source text not null,
  approved_by text not null,
  approved_at date,
  notes text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- tipologia (categoria o sottocategoria; 'supplement' per gli integratori) + stato di preparazione → metodo
create table public.energy_method_assignments (
  category_id text not null,
  processing text not null default 'any' check (processing in ('any','raw','cooked')),
  method_id text not null references public.energy_methods(id),
  caution text,
  primary key (category_id, processing)
);

-- la tipologia deve esistere (o essere 'supplement')
create or replace function public.check_assignment_category() returns trigger
language plpgsql as $$
begin
  if new.category_id <> 'supplement' and not exists (select 1 from public.food_categories where id = new.category_id) then
    raise exception 'Tipologia % inesistente', new.category_id;
  end if;
  return new;
end $$;
create trigger energy_method_assignments_category before insert or update on public.energy_method_assignments
  for each row execute function public.check_assignment_category();

create table public.unit_conversions (
  id text primary key,
  nutrient_id text not null references public.nutrients(id),
  from_unit text not null,
  to_unit text not null,
  form text,
  form_label text not null,
  factor numeric not null check (factor > 0),
  source text not null,
  unique (nutrient_id, from_unit, to_unit, form)
);

alter table public.foods add column if not exists energy_method_id text references public.energy_methods(id);

-- una modifica dei fattori deve cambiare la versione (le ricette la confrontano con la propria istantanea)
create or replace function public.check_energy_method_version() returns trigger
language plpgsql as $$
begin
  if (old.protein, old.fat, old.carbohydrate) is distinct from (new.protein, new.fat, new.carbohydrate) and old.version = new.version then
    raise exception 'Fattori del metodo % cambiati: indicare una nuova versione', new.id;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger energy_methods_version before update on public.energy_methods
  for each row execute function public.check_energy_method_version();

do $$
declare t text;
begin
  foreach t in array array['energy_methods','energy_method_assignments','unit_conversions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t || '_admin_delete', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.log_change()', t || '_audit', t);
  end loop;
end $$;

-- sostituisce tutte le associazioni in un colpo (solo amministratori)
create or replace function public.admin_set_energy_assignments(rows jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_catalog_admin() then raise exception 'Solo gli amministratori possono modificare i metodi energetici'; end if;
  delete from energy_method_assignments where true;
  insert into energy_method_assignments (category_id, processing, method_id, caution)
  select r ->> 'category_id', coalesce(r ->> 'processing', 'any'), r ->> 'method_id', nullif(r ->> 'caution', '')
    from jsonb_array_elements(rows) r;
end $$;
grant execute on function public.admin_set_energy_assignments(jsonb) to authenticated;
grant select, insert, update, delete on public.energy_methods, public.energy_method_assignments, public.unit_conversions to authenticated;

-- ───────────── energia metabolizzabile calcolata ─────────────
create or replace function public.processing_group(state text) returns text
language sql immutable as $$
  select case
    when state = 'raw' then 'raw'
    when state in ('cooked_boiled','cooked_baked','cooked_other','canned') then 'cooked'
    when state = 'dried' then 'any'
  end
$$;

-- metodo della tipologia: sottocategoria prima della categoria; lo stato crudo/cotto prima di «qualsiasi»
create or replace function public.food_energy_method(f public.foods) returns public.energy_methods
language sql stable set search_path = public as $$
  select m.* from energy_methods m
   where m.active and m.id = coalesce(f.energy_method_id, (
     select a.method_id from energy_method_assignments a
      where a.category_id in (f.subcategory_id, f.category_id)
        and (a.processing = 'any' or a.processing = processing_group(f.processing_state))
      order by (a.category_id = f.subcategory_id) desc, (a.processing <> 'any') desc
      limit 1))
$$;

create or replace function public.food_me_calc(f public.foods) returns numeric
language sql stable set search_path = public as $$
  select case when processing_group(f.processing_state) is null then null else
    round((select p.amount_per_100g * m.protein + g.amount_per_100g * m.fat + c.amount_per_100g * m.carbohydrate
             from public.food_energy_method(f) m,
                  food_nutrients p, food_nutrients g, food_nutrients c
            where m.id is not null
              and p.food_id = f.id and p.nutrient_id = 'protein'
              and g.food_id = f.id and g.nutrient_id = 'fat'
              and c.food_id = f.id and c.nutrient_id = 'carbohydrate_available'), 1)
  end
$$;

-- EM in uso: inserita da un amministratore, altrimenti calcolata con il metodo della tipologia
create or replace function public.food_me(f public.foods) returns numeric
language sql stable as $$ select coalesce(f.kcal_me_per_100g, public.food_me_calc(f)) $$;

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
  ready boolean;
begin
  select count(*),
         count(*) filter (where value_status not in ('measured','label','calculated','analytical_zero')),
         count(*) filter (where nullif(trim(source_id), '') is null)
    into n_declared, n_est, n_nosrc
    from supplement_nutrients where supplement_id = s.id and amount_per_unit is not null;
  if n_declared = 0 then hard := hard || 'composizione per dose'::text; end if;
  if nullif(trim(s.label_source), '') is null then hard := hard || 'etichetta o scheda tecnica'::text; end if;
  -- nutrienti non dichiarati: sconosciuti, non zero, ma non sono un motivo di stato (decisione D20)
  if n_est > 0 then reasons := reasons || format('%s valori stimati o di qualità non dichiarata', n_est); end if;
  if n_nosrc > 0 then reasons := reasons || format('%s valori senza fonte', n_nosrc); end if;
  if coalesce(array_length(hard, 1), 0) > 0 then
    return jsonb_build_object('status', 'to_complete', 'reasons', to_jsonb(array['mancano: ' || array_to_string(hard, ', ')] || reasons), 'ready', false);
  end if;
  if s.dose_unit not in ('g','ml') and s.mass_per_unit_g is null then reasons := reasons || 'peso della singola unità non indicato'::text; end if;
  if s.kcal_per_unit is null then reasons := reasons || 'energia per dose non dichiarata (inserire le kcal, o 0 se documentato)'::text; end if;
  if nullif(trim(s.product_version), '') is null then reasons := reasons || 'variante/lotto o versione del prodotto non indicati'::text; end if;
  if s.label_added_only then reasons := reasons || 'l’etichetta dichiara solo le quantità aggiunte: non è un’analisi completa'::text; end if;
  ready := coalesce(array_length(reasons, 1), 0) = 0;
  if s.validated_at is null and s.status <> 'test_fixture' then reasons := reasons || 'non ancora convalidato da un amministratore'::text; end if;
  return jsonb_build_object('status', case when coalesce(array_length(reasons, 1), 0) = 0 then 'verified' else 'partial' end,
                            'reasons', to_jsonb(reasons), 'ready', ready);
end $$;

-- completezza: l'energia in uso comprende quella calcolata
create or replace view public.food_completeness with (security_invoker = true) as
select f.id as food_id, f.name_it, f.data_status, f.available_to_formulate, f.profile_version,
       (public.food_me(f) is not null) as has_energy,
       count(n.id) filter (where n.kind in ('core','advanced')) as required_total,
       count(fn.amount_per_100g) filter (where n.kind in ('core','advanced')) as required_known,
       coalesce(array_agg(n.id order by n.id) filter (where n.kind in ('core','advanced') and fn.amount_per_100g is null), '{}') as required_missing,
       count(fn.amount_per_100g) filter (where fn.verified_at is null and fn.amount_per_100g is not null) as values_not_verified,
       public.food_me(f) as kcal_me_in_use,
       case when f.kcal_me_per_100g is not null then 'declared' when public.food_me_calc(f) is not null then 'calculated' end as kcal_me_origin
from public.foods f
cross join public.nutrients n
left join public.food_nutrients fn on fn.food_id = f.id and fn.nutrient_id = n.id
where n.kind not in ('derived','composition')
group by f.id;
