import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { STATUS_LABEL } from '../../engine/audit';
import { breedNotesFor } from '../../engine/dogProfile';
import { mer, rer, WEIGHT_GAP_MESSAGE, weightGapNeedsWarning } from '../../engine/energy';
import { KCAL_SOURCE_LABEL, MAX_RECIPES_PER_DOG, type Recipe } from '../../data/model';
import { staleFor } from '../../data/recipeService';
import { useApp, useData } from '../AppContext';
import { ErrorBox } from '../components';
import { num } from '../format';

export function DogPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { repo, catalog, bump } = useApp();
  const [error, setError] = useState<string | null>(null);
  const { data } = useData(
    async (r) => {
      const dog = (await r.listDogs()).find((d) => d.id === id) ?? null;
      const recipes = await r.listRecipes(id);
      const versions = Object.fromEntries(await Promise.all(recipes.map(async (rc) => [rc.id, await r.listVersions(rc.id)] as const)));
      const weights = id ? await r.listWeights(id) : [];
      return { dog, recipes, versions, weights };
    },
    [id],
  );
  if (!data || !repo) return <p>Caricamento…</p>;
  const { dog, recipes, versions, weights } = data;
  if (!dog) return <p>Cane non trovato.</p>;
  const notes = catalog ? breedNotesFor(dog.breed, catalog.breedNotes) : [];
  const full = recipes.length >= MAX_RECIPES_PER_DOG;

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const rename = (r: Recipe) => {
    const name = prompt('Nuovo nome della ricetta', r.name);
    if (name && name.trim()) void act(() => repo.updateRecipe({ ...r, name: name.trim() }));
  };
  const remove = (r: Recipe) => {
    if (confirm(`Eliminare definitivamente «${r.name}» e tutto il suo storico?`)) void act(() => repo.deleteRecipe(r.id));
  };

  return (
    <div>
      <div className="row between">
        <h2>{dog.name}</h2>
        <Link className="button secondary" to={`/cani/${dog.id}/modifica`}>Modifica profilo</Link>
      </div>
      <ErrorBox error={error} />
      {notes.map((n) => (
        <div key={n.id} className="box box-purple">{n.text}</div>
      ))}
      {dog.notes.map((n) => (
        <div key={n.text} className="box box-purple">{n.text}</div>
      ))}
      {weightGapNeedsWarning(dog.weightCurrentKg, dog.weightIdealKg) && <div className="box box-orange">{WEIGHT_GAP_MESSAGE}.</div>}
      <div className="card">
        <dl className="kv">
          <dt>Razza</dt>
          <dd>{dog.breed || '—'}</dd>
          <dt>Peso attuale / ideale</dt>
          <dd>{num(dog.weightCurrentKg, 1)} kg / {num(dog.weightIdealKg, 1)} kg</dd>
          <dt>RER (peso ideale)</dt>
          <dd>{num(rer(dog.weightIdealKg), 0)} kcal</dd>
          <dt>MER stimata</dt>
          <dd>{dog.activityFactor ? `${num(mer(dog.weightIdealKg, dog.activityFactor), 0)} kcal (fattore ${num(dog.activityFactor, 2)})` : 'fattore non indicato'}</dd>
          <dt>Obiettivo</dt>
          <dd>{dog.kcalTarget ? `${num(dog.kcalTarget, 0)} kcal/die — ${KCAL_SOURCE_LABEL[dog.kcalSource]}` : <strong>da impostare</strong>}</dd>
          <dt>Revisione del profilo</dt>
          <dd>{dog.formulationRevision}</dd>
        </dl>
        {weights.length > 1 && (
          <details>
            <summary>Storico del peso</summary>
            <ul className="small">
              {weights.map((w) => (
                <li key={w.id}>{new Date(w.date).toLocaleDateString('it-IT')}: {num(w.weightKg, 1)} kg</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="row between">
        <h3>Ricette ({recipes.length}/{MAX_RECIPES_PER_DOG})</h3>
        {full ? (
          <span className="small muted">Limite di {MAX_RECIPES_PER_DOG} raggiunto: elimina una ricetta per crearne una nuova.</span>
        ) : (
          <Link className="button" to={`/cani/${dog.id}/ricette/nuova`}>+ Nuova ricetta</Link>
        )}
      </div>
      {recipes.length === MAX_RECIPES_PER_DOG - 1 && <div className="box box-orange small">Puoi salvare ancora una sola ricetta per {dog.name}.</div>}
      <div className="list">
        {[...recipes]
          .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || Number(a.archived) - Number(b.archived))
          .map((r) => {
            const vs = versions[r.id] ?? [];
            const cur = vs.find((v) => v.id === r.currentVersionId) ?? vs[vs.length - 1];
            const stale = cur && catalog ? staleFor(cur, dog, catalog) : [];
            return (
              <div key={r.id} className={`card recipe-card${r.archived ? ' archived' : ''}`}>
                <div className="row between">
                  <Link to={`/ricette/${r.id}`}>
                    <strong>{r.name}</strong>
                  </Link>
                  <span>
                    {r.isPrimary && <span className="tag">principale</span>}
                    {r.archived && <span className="tag grey">archiviata</span>}
                    {cur?.audit.dataFlags.testData && <span className="tag orange">PROVA</span>}
                  </span>
                </div>
                <div className="small">
                  {cur ? `${(cur.audit.statusLabel ?? STATUS_LABEL[cur.audit.status])} · versione ${cur.revision}` : 'nessuna versione salvata'}
                  {stale.length > 0 && <span className="tag orange">da ricalcolare</span>}
                </div>
                <div className="row wrap">
                  <Link className="button small" to={`/ricette/${r.id}`}>Apri</Link>
                  {!r.isPrimary && <button className="small secondary" onClick={() => act(() => repo.updateRecipe({ ...r, isPrimary: true }))}>Rendi principale</button>}
                  <button className="small secondary" onClick={() => rename(r)}>Rinomina</button>
                  <button className="small secondary" disabled={full} title={full ? 'Limite raggiunto' : ''} onClick={() => nav(`/cani/${dog.id}/ricette/nuova?da=${r.id}`)}>
                    Duplica / sostituisci
                  </button>
                  <button className="small secondary" onClick={() => act(() => repo.updateRecipe({ ...r, archived: !r.archived, isPrimary: r.archived ? r.isPrimary : false }))}>
                    {r.archived ? 'Ripristina' : 'Archivia'}
                  </button>
                  <button className="small danger" onClick={() => remove(r)}>Elimina</button>
                </div>
              </div>
            );
          })}
      </div>
      <p className="small muted">Le ricette archiviate restano salvate e contano nel limite di {MAX_RECIPES_PER_DOG}.</p>
      <button className="ghost danger" onClick={() => confirm(`Eliminare ${dog.name} con tutte le sue ricette?`) && act(async () => { await repo.deleteDog(dog.id); nav('/'); })}>
        Elimina cane
      </button>
    </div>
  );
}
