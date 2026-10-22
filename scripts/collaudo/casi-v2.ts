// Casi dei collaudi della specifica v2 del 21/10/2026 (§10), condivisi da tests/spec-v2-2026-10-21.test.ts e da
// scripts/collaudo/collaudi-v2.ts. Catalogo = archivio locale dell'app con tutte le importazioni incluse (dal 22/10 il
// catalogo unico con dati reali) + dati di prova FITTIZI [TEST], nascosti nell'app e usati solo dai test automatici
// (MENU_SETS). Gli stessi menù con dati reali sono in REAL_MENU_SETS.
// Nessuna ricetta, prescrizione o dato del catalogo viene modificato: le attivazioni valgono solo per la copia in memoria.

import { applyPreset, presetFor } from '../../src/data/formulationPresets';
import { LocalRepository } from '../../src/data/localRepository';
import type { FullCatalog } from '../../src/data/repository';
import type { Dog } from '../../src/data/model';
import { activeLimits, buildInput, type CatalogState } from '../../src/data/recipeService';
import type { AuditResult } from '../../src/engine/audit';
import { DEFAULT_CONFIG } from '../../src/engine/configV2';
import { newDog } from '../../src/engine/dogProfile';
import type { FormulationResult } from '../../src/engine/formulate';
import type { FormulationInputV2 } from '../../src/engine/formulateV2';
import { recommendedFor } from '../../src/engine/recommended';
import { DEFAULT_SETTINGS, type DogFormulationProfile, type RecipeItem } from '../../src/engine/types';

export async function catalogV2(): Promise<FullCatalog> {
  return new LocalRepository(null).loadCatalog();
}

/** copia in memoria con gli id indicati resi utilizzabili (nel catalogo restano come sono). */
export function activated(cat: CatalogState, ids: string[]): CatalogState {
  return {
    ...cat,
    foods: cat.foods.map((f) => (ids.includes(f.id) ? { ...f, availableToFormulate: true } : f)),
    supplements: cat.supplements.map((s) => (ids.includes(s.id) ? { ...s, usableForOptimization: true } : s)),
  };
}

export const ENERGY_PROFILES = [
  { kcal: 900, weightKg: 15, idealKg: 15 },
  { kcal: 1340, weightKg: 30.2, idealKg: 27.2 },
  { kcal: 2700, weightKg: 72, idealKg: 68.8 },
] as const;

/** Menù positivi obbligatori (§10 A). [TEST] = dati fittizi; zucca e carota sono i profili reali USDA del catalogo. */
export const MENU_SETS: { id: string; label: string; foods: string[]; supplements: string[] }[] = [
  { id: 'A1', label: 'agnello + zucca + patata', foods: ['test_lamb', 'pumpkin_cooked', 'test_potato', 'test_sunflower_oil'], supplements: ['test_multi', 'test_bone_meal', 'test_fish_oil_caps'] },
  { id: 'A2', label: 'pollo + riso + carota', foods: ['test_chicken', 'test_rice', 'carrot_cooked', 'test_sunflower_oil'], supplements: ['test_multi', 'test_bone_meal', 'test_fish_oil_caps'] },
  { id: 'A3', label: 'pesce bianco + patata + zucca', foods: ['test_cod', 'test_potato', 'pumpkin_cooked', 'test_sunflower_oil'], supplements: ['test_multi', 'test_bone_meal', 'test_fish_oil_caps'] },
  { id: 'A3b', label: 'sardine + patata + carota', foods: ['test_sardine', 'test_potato', 'carrot_cooked'], supplements: ['test_multi', 'test_bone_meal'] },
];
/** Gli stessi menù con i dati reali del catalogo unico del 22/10 e gli integratori reali (QDiet, farina d'ossa, Omegor). */
export const REAL_SUPPS = ['qdiet', 'bone_meal', 'omegor_vitality'];
export const REAL_MENU_SETS: { id: string; label: string; foods: string[]; supplements: string[] }[] = [
  { id: 'R1', label: 'agnello magro + zucca + patata + olio di girasole', foods: ['lamb_lean_raw', 'pumpkin_cooked', 'potato_yellow_cooked', 'sunflower_oil'], supplements: REAL_SUPPS },
  { id: 'R2', label: 'petto di pollo + riso bianco cotto + carota + olio di girasole', foods: ['chicken_breast_raw', 'rice_white_cooked', 'carrot_cooked', 'sunflower_oil'], supplements: REAL_SUPPS },
  { id: 'R3', label: 'merluzzo + patata + zucca + olio di girasole', foods: ['cod_raw', 'potato_yellow_cooked', 'pumpkin_cooked', 'sunflower_oil'], supplements: REAL_SUPPS },
  { id: 'R4', label: 'sardine al naturale + patata + carota', foods: ['sardine_canned_water', 'potato_yellow_cooked', 'carrot_cooked'], supplements: ['qdiet', 'bone_meal'] },
];
/** riso pesato secco: prima del 22/10 era in conflitto con verdure ≥ 3% e ≤ 20% del peso; ora il 3% è una preferenza e il
 *  tetto di peso, senza resa di cottura documentata, non è determinabile (segnalato, non forzato). */
