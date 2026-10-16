import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { foodStatus, supplementStatus } from '../../../../src/engine/catalogStatus';
import type { FormulationInput, FormulationResult, PreliminaryResult } from '../../../../src/engine/formulate';
import type { ItemConstraint } from '../../../../src/engine/types';
import { MAX_RECIPES_PER_DOG, type Recipe } from '../../../../src/data/model';
import { PROCESSING_LABEL } from '../../../../src/data/packageCatalog';
import { assertCanAddRecipe, buildInput, costOf, selectionFromSnapshot, versionFromResult, type Selection } from '../../../../src/data/recipeService';
import { uid } from '../../../../src/data/repository';
import { useApp, useData } from '../../../lib/AppContext';
import { formulateRemote, preliminaryRemote } from '../../../lib/engineClient';
import { CatalogBadge, ConflictList, ResultBlock } from '../../../lib/result';
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.source) {
      setSel(data.source.selection);
      setName(`${data.source.recipe.name} (copia)`);
    }
  }, [data?.source]);

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
  if (recipes.length >= MAX_RECIPES_PER_DOG) return <Screen><Box color="orange"><T>{dog.name} ha già {MAX_RECIPES_PER_DOG} ricette: eliminane una per crearne una nuova.</T></Box></Screen>;

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
      setResult({ r: await formulateRemote(input), input });
      setStep(3);
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
            <T small muted>Tipo di dieta per il selenio (FEDIAF distingue umida/secca)</T>
            <Choice
              options={[
                { value: 'wet' as const, label: 'Umida' },
                { value: 'dry' as const, label: 'Secca' },
                { value: null, label: 'Non so' },
              ]}
              value={sel.dietMoisture}
              onChange={(v) => setSel({ ...sel, dietMoisture: v })}
            />
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
              <H level={3}>Limiti facoltativi (g/die)</H>
              {sel.foods.map((s) => (
                <View key={s.id} style={{ gap: 4 }}>
                  <T small bold>{catalog.foods.find((f) => f.id === s.id)?.name}</T>
                  <Row>
                    <NumField placeholder="almeno" value={s.constraint?.minQty ?? null} onChange={(v) => setConstraint('foods', s.id, { minQty: v })} />
                    <NumField placeholder="non oltre" value={s.constraint?.maxQty ?? null} onChange={(v) => setConstraint('foods', s.id, { maxQty: v })} />
                  </Row>
                </View>
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
              <H level={3}>Limiti facoltativi</H>
              {sel.supplements.map((s) => (
                <View key={s.id} style={{ gap: 4 }}>
                  <T small bold>{catalog.supplements.find((x) => x.id === s.id)?.name}</T>
                  <Row>
                    <NumField placeholder="almeno" value={s.constraint?.minQty ?? null} onChange={(v) => setConstraint('supplements', s.id, { minQty: v })} />
                    <NumField placeholder="non oltre" value={s.constraint?.maxQty ?? null} onChange={(v) => setConstraint('supplements', s.id, { maxQty: v })} />
                  </Row>
                </View>
              ))}
            </Card>
          )}
          <Button title="Calcola le quantità →" busy={!!busy} onPress={calculate} />
        </>
      )}

      {step === 3 && result && snap && (
        <>
          {result.r.outcome === 'solved' && result.r.audit ? (
            <ResultBlock
              audit={result.r.audit}
              items={result.r.items}
              snapshot={{ ...snap, referenceVersionIds: [...new Set(result.input.limits.map((l) => l.referenceVersionId))], factors: result.input.factors, engineVersion: result.r.engineVersion }}
              cost={costOf({ chosenItems: result.r.items, snapshot: snap as never }, prices)}
              constraints={result.r.constraints}
              notes={result.r.notes}
            />
          ) : result.r.outcome === 'infeasible' ? (
            <>
              <Box color="red"><T bold>{result.r.message}</T></Box>
              <ConflictList conflicts={result.r.conflicts} suggestions={result.r.suggestions} />
            </>
          ) : (
            <Box color="grey">
              <T bold>{result.r.message}</T>
              <Bullets small items={result.r.excluded.map((e) => `${e.name}: ${e.reason}`)} />
            </Box>
          )}
          {result.r.excluded.length > 0 && result.r.outcome === 'solved' && (
            <Box color="grey"><Bullets small items={result.r.excluded.map((e) => `${e.name}: ${e.reason}`)} /></Box>
          )}
          {result.r.outcome === 'solved' && <Button title="Salva ricetta" busy={!!busy} onPress={save} />}
          <Button title="← Modifica scelte" kind="secondary" onPress={() => setStep(2)} />
          <Disclaimer compact />
        </>
      )}
    </Screen>
  );
}
