-- Regole nel database e sicurezza (RLS).

-- ───────────── Validazione delle unità: devono coincidere con l'unità canonica del dizionario ─────────────
create or replace function public.check_nutrient_unit() returns trigger
language plpgsql as $$
declare
  canon text;
begin
  select canonical_unit into canon from public.nutrients where id = new.nutrient_id;
  if canon is null then
    raise exception 'Nutriente % non presente nel dizionario', new.nutrient_id;
  end if;
  if new.unit <> canon then
    raise exception 'Unità % non valida per %: serve %, convertire prima con regola documentata', new.unit, new.nutrient_id, canon;
  end if;
  if canon in ('ratio', '%') then
    raise exception 'Il nutriente % è un valore derivato: non si inserisce nella composizione', new.nutrient_id;
  end if;
  return new;
end $$;

create trigger food_nutrients_unit before insert or update on public.food_nutrients
  for each row execute function public.check_nutrient_unit();
create trigger supplement_nutrients_unit before insert or update on public.supplement_nutrients
  for each row execute function public.check_nutrient_unit();

-- ───────────── Versioni dei profili (una per transazione) con storico del profilo precedente ─────────────
create or replace function public.food_profile_json(fid text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'food', (select to_jsonb(f) from public.foods f where f.id = fid),
    'nutrients', coalesce((select jsonb_agg(to_jsonb(n) order by n.nutrient_id) from public.food_nutrients n where n.food_id = fid), '[]'::jsonb));
$$;

create or replace function public.supplement_profile_json(sid text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'supplement', (select to_jsonb(s) from public.supplements s where s.id = sid),
    'nutrients', coalesce((select jsonb_agg(to_jsonb(n) order by n.nutrient_id) from public.supplement_nutrients n where n.supplement_id = sid), '[]'::jsonb));
$$;

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
  update public.foods set profile_version = profile_version + 1, profile_changed_at = now(), updated_at = now() where id = fid;
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
  update public.supplements set profile_version = profile_version + 1, profile_changed_at = now(), updated_at = now() where id = sid;
end $$;

create or replace function public.on_food_nutrient_change() returns trigger
language plpgsql as $$
begin
  perform public.bump_food_version(coalesce(new.food_id, old.food_id));
  return coalesce(new, old);
end $$;

create or replace function public.on_supplement_nutrient_change() returns trigger
language plpgsql as $$
begin
  perform public.bump_supplement_version(coalesce(new.supplement_id, old.supplement_id));
  return coalesce(new, old);
end $$;

-- before: lo storico salva il profilo PRIMA della modifica
create trigger food_nutrients_version before insert or update or delete on public.food_nutrients
  for each row execute function public.on_food_nutrient_change();
create trigger supplement_nutrients_version before insert or update or delete on public.supplement_nutrients
  for each row execute function public.on_supplement_nutrient_change();

-- modifiche ai campi del profilo dell'alimento (energia, stato, fonte…) aumentano la versione
create or replace function public.on_food_profile_update() returns trigger
language plpgsql as $$
begin
  if (old.kcal_me_per_100g, old.processing_state, old.edible_portion, old.source_identifier, old.source_version, old.data_status, old.me_method)
     is distinct from (new.kcal_me_per_100g, new.processing_state, new.edible_portion, new.source_identifier, new.source_version, new.data_status, new.me_method)
     and old.profile_changed_at is distinct from now() then
    insert into public.food_profile_history(food_id, profile_version, profile, changed_by)
    values (old.id, old.profile_version, jsonb_build_object('food', to_jsonb(old)), auth.uid())
    on conflict (food_id, profile_version) do nothing;
    new.profile_version := old.profile_version + 1;
    new.profile_changed_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger foods_profile_version before update on public.foods
  for each row when (pg_trigger_depth() = 0) execute function public.on_food_profile_update();

create or replace function public.on_supplement_profile_update() returns trigger
language plpgsql as $$
begin
  if (old.dose_unit, old.mass_per_unit_g, old.kcal_per_unit, old.max_daily_units, old.product_version, old.status, old.label_source)
     is distinct from (new.dose_unit, new.mass_per_unit_g, new.kcal_per_unit, new.max_daily_units, new.product_version, new.status, new.label_source)
     and old.profile_changed_at is distinct from now() then
    insert into public.supplement_profile_history(supplement_id, profile_version, profile, changed_by)
    values (old.id, old.profile_version, jsonb_build_object('supplement', to_jsonb(old)), auth.uid())
    on conflict (supplement_id, profile_version) do nothing;
    new.profile_version := old.profile_version + 1;
    new.profile_changed_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger supplements_profile_version before update on public.supplements
  for each row when (pg_trigger_depth() = 0) execute function public.on_supplement_profile_update();

-- ───────────── Ricette: massimo 10 per cane, proprietà coerente ─────────────
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
create trigger recipes_rules before insert or update on public.recipes
  for each row execute function public.check_recipe_rules();

