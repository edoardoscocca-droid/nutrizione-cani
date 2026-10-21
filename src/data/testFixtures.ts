// DATI DI PROVA FITTIZI — solo per collaudare il motore e l'interfaccia (specifica §16).
// I numeri qui sotto NON sono composizioni reali e NON vanno mai usati per alimentare un cane.
// Ogni record ha dataStatus/status = 'test_fixture' e il nome inizia con "[TEST]";
// ogni ricetta che li usa viene mostrata come "PROVA — dati fittizi".

import type { Food, NutrientValue, Supplement } from '../engine/types';

type Profile = Record<string, number | null>;

const ALL_IDS = [
  'protein', 'fat', 'carbohydrate_available', 'fiber', 'moisture', 'linoleic_acid', 'ala', 'epa', 'dha', 'epa_dha',
  'omega3_total', 'omega6_total', 'arachidonic_acid', 'calcium', 'phosphorus', 'potassium', 'sodium', 'chloride',
  'magnesium', 'copper', 'iodine', 'iron', 'manganese', 'selenium_wet', 'zinc', 'vitamin_a', 'vitamin_d', 'vitamin_e',
  'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b5', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12', 'choline',
  'vitamin_c', 'vitamin_b7', 'vitamin_k', 'arginine', 'histidine', 'isoleucine', 'leucine', 'lysine', 'methionine',
  'methionine_cystine', 'phenylalanine', 'phenylalanine_tyrosine', 'threonine', 'tryptophan', 'valine', 'taurine', 'l_carnitine',
  // beta-carotene 0: nei dati fittizi «vitamin_a» è già l'attività totale (nessun contributo da convertire)
  'beta_carotene_ug',
];

function values(p: Profile): Record<string, NutrientValue> {
  const out: Record<string, NutrientValue> = {};
  for (const id of ALL_IDS) {
    if (id === 'epa_dha') continue; // calcolato da EPA + DHA (nessun doppio conteggio)
    const v = id in p ? p[id] : 0;
    out[id] = { value: v, status: v === null ? 'unknown' : 'measured', source: 'TEST fittizio' };
  }
  return out;
}

const meat = (o: Profile): Profile => ({
  protein: 19, fat: 12, moisture: 67, linoleic_acid: 0.35, ala: 0.04, omega3_total: 0.07, omega6_total: 0.42,
  arachidonic_acid: 45, calcium: 0.011, phosphorus: 0.19, potassium: 0.33, sodium: 0.07, chloride: 0.06, magnesium: 0.021,
  copper: 0.08, iodine: 0.004, iron: 2.1, manganese: 0.012, selenium_wet: 16, zinc: 4.6, vitamin_a: 25, vitamin_d: 6,
  vitamin_e: 0.6, vitamin_b1: 0.06, vitamin_b2: 0.17, vitamin_b3: 4.6, vitamin_b5: 0.62, vitamin_b6: 0.36, vitamin_b9: 7,
  vitamin_b12: 2.4, choline: 66, vitamin_b7: 1.4, vitamin_k: 1.4, arginine: 1.25, histidine: 0.66, isoleucine: 0.86,
  leucine: 1.52, lysine: 1.62, methionine: 0.5, methionine_cystine: 0.74, phenylalanine: 0.76, phenylalanine_tyrosine: 1.42,
  threonine: 0.8, tryptophan: 0.13, valine: 0.96, taurine: 40, l_carnitine: 60,
  ...o,
});

function food(id: string, name: string, cat: string, sub: string, kcal: number, p: Profile, extra: Partial<Food> = {}): Food {
  return {
    id,
    name: `[TEST] ${name}`,
    categoryId: cat,
    subcategoryId: sub,
    processingState: 'raw',
    ediblePortion: 'parte edibile (fittizio)',
    kcalMePer100g: kcal,
    meMethod: 'TEST fittizio',
    source: 'Dati di prova fittizi',
    sourceVersion: 'test-1',
    dataStatus: 'test_fixture',
    availableToFormulate: true,
    profileVersion: 1,
    nutrients: values(p),
    ...extra,
  };
}

