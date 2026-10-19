import { useState } from 'react';
import { CATALOG_STATUS_HELP, CATALOG_STATUS_LABEL, foodStatus, statusHelp, supplementStatus, type CatalogStatus, type StatusResult } from '../../engine/catalogStatus';
import type { DataStatus, EnergyAssignment, EnergyMethod, Food, NutrientValue, ProcessingGroup, ProcessingState, Supplement } from '../../engine/types';
import { PROCESSING_LABEL } from '../../data/packageCatalog';
import { SUPPLEMENT_ENERGY_CATEGORY } from '../../engine/energy';
import { compoundValue } from '../../engine/totals';
import { uid } from '../../data/repository';
import { useApp, useData } from '../AppContext';
import { ErrorBox, Modal, NumberInput } from '../components';
import { num } from '../format';
import { ImportTab } from './ImportTab';

function completeness(nutrients: Record<string, NutrientValue>, required: string[]) {
  const known = required.filter((id) => nutrients[id]?.value !== null && nutrients[id]?.value !== undefined);
  return { known: known.length, total: required.length, missing: required.filter((id) => !known.includes(id)) };
}

const BADGE_CLASS: Record<CatalogStatus, string> = { verified: 'green', partial: 'orange', to_complete: 'grey' };

export function StatusBadge({ status, test }: { status: CatalogStatus; test?: boolean }) {
  return (
    <span className={`tag ${BADGE_CLASS[status]}`} title={CATALOG_STATUS_HELP[status]}>
      {test ? 'PROVA · ' : ''}
      {CATALOG_STATUS_LABEL[status]}
    </span>
  );
}

