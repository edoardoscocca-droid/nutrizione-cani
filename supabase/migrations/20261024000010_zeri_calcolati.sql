-- Zeri documentati (20/10/2026): allinea il database alla regola dell'importatore (schema definitivo del 19/10).
-- Uno zero è ammesso se misurato, da etichetta, zero analitico o CALCOLATO da valori documentati (es. EPA+DHA = 0 + 0,
-- carboidrati per differenza); resta vietato lo zero stimato. Prima il vincolo del 16/10 escludeva anche «calculated».

do $$
declare c record;
begin
  for c in
    select conrelid::regclass::text as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.food_nutrients'::regclass, 'public.supplement_nutrients'::regclass)
      and pg_get_constraintdef(oid) ilike '%is distinct from (0)::numeric%'
      and pg_get_constraintdef(oid) ilike '%analytical_zero%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.food_nutrients add constraint food_nutrients_zero_documented
  check (amount_per_100g is distinct from 0 or value_status in ('analytical_zero', 'measured', 'label', 'calculated'));
alter table public.supplement_nutrients add constraint supplement_nutrients_zero_documented
  check (amount_per_unit is distinct from 0 or value_status in ('analytical_zero', 'measured', 'label', 'calculated'));
