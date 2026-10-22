// Generatore v2 (specifiche del 21/10/2026, §3–§6 e precisazione 3).
// Un solo modello con alimenti e integratori insieme:
//  - struttura del pasto: gruppi con intervalli di % kcal e tetti di quantità per alimento ([PROPOSTA], configurazione);
//  - livello A rigido: energia ±tolleranza, minimi di proteine, grassi, calcio e fosforo, tutti i massimi nutrizionali,
//    Ca:P a gradini, massimi legali su sostanza secca se un integratore aggiunge il nutriente, dosi degli integratori,
//    alimenti vietati esclusi;
//  - livello B morbido: per ogni minimo con dati completi negli alimenti si minimizza lo scostamento normalizzato dal
//    riferimento, con beneficio che si ferma al raggiungimento; un minimo non dimostrabile per dati mancanti resta grigio
//    e non viene mai compensato con quantità aggiuntive;
//  - poi praticità (energia vicina all'obiettivo, meno integratori) e costo.
// Gradini (§5): Ca:P 1,2–1,4 → 1,1–1,5 → 1–2; QDiet entro la tabella → fino a +10%. Si prova nell'ordine e si dichiara
// il gradino raggiunto. Generatore e verifica (auditV2) usano gli stessi dati e le stesse conversioni.

import { applicableLimits, type AuditResult } from './audit';
import { A_MINIMA, auditRecipeV2 } from './auditV2';
import { foodStatus, supplementStatus } from './catalogStatus';
import { capOf, DEFAULT_CONFIG, doseRuleOf, ENGINE_VERSION_V2, groupOf, missingActivationNutrients, preparedFactor, weighingStateLabel, type FormulationConfig, type MealGroup } from './configV2';
import { doseRangeFor } from './doseGuide';
import { fediafReferenceKcal } from './energy';
import {
  buildItems,
  buildRows,
  checkUsability,
  diagnoseWith,
  fixObjective,
  rawValue,
  suggestionsFor,
  toItems,
  type Built,
  type BuiltRow,
  type Conflict,
  type ConstraintInfo,
  type FormulationInput,
  type FormulationResult,
  type ModelItem,
  type SuggestionDetail,
} from './formulate';
import { loadSolver, solve, type Model, type Row, type SolveResult, type Term, type VarDef } from './lp';
import type { Food, NutrientLimit, RecipeItem, Supplement } from './types';

export { ENGINE_VERSION_V2 };

export interface FormulationInputV2 extends FormulationInput {
  config?: FormulationConfig;
  /** rifà il calcolo con ogni candidato suggerito per verificarne l'effetto (predefinito: sì). */
  simulateSuggestions?: boolean;
}

const fmt = (n: number, d = 3) => n.toLocaleString('it-IT', { maximumFractionDigits: d });

interface StepPlan {
  caP: 1 | 2 | 3 | null;
  dose: 1 | 2;
}

interface V2Built extends Built {
  /** variabili di scostamento del livello B (una per minimo). */
  bVars: string[];
  /** scostamenti dalle preferenze della struttura del pasto (minimo delle verdure, tetti non verificabili), con il peso. */
  prefTerms: Term[];
  constraints: ConstraintInfo[];
}

/** limiti di dose per gradino (in passi) e testo dell'intervallo, con l'eventuale estrapolazione del QDiet. */
function doseCaps(s: Supplement, it: ModelItem, weightKg: number, cfg: FormulationConfig) {
  const rule = doseRuleOf(s.id, cfg);
  const range = s.doseGuide ? doseRangeFor(s.doseGuide, weightKg, { extrapolate: !!rule?.extrapolate }) : null;
  const declared = s.maxDailyUnits !== null && s.maxDailySource ? s.maxDailyUnits : null;
  const cap1 = range ? (declared === null ? range.max : Math.min(declared, range.max)) : declared;
  const cap2 = cap1 !== null && rule && range ? range.max * (1 + rule.marginPct / 100) : cap1;
  const toSteps = (x: number | null) => (x === null ? null : Math.floor(x / it.step + 1e-9));
  return {
    rule,
    range,
    step1: toSteps(cap1),
    step2: toSteps(cap2 === null ? null : declared === null ? cap2 : Math.min(declared, cap2)),
    text: range ? `${range.text} ${s.doseUnit}/die per il peso attuale di ${fmt(weightKg)} kg — ${s.doseGuide!.source}` : declared !== null ? `dose massima del catalogo ${fmt(declared)} ${s.doseUnit}/die (${s.maxDailySource})` : null,
  };
}

function massPerStep(it: ModelItem, sup?: Supplement): number {
  if (it.kind === 'food') return it.step;
  if (!sup) return 0;
  if (sup.doseUnit === 'g') return it.step;
  return sup.massPerUnitG === null ? 0 : sup.massPerUnitG * it.step;
}

/** sostanza secca per passo; umidità mancante → 0 (ipotesi prudente: concentrazione sovrastimata). */
function dryMatterPerStep(it: ModelItem, food?: Food, sup?: Supplement): number {
  if (it.kind === 'food') {
    const m = food?.nutrients.moisture?.value;
    return m === null || m === undefined ? 0 : it.step * (1 - m / 100);
  }
  const m = sup?.nutrients.moisture?.value;
  const mass = massPerStep(it, sup);
  return m === null || m === undefined ? 0 : Math.max(0, mass - m * it.step);
}

