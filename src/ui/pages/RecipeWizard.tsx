import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { preliminaryAnalysis, type FormulationInput, type FormulationResult, type PreliminaryResult } from '../../engine/formulate';
// specifica v2 del 21/10/2026: stesso generatore del server di calcolo dell'app
import { formulateV2 as formulate } from '../../engine/formulateV2';
import { foodStatus, supplementStatus } from '../../engine/catalogStatus';
import type { Food, ItemConstraint, Nutrient, Supplement } from '../../engine/types';
import { StatusBadge } from './CatalogPage';
import { MAX_RECIPES_PER_DOG, type Recipe } from '../../data/model';
import { PROCESSING_LABEL } from '../../data/packageCatalog';
import { assertCanAddRecipe, buildInput, costOf, selectionFromSnapshot, versionFromResult, type Selection } from '../../data/recipeService';
import { uid } from '../../data/repository';
import { useApp, useData } from '../AppContext';
import { ConflictList, Disclaimer, ErrorBox, NumberInput } from '../components';
import { ResultView } from '../ResultView';

type Step = 1 | 2 | 3;

function statusBadge(f: Food, nutrients: Nutrient[]) {
  const st = foodStatus(f, nutrients);
  return (
    <>
      <StatusBadge status={st.status} test={f.dataStatus === 'test_fixture'} />
      {st.status !== 'to_complete' && !f.availableToFormulate && <span className="tag grey">non attivo</span>}
    </>
  );
}
function suppBadge(s: Supplement, nutrients: Nutrient[]) {
  const st = supplementStatus(s, nutrients);
  return (
    <>
      <StatusBadge status={st.status} test={s.status === 'test_fixture'} />
      {st.status !== 'to_complete' && !s.usableForOptimization && <span className="tag grey">non attivo</span>}
    </>
  );
}