-- ───────────── Versioni di ricetta immutabili ─────────────
create or replace function public.recipe_version_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Le versioni delle ricette sono immutabili: creare una nuova versione';
  end if;
  if tg_op = 'DELETE' then
    -- consentito solo se la ricetta stessa viene eliminata (cascata)
    if exists (select 1 from public.recipes r where r.id = old.recipe_id) then
      raise exception 'Le versioni delle ricette non si eliminano singolarmente';
    end if;
    return old;
  end if;
  if not exists (select 1 from public.recipes r where r.id = new.recipe_id and r.owner_id = new.owner_id) then
    raise exception 'Versione non coerente con la ricetta';
  end if;
  return new;
end $$;
create trigger recipe_versions_rules before insert or update or delete on public.recipe_versions
  for each row execute function public.recipe_version_rules();

-- ───────────── Prezzi: il prodotto deve esistere in catalogo ─────────────
create or replace function public.check_price_product() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.product_kind = 'food' and not exists (select 1 from public.foods where id = new.product_id) then
    raise exception 'Alimento % non presente in catalogo', new.product_id;
  end if;
  if new.product_kind = 'supplement' and not exists (select 1 from public.supplements where id = new.product_id) then
    raise exception 'Integratore % non presente in catalogo', new.product_id;
  end if;
  return new;
end $$;
create trigger user_prices_product before insert or update on public.user_prices
  for each row execute function public.check_price_product();

-- ───────────── Registro modifiche ─────────────
do $$
declare t text;
begin
  foreach t in array array['nutrients','reference_versions','nutrient_limits','custom_thresholds','energy_factors','food_categories',
                           'foods','food_nutrients','supplements','supplement_nutrients','breed_notes','app_admins',
                           'dogs','recipes','recipe_versions','user_prices']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.log_change()', t || '_audit', t);
  end loop;
end $$;

-- ───────────── Completezza dei dati ─────────────
create view public.food_completeness with (security_invoker = true) as
select f.id as food_id, f.name_it, f.data_status, f.available_to_formulate, f.profile_version,
       (f.kcal_me_per_100g is not null) as has_energy,
       count(n.id) filter (where n.kind in ('core','advanced')) as required_total,
       count(fn.amount_per_100g) filter (where n.kind in ('core','advanced')) as required_known,
       coalesce(array_agg(n.id order by n.id) filter (where n.kind in ('core','advanced') and fn.amount_per_100g is null), '{}') as required_missing,
       count(fn.amount_per_100g) filter (where fn.verified_at is null and fn.amount_per_100g is not null) as values_not_verified
from public.foods f
cross join public.nutrients n
left join public.food_nutrients fn on fn.food_id = f.id and fn.nutrient_id = n.id
where n.kind not in ('derived','composition')
group by f.id;

create view public.supplement_completeness with (security_invoker = true) as
select s.id as supplement_id, s.name_it, s.status, s.usable_for_optimization, s.profile_version,
       (s.kcal_per_unit is not null) as has_energy,
       (s.dose_unit in ('g','ml') or s.mass_per_unit_g is not null) as has_unit_content,
       count(sn.amount_per_unit) as values_known,
       coalesce(array_agg(sn.nutrient_id order by sn.nutrient_id) filter (where sn.amount_per_unit is not null), '{}') as nutrients_declared,
       bool_or(sn.declared_total_or_added = 'added') as has_added_only_values
from public.supplements s
left join public.supplement_nutrients sn on sn.supplement_id = s.id
group by s.id;

-- ───────────── RLS ─────────────
do $$
declare t text;
begin
  -- cataloghi condivisi: lettura per utenti autenticati, scrittura solo amministratori
  foreach t in array array['nutrients','reference_versions','nutrient_limits','custom_thresholds','energy_factors','food_categories',
                           'foods','food_nutrients','food_profile_history','supplements','supplement_nutrients',
                           'supplement_profile_history','breed_notes']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t || '_admin_delete', t);
  end loop;
end $$;

alter table public.app_admins enable row level security;
create policy app_admins_self on public.app_admins for select to authenticated using (user_id = auth.uid());
-- nessuna policy di scrittura: gli amministratori si aggiungono solo dal pannello Supabase (SQL editor)

alter table public.audit_log enable row level security;
create policy audit_log_admin_read on public.audit_log for select to authenticated using (public.is_admin());

alter table public.dogs enable row level security;
create policy dogs_own on public.dogs for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.dog_weight_log enable row level security;
create policy weight_own on public.dog_weight_log for all to authenticated
  using (exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid()))
  with check (exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid()));

alter table public.recipes enable row level security;
create policy recipes_own on public.recipes for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid()));

alter table public.recipe_versions enable row level security;
create policy versions_own_read on public.recipe_versions for select to authenticated using (owner_id = auth.uid());
create policy versions_own_insert on public.recipe_versions for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = auth.uid()));

alter table public.user_prices enable row level security;
create policy prices_own on public.user_prices for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.user_settings enable row level security;
create policy settings_own on public.user_settings for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- nessun accesso anonimo
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.food_completeness, public.supplement_completeness to authenticated;