export const CONFLICT_SET = { id: 'A3c', label: 'sardine + riso (pesato secco) + carota', foods: ['test_sardine', 'test_rice', 'carrot_cooked'], supplements: ['test_multi', 'test_bone_meal'] };

export function syntheticDog(kcal: number, weightKg: number, idealKg: number, cat: CatalogState): DogFormulationProfile {
  const dog: DogFormulationProfile = { id: `prova_${kcal}`, name: `Profilo ${kcal} kcal`, lifeStage: 'adult_maintenance', weightCurrentKg: weightKg, weightIdealKg: idealKg, kcalTarget: kcal, targets: [], attentionNotes: [], formulationRevision: 1, eaaMarginPct: 10 };
  dog.recommended = recommendedFor(dog, cat.recommendedTargets ?? [], cat.nutrients);
  return dog;
}

export function menuInput(cat: CatalogState, profile: (typeof ENERGY_PROFILES)[number], set: { foods: string[]; supplements: string[] }, simulate = false): FormulationInputV2 {
  const real = ![...set.foods, ...set.supplements].some((id) => id.startsWith('test_'));
  const c = activated(cat, [...set.foods, ...set.supplements]);
  return {
    dog: syntheticDog(profile.kcal, profile.weightKg, profile.idealKg, cat),
    foods: set.foods.map((id) => ({ food: c.foods.find((f) => f.id === id)! })),
    supplements: set.supplements.map((id) => ({ supplement: c.supplements.find((s) => s.id === id)! })),
    nutrients: cat.nutrients,
    limits: activeLimits(cat),
    dietMoisture: null,
    settings: DEFAULT_SETTINGS,
    // con i dati reali i suggerimenti non propongono i prodotti di prova [TEST] (come nell'app)
    catalogForSuggestions: real ? { foods: cat.foods.filter((f) => f.dataStatus !== 'test_fixture'), supplements: cat.supplements.filter((x) => x.status !== 'test_fixture') } : { foods: cat.foods, supplements: cat.supplements },
    config: DEFAULT_CONFIG,
    simulateSuggestions: simulate,
  };
}

// ── Ker e Garmr (dati reali del catalogo; profili come nei collaudi del 20–21/10) ──
export const KER_FOODS = ['beef_03', 'beef_05', 'beef_10', 'oat_dry', 'carrot_cooked', 'coconut_oil', 'flaxseed_oil'];
export const KER_SUPPS = ['bone_meal', 'qdiet', 'omegor_vitality', 'psyllium_erbavoglio_husk_bio'];
export const GARMR_FOODS = ['beef_05', 'oat_dry', 'carrot_cooked', 'flaxseed_oil'];
export const GARMR_SUPPS = ['bone_meal', 'qdiet', 'omegor_vitality'];

export function kerDog(): Dog {
  return applyPreset(newDog({ name: 'Ker', weightCurrentKg: 30.2, weightIdealKg: 27.2, kcalTarget: 1340, kcalSource: 'user', activityFactor: 1.6, sex: 'F', sterilized: false, ageYears: 6, bcs: 6 }, 'ker'), presetFor('adult_maintenance')!);
}
export function garmrDog(): Dog {
  return applyPreset(newDog({ name: 'Garmr', weightCurrentKg: 72, weightIdealKg: 68.8, kcalTarget: 2700, kcalSource: 'user', activityFactor: 1.6, sex: 'M', sterilized: false, ageYears: 3, bcs: 6 }, 'garmr'), presetFor('adult_maintenance')!);
}

