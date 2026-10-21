-- Specifica v2 del 21/10/2026: categoria «altri alimenti», conversione calcio D-pantotenato → B5, alimenti vietati e voci da completare.
-- Generato da scripts/build-seed.ts. Eseguire come amministratore DOPO la migrazione 20261025000011; nessun dato esistente viene modificato.

insert into public.food_categories (id, parent_id, label_it, secreting_offal, sort) values
  ('other_generic', 'other', 'Altri alimenti (non classificati)', false, 18)
on conflict (id) do nothing;

insert into public.unit_conversions (id, nutrient_id, from_unit, to_unit, form, form_label, factor, source) values
  ('calcium_d_pantothenate', 'vitamin_b5', 'mg', 'mg', 'calcium_d_pantothenate', 'calcio D-pantotenato → acido pantotenico', 0.92, 'fattore 0,92 (FEDIAF 2025, tab. VII-14: 1 mg di calcio D-pantotenato = 0,92 mg di acido D-pantotenico) — conversione richiesta dalla specifica v2 del 21/10/2026 (§6); fattore da confermare sul PDF')
on conflict (id) do nothing;

insert into public.foods (id, name_it, category_id, subcategory_id, processing_state, edible_portion, kcal_me_per_100g, me_method, source_identifier, source_version, data_status, available_to_formulate, notes, forbidden, preparation_warning) values
  ('onion', 'Cipolla (vietata)', 'vegetable', 'vegetable_generic', 'raw_or_unspecified', null, null, null, null, null, 'unverified', false, 'Alimento vietato (specifica v2 §9): mai usato nel calcolo.', true, 'Vietata per il cane.'),
  ('garlic', 'Aglio (vietato)', 'vegetable', 'vegetable_generic', 'raw_or_unspecified', null, null, null, null, null, 'unverified', false, 'Alimento vietato (specifica v2 §9): mai usato nel calcolo.', true, 'Vietato per il cane.'),
  ('grapes_raisins', 'Uva e uvetta (vietate)', 'other', 'other_generic', 'raw_or_unspecified', null, null, null, null, null, 'unverified', false, 'Alimento vietato (specifica v2 §9): mai usato nel calcolo.', true, 'Vietate per il cane.'),
  ('xylitol', 'Xilitolo (vietato)', 'other', 'other_generic', 'raw_or_unspecified', null, null, null, null, null, 'unverified', false, 'Alimento vietato (specifica v2 §9): mai usato nel calcolo.', true, 'Vietato per il cane (anche negli alimenti per uso umano che lo contengono).'),
  ('chocolate', 'Cioccolato (vietato)', 'other', 'other_generic', 'raw_or_unspecified', null, null, null, null, null, 'unverified', false, 'Alimento vietato (specifica v2 §9): mai usato nel calcolo.', true, 'Vietato per il cane.'),
  ('macadamia', 'Noci macadamia (vietate)', 'other', 'other_generic', 'raw_or_unspecified', null, null, null, null, null, 'unverified', false, 'Alimento vietato (specifica v2 §9): mai usato nel calcolo.', true, 'Vietate per il cane.'),
  ('olive_oil', 'Olio d''oliva', 'other', 'fat_oil', 'raw_or_unspecified', null, null, null, null, null, 'unverified', false, 'Voce prevista dalla specifica v2 (§9): dati da importare con fonte.', false, null)
on conflict (id) do nothing;

insert into public.supplements (id, name_it, brand, product_variant, class, dose_unit, mass_per_unit_g, kcal_per_unit, integer_dose, max_daily_units, max_daily_source, label_source, product_version, status, usable_for_optimization, notes) values
  ('eggshell_powder', 'Polvere di guscio d''uovo', null, null, 'calcium', 'g', null, null, false, null, null, null, null, 'missing', false, 'Integratore previsto dalla specifica v2 (§9): etichetta e regole di dose da inserire.'),
  ('fish_oil', 'Olio di pesce', null, null, 'fish_oil', 'ml', null, null, false, null, null, null, null, 'missing', false, 'Integratore previsto dalla specifica v2 (§9): etichetta e regole di dose da inserire.'),
  ('iodine_alga', 'Alga per lo iodio (es. kelp)', null, null, 'iodine', 'g', null, null, false, null, null, null, null, 'missing', false, 'Integratore previsto dalla specifica v2 (§9): etichetta e regole di dose da inserire.'),
  ('vitamin_e_supplement', 'Vitamina E', null, null, 'vitamin', 'capsule', null, null, true, null, null, null, null, 'missing', false, 'Integratore previsto dalla specifica v2 (§9): etichetta e regole di dose da inserire.')
on conflict (id) do nothing;