export async function formulateV2(input: FormulationInputV2): Promise<FormulationResult> {
  const t0 = Date.now();
  const cfg = input.config ?? DEFAULT_CONFIG;
  const highs = await loadSolver();
  let solves = 0;
  const runSolve = (m: Model) => {
    solves++;
    return solve(highs, m, input.settings.timeLimitSeconds);
  };
  const notes: string[] = [];
  const phases: FormulationResult['phases'] = [];
  const usable = checkUsability(input);
  const excluded = [...usable.excluded];
  // alimenti vietati (§9): mai usati
  const foods = usable.foods.filter(({ food }) => {
    if (food.forbidden) {
      excluded.push({ kind: 'food', id: food.id, name: food.name, reason: 'alimento vietato per il cane (§9): mai usato' });
      return false;
    }
    // prodotti concentrati (es. fegato): i nutrienti determinanti vanno documentati prima dell'uso
    const miss = missingActivationNutrients(food, cfg);
    if (miss.length) {
      excluded.push({ kind: 'food', id: food.id, name: food.name, reason: `prodotto concentrato: mancano dati determinanti (${miss.join(', ')}) — da documentare prima dell'uso` });
      return false;
    }
    return true;
  });
  const supplements = usable.supplements.filter(({ supplement: sp }) => {
    const miss = missingActivationNutrients(sp, cfg);
    if (!miss.length) return true;
    excluded.push({ kind: 'supplement', id: sp.id, name: sp.name, reason: `prodotto concentrato: mancano dati determinanti (${miss.join(', ')}) — da documentare prima dell'uso` });
    return false;
  });
  const base = { engineVersion: ENGINE_VERSION_V2, excluded, notes, phases, conflicts: [] as Conflict[], suggestions: [] as string[], constraints: [] as ConstraintInfo[], items: [] as RecipeItem[], audit: null as AuditResult | null };
  const done = (r: Omit<FormulationResult, 'stats'> & { stats?: Partial<NonNullable<FormulationResult['stats']>> }): FormulationResult => ({
    ...r,
    stats: { durationMs: Date.now() - t0, solves, p1Stage: null, caPStep: null, doseStep: null, ...r.stats },
  });
  const K = input.dog.kcalTarget ?? 0;
  if (!(K > 0)) return done({ ...base, outcome: 'blocked', message: 'Imposta l’obiettivo kcal del cane prima di calcolare.' });
  const refKcal = fediafReferenceKcal(input.dog.weightIdealKg);
  if (input.dog.lifeStage === 'adult_maintenance' && K < refKcal - 1e-6) {
    return done({
      ...base,
      outcome: 'blocked',
      message: `Obiettivo di ${fmt(K)} kcal sotto il riferimento FEDIAF di 95 kcal/kg^0,75 del peso ideale (${fmt(input.dog.weightIdealKg)} kg → ${fmt(Math.round(refKcal))} kcal): serve un profilo a bassa energia validato prima di generare una ricetta; le ricette esistenti restano analizzabili.`,
    });
  }
  if (!foods.length) return done({ ...base, outcome: 'blocked', message: 'Nessun alimento selezionato è utilizzabile: le composizioni devono essere inserite in catalogo.' });
  if (input.dog.lifeStage !== 'adult_maintenance') notes.push('Nessuno standard disponibile per questa fase di vita: il calcolo considera solo energia, struttura del pasto e target personali.');

  // §3: un gruppo con minimo > 0 senza alimenti selezionati → la selezione non basta; si propone cosa aggiungere
  const hasGroup = (g: MealGroup) => foods.some(({ food }) => groupOf(food, cfg)?.id === g.id);
  for (const g of cfg.groups) if (g.minIsPreference && g.minPctKcal > 0 && !hasGroup(g)) notes.push(`${g.label}: nessun alimento selezionato — la preferenza di almeno ${g.minPctKcal}% delle kcal non è raggiunta (non è un vincolo).`);
  const missingGroups = cfg.groups.filter((g) => g.minPctKcal > 0 && !g.minIsPreference && !hasGroup(g));
  if (missingGroups.length) {
    const details = missingGroups.flatMap((g) => groupCandidates(g, input, cfg));
    return done({
      ...base,
      outcome: 'infeasible',
      conflicts: missingGroups.map((g) => ({ label: `${g.label}: nessun alimento selezionato (intervallo proposto ${g.minPctKcal}–${g.maxPctKcal}% delle kcal)`, kind: 'user_bound', shortfall: g.minPctKcal, direction: 'deficit' })),
      suggestions: missingGroups.map((g) => {
        const c = details.filter((d) => d.label === g.label).map((d) => d.candidate.name + (d.candidate.toActivate ? ' (da attivare in catalogo)' : ''));
        return `${g.label}: aggiungi un alimento del gruppo${c.length ? ` — in catalogo con dati: ${c.join(', ')}` : ' — nessuno in catalogo ha ancora dati: servono quelli dell’IA dei dati'}.`;
      }),
      suggestionDetails: details,
      message: `La selezione non basta: manca ${missingGroups.map((g) => `un alimento del gruppo «${g.label}»`).join(' e ')}. L’app non compensa con quantità estreme: aggiungi uno degli alimenti indicati.`,
    });
  }

  const limits = applicableLimits(input.limits, input.dog, input.dietMoisture);
  const itemNotes: string[] = [];
  const items0 = buildItems({ ...input, foods, supplements }, foods, supplements, itemNotes);
  const foodById = new Map(foods.map(({ food }) => [food.id, food]));
  const supById = new Map(supplements.map(({ supplement }) => [supplement.id, supplement]));
  const caps = new Map<string, ReturnType<typeof doseCaps>>();
  for (const it of items0) {
    if (it.kind !== 'supplement') continue;
    const s = supById.get(it.id)!;
    const c = doseCaps(s, it, input.dog.weightCurrentKg, cfg);
    caps.set(it.id, c);
    it.guideMin = null; // v2: la dose minima del produttore non guida il calcolo (si segnala nella verifica)
    it.guideText = c.text;
  }
  // le note sulla tabella fuori peso non valgono per i prodotti con estrapolazione esplicita (QDiet)
  for (const n of itemNotes) if (!supplements.some(({ supplement: s }) => caps.get(s.id)?.range?.extrapolated && n.startsWith(`${s.name}: la tabella`))) notes.push(n);
  for (const it of items0) {
    const c = caps.get(it.id);
    if (c?.range?.extrapolated) notes.push(`${it.name}: dose ${c.range.text} ${supById.get(it.id)!.doseUnit}/die — estrapolato, non indicato dal produttore.`);
    if (it.kind === 'supplement' && c && c.step1 === null && it.ub === null) notes.push(`${it.name}: dose non indicata dal produttore — il generatore la limita solo con i controlli di livello A.`);
  }

  const hasQ = items0.some((it) => !!caps.get(it.id)?.rule && caps.get(it.id)!.step2 !== caps.get(it.id)!.step1);
  const complete = (n: string) => items0.every((it) => it.kind === 'supplement' || (it.value(n) !== null && !it.partial?.(n)));
  const caPApplies = complete('calcium') && complete('phosphorus');
  if (!caPApplies) notes.push('Ca:P non imposto dal generatore: manca il calcio o il fosforo di un alimento (la verifica lo mostra grigio).');
  const plans: StepPlan[] = (caPApplies ? ([[1, 1], [2, 1], [1, 2], [2, 2], [3, 1], [3, 2]] as const) : ([[null, 1], [null, 2]] as const))
    .map(([caP, dose]) => ({ caP, dose }) as StepPlan)
    .filter((p) => hasQ || p.dose === 1);

  const build = (plan: StepPlan) => buildV2(input, cfg, items0, limits, plan, caps, foodById, supById, notes);
  const timeout = (r: SolveResult, constraints: ConstraintInfo[]) =>
    done({ ...base, constraints, outcome: r.status === 'timeout' ? 'timeout' : 'error', message: `Calcolo non completato (${r.rawStatus}): la fattibilità non è stata determinata. Nessuna quantità proposta.` });

  // ── gradini: la prima combinazione che rispetta il livello A ──
  let chosen: { plan: StepPlan; built: V2Built; res: SolveResult } | null = null;
  const firstNotes = notes.length;
  for (const plan of plans) {
    notes.length = firstNotes;
    const built = build(plan);
    const obj: Term[] = built.bVars.map((v) => ({ v, c: 1 }));
    const r = runSolve({ ...built.model, objective: obj });
    phases.push({ name: `Livello A con Ca:P ${plan.caP ? `gradino ${plan.caP}` : 'non imposto'}${hasQ ? `, dosi gradino ${plan.dose}` : ''} — livello B: scostamenti normalizzati`, status: r.rawStatus, objective: r.status === 'optimal' ? r.objective : null });
    if (r.status === 'optimal') {
      chosen = { plan, built, res: r };
      break;
    }
    if (r.status !== 'infeasible') return timeout(r, built.constraints);
  }

  if (!chosen) {
    // nessuna combinazione: diagnosi elastica sul modello più ampio e suggerimenti simulati
    notes.length = firstNotes;
    const built = build(plans[plans.length - 1]);
    const conflicts = diagnoseWith(built, runSolve, false) ?? diagnoseWith(built, runSolve, true) ?? [];
    const details = input.simulateSuggestions === false ? [] : await simulate(input, conflictMetrics(conflicts), items0, 4, t0);
    return done({
      ...base,
      constraints: built.constraints,
      outcome: 'infeasible',
      conflicts,
      suggestions: [...suggestionsFor(conflicts, input, items0), ...details.map((d) => d.text)],
      suggestionDetails: details,
      message: conflicts.length
        ? 'Nessun menù rispetta tutto il livello A con questi ingredienti, nemmeno con i gradini consentiti: i vincoli elencati sono incompatibili. Vedi cosa servirebbe.'
        : 'Nessun menù rispetta tutto il livello A con questi ingredienti. La diagnosi automatica non è riuscita a isolare il vincolo responsabile: di solito è la combinazione di più limiti (per esempio rapporto Ca:P e massimo di fosforo), oppure le dosi intere. Prova ad aggiungere o cambiare un alimento o un integratore.',
    });
  }

  // ── livello B fissato (nessun minimo già coperto peggiora), poi praticità e costo ──
  const { plan, built } = chosen;
  let last = chosen.res;
  const bObj: Term[] = built.bVars.map((v) => ({ v, c: 1 }));
  let model = fixObjective(built.model, bObj, last.objective, 'fix_b');
  // preferenze della struttura del pasto (verdure ≥ 3% delle kcal, tetti di peso non verificabili per resa mancante)
  if (built.prefTerms.length) {
    const pr = runSolve({ ...model, objective: built.prefTerms });
    phases.push({ name: 'Preferenze della struttura del pasto', status: pr.rawStatus, objective: pr.status === 'optimal' ? pr.objective : null });
    if (pr.status !== 'optimal') return timeout(pr, built.constraints);
    model = fixObjective(model, built.prefTerms, pr.objective, 'fix_pref');
    last = pr;
  }
  const omegaObj: Term[] = items0.filter((it) => it.omega).map((it) => ({ v: it.v, c: it.step }));
  if (omegaObj.length) {
    const o = runSolve({ ...model, objective: omegaObj });
    phases.push({ name: 'EPA+DHA: minimo indispensabile di olio', status: o.rawStatus, objective: o.status === 'optimal' ? o.objective : null });
    if (o.status !== 'optimal') return timeout(o, built.constraints);
    model = fixObjective(model, omegaObj, o.objective, 'fix_omega');
    last = o;
  }
  const practical: Term[] = [{ v: 'ep', c: 1 / K }, { v: 'en', c: 1 / K }];
  // §3.3: di norma un alimento principale per gruppo → ogni alimento usato in più costa come il 2% di scarto energetico
  for (const v of built.model.vars) if (v.name.startsWith('y_f')) practical.push({ v: v.name, c: 0.02 });
  for (const it of built.items) {
    if (it.kind === 'supplement') practical.push({ v: it.v, c: (1e-2 * it.step) / Math.max((it.productMax ?? it.omegaMax ?? it.ub ?? 1000) * it.step, 1e-6) });
    else practical.push({ v: it.v, c: (1e-4 * it.step) / K });
  }
  const p2 = runSolve({ ...model, objective: practical });
  phases.push({ name: 'Praticità: energia vicina all’obiettivo, meno integratori', status: p2.rawStatus, objective: p2.status === 'optimal' ? p2.objective : null });
  if (p2.status !== 'optimal') return timeout(p2, built.constraints);
  last = p2;
  const prices = input.unitPrices ?? {};
  if (input.settings.preferLowerCost && built.items.every((it) => typeof prices[it.id] === 'number')) {
    model = fixObjective(model, practical, p2.objective, 'fix_p2');
    const p3 = runSolve({ ...model, objective: built.items.map((it) => ({ v: it.v, c: (prices[it.id] as number) * it.step })) });
    phases.push({ name: 'Costo', status: p3.rawStatus, objective: p3.status === 'optimal' ? p3.objective : null });
    if (p3.status === 'optimal') {
      last = p3;
      notes.push('A parità di vincoli e praticità è stata scelta la combinazione meno costosa con i tuoi prezzi.');
    }
  } else if (input.settings.preferLowerCost) notes.push('Costo non usato come criterio: mancano prezzi per alcuni componenti.');

  const proposal = toItems(built, last.values);
  for (const it of proposal) if (it.qty === 0) notes.push(`${built.items.find((x) => x.id === it.id)?.name}: non usato (quantità 0) — non serve per rispettare i controlli. Attiva «includi sempre» se vuoi usarlo.`);
  if (plan.caP && plan.caP > 1) notes.push(`Ca:P al gradino ${plan.caP} (${cfg.caPSteps.find((s) => s.step === plan.caP)?.label}): il gradino 1 non era raggiungibile con il resto del livello A.`);
  if (plan.dose === 2) notes.push('Dose del QDiet al gradino 2 (fino a +10% dell’indicazione del produttore): scelta operativa dell’utente, non un margine di sicurezza dimostrato; tutti gli altri controlli di livello A sono rispettati con la dose maggiorata.');

  const audit = auditRecipeV2({
    items: proposal,
    foods: Object.fromEntries(input.foods.map(({ food }) => [food.id, food])),
    supplements: Object.fromEntries(input.supplements.map(({ supplement }) => [supplement.id, supplement])),
    nutrients: input.nutrients,
    limits: input.limits,
    dog: input.dog,
    dietMoisture: input.dietMoisture,
    settings: input.settings,
    excluded: excluded.map((e) => ({ name: e.name, reason: e.reason })),
    config: cfg,
  });
  const usedDoseStep = (audit.v2?.doseSteps ?? []).reduce<1 | 2 | null>((a, d) => (d.step === 2 ? 2 : (a ?? d.step)), null);
  // §3.6 e §7.4: per i minimi di livello B sotto riferimento con dati noti, cosa servirebbe (simulato sul livello A)
  const lowB = audit.rows.filter((r) => r.checks.some((c) => c.level === 'B' && (c.color === 'orange' || c.color === 'yellow') && c.gap && c.gap.deviation < 0)).map((r) => r.metric);
  const details = input.simulateSuggestions === false || !lowB.length ? [] : await simulate(input, lowB.slice(0, 3), items0, 2, t0, audit);
  return done({
    ...base,
    constraints: built.constraints,
    outcome: 'solved',
    items: proposal,
    audit,
    suggestions: details.map((d) => d.text),
    suggestionDetails: details,
    message: audit.statusLabel,
    stats: { p1Stage: plan.caP, caPStep: audit.v2?.caPStep ?? plan.caP, doseStep: usedDoseStep },
  });
}

