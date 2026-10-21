import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { foodStatus, supplementStatus } from '../../../../src/engine/catalogStatus';
import { DIAGNOSIS_LABEL, diagnosisOf } from '../../../../src/engine/diagnosis';
import type { FormulationInput, FormulationResult, PreliminaryResult } from '../../../../src/engine/formulate';
import type { ItemConstraint, RecipeItem } from '../../../../src/engine/types';
import { auditRecipeV2 } from '../../../../src/engine/auditV2';
import type { AuditResult } from '../../../../src/engine/audit';
import { MAX_RECIPES_PER_DOG, type Recipe } from '../../../../src/data/model';
import { PROCESSING_LABEL } from '../../../../src/data/packageCatalog';
import { activeRecipeCount, analysisVersion, assertCanAddRecipe, buildInput, costOf, digestibilityRef, selectionFromSnapshot, versionFromResult, type Selection } from '../../../../src/data/recipeService';
import { uid } from '../../../../src/data/repository';
import { useApp, useData } from '../../../lib/AppContext';
import { formulateRemote, preliminaryRemote } from '../../../lib/engineClient';
import { CatalogBadge, ConflictList, ResultBlock, SuggestionsCard } from '../../../lib/result';
import { Badge, Box, Bullets, Button, Card, Check, Choice, Disclaimer, ErrorBox, Field, H, Loading, NumField, Row, Screen, T } from '../../../lib/ui';

type Step = 1 | 2 | 3;

