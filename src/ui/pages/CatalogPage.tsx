import { useState } from 'react';
import type { DataStatus, Food, NutrientValue, ProcessingState, Supplement } from '../../engine/types';
import { PROCESSING_LABEL } from '../../data/packageCatalog';
import { uid } from '../../data/repository';
import { useApp } from '../AppContext';
import { ErrorBox, Modal, NumberInput } from '../components';
import { num } from '../format';

function completeness(nutrients: Record<string, NutrientValue>, required: string[]) {
  const known = required.filter((id) => nutrients[id]?.value !== null && nutrients[id]?.value !== undefined);
  return { known: known.length, total: required.length, missing: required.filter((id) => !known.includes(id)) };
}

export function CatalogPage() {
  const { catalog, isAdmin, repo } = useApp();
  const [tab, setTab] = useState<'foods' | 'supplements' | 'refs'>('foods');
  const [editFood, setEditFood] = useState<Food | null>(null);
  const [editSupp, setEditSupp] = useState<Supplement | null>(null);
  if (!catalog || !repo) return <p>Caricamento…</p>;
  const required = catalog.nutrients.filter((n) => n.kind === 'core' || n.kind === 'advanced').map((n) => n.id);
  const label = new Map(catalog.nutrients.map((n) => [n.id, n.label]));
  return (
    <div>
      <h2>Catalogo</h2>
      <p className="small muted">
        {repo.mode === 'supabase'
          ? isAdmin
            ? 'Sei amministratore: puoi modificare alimenti, integratori e riferimenti. Ogni modifica crea una nuova versione del profilo e resta nel registro.'
            : 'Consultazione: alimenti, integratori e riferimenti sono modificabili solo dagli amministratori.'
          : 'Modalità prova: il catalogo di prova si modifica solo su questo dispositivo. In Supabase solo gli amministratori possono farlo.'}
      </p>
      <div className="tabs">
        <button className={tab === 'foods' ? 'on' : ''} onClick={() => setTab('foods')}>Alimenti</button>
        <button className={tab === 'supplements' ? 'on' : ''} onClick={() => setTab('supplements')}>Integratori</button>
        <button className={tab === 'refs' ? 'on' : ''} onClick={() => setTab('refs')}>Riferimenti</button>
      </div>
      {tab === 'foods' && (
        <>
          {isAdmin && (
            <button className="secondary" onClick={() => setEditFood({ id: `food_${uid().slice(0, 8)}`, name: '', categoryId: 'animal', subcategoryId: 'muscle', processingState: 'raw', kcalMePer100g: null, dataStatus: 'unverified', availableToFormulate: false, profileVersion: 1, nutrients: {} })}>
              + Nuovo alimento
            </button>
          )}
          {catalog.categories.filter((c) => c.parentId).map((c) => {
            const foods = catalog.foods.filter((f) => f.subcategoryId === c.id);
            if (!foods.length) return null;
            return (
              <div key={c.id} className="card">
                <h4>{catalog.categories.find((p) => p.id === c.parentId)?.label} · {c.label}</h4>
                <table className="nut">
                  <tbody>
                    {foods.map((f) => {
                      const cm = completeness(f.nutrients, required);
                      return (
                        <tr key={f.id}>
                          <td>
                            {f.name} <span className="small muted">({PROCESSING_LABEL[f.processingState]}, v{f.profileVersion})</span>
                            <div className="small muted">{f.source ?? 'fonte non indicata'}{f.sourceVersion ? ` · ${f.sourceVersion}` : ''}</div>
                          </td>
                          <td className="small">{f.availableToFormulate ? <span className="tag green">attivo</span> : <span className="tag grey">non attivo</span>} {f.dataStatus}</td>
                          <td className="small r" title={cm.missing.map((m) => label.get(m)).join(', ')}>
                            {cm.known}/{cm.total} essenziali{f.kcalMePer100g === null ? ' · kcal mancanti' : ` · ${num(f.kcalMePer100g, 0)} kcal`}
                          </td>
                          {isAdmin && <td><button className="small secondary" onClick={() => setEditFood(structuredClone(f))}>Modifica</button></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}
      {tab === 'supplements' && (
        <div className="card">
          {isAdmin && (
            <button className="secondary" onClick={() => setEditSupp({ id: `supp_${uid().slice(0, 8)}`, name: '', doseUnit: 'g', massPerUnitG: null, kcalPerUnit: null, integerDose: false, maxDailyUnits: null, status: 'missing', usableForOptimization: false, profileVersion: 1, nutrients: {} })}>
              + Nuovo integratore
            </button>
          )}
          <table className="nut">
            <tbody>
              {catalog.supplements.map((s) => {
                const declared = Object.values(s.nutrients).filter((v) => v.value !== null).length;
                return (
                  <tr key={s.id}>
                    <td>
                      {s.name} <span className="small muted">{s.brand} {s.variant} · per {s.doseUnit} · v{s.profileVersion}</span>
                      <div className="small muted">{s.labelSource ?? 'etichetta non caricata'}{s.notes ? ` · ${s.notes}` : ''}</div>
                    </td>
                    <td className="small">{s.usableForOptimization ? <span className="tag green">attivo</span> : <span className="tag grey">non attivo</span>} {s.status}</td>
                    <td className="small r">{declared} nutrienti dichiarati{s.labelAddedOnly ? ' (solo aggiunti)' : ''}</td>
                    {isAdmin && <td><button className="small secondary" onClick={() => setEditSupp(structuredClone(s))}>Modifica</button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'refs' && <RefsTab />}
      {editFood && <FoodEditor food={editFood} onClose={() => setEditFood(null)} />}
      {editSupp && <SuppEditor supp={editSupp} onClose={() => setEditSupp(null)} />}
    </div>
  );
}

function RefsTab() {
  const { catalog, isAdmin, repo, refresh } = useApp();
  const [f, setF] = useState({ version: '', protein: null as number | null, fat: null as number | null, carbohydrate: null as number | null, source: '', approvedBy: '' });
  const [error, setError] = useState<string | null>(null);
  if (!catalog || !repo) return null;
  const label = new Map(catalog.nutrients.map((n) => [n.id, n.label]));
  return (
    <div>
      <div className="card">
        <h3>Standard in uso</h3>
        <ul className="small">
          {catalog.referenceVersions.map((r) => (
            <li key={r.id}>{r.label} — {r.status}{r.url && <> · <a href={r.url} target="_blank" rel="noreferrer">fonte</a></>}</li>
          ))}
        </ul>
        <table className="nut">
          <thead>
            <tr><th>Nutriente</th><th>Classe</th><th className="r">Min</th><th className="r">Max</th><th>Base</th></tr>
          </thead>
          <tbody>
            {catalog.limits.map((l) => (
              <tr key={l.id}>
                <td>{label.get(l.metric) ?? l.metric}{l.applicability?.dietMoisture ? ` (dieta ${l.applicability.dietMoisture === 'wet' ? 'umida' : 'secca'})` : ''}</td>
                <td className="small">{l.limitClass}{l.status !== 'verified' ? ' · da rivedere' : ''}</td>
                <td className="r">{num(l.lower, 3)}</td>
                <td className="r">{num(l.upper, 3)}</td>
                <td className="small">{l.unit} {l.basis === 'per_1000_kcal_me' ? '/1000 kcal' : l.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Soglie non ufficiali (allegato C)</h3>
        {catalog.customThresholds.map((t) => (
          <div key={t.id}>
            <label className="check">
              <input type="checkbox" disabled={!isAdmin} checked={t.enabled} onChange={async (e) => { await repo.saveThreshold({ ...t, enabled: e.target.checked }); await refresh(); }} />
              {t.metric}: {num(t.lower)}–{num(t.upper)} · {t.status}
            </label>
            <div className="small muted">{t.rationale}</div>
          </div>
        ))}
      </div>
      <div className="card form">
        <h3>Fattori energetici (kcal/g)</h3>
        <p className="small">
          In uso: {catalog.energyFactors.protein === null ? <strong>nessuno — quote energetiche non calcolabili (decisione D4)</strong> : `proteine ${catalog.energyFactors.protein}, grassi ${catalog.energyFactors.fat}, carboidrati ${catalog.energyFactors.carbohydrate} — ${catalog.energyFactors.source}`}
        </p>
        {isAdmin && (
          <>
            <ErrorBox error={error} />
            <div className="grid3">
              <NumberInput placeholder="proteine" value={f.protein} onChange={(v) => setF({ ...f, protein: v })} />
              <NumberInput placeholder="grassi" value={f.fat} onChange={(v) => setF({ ...f, fat: v })} />
              <NumberInput placeholder="carboidrati" value={f.carbohydrate} onChange={(v) => setF({ ...f, carbohydrate: v })} />
            </div>
            <input placeholder="versione (es. NRC-2006-modificati)" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
            <input placeholder="fonte" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
            <input placeholder="approvato da" value={f.approvedBy} onChange={(e) => setF({ ...f, approvedBy: e.target.value })} />
            <button
              className="small"
              onClick={async () => {
                if (!f.version || !f.source || !f.approvedBy || !f.protein || !f.fat || !f.carbohydrate) return setError('Compila tutti i campi: valori, versione, fonte e approvazione.');
                await repo.saveEnergyFactors(f);
                await refresh();
              }}
            >
              Attiva questi fattori
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const STATUS_OPTS: DataStatus[] = ['unverified', 'review_required', 'estimated', 'verified', 'test_fixture'];

function NutrientGrid({ values, onChange, perLabel }: { values: Record<string, NutrientValue>; onChange: (v: Record<string, NutrientValue>) => void; perLabel: string }) {
  const { catalog } = useApp();
  if (!catalog) return null;
  const list = catalog.nutrients.filter((n) => n.kind !== 'derived' && n.kind !== 'composition');
  return (
    <table className="nut">
      <thead>
        <tr><th>Nutriente</th><th className="r">Valore {perLabel}</th><th>Stato</th><th>Fonte</th></tr>
      </thead>
      <tbody>
        {list.map((n) => {
          const v = values[n.id] ?? { value: null };
          const upd = (p: Partial<NutrientValue>) => onChange({ ...values, [n.id]: { ...v, ...p } });
          return (
            <tr key={n.id}>
              <td>{n.label} <span className="muted small">{n.unit}</span></td>
              <td className="r"><NumberInput ariaLabel={n.label} min={0} value={v.value} placeholder="non disponibile" onChange={(x) => upd({ value: x, status: x === null ? 'unknown' : v.status && v.status !== 'unknown' ? v.status : 'measured' })} /></td>
              <td>
                <select value={v.status ?? 'unknown'} onChange={(e) => upd({ status: e.target.value as NutrientValue['status'] })}>
                  {['measured', 'label', 'calculated', 'estimated', 'analytical_zero', 'unknown'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </td>
              <td><input value={v.source ?? ''} onChange={(e) => upd({ source: e.target.value || null })} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FoodEditor({ food, onClose }: { food: Food; onClose: () => void }) {
  const { repo, catalog, refresh } = useApp();
  const [f, setF] = useState(food);
  const [error, setError] = useState<string | null>(null);
  if (!repo || !catalog) return null;
  const save = async () => {
    setError(null);
    for (const v of Object.values(f.nutrients)) if (v.value === 0 && !['analytical_zero', 'measured', 'label'].includes(v.status ?? '')) return setError('Uno zero va dichiarato come zero analitico, misurato o da etichetta.');
    try {
      await repo.saveFood(f);
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Modal title={food.name || 'Nuovo alimento'} onClose={onClose}>
      <ErrorBox error={error} />
      <div className="form">
        <label>Nome<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>
          Sottocategoria
          <select value={f.subcategoryId} onChange={(e) => setF({ ...f, subcategoryId: e.target.value, categoryId: catalog.categories.find((c) => c.id === e.target.value)?.parentId ?? f.categoryId })}>
            {catalog.categories.filter((c) => c.parentId).map((c) => (
              <option key={c.id} value={c.id}>{catalog.categories.find((p) => p.id === c.parentId)?.label} · {c.label}</option>
            ))}
          </select>
        </label>
        <div className="grid2">
          <label>
            Stato
            <select value={f.processingState} onChange={(e) => setF({ ...f, processingState: e.target.value as ProcessingState })}>
              {Object.entries(PROCESSING_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label>Taglio / parte<input value={f.speciesCut ?? ''} onChange={(e) => setF({ ...f, speciesCut: e.target.value || null })} /></label>
          <label>Parte edibile<input value={f.ediblePortion ?? ''} onChange={(e) => setF({ ...f, ediblePortion: e.target.value || null })} /></label>
          <label>kcal EM per 100 g<NumberInput value={f.kcalMePer100g} onChange={(v) => setF({ ...f, kcalMePer100g: v })} /></label>
          <label>Metodo EM<input value={f.meMethod ?? ''} onChange={(e) => setF({ ...f, meMethod: e.target.value || null })} /></label>
          <label>Fonte (es. FDC id)<input value={f.source ?? ''} onChange={(e) => setF({ ...f, source: e.target.value || null })} /></label>
          <label>Versione fonte<input value={f.sourceVersion ?? ''} onChange={(e) => setF({ ...f, sourceVersion: e.target.value || null })} /></label>
          <label>
            Stato dei dati
            <select value={f.dataStatus} onChange={(e) => setF({ ...f, dataStatus: e.target.value as DataStatus })}>
              {STATUS_OPTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label>Incertezza / note<input value={f.uncertainty ?? ''} onChange={(e) => setF({ ...f, uncertainty: e.target.value || null })} /></label>
        <label className="check"><input type="checkbox" checked={f.availableToFormulate} onChange={(e) => setF({ ...f, availableToFormulate: e.target.checked })} /> Attivo per la formulazione</label>
        <p className="small muted">Valori per 100 g di parte edibile nello stato indicato. Lascia vuoto ciò che la fonte non riporta: non verrà mai considerato zero. Crudo e cotto sono alimenti distinti.</p>
        <NutrientGrid values={f.nutrients} onChange={(n) => setF({ ...f, nutrients: n })} perLabel="/100 g" />
        <button onClick={save}>Salva (nuova versione del profilo)</button>
      </div>
    </Modal>
  );
}

function SuppEditor({ supp, onClose }: { supp: Supplement; onClose: () => void }) {
  const { repo, refresh } = useApp();
  const [s, setS] = useState(supp);
  const [error, setError] = useState<string | null>(null);
  if (!repo) return null;
  const save = async () => {
    setError(null);
    if (s.maxDailyUnits !== null && !s.maxDailySource) return setError('Una dose massima richiede la fonte (etichetta o scheda del produttore).');
    try {
      await repo.saveSupplement(s);
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Modal title={supp.name || 'Nuovo integratore'} onClose={onClose}>
      <ErrorBox error={error} />
      <div className="form">
        <div className="grid2">
          <label>Nome<input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></label>
          <label>Marca<input value={s.brand ?? ''} onChange={(e) => setS({ ...s, brand: e.target.value || null })} /></label>
          <label>Variante esatta<input value={s.variant ?? ''} onChange={(e) => setS({ ...s, variant: e.target.value || null })} /></label>
          <label>
            Unità di dose
            <select value={s.doseUnit} onChange={(e) => setS({ ...s, doseUnit: e.target.value as Supplement['doseUnit'], integerDose: ['capsule', 'tablet', 'scoop'].includes(e.target.value) })}>
              {['g', 'ml', 'capsule', 'tablet', 'scoop'].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>Contenuto per unità (g)<NumberInput value={s.massPerUnitG} onChange={(v) => setS({ ...s, massPerUnitG: v })} /></label>
          <label>kcal per unità<NumberInput value={s.kcalPerUnit} onChange={(v) => setS({ ...s, kcalPerUnit: v })} /></label>
          <label>Dose massima/die (produttore)<NumberInput value={s.maxDailyUnits} onChange={(v) => setS({ ...s, maxDailyUnits: v })} /></label>
          <label>Fonte della dose massima<input value={s.maxDailySource ?? ''} onChange={(e) => setS({ ...s, maxDailySource: e.target.value || null })} /></label>
          <label>Etichetta / scheda tecnica<input value={s.labelSource ?? ''} onChange={(e) => setS({ ...s, labelSource: e.target.value || null })} /></label>
          <label>Versione / lotto<input value={s.version ?? ''} onChange={(e) => setS({ ...s, version: e.target.value || null })} /></label>
          <label>
            Stato
            <select value={s.status} onChange={(e) => setS({ ...s, status: e.target.value as Supplement['status'] })}>
              {['missing', 'review_required', 'verified', 'test_fixture'].map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="check"><input type="checkbox" checked={s.integerDose} onChange={(e) => setS({ ...s, integerDose: e.target.checked })} /> Solo dosi intere</label>
        <label className="check"><input type="checkbox" checked={!!s.labelAddedOnly} onChange={(e) => setS({ ...s, labelAddedOnly: e.target.checked })} /> L’etichetta dichiara solo le quantità aggiunte (non è un’analisi completa)</label>
        <label className="check"><input type="checkbox" checked={s.usableForOptimization} onChange={(e) => setS({ ...s, usableForOptimization: e.target.checked })} /> Attivo per la formulazione</label>
        <NutrientGrid values={s.nutrients} onChange={(n) => setS({ ...s, nutrients: n })} perLabel={`per ${s.doseUnit}`} />
        <button onClick={save}>Salva (nuova versione del profilo)</button>
      </div>
    </Modal>
  );
}