export function realInput(cat: CatalogState, dog: Dog, foods: string[], supps: string[], simulate = false): FormulationInputV2 {
  const c = activated(cat, [...foods, ...supps]);
  return { ...buildInput(dog, { foods: foods.map((id) => ({ id })), supplements: supps.map((id) => ({ id })), dietMoisture: null, proteinDigestibility: null }, c, DEFAULT_SETTINGS, []), simulateSuggestions: simulate };
}

/** Prescrizione del 01/10/2025 (Ker), grammi fissi; «bovino 560 g, grasso massimo 10%» → profilo 10% (il più grasso ammesso). */
export const KER_PRESCRIPTION: RecipeItem[] = [
  { kind: 'food', id: 'beef_10', qty: 560 },
  { kind: 'food', id: 'oat_dry', qty: 100 },
  { kind: 'food', id: 'carrot_cooked', qty: 90 },
  { kind: 'food', id: 'coconut_oil', qty: 10 },
  { kind: 'food', id: 'flaxseed_oil', qty: 10 },
  { kind: 'supplement', id: 'bone_meal', qty: 5 },
  { kind: 'supplement', id: 'qdiet', qty: 13 },
  { kind: 'supplement', id: 'omegor_vitality', qty: 1 },
  { kind: 'supplement', id: 'psyllium_erbavoglio_husk_bio', qty: 5 },
];

/**
 * «Pratico» (§10 A): ogni gruppo nell'intervallo, nessun tetto superato, dosi entro il §5, nessun rosso e nessun
 * controllo di livello A non verificabile; peso totale realistico. Il criterio numerico del peso (≤ 1.300 g per 1000 kcal,
 * cioè almeno 77 kcal per 100 g in media) è una scelta della sviluppatrice per il collaudo: la specifica non lo quantifica.
 */
export const MAX_G_PER_1000_KCAL = 1300;

export function practical(r: FormulationResult): { ok: boolean; reasons: string[]; limitations: string[]; a: AuditResult | null } {
  const a = r.audit;
  const reasons: string[] = [];
  // preferenze non raggiunte e controlli non determinabili (es. resa di cottura mancante): elencati, non bloccanti
  const limitations: string[] = [];
  if (r.outcome !== 'solved' || !a?.v2) return { ok: false, reasons: [`esito ${r.outcome}: ${r.message}`], limitations, a: a ?? null };
  const red = a.rows.flatMap((x) => x.checks.filter((c) => c.color === 'red').map((c) => `${x.label}: ${c.message}`));
  const aGrey = a.rows.flatMap((x) => x.checks.filter((c) => c.level === 'A' && c.color === 'grey').map((c) => `${x.label}: ${c.message}`));
  if (red.length) reasons.push(`rossi: ${red.join('; ')}`);
  if (aGrey.length) reasons.push(`livello A non verificabile: ${aGrey.join('; ')}`);
  if (a.energyRow.color !== 'green') reasons.push(`energia: ${a.energyRow.note}`);
  for (const g of a.v2.groups) {
    if (g.color === 'green' || (g.foods.length === 0 && g.range[0] === 0)) continue;
    if (/sotto la preferenza|preferenza, non vincolo/.test(g.message)) limitations.push(g.message);
    else reasons.push(g.message);
  }
  for (const c of a.v2.caps) {
    if (c.color === 'green') continue;
    if (c.color === 'grey') limitations.push(c.message);
    else reasons.push(c.message);
  }
  for (const d of a.doseChecks ?? []) if (d.color === 'red') reasons.push(d.message);
  if (a.v2.forbidden.length) reasons.push(`vietati: ${a.v2.forbidden.join(', ')}`);
  const w = a.v2.totalWeightG;
  if (w === null || !a.kcal || (w * 1000) / a.kcal > MAX_G_PER_1000_KCAL) reasons.push(`peso totale ${w} g per ${a.kcal} kcal oltre ${MAX_G_PER_1000_KCAL} g/1000 kcal`);
  return { ok: reasons.length === 0, reasons, limitations, a };
}

/** elenco dei livelli B non verdi (consentiti nei menù positivi, ma elencati). */
export function levelBIssues(a: AuditResult | null): string[] {
  if (!a) return [];
  return a.rows.flatMap((x) => x.checks.filter((c) => c.level === 'B' && c.color !== 'green').map((c) => `${x.label} (${c.color})`));
}