export function StatusPanel({ st, validatedBy, validatedAt, kind = 'food' }: { st: StatusResult; validatedBy?: string | null; validatedAt?: string | null; kind?: 'food' | 'supplement' }) {
  return (
    <div className={`box ${st.status === 'verified' ? 'box-green' : st.status === 'partial' ? 'box-orange' : 'box-grey'}`}>
      <strong>{CATALOG_STATUS_LABEL[st.status]}</strong> — <span className="small">{statusHelp(kind, st.status)}</span>
      {st.reasons.length > 0 && (
        <ul className="small">
          {st.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {st.info.length > 0 && (
        <ul className="small muted">
          {st.info.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {validatedAt && <div className="small">Convalidato da {validatedBy} il {new Date(validatedAt).toLocaleString('it-IT')}</div>}
    </div>
  );
}

type Tab = 'foods' | 'supplements' | 'refs' | 'import';

export function CatalogPage() {
  const { catalog, isAdmin, repo } = useApp();
  const [tab, setTab] = useState<Tab>('foods');
  const [filter, setFilter] = useState<CatalogStatus | 'all'>('all');
  const [editFood, setEditFood] = useState<Food | null>(null);
  const [editSupp, setEditSupp] = useState<Supplement | null>(null);
  if (!catalog || !repo) return <p>Caricamento…</p>;
  const required = catalog.nutrients.filter((n) => n.kind === 'core' || n.kind === 'advanced').map((n) => n.id);
  const label = new Map(catalog.nutrients.map((n) => [n.id, n.label]));
  const fStatus = new Map(catalog.foods.map((f) => [f.id, foodStatus(f, catalog.nutrients)]));
  const sStatus = new Map(catalog.supplements.map((s) => [s.id, supplementStatus(s, catalog.nutrients)]));
  const count = (m: Map<string, StatusResult>, st: CatalogStatus) => [...m.values()].filter((x) => x.status === st).length;
  const counts = tab === 'supplements' ? sStatus : fStatus;
  return (
    <div>
      <h2>Catalogo</h2>
      <p className="small muted">
        {repo.mode === 'supabase'
          ? isAdmin
            ? 'Sei amministratore: puoi modificare, importare e convalidare. Ogni modifica crea una nuova versione del profilo e resta nel registro.'
            : 'Consultazione: alimenti, integratori e riferimenti sono modificabili solo dagli amministratori.'
          : 'Modalità prova: il catalogo di prova si modifica solo su questo dispositivo. In Supabase solo gli amministratori possono farlo.'}
      </p>
      <div className="tabs">
        <button className={tab === 'foods' ? 'on' : ''} onClick={() => setTab('foods')}>Alimenti</button>
        <button className={tab === 'supplements' ? 'on' : ''} onClick={() => setTab('supplements')}>Integratori</button>
        <button className={tab === 'refs' ? 'on' : ''} onClick={() => setTab('refs')}>Riferimenti</button>
        {isAdmin && <button className={tab === 'import' ? 'on' : ''} onClick={() => setTab('import')}>Importa</button>}
      </div>
      {(tab === 'foods' || tab === 'supplements') && (
        <div className="row wrap status-filter">
          {(['all', 'verified', 'partial', 'to_complete'] as const).map((st) => (
            <button key={st} className={`small ${filter === st ? '' : 'secondary'}`} onClick={() => setFilter(st)}>
              {st === 'all' ? `Tutti (${counts.size})` : `${CATALOG_STATUS_LABEL[st]} (${count(counts, st)})`}
            </button>
          ))}
        </div>
      )}
      {tab === 'foods' && (
        <>
          {isAdmin && (
            <button className="secondary" onClick={() => setEditFood({ id: `food_${uid().slice(0, 8)}`, name: '', categoryId: 'animal', subcategoryId: 'muscle', processingState: 'raw', kcalMePer100g: null, dataStatus: 'unverified', availableToFormulate: false, profileVersion: 1, nutrients: {} })}>
              + Nuovo alimento
            </button>
          )}
          {catalog.categories.filter((c) => c.parentId).map((c) => {
            const foods = catalog.foods.filter((f) => f.subcategoryId === c.id && (filter === 'all' || fStatus.get(f.id)!.status === filter));
            if (!foods.length) return null;
            return (
              <div key={c.id} className="card">
                <h4>{catalog.categories.find((p) => p.id === c.parentId)?.label} · {c.label}</h4>
                <table className="nut cat">
                  <tbody>
                    {foods.map((f) => {
                      const cm = completeness(f.nutrients, required);
                      const st = fStatus.get(f.id)!;
                      return (
                        <tr key={f.id}>
                          <td>
                            {f.name} <span className="small muted">({PROCESSING_LABEL[f.processingState]}, v{f.profileVersion})</span>
                            <div className="small muted">{f.source ?? 'fonte non indicata'}{f.sourceVersion ? ` · ${f.sourceVersion}` : ''}</div>
                            {st.status !== 'verified' && <div className="small muted">{st.reasons.slice(0, 2).join(' · ')}</div>}
                          </td>
                          <td className="small">
                            <StatusBadge status={st.status} test={f.dataStatus === 'test_fixture'} />
                            {f.availableToFormulate ? <span className="tag green">attivo</span> : <span className="tag grey">non attivo</span>}
                          </td>
                          <td className="small r" title={cm.missing.map((m) => label.get(m)).join(', ')}>
                            {cm.known}/{cm.total} essenziali{f.kcalMePer100g === null ? ' · kcal mancanti' : ` · ${num(f.kcalMePer100g, 0)} kcal`}
                          </td>
                          <td><button className="small secondary" onClick={() => setEditFood(structuredClone(f))}>{isAdmin ? 'Modifica' : 'Dettagli'}</button></td>
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
          <table className="nut cat">
            <tbody>
              {catalog.supplements
                .filter((s) => filter === 'all' || sStatus.get(s.id)!.status === filter)
                .map((s) => {
                  const declared = Object.values(s.nutrients).filter((v) => v.value !== null).length;
                  const st = sStatus.get(s.id)!;
                  return (
                    <tr key={s.id}>
                      <td>
                        {s.name} <span className="small muted">{s.brand} {s.variant} · per {s.doseUnit} · v{s.profileVersion}</span>
                        <div className="small muted">{s.labelSource ?? 'etichetta non caricata'}{s.notes ? ` · ${s.notes}` : ''}</div>
                        {st.status !== 'verified' && <div className="small muted">{st.reasons.slice(0, 2).join(' · ')}</div>}
                      </td>
                      <td className="small">
                        <StatusBadge status={st.status} test={s.status === 'test_fixture'} />
                        {s.usableForOptimization ? <span className="tag green">attivo</span> : <span className="tag grey">non attivo</span>}
                      </td>
                      <td className="small r">{declared} nutrienti dichiarati{s.labelAddedOnly ? ' (solo aggiunti)' : ''}</td>
                      <td><button className="small secondary" onClick={() => setEditSupp(structuredClone(s))}>{isAdmin ? 'Modifica' : 'Dettagli'}</button></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'refs' && <RefsTab />}
      {tab === 'import' && isAdmin && <ImportTab />}
      {editFood && <FoodEditor food={editFood} onClose={() => setEditFood(null)} />}
      {editSupp && <SuppEditor supp={editSupp} onClose={() => setEditSupp(null)} />}
    </div>
  );
}

function HistoryList({ kind, id }: { kind: 'food' | 'supplement'; id: string }) {
  const { data } = useData((r) => r.listProfileHistory(kind, id), [kind, id]);
  if (!data?.length) return <p className="small muted">Nessuna versione precedente.</p>;
  return (
    <ul className="small">
      {data.map((h) => (
        <li key={h.version}>
          v{h.version} — sostituita il {new Date(h.changedAt).toLocaleString('it-IT')}
          {h.changedBy ? ` (${h.changedBy})` : ''}
          <details>
            <summary>profilo</summary>
            <pre className="small pre">{JSON.stringify(h.profile, null, 1)}</pre>
          </details>
        </li>
      ))}
    </ul>
  );
}

function ValidateButton({ kind, id, st }: { kind: 'food' | 'supplement'; id: string; st: StatusResult }) {
  const { repo, refresh, isAdmin } = useApp();
  const [error, setError] = useState<string | null>(null);
  if (!isAdmin || !repo || st.status === 'verified') return null;
  return (
    <div>
      <ErrorBox error={error} />
      <button
        className="small"
        disabled={!st.readyForValidation}
        title={st.readyForValidation ? '' : 'Prima vanno soddisfatti tutti i criteri elencati'}
        onClick={async () => {
          setError(null);
          try {
            await repo.validateCatalogItem(kind, id);
            await refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        Convalida (dati controllati)
      </button>
      {!st.readyForValidation && <span className="small muted"> Disponibile quando restano solo da convalidare i dati salvati.</span>}
    </div>
  );
}

function RefsTab() {
  const { catalog, isAdmin, repo, refresh } = useApp();
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
      <EnergyMethodsCard />
      <ConversionsCard />
    </div>
  );
}

const PROCESSING_GROUP_LABEL: Record<ProcessingGroup, string> = { any: 'qualsiasi stato', raw: 'crudo', cooked: 'cotto' };

function ConversionsCard() {
  const { catalog } = useApp();
  if (!catalog) return null;
  return (
    <div className="card">
      <h3>Conversioni di unità approvate</h3>
      <p className="small muted">Usate dall’importazione. La vitamina E si converte solo se il file indica la forma chimica.</p>
      <ul className="small">
        {catalog.unitConversions.map((c) => (
          <li key={c.id}>{c.formLabel}: 1 {c.fromUnit} = {String(c.factor).replace('.', ',')} {c.toUnit} — {c.source}</li>
        ))}
      </ul>
    </div>
  );
}

/** Metodi energetici (D4): fattori versionati e associazione alle tipologie di alimento. Modifiche solo per gli amministratori. */
function EnergyMethodsCard() {
  const { catalog, isAdmin, repo, refresh } = useApp();
  const empty = { id: '', version: '', label: '', protein: null as number | null, fat: null as number | null, carbohydrate: null as number | null, source: '', approvedBy: '', notes: '' };
  const [edit, setEdit] = useState<typeof empty | null>(null);
  const [rows, setRows] = useState<EnergyAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!catalog || !repo) return null;
  const methods = catalog.energyMethods;
  const assignments = rows ?? catalog.energyAssignments;
  const catLabel = (id: string) => (id === SUPPLEMENT_ENERGY_CATEGORY ? 'Integratori (solo quote energetiche)' : (catalog.categories.find((c) => c.id === id)?.label ?? id));
  const calculated = catalog.foods.filter((f) => f.kcalMeOrigin === 'calculated').length;
  const save = async () => {
    if (!edit) return;
    const prev = methods.find((m) => m.id === edit.id);
    if (!edit.id || !edit.version || !edit.label || !edit.source || !edit.approvedBy || !edit.protein || !edit.fat || !edit.carbohydrate) return setError('Compila tutti i campi: fattori, versione, nome, fonte e approvazione.');
    if (prev && prev.version === edit.version && (prev.protein !== edit.protein || prev.fat !== edit.fat || prev.carbohydrate !== edit.carbohydrate)) return setError('Hai cambiato i fattori: indica una nuova versione (le ricette verranno segnalate da ricalcolare).');
    try {
      await repo.saveEnergyMethod({ id: edit.id, version: edit.version, label: edit.label, protein: edit.protein, fat: edit.fat, carbohydrate: edit.carbohydrate, source: edit.source, approvedBy: edit.approvedBy, approvedAt: new Date().toISOString().slice(0, 10), notes: edit.notes || null, active: true });
      setEdit(null);
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="card form">
      <h3>Energia metabolizzabile: metodi per tipologia di alimento</h3>
      <p className="small">
        L’EM per il cane si calcola da proteine, grassi e carboidrati disponibili con il metodo della tipologia (e dello stato crudo/cotto) dell’alimento,
        se un amministratore non ha inserito un valore misurato. L’energia «umana» delle tabelle non viene mai usata. Oggi {calculated} alimenti usano l’EM calcolata.
      </p>
      <ErrorBox error={error} />
      {methods.map((m) => (
        <div key={m.id} className="box small">
          <strong>{m.label}</strong> · v. {m.version} · proteine {m.protein}, grassi {m.fat}, carboidrati disponibili {m.carbohydrate} kcal/g{!m.active && ' · non attivo'}
          <div className="muted">{m.source} — approvato da {m.approvedBy}{m.approvedAt ? ` (${m.approvedAt})` : ''}</div>
          {m.notes && <div className="muted">{m.notes}</div>}
          {isAdmin && <button className="small" onClick={() => setEdit({ ...m, notes: m.notes ?? '' })}>Modifica</button>}
        </div>
      ))}
      {isAdmin && !edit && <button className="small" onClick={() => setEdit({ ...empty })}>Nuovo metodo</button>}
      {edit && (
        <>
          <input placeholder="codice (es. fediaf_2025_ingredienti_naturali)" value={edit.id} disabled={methods.some((m) => m.id === edit.id && edit.label === m.label)} onChange={(e) => setEdit({ ...edit, id: e.target.value.trim() })} />
          <input placeholder="nome" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
          <div className="grid3">
            <NumberInput placeholder="proteine kcal/g" value={edit.protein} onChange={(v) => setEdit({ ...edit, protein: v })} />
            <NumberInput placeholder="grassi kcal/g" value={edit.fat} onChange={(v) => setEdit({ ...edit, fat: v })} />
            <NumberInput placeholder="carboidrati kcal/g" value={edit.carbohydrate} onChange={(v) => setEdit({ ...edit, carbohydrate: v })} />
          </div>
          <input placeholder="versione" value={edit.version} onChange={(e) => setEdit({ ...edit, version: e.target.value })} />
          <input placeholder="fonte" value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })} />
          <input placeholder="approvato da" value={edit.approvedBy} onChange={(e) => setEdit({ ...edit, approvedBy: e.target.value })} />
          <input placeholder="note (preparazione, digeribilità…)" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
          <div className="actions">
            <button className="small" onClick={save}>Salva metodo</button>
            <button className="small ghost" onClick={() => setEdit(null)}>Annulla</button>
          </div>
        </>
      )}
      <h4>Associazioni</h4>
      <table className="nut">
        <thead>
          <tr><th>Tipologia</th><th>Stato</th><th>Metodo</th><th>Avvertenza (digeribilità, preparazione)</th></tr>
        </thead>
        <tbody>
          {assignments.map((a, i) => (
            <tr key={`${a.categoryId}:${a.processing}`}>
              <td>{catLabel(a.categoryId)}</td>
              <td>{PROCESSING_GROUP_LABEL[a.processing]}</td>
              <td>
                {isAdmin ? (
                  <select value={a.methodId} onChange={(e) => setRows(assignments.map((x, j) => (j === i ? { ...x, methodId: e.target.value } : x)))}>
                    {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                ) : (methods.find((m) => m.id === a.methodId)?.label ?? a.methodId)}
              </td>
              <td className="small">
                {isAdmin ? <input value={a.caution ?? ''} onChange={(e) => setRows(assignments.map((x, j) => (j === i ? { ...x, caution: e.target.value || null } : x)))} /> : a.caution}
                {isAdmin && <button className="small ghost" onClick={() => setRows(assignments.filter((_, j) => j !== i))}>Togli</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isAdmin && <AddAssignment methods={methods} categories={catalog.categories} onAdd={(a) => setRows([...assignments.filter((x) => !(x.categoryId === a.categoryId && x.processing === a.processing)), a])} />}
      {isAdmin && rows && (
        <button
          className="small"
          onClick={async () => {
            try {
              await repo.saveEnergyAssignments(rows);
              setRows(null);
              await refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Salva associazioni
        </button>
      )}
    </div>
  );
}

function AddAssignment({ methods, categories, onAdd }: { methods: EnergyMethod[]; categories: { id: string; label: string }[]; onAdd: (a: EnergyAssignment) => void }) {
  const [a, setA] = useState<EnergyAssignment>({ categoryId: categories[0]?.id ?? '', processing: 'any', methodId: methods[0]?.id ?? '', caution: null });
  return (
    <div className="grid3">
      <select value={a.categoryId} onChange={(e) => setA({ ...a, categoryId: e.target.value })}>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        <option value={SUPPLEMENT_ENERGY_CATEGORY}>Integratori</option>
      </select>
      <select value={a.processing} onChange={(e) => setA({ ...a, processing: e.target.value as ProcessingGroup })}>
        {(Object.keys(PROCESSING_GROUP_LABEL) as ProcessingGroup[]).map((k) => <option key={k} value={k}>{PROCESSING_GROUP_LABEL[k]}</option>)}
      </select>
      <button className="small" disabled={!a.categoryId || !a.methodId} onClick={() => onAdd(a)}>Aggiungi associazione</button>
    </div>
  );
}

// qualità dichiarata del profilo; lo stato «Verificato» si ottiene solo con la convalida
const STATUS_OPTS: DataStatus[] = ['unverified', 'review_required', 'estimated'];

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
          const calc = v.value === null ? compoundValue(values, n.id) : null;
          return (
            <tr key={n.id}>
              <td>{n.label} <span className="muted small">{n.unit}</span></td>
              <td className="r"><NumberInput ariaLabel={n.label} min={0} value={v.value} placeholder={calc ? `calcolato ${num(calc.value, 3)} (somma)` : 'non disponibile'} onChange={(x) => upd({ value: x, status: x === null ? 'unknown' : v.status && v.status !== 'unknown' ? v.status : 'measured' })} /></td>
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
  const { repo, catalog, refresh, isAdmin } = useApp();
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
      <StatusPanel st={foodStatus(f, catalog.nutrients)} validatedBy={food.validatedBy} validatedAt={food.validatedAt} />
      {catalog.foods.some((x) => x.id === food.id) && <ValidateButton kind="food" id={food.id} st={foodStatus(food, catalog.nutrients)} />}
      <ErrorBox error={error} />
      <fieldset className="form plain" disabled={!isAdmin}>
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
          <label>
            kcal EM per 100 g (vuoto = calcolata con il metodo della tipologia)
            <NumberInput
              placeholder={f.kcalMeOrigin === 'calculated' ? `calcolata: ${num(f.kcalMePer100g, 1)}` : 'calcolata dal metodo'}
              value={f.kcalMeOrigin === 'calculated' ? null : f.kcalMePer100g}
              onChange={(v) => setF({ ...f, kcalMePer100g: v, kcalMeOrigin: v === null ? null : 'declared', meMethod: v === null ? null : f.kcalMeOrigin === 'calculated' ? null : f.meMethod })}
            />
          </label>
          {f.kcalMeOrigin !== 'calculated' && <label>Metodo EM (come è stata ottenuta)<input value={f.meMethod ?? ''} onChange={(e) => setF({ ...f, meMethod: e.target.value || null })} /></label>}
          {f.kcalMeOrigin === 'calculated' && f.energyMethod && <p className="small muted">{f.meMethod}{f.energyMethod.caution ? ` — ${f.energyMethod.caution}` : ''}</p>}
          <label>Fonte (es. FDC id)<input value={f.source ?? ''} onChange={(e) => setF({ ...f, source: e.target.value || null })} /></label>
          <label>Versione fonte<input value={f.sourceVersion ?? ''} onChange={(e) => setF({ ...f, sourceVersion: e.target.value || null })} /></label>
          <label>
            Stato dei dati
            <select value={f.dataStatus} onChange={(e) => setF({ ...f, dataStatus: e.target.value as DataStatus })}>
              {[...STATUS_OPTS, ...(f.dataStatus === 'verified' || f.dataStatus === 'test_fixture' ? [f.dataStatus] : [])].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label>Incertezza / note<input value={f.uncertainty ?? ''} onChange={(e) => setF({ ...f, uncertainty: e.target.value || null })} /></label>
        <label className="check"><input type="checkbox" checked={f.availableToFormulate} onChange={(e) => setF({ ...f, availableToFormulate: e.target.checked })} /> Attivo per la formulazione (non possibile se «da completare»)</label>
        <p className="small muted">Valori per 100 g di parte edibile nello stato indicato. Lascia vuoto ciò che la fonte non riporta: non verrà mai considerato zero. Crudo e cotto sono alimenti distinti.</p>
        <NutrientGrid values={f.nutrients} onChange={(n) => setF({ ...f, nutrients: n })} perLabel="/100 g" />
        {isAdmin && <button onClick={save}>Salva (nuova versione del profilo; la convalida decade)</button>}
      </fieldset>
      <h4>Versioni precedenti</h4>
      <HistoryList kind="food" id={food.id} />
    </Modal>
  );
}

function SuppEditor({ supp, onClose }: { supp: Supplement; onClose: () => void }) {
  const { repo, refresh, isAdmin, catalog } = useApp();
  const [s, setS] = useState(supp);
  const [error, setError] = useState<string | null>(null);
  if (!repo || !catalog) return null;
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
      <StatusPanel kind="supplement" st={supplementStatus(s, catalog.nutrients)} validatedBy={supp.validatedBy} validatedAt={supp.validatedAt} />
      {catalog.supplements.some((x) => x.id === supp.id) && <ValidateButton kind="supplement" id={supp.id} st={supplementStatus(supp, catalog.nutrients)} />}
      <ErrorBox error={error} />
      <fieldset className="form plain" disabled={!isAdmin}>
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
              {['missing', 'review_required', ...(s.status === 'verified' || s.status === 'test_fixture' ? [s.status] : [])].map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="check"><input type="checkbox" checked={s.integerDose} onChange={(e) => setS({ ...s, integerDose: e.target.checked })} /> Solo dosi intere</label>
        <label className="check"><input type="checkbox" checked={!!s.labelAddedOnly} onChange={(e) => setS({ ...s, labelAddedOnly: e.target.checked })} /> L’etichetta dichiara solo le quantità aggiunte (non è un’analisi completa)</label>
        <label className="check"><input type="checkbox" checked={s.usableForOptimization} onChange={(e) => setS({ ...s, usableForOptimization: e.target.checked })} /> Attivo per la formulazione</label>
        <NutrientGrid values={s.nutrients} onChange={(n) => setS({ ...s, nutrients: n })} perLabel={`per ${s.doseUnit}`} />
        {isAdmin && <button onClick={save}>Salva (nuova versione del profilo; la convalida decade)</button>}
      </fieldset>
      <h4>Versioni precedenti</h4>
      <HistoryList kind="supplement" id={supp.id} />
    </Modal>
  );
}