/** Modello v2 per una combinazione di gradini. */
function buildV2(
  input: FormulationInputV2,
  cfg: FormulationConfig,
  items0: ModelItem[],
  limits: NutrientLimit[],
  plan: StepPlan,
  caps: Map<string, ReturnType<typeof doseCaps>>,
  foodById: Map<string, Food>,
  supById: Map<string, Supplement>,
  notes: string[],
): V2Built {
  const K = input.dog.kcalTarget as number;
  const tol = cfg.energyTolerancePct / 100;
  const label = new Map(input.nutrients.map((n) => [n.id, n.label]));
  const unit = new Map(input.nutrients.map((n) => [n.id, n.unit]));
  const items: ModelItem[] = items0.map((it) => {
    if (it.kind !== 'supplement') return { ...it };
    const c = caps.get(it.id);
    return { ...it, productMax: c ? (plan.dose === 2 ? c.step2 : c.step1) : it.productMax };
  });
  const rows: BuiltRow[] = [];
  const extra: Row[] = [];
  const vars: VarDef[] = items.map((it) => {
    let ub = it.ub;
    for (const m of [it.productMax, it.omegaMax]) if (m !== null) ub = ub === null ? m : Math.min(ub, m);
    return { name: it.v, lb: it.lb, ub: ub ?? Math.ceil(10000 / it.step), integer: it.integerUnits };
  });
  const ubOf = (it: ModelItem) => vars.find((x) => x.name === it.v)!.ub as number;
  const kcalTerms = (f: number): Term[] => items.map((it) => ({ v: it.v, c: f * it.kcal }));
  const coef = (n: string): Term[] => items.map((it) => ({ v: it.v, c: it.value(n) ?? 0 }));
  const complete = (n: string) => items.every((it) => it.kind === 'supplement' || (it.value(n) !== null && !it.partial?.(n)));
  const hard = (name: string, terms: Term[], op: Row['op'], rhs: number, scale: number, info: Omit<ConstraintInfo, 'name' | 'hardness'>) =>
    rows.push({ name, terms, op, rhs, scale, info: { ...info, name, hardness: 'hard' } });
  const uLabel = (m: string) => `${unit.get(m) ?? ''}/1000 kcal`;

  // energia ±tolleranza (§4 livello A)
  const energy: BuiltRow = {
    name: 'energy',
    terms: [...kcalTerms(1), { v: 'ep', c: -1 }, { v: 'en', c: 1 }],
    op: '=',
    rhs: K,
    scale: K,
    info: { name: 'energy', label: `Energia: ${fmt(K)} kcal ±${cfg.energyTolerancePct}% (livello A, [PROPOSTA])`, kind: 'energy', hardness: 'hard' },
  };
  vars.push({ name: 'ep', lb: 0, ub: tol * K, integer: false }, { name: 'en', lb: 0, ub: tol * K, integer: false });

  // minimi di livello A e B, massimi nutrizionali
  const bVars: string[] = [];
  const prefTerms: Term[] = [];
  const bSkipped: string[] = [];
  const aSkipped: string[] = [];
  for (const l of limits) {
    if (l.basis !== 'per_1000_kcal_me' && l.basis !== 'per_day') continue;
    if (!label.has(l.metric)) continue;
    const src = `(${l.source})`;
    if (l.limitClass === 'OFFICIAL_NUTRITIONAL_MAX' && l.upper !== null) {
      // massimo: i contributi noti sono un limite inferiore del vero apporto → vincolo sempre applicabile
      const terms = l.basis === 'per_day' ? coef(l.metric) : [...coef(l.metric), ...kcalTerms(-l.upper / 1000)];
      hard(`max_${l.metric}`, terms, '<=', l.basis === 'per_day' ? l.upper : 0, Math.max((l.upper * K) / 1000, 1e-9), { label: `${label.get(l.metric)}: massimo ${fmt(l.upper)} ${uLabel(l.metric)} ${src} — livello A`, kind: 'official_max', metric: l.metric });
      continue;
    }
    const isMin = l.lower !== null && (l.limitClass === 'OFFICIAL_MIN' || l.limitClass === 'RECOMMENDED_ALLOWANCE');
    if (!isMin) continue;
    const m = l.lower as number;
    const daily = l.basis === 'per_day' ? m : (m * K) / 1000;
    const levelA = l.limitClass === 'OFFICIAL_MIN' && A_MINIMA.has(l.metric);
    if (!complete(l.metric)) {
      (levelA ? aSkipped : bSkipped).push(label.get(l.metric) as string);
      continue;
    }
    const what = l.limitClass === 'RECOMMENDED_ALLOWANCE' ? (l.displayLabel ?? 'apporto raccomandato') : 'minimo';
    const desc = `${label.get(l.metric)}: ${what} ${fmt(m)} ${l.basis === 'per_day' ? `${unit.get(l.metric)}/die` : uLabel(l.metric)} ${src}`;
    if (levelA) {
      hard(`minK_${l.metric}`, coef(l.metric), '>=', daily, daily, { label: `${desc} — livello A, su ${fmt(K)} kcal obiettivo`, kind: 'official_min', metric: l.metric });
      hard(`minE_${l.metric}`, [...coef(l.metric), ...kcalTerms(-m / 1000)], '>=', 0, daily, { label: `${desc} — livello A`, kind: 'official_min', metric: l.metric });
      continue;
    }
    // livello B: d ∈ [0,1] = scostamento normalizzato dal riferimento (nessun beneficio oltre il minimo)
    const d = `b${bVars.length}`;
    bVars.push(d);
    vars.push({ name: d, lb: 0, ub: 1, integer: false });
    const info = { label: `${desc} — livello B (obiettivo morbido)`, kind: l.limitClass === 'RECOMMENDED_ALLOWANCE' ? ('recommended' as const) : ('official_min' as const), metric: l.metric };
    rows.push({ name: `bK_${l.metric}`, terms: [...coef(l.metric), { v: d, c: daily }], op: '>=', rhs: daily, scale: daily, dev: { v: d, group: 'preference' }, info: { ...info, name: `bK_${l.metric}`, hardness: 'soft' } });
    if (l.basis === 'per_1000_kcal_me') {
      rows.push({ name: `bE_${l.metric}`, terms: [...coef(l.metric), ...kcalTerms(-m / 1000), { v: d, c: daily }], op: '>=', rhs: 0, scale: daily, dev: { v: d, group: 'preference' }, info: { ...info, name: `bE_${l.metric}`, hardness: 'soft' } });
    }
  }
  if (aSkipped.length) notes.push(`Minimi di livello A non imposti per dati mancanti negli alimenti (la verifica li mostra grigi): ${[...new Set(aSkipped)].join(', ')}.`);
  if (bSkipped.length) notes.push(`Minimi di livello B non usati dal generatore per dati mancanti (restano grigi, mai compensati con quantità aggiuntive): ${[...new Set(bSkipped)].join(', ')}.`);

  // Ca:P a gradini (§5)
  if (plan.caP) {
    const st = cfg.caPSteps.find((s) => s.step === plan.caP)!;
    const ca = coef('calcium');
    const p = coef('phosphorus');
    const scale = (1.45 * K) / 1000;
    hard('cap_lo', ca.map((t, i) => ({ v: t.v, c: t.c - st.lower * p[i].c })), '>=', 0, scale, { label: `Ca:P almeno ${fmt(st.lower)} (${st.label}) — livello A`, kind: 'official_ratio', metric: 'ca_p_ratio' });
    hard('cap_hi', ca.map((t, i) => ({ v: t.v, c: t.c - st.upper * p[i].c })), '<=', 0, scale, { label: `Ca:P al più ${fmt(st.upper)} (${st.label}) — livello A`, kind: 'official_ratio', metric: 'ca_p_ratio' });
  }

  // porzione minima se usato (binarie), un solo olio EPA+DHA
  const usedVar = new Map<string, string>();
  const used = (it: ModelItem) => {
    let y = usedVar.get(it.v);
    if (y) return y;
    y = `y_${it.v}`;
    usedVar.set(it.v, y);
    vars.push({ name: y, lb: 0, ub: 1, integer: true });
    extra.push({ name: `use_${it.v}`, terms: [{ v: it.v, c: 1 }, { v: y, c: -ubOf(it) }], op: '<=', rhs: 0 });
    return y;
  };
  for (const it of items) {
    if (it.semiMin === null) continue;
    const v = vars.find((x) => x.name === it.v)!;
    if (it.semiMin > (v.ub as number)) {
      v.ub = 0;
      notes.push(`${it.name}: la porzione minima supera la quantità massima consentita, quindi non viene usato.`);
      continue;
    }
    if ((v.ub as number) === 0) continue;
    extra.push({ name: `semi_lo_${it.v}`, terms: [{ v: it.v, c: 1 }, { v: used(it), c: -it.semiMin }], op: '>=', rhs: 0 });
  }
  const omegas = items.filter((it) => it.omega && ubOf(it) > 0);
  if (omegas.length > 1 && omegas.filter((it) => it.required).length <= 1) extra.push({ name: 'omega_one', terms: omegas.map((it) => ({ v: used(it), c: 1 })), op: '<=', rhs: 1 });

  // struttura del pasto: gruppi in % delle kcal ([PROPOSTA])
  const groupsUsed = new Map<string, { g: MealGroup; its: ModelItem[] }>();
  for (const it of items) {
    if (it.kind !== 'food') continue;
    const g = groupOf(foodById.get(it.id)!, cfg);
    if (!g) continue;
    const e = groupsUsed.get(g.id) ?? { g, its: [] };
    e.its.push(it);
    groupsUsed.set(g.id, e);
  }
  for (const { g, its } of groupsUsed.values()) {
    const ids = new Set(its.map((x) => x.v));
    const share = (p: number): Term[] => items.map((it) => ({ v: it.v, c: (ids.has(it.v) ? it.kcal : 0) - (p / 100) * it.kcal }));
    if (g.minPctKcal > 0 && g.minIsPreference) {
      // preferenza: scostamento in kcal penalizzato, nessun vincolo rigido
      const sv = `pg_${g.id}`;
      vars.push({ name: sv, lb: 0, ub: null, integer: false });
      prefTerms.push({ v: sv, c: 1 / K });
      const name = `grp_lo_${g.id}`;
      rows.push({ name, terms: [...share(g.minPctKcal), { v: sv, c: 1 }], op: '>=', rhs: 0, scale: K, dev: { v: sv, group: 'preference' }, info: { name, label: `${g.label}: almeno ${g.minPctKcal}% delle kcal — preferenza, non vincolo ([PROPOSTA], decisione del 22/10)`, kind: 'personal_soft', hardness: 'soft' } });
    } else if (g.minPctKcal > 0) hard(`grp_lo_${g.id}`, share(g.minPctKcal), '>=', 0, K, { label: `${g.label}: almeno ${g.minPctKcal}% delle kcal (struttura del pasto, [PROPOSTA])`, kind: 'user_bound' });
    if (g.maxPctKcal < 100) hard(`grp_hi_${g.id}`, share(g.maxPctKcal), '<=', 0, K, { label: `${g.label}: al più ${g.maxPctKcal}% delle kcal (struttura del pasto, [PROPOSTA])`, kind: 'user_bound' });
  }
  // tetti di quantità per alimento (catalogo o predefinito): % del peso degli ALIMENTI della razione pronta, senza acqua
  // aggiunta né integratori. Gli alimenti pesati crudi o secchi da cuocere contano con la resa documentata; se manca,
  // il denominatore non è determinabile: il tetto diventa una preferenza (sul peso come pesato) e la verifica lo segnala.
  const factorOf = (it: ModelItem) => (it.kind === 'food' ? preparedFactor(foodById.get(it.id)!, cfg) : 0);
  const noYield = items.filter((it) => it.kind === 'food' && factorOf(it) === null).map((it) => `${it.name} (${weighingStateLabel(foodById.get(it.id)!)})`);
  const massTerms = (p: number, self: ModelItem): Term[] => items.map((it) => ({ v: it.v, c: (it.v === self.v ? it.step * (factorOf(it) ?? 1) : 0) - (p / 100) * it.step * (factorOf(it) ?? 1) }));
  if (noYield.length && items.some((it) => it.kind === 'food' && capOf(foodById.get(it.id)!, cfg).maxFreshWeightPct !== null))
    notes.push(`Tetti in % del peso non verificabili e usati come preferenza: manca la resa di cottura documentata per ${noYield.join(', ')} (la resa non viene inventata; i nutrienti restano calcolati sul peso come pesato).`);
  for (const it of items) {
    if (it.kind !== 'food') continue;
    const f = foodById.get(it.id)!;
    const cap = capOf(f, cfg);
    const src = cap.source.join('; ');
    if (cap.maxFreshWeightPct !== null) {
      const label = `${f.name} (${weighingStateLabel(f)}): al più ${cap.maxFreshWeightPct}% del peso degli alimenti della razione (${src})`;
      if (noYield.length) {
        const sv = `pc_${it.v}`;
        vars.push({ name: sv, lb: 0, ub: null, integer: false });
        prefTerms.push({ v: sv, c: 1 / 100 });
        const name = `cap_fw_${it.v}`;
        rows.push({ name, terms: [...massTerms(cap.maxFreshWeightPct, it), { v: sv, c: -1 }], op: '<=', rhs: 0, scale: 100, dev: { v: sv, group: 'preference' }, info: { name, label: `${label} — preferenza: denominatore non determinabile senza resa di cottura`, kind: 'personal_soft', hardness: 'soft' } });
      } else hard(`cap_fw_${it.v}`, massTerms(cap.maxFreshWeightPct, it), '<=', 0, 100, { label, kind: 'user_bound' });
    }
    if (cap.maxPctKcal !== null) hard(`cap_kc_${it.v}`, items.map((x) => ({ v: x.v, c: (x.v === it.v ? x.kcal : 0) - (cap.maxPctKcal! / 100) * x.kcal })), '<=', 0, K, { label: `${f.name}: al più ${cap.maxPctKcal}% delle kcal (${src})`, kind: 'user_bound' });
    if (cap.maxGPer1000Kcal !== null) hard(`cap_g_${it.v}`, items.map((x) => ({ v: x.v, c: (x.v === it.v ? x.step : 0) - (cap.maxGPer1000Kcal! / 1000) * x.kcal })), '<=', 0, 100, { label: `${f.name}: al più ${cap.maxGPer1000Kcal} g per 1000 kcal (${src})`, kind: 'user_bound' });
  }

  // massimi legali su sostanza secca: solo se un integratore usato aggiunge il nutriente come additivo (§4)
  for (const ll of cfg.legalLimits) {
    const adders = items.filter((it) => it.kind === 'supplement' && supById.get(it.id)?.nutrients[ll.metric]?.declared === 'added' && (supById.get(it.id)!.nutrients[ll.metric].value ?? 0) > 0 && ubOf(it) > 0);
    if (!adders.length) continue;
    const terms = items.map((it) => ({ v: it.v, c: (it.value(ll.metric) ?? 0) - (ll.upper / 100) * dryMatterPerStep(it, foodById.get(it.id), supById.get(it.id)) }));
    const M = items.reduce((a, it) => a + Math.max(0, it.value(ll.metric) ?? 0) * ubOf(it), 0) + 1;
    for (const s of adders) {
      const y = used(s);
      hard(`legal_${ll.metric}_${s.v}`, [...terms, { v: y, c: M }], '<=', M, Math.max(ll.upper, 1e-9), { label: `${label.get(ll.metric)}: massimo legale ${fmt(ll.upper)} ${ll.unit}/100 g di sostanza secca se si usa ${s.name} (additivo) — livello A, umidità mancante contata come sostanza secca zero`, kind: 'legal_max', metric: ll.metric });
    }
  }

  // target fissati da un professionista: vincoli rigidi (se i dati lo consentono)
  const locked = limits.filter((l) => l.limitClass === 'PERSONAL_TARGET' && l.hardness === 'hard');
  if (locked.length) {
    const r = buildRows(input, items, locked, notes);
    for (const row of r.rows) {
      if (row.dev) {
        notes.push(`${row.info.label}: target professionale non imposto per dati mancanti (la verifica lo mostra grigio).`);
        continue;
      }
      rows.push({ ...row, name: `pt_${row.name}`, info: { ...row.info, name: `pt_${row.name}` } });
    }
  }

  const constraints: ConstraintInfo[] = [energy.info, ...rows.map((r) => r.info)];
  for (const it of items) {
    if (it.required) constraints.push({ name: `lb_${it.v}`, label: `${it.name}: sempre incluso${it.minQty ? `, almeno ${fmt(it.minQty)}` : ''}`, kind: 'user_bound', hardness: 'hard' });
    if (it.semiMin !== null) constraints.push({ name: `semi_${it.v}`, label: `${it.name}: se usato, almeno ${fmt(it.semiMin * it.step)}${it.practicalMin !== null ? ' (minimo pratico: 5 g o 0,5% delle kcal)' : ''} — altrimenti 0`, kind: 'user_bound', hardness: 'hard' });
    if (it.maxQty !== null) constraints.push({ name: `ub_${it.v}`, label: `${it.name}: non oltre ${fmt(it.maxQty)}`, kind: 'user_bound', hardness: 'hard' });
    if (it.productMax !== null) constraints.push({ name: `pm_${it.v}`, label: `${it.name}: dose massima ${fmt(it.productMax * it.step)}${plan.dose === 2 && caps.get(it.id)?.rule ? ' (gradino 2: +10% sull’indicazione del produttore)' : ''}${it.guideText ? ` — ${it.guideText}` : ''}`, kind: 'product_max', hardness: 'hard' });
    if (it.omegaMax !== null) constraints.push({ name: `om_${it.v}`, label: `${it.name}: limite operativo ${fmt(it.omegaMax * it.step)} (copre l’obiettivo EPA+DHA; non è un massimo clinico)`, kind: 'product_max', hardness: 'hard' });
  }
  return {
    model: { vars, rows: [energy, ...rows, ...extra], objective: [] },
    rows: [energy, ...rows],
    widened: [],
    items,
    energyDev: ['ep', 'en'],
    K,
    bVars,
    prefTerms,
    constraints,
  };
}