export default function NewRecipe() {
  const { id: dogId, da: fromId } = useLocalSearchParams<{ id: string; da?: string }>();
  const { repo, catalog, settings, bump } = useApp();
  const { data } = useData(
    async (r) => {
      const dog = (await r.listDogs()).find((d) => d.id === dogId) ?? null;
      const recipes = await r.listRecipes(dogId);
      const prices = await r.listPrices();
      let source: { recipe: Recipe; selection: Selection } | null = null;
      if (fromId) {
        const rc = recipes.find((x) => x.id === fromId);
        const vs = rc ? await r.listVersions(rc.id) : [];
        const cur = vs.find((v) => v.id === rc?.currentVersionId) ?? vs[vs.length - 1];
        if (rc && cur) source = { recipe: rc, selection: selectionFromSnapshot(cur.snapshot) };
      }
      return { dog, recipes, prices, source };
    },
    [dogId, fromId],
  );
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [sel, setSel] = useState<Selection>({ foods: [], supplements: [], dietMoisture: null });
  const [query, setQuery] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [prelim, setPrelim] = useState<PreliminaryResult | null>(null);
  const [result, setResult] = useState<{ r: FormulationResult; input: FormulationInput } | null>(null);
  // modalità analisi: ricetta già fatta a grammi fissi (nessun generatore)
  const [fixed, setFixed] = useState<Record<string, number | null> | null>(null);
  const [analysis, setAnalysis] = useState<{ input: ReturnType<typeof buildInput>; items: RecipeItem[]; audit: AuditResult } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // duplicazione: la selezione della ricetta di partenza si copia una volta, appena caricata
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data?.source && seededFrom !== data.source) {
    setSeededFrom(data.source);
    setSel(data.source.selection);
    setName(`${data.source.recipe.name} (copia)`);
  }

  const groups = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.categories
      .filter((c) => c.parentId)
      .map((c) => ({ cat: c, parent: catalog.categories.find((p) => p.id === c.parentId), foods: catalog.foods.filter((f) => f.subcategoryId === c.id && (!q || f.name.toLowerCase().includes(q))) }))
      .filter((g) => g.foods.length);
  }, [catalog, query]);

  if (!data || !catalog || !settings || !repo) return <Loading />;
  const { dog, recipes, prices } = data;
  if (!dog) return <Screen><T>Cane non trovato.</T></Screen>;
  if (activeRecipeCount(recipes) >= MAX_RECIPES_PER_DOG) return <Screen><Box color="orange"><T>{dog.name} ha già {MAX_RECIPES_PER_DOG} ricette attive: archiviane o eliminane una per crearne una nuova.</T></Box></Screen>;

  const toggle = (kind: 'foods' | 'supplements', id: string) =>
    setSel((s) => ({ ...s, [kind]: s[kind].some((x) => x.id === id) ? s[kind].filter((x) => x.id !== id) : [...s[kind], { id }] }));
  const setConstraint = (kind: 'foods' | 'supplements', id: string, c: ItemConstraint) =>
    setSel((s) => ({ ...s, [kind]: s[kind].map((x) => (x.id === id ? { ...x, constraint: { ...x.constraint, ...c } } : x)) }));

  const run = async (label: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  };
  const analyze = () =>
    run('Analisi in corso… (il primo calcolo della giornata può richiedere fino a un minuto)', async () => {
      if (!sel.foods.length) throw new Error('Seleziona almeno un alimento.');
      setPrelim(await preliminaryRemote(buildInput(dog, sel, catalog, settings, prices)));
      setStep(2);
    });
  const calculate = () =>
    run('Calcolo delle quantità…', async () => {
      const input = buildInput(dog, sel, catalog, settings, prices);
      setAnalysis(null);
      setResult({ r: await formulateRemote(input), input });
      setStep(3);
    });
  // §8 modalità analisi: stessi dati e stesse regole del generatore, sulle quantità inserite
  const analyzeFixed = () =>
    run('Verifica della ricetta…', async () => {
      const input = buildInput(dog, sel, catalog, settings, prices);
      const items: RecipeItem[] = [
        ...sel.foods.map((f) => ({ kind: 'food' as const, id: f.id, qty: fixed?.[f.id] ?? 0 })),
        ...sel.supplements.map((x) => ({ kind: 'supplement' as const, id: x.id, qty: fixed?.[x.id] ?? 0 })),
      ];
      if (!items.some((i) => i.qty > 0)) throw new Error('Inserisci almeno una quantità.');
      const audit = auditRecipeV2({
        items,
        foods: Object.fromEntries(input.foods.map((f) => [f.food.id, f.food])),
        supplements: Object.fromEntries(input.supplements.map((x) => [x.supplement.id, x.supplement])),
        nutrients: input.nutrients,
        limits: input.limits,
        dog: input.dog,
        dietMoisture: input.dietMoisture,
        settings: input.settings,
        config: input.config,
      });
      setResult(null);
      setAnalysis({ input, items, audit });
      setStep(3);
    });
  const saveAnalysis = () =>
    run('Salvataggio…', async () => {
      if (!analysis) return;
      assertCanAddRecipe(await repo.listRecipes(dog.id));
      const recipe: Recipe = { id: uid(), dogId: dog.id, name: name.trim() || 'Ricetta analizzata', isPrimary: recipes.length === 0, archived: false, currentVersionId: null, dietMoisture: sel.dietMoisture, createdAt: new Date().toISOString() };
      await repo.createRecipe(recipe);
      try {
        const v = analysisVersion({ id: uid(), recipeId: recipe.id, revision: 1, author: repo.userLabel(), note: 'Ricetta già fatta, inserita a grammi fissi' }, analysis.input, analysis.items);
        await repo.addVersion(v);
        await repo.updateRecipe({ ...recipe, currentVersionId: v.id });
      } catch (e) {
        await repo.deleteRecipe(recipe.id).catch(() => undefined);
        throw e;
      }
      bump();
      router.replace(`/ricetta/${recipe.id}`);
    });
  const save = () =>
    run('Salvataggio…', async () => {
      if (!result) return;
      assertCanAddRecipe(await repo.listRecipes(dog.id));
      const recipe: Recipe = { id: uid(), dogId: dog.id, name: name.trim() || 'Ricetta senza nome', isPrimary: recipes.length === 0, archived: false, currentVersionId: null, dietMoisture: sel.dietMoisture, createdAt: new Date().toISOString() };
      await repo.createRecipe(recipe);
      try {
        const v = versionFromResult(
          { id: uid(), recipeId: recipe.id, revision: 1, origin: fromId ? 'duplicate' : 'engine', parentVersionId: null, author: repo.userLabel(), note: fromId ? `Nuova formulazione completa a partire da «${data.source?.recipe.name}»` : null },
          result.r,
          result.input,
        );
        await repo.addVersion(v);
        await repo.updateRecipe({ ...recipe, currentVersionId: v.id });
      } catch (e) {
        await repo.deleteRecipe(recipe.id).catch(() => undefined);
        throw e;
      }
      bump();
      router.replace(`/ricetta/${recipe.id}`);
    });

  const snap = result ? { foods: Object.fromEntries(result.input.foods.map((f) => [f.food.id, f.food])), supplements: Object.fromEntries(result.input.supplements.map((s) => [s.supplement.id, s.supplement])) } : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: fromId ? 'Duplica o sostituisci' : 'Nuova ricetta' }} />
      <Choice
        options={[
          { value: '1', label: '1. Alimenti' },
          { value: '2', label: '2. Integratori' },
          { value: '3', label: '3. Risultato' },
        ]}
        value={String(step)}
        onChange={(v) => {
          const s = Number(v) as Step;
          if (s < step) setStep(s);
        }}
      />
      {fromId && <Box color="grey"><T small>Cambiando ingredienti la ricetta viene riformulata da zero: nessuna sostituzione grammo per grammo.</T></Box>}
      <ErrorBox error={error} />
      {busy && <Box color="blue"><T small>{busy}</T></Box>}

      {step === 1 && (
        <>
          <Card>
            <Field label="Nome della ricetta" value={name} onChange={setName} placeholder="es. Manzo e avena" />
            <T small muted>Tipo di razione (per il selenio). Casalinga, mista o non nota: si usa il riferimento più alto, per prudenza.</T>
            <Choice
              options={[
                { value: null, label: 'Casalinga / mista' },
                { value: 'wet' as const, label: 'Umida' },
                { value: 'dry' as const, label: 'Mangime secco completo' },
              ]}
              value={sel.dietMoisture}
              onChange={(v) => setSel({ ...sel, dietMoisture: v })}
            />
            <Check
              label="Digeribilità proteica di questa dieta ≥ 80% documentata"
              value={!!sel.proteinDigestibility?.atLeast80}
              onChange={(v) => setSel({ ...sel, proteinDigestibility: { atLeast80: v, reference: sel.proteinDigestibility?.reference ?? null } })}
            />
            {sel.proteinDigestibility?.atLeast80 && (
              <Field
                label="Riferimento documentale (analisi, studio, scheda)"
                value={sel.proteinDigestibility.reference ?? ''}
                onChange={(v) => setSel({ ...sel, proteinDigestibility: { atLeast80: true, reference: v || null } })}
              />
            )}
            <T small muted>
              {digestibilityRef(sel) ? 'Documentata: nessun margine sugli aminoacidi essenziali.' : 'Non documentata: i minimi degli aminoacidi essenziali sono aumentati del 10% (FEDIAF).'}
            </T>
          </Card>
          <Card>
            <H level={3}>Alimenti disponibili</H>
            <T small muted>Non serve indicare i grammi: li calcola l’app. «Da completare» = non utilizzabile; «Dati parziali» = utilizzabile, ma la ricetta non potrà risultare completa.</T>
            <Field placeholder="Cerca…" value={query} onChange={setQuery} />
            {groups.map((g) => {
              const n = g.foods.filter((f) => sel.foods.some((x) => x.id === f.id)).length;
              const open = openGroup === g.cat.id || !!query.trim();
              return (
                <View key={g.cat.id}>
                  <Button title={`${open ? '▾' : '▸'} ${g.parent?.label} · ${g.cat.label}${n ? ` (${n})` : ''}`} kind="ghost" small onPress={() => setOpenGroup(open ? null : g.cat.id)} />
                  {open &&
                    g.foods.map((f) => {
                      const st = foodStatus(f, catalog.nutrients);
                      return (
                        <Check
                          key={f.id}
                          value={sel.foods.some((x) => x.id === f.id)}
                          onChange={() => toggle('foods', f.id)}
                          label={
                            <View style={{ gap: 3 }}>
                              <T>{f.name}</T>
                              <Row wrap>
                                <T small muted>{PROCESSING_LABEL[f.processingState]}</T>
                                <CatalogBadge status={st.status} test={f.dataStatus === 'test_fixture'} />
                                {st.status !== 'to_complete' && !f.availableToFormulate && <Badge label="non attivo" color="grey" />}
                              </Row>
                            </View>
                          }
                        />
                      );
                    })}
                </View>
              );
            })}
          </Card>
          {sel.foods.length > 0 && (
            <Card>
              <H level={3}>Quantità: limiti facoltativi (g/die)</H>
              <T small muted>Selezionare un alimento lo rende disponibile, non obbligatorio: il calcolo può anche non usarlo. Per evitare quantità simboliche indica una porzione minima.</T>
              {sel.foods.map((s) => (
                <ItemLimits key={s.id} name={catalog.foods.find((f) => f.id === s.id)?.name ?? s.id} unit="g" c={s.constraint} onChange={(c) => setConstraint('foods', s.id, c)} />
              ))}
            </Card>
          )}
          <Button title="Analisi preliminare →" busy={!!busy} disabled={!dog.kcalTarget} onPress={analyze} />
        </>
      )}

      {step === 2 && prelim && (
        <>
          <Card>
            <H level={3}>Analisi preliminare (indicativa)</H>
            <T>{prelim.message}</T>
            {prelim.excluded.length > 0 && (
              <Box color="grey">
                <T bold small>Non utilizzabili</T>
                <Bullets small items={prelim.excluded.map((e) => `${e.name}: ${e.reason}`)} />
              </Box>
            )}
            {prelim.potentialGaps.length > 0 && (
              <>
                <T bold>Potenziali carenze con i soli alimenti</T>
                <Bullets small items={prelim.potentialGaps.map((g) => `${g.label}${g.coveredBySelectable.length ? ` — in catalogo: ${g.coveredBySelectable.join(', ')}` : ' — nessun integratore caratterizzato lo apporta'}`)} />
              </>
            )}
            {prelim.dataGaps.length > 0 && <T small muted>Dati mancanti negli alimenti per {prelim.dataGaps.length} nutrienti.</T>}
          </Card>
          <Card>
            <H level={3}>Integratori disponibili</H>
            <T small muted>Solo quelli selezionati entrano nel calcolo. Nessun prodotto o dose viene inventato.</T>
            {catalog.supplements.map((s) => {
              const st = supplementStatus(s, catalog.nutrients);
              return (
                <Check
                  key={s.id}
                  value={sel.supplements.some((x) => x.id === s.id)}
                  onChange={() => toggle('supplements', s.id)}
                  label={
                    <View style={{ gap: 3 }}>
                      <T>{s.name}</T>
                      <Row wrap>
                        <CatalogBadge status={st.status} test={s.status === 'test_fixture'} />
                        {st.status !== 'to_complete' && !s.usableForOptimization && <Badge label="non attivo" color="grey" />}
                        <T small muted>dose in {s.doseUnit}{s.integerDose ? ', intere' : ''}{s.maxDailyUnits ? `, max ${s.maxDailyUnits}/die` : ''}</T>
                      </Row>
                    </View>
                  }
                />
              );
            })}
          </Card>
          {sel.supplements.length > 0 && (
            <Card>
              <H level={3}>Quantità: limiti facoltativi</H>
              {sel.supplements.map((s) => {
                const sp = catalog.supplements.find((x) => x.id === s.id);
                return <ItemLimits key={s.id} name={sp?.name ?? s.id} unit={sp?.doseUnit ?? ''} c={s.constraint} onChange={(c) => setConstraint('supplements', s.id, c)} />;
              })}
            </Card>
          )}
          <Button title="Calcola le quantità →" busy={!!busy} onPress={calculate} />
          <Card>
            <H level={3}>Oppure: analizza una ricetta già fatta</H>
            <T small muted>Inserisci i grammi (o le dosi) della ricetta, per esempio quella della veterinaria: l’app non li cambia, li verifica con gli stessi controlli del generatore. I grammi sono per l’intero giorno.</T>
            {fixed === null ? (
              <Button title="Inserisci i grammi" kind="secondary" small onPress={() => setFixed({})} />
            ) : (
              <>
                {[...sel.foods.map((f) => ({ id: f.id, name: catalog.foods.find((x) => x.id === f.id)?.name ?? f.id, unit: 'g' })), ...sel.supplements.map((x) => {
                  const sp = catalog.supplements.find((y) => y.id === x.id);
                  return { id: x.id, name: sp?.name ?? x.id, unit: sp?.doseUnit ?? '' };
                })].map((it) => (
                  <NumField key={it.id} label={`${it.name} (${it.unit}/die)`} value={fixed[it.id] ?? null} onChange={(v) => setFixed({ ...fixed, [it.id]: v })} />
                ))}
                <Button title="Verifica questa ricetta →" busy={!!busy} onPress={analyzeFixed} />
              </>
            )}
          </Card>
        </>
      )}

      {step === 3 && analysis && (
        <>
          <Box color="blue"><T small>Analisi di una ricetta già fatta: quantità inserite, nessuna formulazione. Il rapporto elenca gli esiti senza giudicare chi l’ha prescritta.</T></Box>
          <ResultBlock
            audit={analysis.audit}
            items={analysis.items}
            snapshot={{ foods: Object.fromEntries(analysis.input.foods.map((f) => [f.food.id, f.food])), supplements: Object.fromEntries(analysis.input.supplements.map((x) => [x.supplement.id, x.supplement])) }}
            cost={costOf({ chosenItems: analysis.items, snapshot: { foods: Object.fromEntries(analysis.input.foods.map((f) => [f.food.id, f.food])), supplements: Object.fromEntries(analysis.input.supplements.map((x) => [x.supplement.id, x.supplement])) } as never }, prices)}
          />
          <Button title="Salva come ricetta analizzata" busy={!!busy} onPress={saveAnalysis} />
          <Button title="← Modifica i grammi" kind="secondary" onPress={() => setStep(2)} />
        </>
      )}

      {step === 3 && result && snap && (
        <>
          {result.r.outcome === 'solved' && result.r.audit ? (
            <ResultBlock
              audit={result.r.audit}
              items={result.r.items}
              snapshot={{ ...snap, referenceVersionIds: [...new Set(result.input.limits.map((l) => l.referenceVersionId))], engineVersion: result.r.engineVersion }}
              cost={costOf({ chosenItems: result.r.items, snapshot: snap as never }, prices)}
              constraints={result.r.constraints}
              notes={result.r.notes}
            />
          ) : result.r.outcome === 'preferences_unreachable' ? (
            <>
              <Box color="orange"><T bold>{result.r.message}</T></Box>
              {result.r.conflicts.length > 0 && <ConflictList conflicts={result.r.conflicts} suggestions={[]} />}
              {result.r.audit && (
                <ResultBlock
                  audit={result.r.audit}
                  items={result.r.items}
                  snapshot={{ ...snap, referenceVersionIds: [...new Set(result.input.limits.map((l) => l.referenceVersionId))], engineVersion: result.r.engineVersion }}
                  cost={costOf({ chosenItems: result.r.items, snapshot: snap as never }, prices)}
                  constraints={result.r.constraints}
                  notes={result.r.notes}
                />
              )}
            </>
          ) : result.r.outcome === 'infeasible' ? (
            <>
              <Box color="red"><T bold>{result.r.message}</T></Box>
              <ConflictList conflicts={result.r.conflicts} suggestions={result.r.suggestionDetails?.length ? [] : result.r.suggestions} />
              <SuggestionsCard details={result.r.suggestionDetails} />
            </>
          ) : (
            <Box color="grey">
              <T bold>{result.r.message}</T>
              <Bullets small items={result.r.excluded.map((e) => `${e.name}: ${e.reason}`)} />
            </Box>
          )}
          {result.r.outcome === 'solved' && <SuggestionsCard details={result.r.suggestionDetails} />}
          {result.r.excluded.length > 0 && result.r.outcome === 'solved' && (
            <Box color="grey"><Bullets small items={result.r.excluded.map((e) => `${e.name}: ${e.reason}`)} /></Box>
          )}
          {result.r.stats && (
            <T small muted>
              Calcolo in {(result.r.stats.durationMs / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} s
              {result.r.stats.caPStep ? ` · Ca:P al gradino ${result.r.stats.caPStep}` : result.r.stats.p1Stage === 2 ? ' · preferenze raggiunte con la seconda ricerca (ampliamenti documentati)' : ''}
              {result.r.stats.doseStep === 2 ? ' · QDiet al gradino 2 (+10%)' : ''}
            </T>
          )}
          <T small muted>{DIAGNOSIS_LABEL[diagnosisOf(result.r)]}</T>
          {result.r.outcome === 'solved' && <Button title="Salva ricetta" busy={!!busy} onPress={save} />}
          {result.r.outcome === 'preferences_unreachable' && result.r.items.length > 0 && <Button title="Salva come bozza diagnostica" kind="secondary" busy={!!busy} onPress={save} />}
          <Button title="← Modifica scelte" kind="secondary" onPress={() => setStep(2)} />
          <Disclaimer compact />
        </>
      )}
    </Screen>
  );
}

/** Limiti di quantità di un ingrediente: includi sempre, porzione minima (se usato o sempre), massimo. */
function ItemLimits({ name, unit, c, onChange }: { name: string; unit: string; c?: ItemConstraint; onChange: (c: ItemConstraint) => void }) {
  // vecchie selezioni: «almeno X» = sempre incluso con porzione minima X
  const required = !!c?.required || (c?.minQty ?? 0) > 0;
  const min = c?.minIfUsed ?? c?.minQty ?? null;
  return (
    <View style={{ gap: 4, paddingVertical: 4 }}>
      <T small bold>{name}</T>
      <Check label="Includi sempre" value={required} onChange={(v) => onChange({ required: v, minIfUsed: min, minQty: null })} />
      <Row>
        <NumField label={required ? `Porzione minima (${unit})` : `Porzione minima se usato (${unit})`} placeholder="nessuna" value={min} onChange={(v) => onChange({ required, minIfUsed: v, minQty: null })} />
        <NumField label={`Non oltre (${unit})`} placeholder="nessun limite" value={c?.maxQty ?? null} onChange={(v) => onChange({ maxQty: v })} />
      </Row>
    </View>
  );
}
