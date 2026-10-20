-- Bozze diagnostiche (20/10/2026): una formulazione con «preferenze non raggiungibili» si può salvare come BOZZA,
-- distinta da una ricetta generata; le quantità restano quelle mostrate, senza riformulazione.

alter table public.recipe_versions drop constraint if exists recipe_versions_origin_check;
alter table public.recipe_versions add constraint recipe_versions_origin_check
  check (origin in ('engine','user_edit','recalculation','duplicate','diagnostic'));
alter table public.recipe_versions add column if not exists draft boolean not null default false;
comment on column public.recipe_versions.draft is 'true = bozza diagnostica (preferenze non raggiungibili): non è un menù generato';