function conflictMetrics(conflicts: Conflict[]): string[] {
  const out: string[] = [];
  for (const c of conflicts) {
    if (!c.metric || c.direction !== 'deficit') continue;
    const m = c.metric === 'ca_p_ratio' ? 'calcium' : c.metric;
    if (!out.includes(m)) out.push(m);
  }
  return out.slice(0, 3);
}

/** alimenti del catalogo con dati utilizzabili per un gruppo mancante (anche da attivare o da comprare). */
function groupCandidates(g: MealGroup, input: FormulationInput, cfg: FormulationConfig): SuggestionDetail[] {
  const cat = input.catalogForSuggestions;
  if (!cat) return [];
  return cat.foods
    .filter((f) => !f.forbidden && groupOf(f, cfg)?.id === g.id && foodStatus(f, input.nutrients).status !== 'to_complete' && f.kcalMePer100g)
    // prima i dati reali e i prodotti già attivi, poi quelli di prova
    .sort((a, b) => Number(a.dataStatus === 'test_fixture') - Number(b.dataStatus === 'test_fixture') || Number(b.availableToFormulate) - Number(a.availableToFormulate))
    .slice(0, 4)
    .map((f) => ({
      metric: null,
      label: g.label,
      candidate: { kind: 'food' as const, id: f.id, name: f.name, toActivate: !f.availableToFormulate },
      simulated: false,
      feasible: false,
      text: `${g.label}: ${f.name}${f.availableToFormulate ? '' : ' (da attivare in catalogo)'}`,
    }));
}

