-- Nutrizione cani — schema Supabase (Postgres).
-- Deriva da dati/pacchetto/03_Allegati_A_F/supabase_schema.sql, completato con i TODO di sicurezza indicati lì:
-- RLS su TUTTE le tabelle, cataloghi in sola lettura per gli utenti, scritture solo per amministratori
-- (controllo nel database), massimo 10 ricette per cane, una sola ricetta principale, versioni immutabili,
-- storico dei profili, registro delle modifiche, validazione delle unità.

create extension if not exists pgcrypto;

-- ───────────────────────── Ruoli ─────────────────────────
create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.app_admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ───────────────────────── Registro modifiche ─────────────────────────
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  entity_name text not null,
  entity_id text not null,
  operation text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  key text;
begin
  key := coalesce(rec ->> 'id', rec ->> 'food_id', rec ->> 'supplement_id', rec ->> 'version', rec ->> 'user_id', '?');
  if rec ? 'nutrient_id' then
    key := key || ':' || (rec ->> 'nutrient_id');
  end if;
  insert into public.audit_log(actor_id, entity_name, entity_id, operation, before, after)
  values (auth.uid(), tg_table_name, key, tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- ───────────────────────── Riferimenti ─────────────────────────
create table public.nutrients (
  id text primary key,
  label_it text not null,
  canonical_unit text not null,
  nutrient_group text not null,
  kind text not null check (kind in ('core','descriptive','advanced','informational','derived','composition')),
  formula text,
  notes text,
  updated_at timestamptz not null default now()
);

create table public.reference_versions (
  id text primary key,
  source text not null,
  version_label text not null,
  source_url text,
  published_at date,
  verified_at timestamptz,
  status text not null default 'pending' check (status in ('pending','draft','verified','superseded'))
);

create table public.nutrient_limits (
  id text primary key,
  reference_version_id text not null references public.reference_versions(id),
  metric text not null references public.nutrients(id),
  life_stage text not null default 'adult_maintenance',
  lower_value numeric,
  upper_value numeric,
  unit text not null,
  basis text not null check (basis in ('per_1000_kcal_me','per_day','ratio','energy_pct','per_kg_dry_matter','per_kg_feed_12pct_moisture')),
  limit_class text not null check (limit_class in ('OFFICIAL_MIN','OFFICIAL_NUTRITIONAL_MAX','LEGAL_MAX','NON_OFFICIAL_ATTENTION','INFORMATIONAL_REFERENCE')),
  hardness text not null check (hardness in ('hard','soft')),
  severity text not null check (severity in ('red','orange','blue')),
  applicability jsonb not null default '{}'::jsonb,
  source text not null,
  status text not null default 'verified' check (status in ('verified','draft','review_required')),
  notes text,
  active boolean not null default true,
  check (lower_value is not null or upper_value is not null),
  -- una soglia non ufficiale non può essere marcata come limite ufficiale o rosso
  check (limit_class <> 'NON_OFFICIAL_ATTENTION' or (severity = 'orange' and hardness = 'soft')),
  check (limit_class <> 'INFORMATIONAL_REFERENCE' or severity = 'blue')
);

create table public.custom_thresholds (
  id text primary key,
  metric text not null,
  lower_value numeric,
  upper_value numeric,
  status text not null,
  rationale text not null,
  requires_review boolean not null default true,
  enabled boolean not null default true
);

-- Fattori kcal/g per le quote energetiche (decisione D4): vuota finché non approvati.
create table public.energy_factors (
  version text primary key,
  protein numeric check (protein > 0),
  fat numeric check (fat > 0),
  carbohydrate numeric check (carbohydrate > 0),
  source text not null,
  approved_by text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index energy_factors_one_active on public.energy_factors(active) where active;

-- ───────────────────────── Catalogo alimenti ─────────────────────────
create table public.food_categories (
  id text primary key,
  parent_id text references public.food_categories(id),
  label_it text not null,
  secreting_offal boolean not null default false,
  sort integer not null default 0
);

create table public.foods (
  id text primary key,
  name_it text not null unique,
  category_id text not null references public.food_categories(id),
  subcategory_id text not null references public.food_categories(id),
  species_cut text,
  processing_state text not null default 'raw_or_unspecified'
    check (processing_state in ('raw','cooked_boiled','cooked_baked','cooked_other','dried','canned','raw_or_unspecified')),
  preparation text,
  edible_portion text,
  expression_basis text not null default 'per_100g_edible',
  kcal_me_per_100g numeric check (kcal_me_per_100g is null or kcal_me_per_100g >= 0),
  me_method text,
  source_identifier text,
  source_url text,
  source_version text,
  data_status text not null default 'unverified' check (data_status in ('verified','estimated','review_required','unverified','test_fixture')),
  available_to_formulate boolean not null default false,
  uncertainty text,
  notes text,
  profile_version integer not null default 1,
  profile_changed_at timestamptz,
  updated_at timestamptz not null default now(),
  -- non si attiva un alimento senza energia e senza dati verificati o stimati dichiarati
  check (not available_to_formulate or (kcal_me_per_100g is not null and data_status in ('verified','estimated','test_fixture')))
);

create table public.food_nutrients (
  food_id text not null references public.foods(id) on delete cascade,
  nutrient_id text not null references public.nutrients(id),
  amount_per_100g numeric check (amount_per_100g is null or amount_per_100g >= 0),
  unit text not null,
  value_status text not null default 'unknown' check (value_status in ('measured','label','calculated','estimated','analytical_zero','unknown')),
  method text,
  source_value numeric,
  source_unit text,
  source_basis text,
  conversion_rule text,
  data_quality text,
  source_id text,
  source_url text,
  source_version text,
  verified_by text,
  verified_at timestamptz,
  primary key (food_id, nutrient_id),
  -- null ≠ 0: un valore assente deve essere "unknown", uno zero deve essere dichiarato
  check ((amount_per_100g is null) = (value_status = 'unknown')),
  check (amount_per_100g is distinct from 0 or value_status in ('analytical_zero','measured','label'))
);

create table public.food_profile_history (
  id uuid primary key default gen_random_uuid(),
  food_id text not null,
  profile_version integer not null,
  profile jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  unique (food_id, profile_version)
);

-- ───────────────────────── Catalogo integratori ─────────────────────────
create table public.supplements (
  id text primary key,
  name_it text not null unique,
  brand text,
  product_variant text,
  class text,
  dose_unit text not null check (dose_unit in ('g','ml','capsule','tablet','scoop')),
  mass_per_unit_g numeric check (mass_per_unit_g is null or mass_per_unit_g > 0),
  kcal_per_unit numeric check (kcal_per_unit is null or kcal_per_unit >= 0),
  integer_dose boolean not null default false,
  max_daily_units numeric check (max_daily_units is null or max_daily_units > 0),
  max_daily_source text,
  label_source text,
  label_added_only boolean not null default false,
  product_version text,
  status text not null default 'missing' check (status in ('verified','review_required','missing','test_fixture')),
  usable_for_optimization boolean not null default false,
  notes text,
  profile_version integer not null default 1,
  profile_changed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (not usable_for_optimization or status in ('verified','test_fixture')),
  check (max_daily_units is null or max_daily_source is not null)
);

create table public.supplement_nutrients (
  supplement_id text not null references public.supplements(id) on delete cascade,
  nutrient_id text not null references public.nutrients(id),
  amount_per_unit numeric check (amount_per_unit is null or amount_per_unit >= 0),
  unit text not null,
  value_status text not null default 'unknown' check (value_status in ('measured','label','calculated','estimated','analytical_zero','unknown')),
  declared_total_or_added text check (declared_total_or_added in ('total','added')),
  source_value numeric,
  source_unit text,
  conversion_rule text,
  source_id text,
  verified_by text,
  verified_at timestamptz,
  primary key (supplement_id, nutrient_id),
  check ((amount_per_unit is null) = (value_status = 'unknown')),
  check (amount_per_unit is distinct from 0 or value_status in ('analytical_zero','measured','label'))
);

create table public.supplement_profile_history (
  id uuid primary key default gen_random_uuid(),
  supplement_id text not null,
  profile_version integer not null,
  profile jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  unique (supplement_id, profile_version)
);

create table public.breed_notes (
  id text primary key,
  breed_match text[] not null,
  note text not null,
  source text not null,
  metrics text[] not null default '{}'
);

-- ───────────────────────── Dati utente ─────────────────────────
create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  breed text,
  birth_date date,
  age_years numeric,
  sex text check (sex in ('M','F')),
  sterilized boolean,
  life_stage text not null default 'adult_maintenance' check (life_stage in ('adult_maintenance','growth','gestation','lactation','other')),
  weight_current_kg numeric not null check (weight_current_kg > 0),
  weight_ideal_kg numeric not null check (weight_ideal_kg > 0),
  bcs numeric,
  activity text,
  activity_factor numeric check (activity_factor is null or activity_factor > 0),
  kcal_target numeric check (kcal_target is null or kcal_target > 0),
  kcal_source text not null default 'user' check (kcal_source in ('estimated','veterinarian','user')),
  macro_preferences jsonb not null default '[]'::jsonb,
  fiber_target jsonb,
  ingredient_preferences text,
  targets jsonb not null default '[]'::jsonb,
  clinical_notes text,
  notes jsonb not null default '[]'::jsonb,
  formulation_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dog_weight_log (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  date timestamptz not null default now(),
  weight_kg numeric not null check (weight_kg > 0)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  name text not null,
  is_primary boolean not null default false,
  archived boolean not null default false,
  current_version_id uuid,
  diet_moisture text check (diet_moisture in ('wet','dry')),
  created_at timestamptz not null default now()
);
create unique index recipes_one_primary_per_dog on public.recipes(dog_id) where is_primary;

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  revision integer not null,
  origin text not null check (origin in ('engine','user_edit','recalculation','duplicate')),
  parent_version_id uuid references public.recipe_versions(id),
  suggested_items jsonb not null,
  chosen_items jsonb not null,
  audit jsonb not null,
  snapshot jsonb not null,
  constraints_used jsonb not null default '[]'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  engine_notes jsonb not null default '[]'::jsonb,
  excluded jsonb not null default '[]'::jsonb,
  author text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (recipe_id, revision)
);
alter table public.recipes add constraint recipes_current_version_fk
  foreign key (current_version_id) references public.recipe_versions(id) on delete set null deferrable initially deferred;

create table public.user_prices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_kind text not null check (product_kind in ('food','supplement')),
  product_id text not null,
  supplier text,
  mode text not null check (mode in ('per_kg','package_mass','package_units')),
  price numeric not null check (price >= 0),
  package_grams numeric check (package_grams is null or package_grams > 0),
  package_units numeric check (package_units is null or package_units > 0),
  currency text not null default 'EUR',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (mode <> 'package_mass' or package_grams is not null),
  check (mode <> 'package_units' or package_units is not null)
);

create table public.user_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index on public.dogs(owner_id);
create index on public.recipes(dog_id);
create index on public.recipe_versions(recipe_id);
create index on public.user_prices(owner_id, product_kind, product_id);
create index on public.food_nutrients(nutrient_id);
create index on public.audit_log(entity_name, entity_id);
