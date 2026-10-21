import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { STATUS_LABEL } from '../../engine/audit';
import { formulateV2 as formulate } from '../../engine/formulateV2';
import type { RecipeItem } from '../../engine/types';
import type { RecipeVersion } from '../../data/model';
import { auditOnSnapshot, costOf, editedVersion, previewRecalculation, staleFor, versionFromResult, type RecalcPreview } from '../../data/recipeService';
import { uid } from '../../data/repository';
import { useApp, useData } from '../AppContext';
import { ConflictList, ErrorBox, Modal, NumberInput, StatusBox } from '../components';
import { dose, num } from '../format';
import { ResultView } from '../ResultView';

const ORIGIN: Record<RecipeVersion['origin'], string> = {
  engine: 'proposta del motore',
  user_edit: 'modificata dall’utente',
  recalculation: 'ricalcolo confermato',
  duplicate: 'nuova formulazione da copia',
  diagnostic: 'bozza diagnostica (preferenze non raggiungibili)',
  analysis: 'analisi di una ricetta già fatta (grammi fissi)',
};

export function RecipePage() {
  const { id } = useParams();
  const { repo, catalog, settings, bump } = useApp();
  const [viewId, setViewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecipeItem[] | null>(null);
  const [editNote, setEditNote] = useState('');
  const [preview, setPreview] = useState<RecalcPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data } = useData(
    async (r) => {
      const recipe = (await r.listRecipes()).find((x) => x.id === id) ?? null;
      if (!recipe) return null;
      const dog = (await r.listDogs()).find((d) => d.id === recipe.dogId) ?? null;
      const versions = await r.listVersions(recipe.id);
      const prices = await r.listPrices();
      return { recipe, dog, versions, prices };
    },
    [id],
  );
  const live = useMemo(() => {
    if (!editing || !data) return null;
    const cur = data.versions.find((v) => v.id === (viewId ?? data.recipe.currentVersionId)) ?? data.versions[data.versions.length - 1];
    return cur ? auditOnSnapshot(cur.snapshot, editing, cur.excluded) : null;
  }, [editing, data, viewId]);

  if (!data || !repo || !catalog || !settings) return <p>Caricamento…</p>;
  const { recipe, dog, versions, prices } = data;
  if (!recipe || !dog) return <p>Ricetta non trovata.</p>;
  const current = versions.find((v) => v.id === recipe.currentVersionId) ?? versions[versions.length - 1];
  const shown = versions.find((v) => v.id === viewId) ?? current;
  if (!shown) return <p>La ricetta non ha versioni salvate.</p>;
  const stale = staleFor(shown, dog, catalog);
  const nextRevision = Math.max(...versions.map((v) => v.revision)) + 1;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  const saveEdit = () =>
    run(async () => {
      if (!editing) return;
      const v = editedVersion(shown, editing, { id: uid(), revision: nextRevision, author: repo.userLabel(), note: editNote || null });
      await repo.addVersion(v);
      await repo.updateRecipe({ ...recipe, currentVersionId: v.id });
      setEditing(null);
      setEditNote('');
      setViewId(null);
      bump();
    });
  const openPreview = () => run(async () => setPreview(await previewRecalculation(shown, dog, catalog, settings, prices, formulate)));
  const confirmRecalc = () =>
    run(async () => {
      if (!preview) return;
      const v = versionFromResult(
        { id: uid(), recipeId: recipe.id, revision: nextRevision, origin: 'recalculation', parentVersionId: shown.id, author: repo.userLabel(), note: `Ricalcolo: ${preview.stale.map((s) => s.name).join(', ') || 'su richiesta'}` },
        preview.result,
        preview.input,
      );
      await repo.addVersion(v);
      await repo.updateRecipe({ ...recipe, currentVersionId: v.id });
      setPreview(null);
      setViewId(null);
      bump();
    });
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ recipe, version: shown }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${recipe.name.replace(/[^\w-]+/g, '_')}_v${shown.revision}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div className="row between no-print">
        <Link to={`/cani/${dog.id}`}>← {dog.name}</Link>
        <div className="row">
          <button className="small secondary" onClick={() => window.print()}>Stampa</button>
          <button className="small secondary" onClick={exportJson}>Esporta</button>
        </div>
      </div>
      <h2>
        {recipe.name} {recipe.isPrimary && <span className="tag">principale</span>}
      </h2>
      <p className="small muted">
        {dog.name} · versione {shown.revision} ({ORIGIN[shown.origin]}) del {new Date(shown.createdAt).toLocaleString('it-IT')} · {shown.author}
        {shown.id !== current?.id && <strong> · stai guardando una versione precedente</strong>}
      </p>
      {shown.note && <p className="small">Nota: {shown.note}</p>}
      <ErrorBox error={error} />

      {stale.length > 0 && (
        <div className="box box-orange no-print">
          <strong>Ricetta potenzialmente da aggiornare</strong>: sono cambiati
          <ul>
            {stale.map((s) => (
              <li key={s.kind + s.id}>{s.name}: {s.frozen} → {s.current}</li>
            ))}
          </ul>
          I valori qui sotto restano quelli congelati della versione. <button className="small" disabled={busy} onClick={openPreview}>Anteprima del ricalcolo</button>
        </div>
      )}

      {!editing && (
        <div className="row no-print">
          <button className="secondary" onClick={() => setEditing(shown.chosenItems.map((i) => ({ ...i })))}>Modifica quantità</button>
          {stale.length === 0 && <button className="secondary" disabled={busy} onClick={openPreview}>Ricalcola con il motore</button>}
          {shown.id !== current?.id && (
            <button className="secondary" onClick={() => run(async () => { await repo.updateRecipe({ ...recipe, currentVersionId: shown.id }); setViewId(null); bump(); })}>
              Usa questa versione
            </button>
          )}
        </div>
      )}

      {editing && live && (
        <div className="card">
          <h3>Modifica quantità</h3>
          <p className="small muted">La proposta del motore resta salvata. La tua versione sarà separata e verificata di nuovo da zero.</p>
          <table className="items">
            <thead>
              <tr>
                <th>Componente</th>
                <th className="r">Proposta</th>
                <th className="r">Nuova</th>
                <th className="r">Differenza</th>
              </tr>
            </thead>
            <tbody>
              {editing.map((it, i) => {
                const f = it.kind === 'food' ? shown.snapshot.foods[it.id] : null;
                const s = it.kind === 'supplement' ? shown.snapshot.supplements[it.id] : null;
                const sug = shown.suggestedItems.find((x) => x.id === it.id)?.qty ?? 0;
                return (
                  <tr key={it.id}>
                    <td>{f?.name ?? s?.name}</td>
                    <td className="r">{dose(sug, s?.doseUnit ?? 'g')}</td>
                    <td className="r">
                      <NumberInput
                        ariaLabel={`Quantità ${f?.name ?? s?.name}`}
                        min={0}
                        step={s?.integerDose ? '1' : 'any'}
                        value={it.qty}
                        onChange={(v) => setEditing(editing.map((x, j) => (j === i ? { ...x, qty: v ?? 0 } : x)))}
                      />
                    </td>
                    <td className={`r ${it.qty !== sug ? 'changed' : 'muted'}`}>{it.qty - sug > 0 ? '+' : ''}{num(it.qty - sug, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {editing.some((it) => it.kind === 'supplement' && shown.snapshot.supplements[it.id]?.integerDose && !Number.isInteger(it.qty)) && (
            <div className="box box-orange small">Le capsule/compresse vanno indicate come numeri interi.</div>
          )}
          <StatusBox audit={live} />
          <label>Nota sulla modifica<input value={editNote} onChange={(e) => setEditNote(e.target.value)} /></label>
          <div className="row">
            <button disabled={busy} onClick={saveEdit}>Salva come nuova versione</button>
            <button className="ghost" onClick={() => setEditing(null)}>Annulla</button>
          </div>
        </div>
      )}

      <ResultView
        audit={editing && live ? live : shown.audit}
        items={editing ?? shown.chosenItems}
        suggested={shown.origin === 'user_edit' || editing ? shown.suggestedItems : undefined}
        snapshot={shown.snapshot}
        cost={costOf({ chosenItems: editing ?? shown.chosenItems, snapshot: shown.snapshot }, prices)}
        constraints={shown.constraintsUsed}
        notes={shown.engineNotes}
        meta={`${shown.snapshot.engineVersion} · istantanea del ${new Date(shown.snapshot.createdAt).toLocaleString('it-IT')}`}
      />

      <div className="card no-print">
        <h3>Storico</h3>
        <ul className="history">
          {[...versions].reverse().map((v) => (
            <li key={v.id} className={v.id === shown.id ? 'on' : ''}>
              <button className="ghost" onClick={() => { setViewId(v.id); setEditing(null); }}>
                v{v.revision} · {ORIGIN[v.origin]} · {new Date(v.createdAt).toLocaleDateString('it-IT')} · {STATUS_LABEL[v.audit.status]}
                {v.id === current?.id && ' · in uso'}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {preview && (
        <Modal title="Anteprima del ricalcolo" onClose={() => setPreview(null)}>
          {preview.stale.length > 0 && (
            <ul className="small">
              {preview.stale.map((s) => (
                <li key={s.kind + s.id}>{s.name}: {s.frozen} → {s.current}</li>
              ))}
            </ul>
          )}
          {preview.result.outcome === 'solved' && preview.result.audit ? (
            <>
              <table className="items">
                <thead>
                  <tr>
                    <th>Componente</th>
                    <th className="r">Ora</th>
                    <th className="r">Nuova proposta</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.diff.map((d) => (
                    <tr key={d.id}>
                      <td>{d.name}</td>
                      <td className="r">{d.before === null ? '—' : num(d.before, 1)}</td>
                      <td className={`r ${d.before !== d.after ? 'changed' : ''}`}>{d.after === null ? '—' : num(d.after, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Stato: <strong>{STATUS_LABEL[shown.audit.status]}</strong> → <strong>{preview.result.audit.statusLabel}</strong>
              </p>
              <div className="row">
                <button disabled={busy} onClick={confirmRecalc}>Conferma e crea nuova versione</button>
                <button className="ghost" onClick={() => setPreview(null)}>Non ora</button>
              </div>
            </>
          ) : preview.result.outcome === 'infeasible' ? (
            <ConflictList conflicts={preview.result.conflicts} suggestions={preview.result.suggestions} />
          ) : (
            <div className="box box-grey">{preview.result.message}</div>
          )}
          <p className="small muted">Niente viene salvato senza conferma. La versione attuale resta nello storico.</p>
        </Modal>
      )}
    </div>
  );
}