/**
 * §7.4 e §3.6: per i nutrienti mancanti propone alimenti o integratori del catalogo con dato noto per quel nutriente e
 * SIMULA l'aggiunta rifacendo il calcolo (stesso livello A: massimi, Ca:P, dosi). Non applica nulla: sceglie l'utente.
 */
async function simulate(input: FormulationInputV2, metrics: string[], items: ModelItem[], maxRuns: number, t0: number, current?: AuditResult): Promise<SuggestionDetail[]> {
  const cat = input.catalogForSuggestions;
  if (!cat || !metrics.length) return [];
  const label = new Map(input.nutrients.map((n) => [n.id, n.label]));
  const selected = new Set(items.map((i) => i.id));
  const out: SuggestionDetail[] = [];
  const seen = new Set<string>();
  const pctOf = (a: AuditResult | null | undefined, m: string) => {
    const c = a?.rows.find((r) => r.metric === m)?.checks.find((x) => x.level === 'B' || x.level === 'A');
    return c ? `${c.color === 'green' ? 'coperto' : c.color === 'grey' ? 'non dimostrato' : 'sotto riferimento'} — ${c.message.split(': ').slice(1).join(': ')}` : null;
  };
  for (const m of metrics) {
    const foods = cat.foods
      .filter((f) => !f.forbidden && !selected.has(f.id) && f.kcalMePer100g && (rawValue(f.nutrients, m) ?? 0) > 0 && foodStatus(f, input.nutrients).status !== 'to_complete')
      .sort((a, b) => Number(a.dataStatus === 'test_fixture') - Number(b.dataStatus === 'test_fixture') || (rawValue(b.nutrients, m) as number) / (b.kcalMePer100g as number) - (rawValue(a.nutrients, m) as number) / (a.kcalMePer100g as number))
      .slice(0, 1);
    const supps = cat.supplements
      .filter((s) => !selected.has(s.id) && s.status !== 'missing' && (rawValue(s.nutrients, m) ?? 0) > 0 && supplementStatus(s, input.nutrients).status !== 'to_complete')
      .sort((a, b) => Number(a.status === 'test_fixture') - Number(b.status === 'test_fixture'))
      .slice(0, 1);
    const cands = [...supps.map((s) => ({ kind: 'supplement' as const, x: s })), ...foods.map((f) => ({ kind: 'food' as const, x: f }))];
    if (!cands.length) {
      out.push({ metric: m, label: label.get(m) ?? m, candidate: { kind: 'food', id: '', name: '—', toActivate: false }, simulated: false, feasible: false, text: `${label.get(m) ?? m}: nessun alimento o integratore del catalogo ha un dato noto per questo nutriente — serve un prodotto caratterizzato (dati dall’IA dei dati).` });
      continue;
    }
    for (const c of cands) {
      if (seen.has(c.x.id)) continue;
      seen.add(c.x.id);
      const toActivate = c.kind === 'food' ? !(c.x as Food).availableToFormulate : !(c.x as Supplement).usableForOptimization;
      const base = { metric: m, label: label.get(m) ?? m, candidate: { kind: c.kind, id: c.x.id, name: c.x.name, toActivate } };
      if (out.filter((d) => d.simulated).length >= maxRuns || Date.now() - t0 > 25000) {
        out.push({ ...base, simulated: false, feasible: false, text: `${base.label}: ${c.x.name} ha un dato noto per questo nutriente${toActivate ? ' (da attivare in catalogo)' : ''} — non simulato (limite di tempo).` });
        continue;
      }
      const next: FormulationInputV2 = {
        ...input,
        simulateSuggestions: false,
        foods: c.kind === 'food' ? [...input.foods, { food: { ...(c.x as Food), availableToFormulate: true } }] : input.foods,
        supplements: c.kind === 'supplement' ? [...input.supplements, { supplement: { ...(c.x as Supplement), usableForOptimization: true } }] : input.supplements,
      };
      const r = await formulateV2(next);
      const qty = r.items.find((i) => i.id === c.x.id)?.qty ?? 0;
      const unit = c.kind === 'food' ? 'g' : (c.x as Supplement).doseUnit;
      const levelAOk = r.outcome === 'solved' && r.audit?.status !== 'FAILS_OFFICIAL_LIMITS';
      const after = pctOf(r.audit, m);
      const before = pctOf(current, m);
      const text =
        r.outcome !== 'solved'
          ? `${base.label}: aggiungendo ${c.x.name}${toActivate ? ' (da attivare in catalogo)' : ''} il generatore non trova comunque un menù che rispetti il livello A.`
          : qty === 0
            ? `${base.label}: ${c.x.name} non verrebbe usato (non migliora l’apporto entro i limiti di livello A).`
            : `${base.label}: aggiungendo ${c.x.name}${toActivate ? ' (da attivare in catalogo)' : ''}, ${fmt(qty)} ${unit}/die${after ? ` → ${after}` : ''}; livello A ${levelAOk ? 'rispettato' : 'NON rispettato'} nella simulazione.`;
      out.push({ ...base, simulated: true, feasible: r.outcome === 'solved', qty, unit, before, after, levelAOk, text });
    }
  }
  return out;
}