export function RecipeWizard() {
  const { id: dogId } = useParams();
  const [params] = useSearchParams();
  const fromId = params.get('da');
  const nav = useNavigate();
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
  const [prelim, setPrelim] = useState<PreliminaryResult | null>(null);
  const [result, setResult] = useState<{ r: FormulationResult; input: FormulationInput } | null>(null);
  const [busy, setBusy] = useState(false);
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
    const subs = catalog.categories.filter((c) => c.parentId);
    return subs
      .map((c) => ({ cat: c, parent: catalog.categories.find((p) => p.id === c.parentId), foods: catalog.foods.filter((f) => f.subcategoryId === c.id && (!q || f.name.toLowerCase().includes(q))) }))
      .filter((g) => g.foods.length);
  }, [catalog, query]);

  if (!data || !catalog || !settings || !repo) return <p>Caricamento…</p>;
  const { dog, recipes, prices } = data;
  if (!dog) return <p>Cane non trovato.</p>;
  if (recipes.length >= MAX_RECIPES_PER_DOG) {
    return <div className="box box-orange">{dog.name} ha già {MAX_RECIPES_PER_DOG} ricette salvate: elimina una ricetta per crearne una nuova.</div>;
  }

  const toggleFood = (id: string) =>
    setSel((s) => ({ ...s, foods: s.foods.some((f) => f.id === id) ? s.foods.filter((f) => f.id !== id) : [...s.foods, { id }] }));
  const toggleSupp = (id: string) =>
    setSel((s) => ({ ...s, supplements: s.supplements.some((f) => f.id === id) ? s.supplements.filter((f) => f.id !== id) : [...s.supplements, { id }] }));
  const setConstraint = (kind: 'foods' | 'supplements', id: string, c: ItemConstraint) =>
    setSel((s) => ({ ...s, [kind]: s[kind].map((x) => (x.id === id ? { ...x, constraint: { ...x.constraint, ...c } } : x)) }));

  const runPrelim = async () => {
    setError(null);
    if (!sel.foods.length) return setError('Seleziona almeno un alimento.');
    setBusy(true);
    try {
      setPrelim(await preliminaryAnalysis(buildInput(dog, sel, catalog, settings, prices)));
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  const runFormulate = async () => {
    setError(null);
    setBusy(true);
    try {
      const input = buildInput(dog, sel, catalog, settings, prices);
      setResult({ r: await formulate(input), input });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  const save = async () => {
    if (!result) return;
    setError(null);
    try {
      assertCanAddRecipe(await repo.listRecipes(dog.id));
      const recipe: Recipe = {
        id: uid(),
        dogId: dog.id,
        name: name.trim() || 'Ricetta senza nome',
        isPrimary: recipes.length === 0,
        archived: false,
        currentVersionId: null,
        dietMoisture: sel.dietMoisture,
        createdAt: new Date().toISOString(),
      };
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
        // niente ricette vuote: se la versione non si salva, si annulla anche la ricetta
        await repo.deleteRecipe(recipe.id).catch(() => undefined);
        throw e;
      }
      bump();
      nav(`/ricette/${recipe.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const selectedFoods = sel.foods.map((f) => ({ ...f, food: catalog.foods.find((x) => x.id === f.id) }));
  const selectedSupps = sel.supplements.map((s) => ({ ...s, supp: catalog.supplements.find((x) => x.id === s.id) }));

  return (
    <div>
      <h2>{fromId ? 'Duplica o sostituisci' : 'Nuova ricetta'} per {dog.name}</h2>
      <ol className="steps">
        <li className={step === 1 ? 'on' : ''}>Alimenti</li>
        <li className={step === 2 ? 'on' : ''}>Analisi e integratori</li>
        <li className={step === 3 ? 'on' : ''}>Risultato</li>
      </ol>
      {!dog.kcalTarget && <div className="box box-orange">Imposta prima l’obiettivo kcal nel profilo del cane.</div>}
      {fromId && <div className="box box-grey small">Cambiando ingredienti la ricetta viene riformulata da zero: nessuna sostituzione grammo per grammo.</div>}
      <ErrorBox error={error} />

      {step === 1 && (
        <div>
          <div className="card form">
            <label>Nome della ricetta<input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Manzo e avena" /></label>
            <fieldset>
              <legend>Tipo di dieta per il selenio (FEDIAF distingue umida/secca)</legend>
              <label className="check"><input type="radio" checked={sel.dietMoisture === 'wet'} onChange={() => setSel({ ...sel, dietMoisture: 'wet' })} /> Umida</label>
              <label className="check"><input type="radio" checked={sel.dietMoisture === 'dry'} onChange={() => setSel({ ...sel, dietMoisture: 'dry' })} /> Secca</label>
              <label className="check"><input type="radio" checked={sel.dietMoisture === null} onChange={() => setSel({ ...sel, dietMoisture: null })} /> Non so (selenio non verificabile)</label>
            </fieldset>
          </div>
          <div className="card">
            <h3>Scegli gli alimenti disponibili</h3>
            <p className="small muted">Non serve indicare i grammi: li calcola l’app. Puoi aggiungere limiti facoltativi.</p>
            <p className="small muted">«Da completare» = non utilizzabile nel calcolo; «Dati parziali» = utilizzabile, ma la ricetta non potrà essere dichiarata completa.</p>
            <input type="search" placeholder="Cerca…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {groups.map((g) => (
              <div key={g.cat.id} className="pick-group">
                <h4>
                  {g.parent?.label} · {g.cat.label}
                </h4>
                {g.foods.map((f) => (
                  <label key={f.id} className="pick">
                    <input type="checkbox" checked={sel.foods.some((x) => x.id === f.id)} onChange={() => toggleFood(f.id)} />
                    <span>
                      {f.name} <span className="muted small">({PROCESSING_LABEL[f.processingState]})</span> {statusBadge(f, catalog.nutrients)}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          {selectedFoods.length > 0 && (
            <div className="card">
              <h3>Selezionati — limiti facoltativi (g/die)</h3>
              {selectedFoods.map((f) => (
                <div key={f.id} className="grid3">
                  <span>{f.food?.name}</span>
                  <NumberInput placeholder="almeno" value={f.constraint?.minQty ?? null} onChange={(v) => setConstraint('foods', f.id, { minQty: v })} />
                  <NumberInput placeholder="non oltre" value={f.constraint?.maxQty ?? null} onChange={(v) => setConstraint('foods', f.id, { maxQty: v })} />
                </div>
              ))}
            </div>
          )}
          <button disabled={busy || !dog.kcalTarget} onClick={runPrelim}>{busy ? 'Analisi…' : 'Analisi preliminare →'}</button>
        </div>
      )}

      {step === 2 && prelim && (
        <div>
          <div className="card">
            <h3>Analisi preliminare (indicativa)</h3>
            <p>{prelim.message}</p>
            {prelim.excluded.length > 0 && (
              <div className="box box-grey">
                <strong>Non utilizzabili:</strong>
                <ul>
                  {prelim.excluded.map((e) => (
                    <li key={e.id}>{e.name}: {e.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            {prelim.potentialGaps.length > 0 && (
              <>
                <h4>Potenziali carenze con i soli alimenti</h4>
                <ul>
                  {prelim.potentialGaps.map((g) => (
                    <li key={g.metric}>
                      {g.label}
                      {g.coveredBySelectable.length ? <span className="small muted"> — in catalogo lo apportano: {g.coveredBySelectable.join(', ')}</span> : <span className="small muted"> — nessun integratore caratterizzato lo apporta</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {prelim.dataGaps.length > 0 && (
              <details>
                <summary>Dati mancanti negli alimenti ({prelim.dataGaps.length} nutrienti)</summary>
                <ul className="small">
                  {prelim.dataGaps.map((g) => (
                    <li key={g.metric}>{g.label}: {g.missingIn.join(', ')}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <div className="card">
            <h3>Integratori disponibili</h3>
            <p className="small muted">Solo quelli che selezioni possono entrare nel calcolo. Nessun prodotto o dose viene inventato.</p>
            {catalog.supplements.map((s) => (
              <label key={s.id} className="pick">
                <input type="checkbox" checked={sel.supplements.some((x) => x.id === s.id)} onChange={() => toggleSupp(s.id)} />
                <span>
                  {s.name} {suppBadge(s, catalog.nutrients)} <span className="muted small">dose in {s.doseUnit}{s.integerDose ? ', solo intere' : ''}{s.maxDailyUnits ? `, max ${s.maxDailyUnits}/die (produttore)` : ''}</span>
                </span>
              </label>
            ))}
            {selectedSupps.length > 0 && (
              <>
                <h4>Limiti facoltativi</h4>
                {selectedSupps.map((s) => (
                  <div key={s.id} className="grid3">
                    <span>{s.supp?.name}</span>
                    <NumberInput placeholder="almeno" value={s.constraint?.minQty ?? null} onChange={(v) => setConstraint('supplements', s.id, { minQty: v })} />
                    <NumberInput placeholder="non oltre" value={s.constraint?.maxQty ?? null} onChange={(v) => setConstraint('supplements', s.id, { maxQty: v })} />
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="row">
            <button className="ghost" onClick={() => setStep(1)}>← Alimenti</button>
            <button disabled={busy} onClick={runFormulate}>{busy ? 'Calcolo…' : 'Calcola le quantità →'}</button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div>
          {result.r.outcome === 'solved' && result.r.audit ? (
            <>
              <ResultView
                audit={result.r.audit}
                items={result.r.items}
                snapshot={{ foods: Object.fromEntries(result.input.foods.map((f) => [f.food.id, f.food])), supplements: Object.fromEntries(result.input.supplements.map((s) => [s.supplement.id, s.supplement])), referenceVersionIds: [...new Set(result.input.limits.map((l) => l.referenceVersionId))] }}
                cost={costOf({ chosenItems: result.r.items, snapshot: { foods: Object.fromEntries(result.input.foods.map((f) => [f.food.id, f.food])), supplements: Object.fromEntries(result.input.supplements.map((s) => [s.supplement.id, s.supplement])) } as never }, prices)}
                constraints={result.r.constraints}
                notes={result.r.notes}
                meta={result.r.engineVersion}
              />
              {result.r.excluded.length > 0 && (
                <div className="box box-grey">
                  {result.r.excluded.map((e) => (
                    <div key={e.id}>{e.name}: {e.reason}</div>
                  ))}
                </div>
              )}
            </>
          ) : result.r.outcome === 'infeasible' ? (
            <>
              <div className="box box-red"><strong>{result.r.message}</strong></div>
              <ConflictList conflicts={result.r.conflicts} suggestions={result.r.suggestions} />
            </>
          ) : (
            <div className="box box-grey">
              <strong>{result.r.message}</strong>
              {result.r.excluded.map((e) => (
                <div key={e.id}>{e.name}: {e.reason}</div>
              ))}
            </div>
          )}
          <div className="row">
            <button className="ghost" onClick={() => setStep(2)}>← Modifica scelte</button>
            {result.r.outcome === 'solved' && <button onClick={save}>Salva ricetta</button>}
          </div>
          <Disclaimer compact />
        </div>
      )}
    </div>
  );
}