export const TEST_FOODS: Food[] = [
  food('test_beef', 'Manzo (fittizio)', 'animal', 'muscle', 195, meat({})),
  food('test_lamb', 'Agnello (fittizio)', 'animal', 'muscle', 235, meat({ protein: 17, fat: 17, zinc: 3.9, iron: 1.7, taurine: 50 })),
  food('test_beef_heart', 'Cuore bovino (fittizio)', 'animal', 'heart', 115, meat({ protein: 17, fat: 4, iron: 4.3, copper: 0.4, taurine: 60 })),
  food(
    'test_beef_liver', 'Fegato bovino (fittizio)', 'animal', 'secreting_offal_liver', 135,
    meat({ protein: 20, fat: 3.6, vitamin_a: 16000, copper: 9.5, iron: 4.9, vitamin_b12: 59, vitamin_b9: 290, vitamin_b2: 2.7, choline: 330, vitamin_d: 50 }),
  ),
  food('test_beef_kidney', 'Rene bovino (fittizio)', 'animal', 'secreting_offal_kidney', 100, meat({ protein: 17, fat: 3, selenium_wet: 140, vitamin_b12: 27, iron: 4.6 })),
  food('test_beef_spleen', 'Milza bovina (fittizio)', 'animal', 'secreting_offal_spleen', 105, meat({ protein: 18, fat: 3, iron: 44 })),
  food('test_sardine', 'Sardine (fittizio)', 'animal', 'fish', 200, meat({ protein: 21, fat: 11, epa: 0.47, dha: 0.5, omega3_total: 1.4, vitamin_d: 190, calcium: 0.38, phosphorus: 0.49 })),
  food('test_egg', 'Uovo (fittizio)', 'animal', 'egg', 145, meat({ protein: 12.5, fat: 9.5, choline: 290, vitamin_d: 80, vitamin_a: 540, calcium: 0.056 })),
  food('test_oats', 'Avena (fittizio)', 'starch', 'cereal', 360, {
    protein: 13, fat: 6.5, carbohydrate_available: 58, fiber: 10, moisture: 9, linoleic_acid: 2.4, ala: 0.1, omega3_total: 0.1,
    omega6_total: 2.4, calcium: 0.05, phosphorus: 0.42, potassium: 0.42, sodium: 0.002, chloride: 0.05, magnesium: 0.14,
    copper: 0.4, iodine: 0.002, iron: 4.4, manganese: 3.9, selenium_wet: 25, zinc: 3.6, vitamin_e: 1.1, vitamin_b1: 0.6,
    vitamin_b2: 0.14, vitamin_b3: 1, vitamin_b5: 1.3, vitamin_b6: 0.12, vitamin_b9: 50, choline: 40, vitamin_b7: 20,
    vitamin_k: 2, arginine: 0.88, histidine: 0.3, isoleucine: 0.5, leucine: 1, lysine: 0.55, methionine: 0.23,
    methionine_cystine: 0.6, phenylalanine: 0.66, phenylalanine_tyrosine: 1.1, threonine: 0.45, tryptophan: 0.18, valine: 0.7,
  }),
  food('test_rice', 'Riso (fittizio)', 'starch', 'cereal', 350, {
    protein: 7, fat: 0.7, carbohydrate_available: 78, fiber: 1.3, moisture: 12, linoleic_acid: 0.18, omega6_total: 0.18, omega3_total: 0.01,
    calcium: 0.01, phosphorus: 0.11, potassium: 0.1, magnesium: 0.03, copper: 0.2, iron: 0.8, manganese: 1.1, selenium_wet: 15, zinc: 1.1,
    vitamin_b1: 0.07, vitamin_b3: 1.6, vitamin_b5: 1, vitamin_b6: 0.15, vitamin_b9: 8, choline: 6, arginine: 0.55, histidine: 0.17,
    isoleucine: 0.3, leucine: 0.58, lysine: 0.25, methionine: 0.16, methionine_cystine: 0.3, phenylalanine: 0.37,
    phenylalanine_tyrosine: 0.6, threonine: 0.25, tryptophan: 0.08, valine: 0.42,
  }),
  food('test_carrot', 'Carote (fittizio)', 'vegetable', 'vegetable_generic', 35, {
    protein: 0.9, fat: 0.2, carbohydrate_available: 6.8, fiber: 2.8, moisture: 88, linoleic_acid: 0.1, omega6_total: 0.1, omega3_total: 0.002,
    calcium: 0.033, phosphorus: 0.035, potassium: 0.32, sodium: 0.069, chloride: 0.05, magnesium: 0.012, copper: 0.045, iron: 0.3,
    manganese: 0.14, zinc: 0.24, vitamin_a: 16700, vitamin_e: 1, vitamin_b1: 0.07, vitamin_b3: 1, vitamin_b6: 0.14, vitamin_b9: 19,
    choline: 9, vitamin_c: 6, vitamin_k: 13, arginine: 0.09, histidine: 0.04, isoleucine: 0.08, leucine: 0.1, lysine: 0.1,
    methionine: 0.02, methionine_cystine: 0.03, phenylalanine: 0.06, phenylalanine_tyrosine: 0.1, threonine: 0.19, tryptophan: 0.01, valine: 0.07,
  }),
  food('test_sunflower_oil', 'Olio vegetale (fittizio)', 'other', 'fat_oil', 880, {
    fat: 100, linoleic_acid: 62, omega6_total: 62, omega3_total: 0.2, ala: 0.2, vitamin_e: 60, vitamin_k: 5,
  }),
  // specifica v2 (§10, collaudi A): pollo, pesce bianco e patata — sempre fittizi, solo per collaudare il generatore
  food('test_chicken', 'Pollo (fittizio)', 'animal', 'muscle', 150, meat({ protein: 21, fat: 6.5, iron: 0.9, zinc: 1.5, copper: 0.05, vitamin_a: 30, vitamin_d: 4 })),
  food('test_cod', 'Merluzzo (fittizio)', 'animal', 'fish', 82, meat({
    protein: 18, fat: 0.7, linoleic_acid: 0.01, omega6_total: 0.02, omega3_total: 0.2, epa: 0.004, dha: 0.15, iodine: 0.1, selenium_wet: 30,
    iron: 0.4, zinc: 0.5, copper: 0.03, vitamin_a: 40, vitamin_d: 40, vitamin_b12: 1, taurine: 30,
  }), { processingState: 'cooked_steamed' }),
  food('test_potato', 'Patata cotta (fittizio)', 'starch', 'tuber', 86, {
    protein: 1.9, fat: 0.1, carbohydrate_available: 18, fiber: 1.8, moisture: 77, linoleic_acid: 0.03, omega6_total: 0.03, omega3_total: 0.01,
    calcium: 0.005, phosphorus: 0.044, potassium: 0.38, sodium: 0.005, chloride: 0.05, magnesium: 0.022, copper: 0.1, iodine: 0.001, iron: 0.3,
    manganese: 0.14, selenium_wet: 0.3, zinc: 0.3, vitamin_e: 0.01, vitamin_b1: 0.1, vitamin_b2: 0.02, vitamin_b3: 1.4, vitamin_b5: 0.5,
    vitamin_b6: 0.3, vitamin_b9: 10, choline: 13, vitamin_c: 7, arginine: 0.1, histidine: 0.03, isoleucine: 0.07, leucine: 0.1, lysine: 0.1,
    methionine: 0.03, methionine_cystine: 0.05, phenylalanine: 0.08, phenylalanine_tyrosine: 0.13, threonine: 0.07, tryptophan: 0.02, valine: 0.1,
  }, { processingState: 'cooked_boiled' }),
  // T02: alimento con vitamina D mancante (null ≠ 0)
  food('test_pumpkin_no_vitd', 'Zucca senza vitamina D (fittizio)', 'vegetable', 'vegetable_generic', 26, {
    protein: 1, fat: 0.1, carbohydrate_available: 5.5, fiber: 0.5, moisture: 91, calcium: 0.021, phosphorus: 0.044, potassium: 0.34,
    vitamin_a: 8500, vitamin_d: null, vitamin_b9: 16, choline: 8,
  }),
];

function supp(id: string, name: string, s: Partial<Supplement>, p: Profile): Supplement {
  return {
    id,
    name: `[TEST] ${name}`,
    brand: 'TEST',
    variant: 'fittizia',
    supplementClass: s.supplementClass ?? 'multinutrient',
    doseUnit: 'g',
    massPerUnitG: 1,
    kcalPerUnit: 0,
    integerDose: false,
    maxDailyUnits: null,
    maxDailySource: null,
    labelSource: 'Etichetta fittizia di prova',
    version: 'test-1',
    status: 'test_fixture',
    usableForOptimization: true,
    profileVersion: 1,
    nutrients: values(p),
    ...s,
  };
}

export const TEST_SUPPLEMENTS: Supplement[] = [
  supp('test_multi', 'Multinutriente (fittizio, per 1 g)', { kcalPerUnit: 2 }, {
    sodium: 0.04, chloride: 0.09, magnesium: 0.03, copper: 0.7, iodine: 0.13, iron: 2, manganese: 0.6, selenium_wet: 18, zinc: 6,
    vitamin_a: 400, vitamin_d: 60, vitamin_e: 4, vitamin_b1: 0.25, vitamin_b2: 0.6, vitamin_b3: 1.5, vitamin_b5: 1.6, vitamin_b6: 0.15,
    vitamin_b9: 25, vitamin_b12: 3, choline: 150, potassium: 0.05,
  }),
  supp('test_fish_oil_caps', 'Olio di pesce (fittizio, per capsula)', {
    supplementClass: 'fish_oil', doseUnit: 'capsule', massPerUnitG: 1, kcalPerUnit: 9, integerDose: true, maxDailyUnits: 4,
    maxDailySource: 'Etichetta fittizia di prova',
  }, { fat: 1, epa: 0.18, dha: 0.12, omega3_total: 0.33, omega6_total: 0.02, linoleic_acid: 0.01, vitamin_e: 1 }),
  supp('test_bone_meal', 'Farina d’ossa (fittizio, per 1 g)', { supplementClass: 'calcium_phosphorus' }, {
    calcium: 0.3, phosphorus: 0.14, magnesium: 0.006, sodium: 0.005, moisture: 0.05,
  }),
  supp('test_calcium_carbonate', 'Carbonato di calcio (fittizio, per 1 g)', { supplementClass: 'calcium' }, { calcium: 0.4 }),
  // T07: integratore selezionabile ma senza etichetta
  { ...supp('test_no_label', 'Integratore senza etichetta', { status: 'missing', usableForOptimization: false, labelSource: null }, {}), nutrients: {} },
];
