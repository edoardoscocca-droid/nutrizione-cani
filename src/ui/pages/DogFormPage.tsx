import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { applyDogChange, breedNotesFor, fiberPerDay, newDog, planDogChange, syncAutoFiber } from '../../engine/dogProfile';
import { applyPreset, presetFor } from '../../data/formulationPresets';
import { fediafReferenceKcal, mer, rer, WEIGHT_GAP_MESSAGE, weightGapNeedsWarning } from '../../engine/energy';
import type { LifeStage, PersonalTarget } from '../../engine/types';
import { KCAL_SOURCE_LABEL, type Dog, type KcalSource, type MacroPreference } from '../../data/model';
import { uid } from '../../data/repository';
import { useApp, useData } from '../AppContext';
import { ErrorBox, Modal, NumberInput } from '../components';
import { num } from '../format';

const LIFE_STAGE: Record<LifeStage, string> = {
  adult_maintenance: 'Adulto in mantenimento',
  growth: 'Crescita (cucciolo)',
  gestation: 'Gestazione',
  lactation: 'Allattamento',
  other: 'Altro / condizione clinica',
};

const MACROS: { metric: MacroPreference['metric']; label: string }[] = [
  { metric: 'protein_energy_pct', label: 'Proteine' },
  { metric: 'fat_energy_pct', label: 'Grassi' },
  { metric: 'carb_energy_pct', label: 'Carboidrati disponibili' },
];

export function DogFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { repo, catalog, bump } = useApp();
  const { data } = useData(async (r) => (id ? ((await r.listDogs()).find((d) => d.id === id) ?? null) : null), [id]);
  const [dog, setDog] = useState<Dog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { next: Dog; plan: ReturnType<typeof planDogChange>; recipes: number }>(null);
  const [gapOk, setGapOk] = useState(false);

  useEffect(() => {
    if (id && data) setDog(data);
    if (!id && !dog) {
      const d = newDog({ name: '', weightCurrentKg: 0 as number }, uid());
      const p = presetFor(d.lifeStage);
      setDog(p ? applyPreset(d, p) : d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data]);

  if (!dog || !repo) return <p>Caricamento…</p>;
  const before = id ? data : null;
  const set = <K extends keyof Dog>(k: K, v: Dog[K]) => setDog({ ...dog, [k]: v });
  const validWeights = dog.weightCurrentKg > 0 && dog.weightIdealKg > 0;
  const gap = validWeights && weightGapNeedsWarning(dog.weightCurrentKg, dog.weightIdealKg);
  const estimate = validWeights ? mer(dog.weightIdealKg, dog.activityFactor) : null;
  const breedNotes = catalog ? breedNotesFor(dog.breed, catalog.breedNotes) : [];

  const preset = presetFor(dog.lifeStage);
  const fiber = fiberPerDay(dog);
  const save = async (raw: Dog) => {
    const next = syncAutoFiber(raw);
    try {
      await repo.saveDog(next);
      if (before && before.weightCurrentKg !== next.weightCurrentKg) {
        await repo.addWeight({ id: uid(), dogId: next.id, date: new Date().toISOString(), weightKg: next.weightCurrentKg });
      }
      if (!before) await repo.addWeight({ id: uid(), dogId: next.id, date: new Date().toISOString(), weightKg: next.weightCurrentKg });
      bump();
      nav(`/cani/${next.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submit = async () => {
    setError(null);
    if (!dog.name.trim()) return setError('Inserisci il nome.');
    if (!validWeights) return setError('Inserisci peso attuale e peso ideale maggiori di zero.');
    if (gap && !gapOk) return setError('Conferma di aver letto l’avviso sullo scostamento di peso.');
    if (!before) {
      const first = { ...dog, kcalTarget: dog.kcalTarget ?? (estimate ? Math.round(estimate) : null), kcalSource: dog.kcalTarget ? dog.kcalSource : estimate ? ('estimated' as KcalSource) : dog.kcalSource };
      return save(first);
    }
    const plan = planDogChange(before, dog);
    if (plan.proposeKcalUpdate || plan.formulationChanged) {
      const recipes = (await repo.listRecipes(dog.id)).length;
      setConfirm({ next: dog, plan, recipes });
      return;
    }
    await save(applyDogChange(before, dog, false));
  };

  const setMacro = (metric: MacroPreference['metric'], patch: Partial<MacroPreference>) => {
    const cur = dog.macroPreferences.find((m) => m.metric === metric) ?? { metric, lower: null, upper: null, locked: false };
    set('macroPreferences', [...dog.macroPreferences.filter((m) => m.metric !== metric), { ...cur, ...patch }]);
  };
  const factorsOk = !catalog || (catalog.energyMethods.some((m) => m.active) && catalog.energyAssignments.length > 0);

  return (
    <div>
      <h2>{before ? `Modifica ${before.name}` : 'Nuovo cane'}</h2>
      <ErrorBox error={error} />
      <div className="card form">
        <h3>Dati</h3>
        <label>Nome<input value={dog.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label>Razza (anche «meticcio»)<input value={dog.breed ?? ''} onChange={(e) => set('breed', e.target.value || null)} /></label>
        {breedNotes.map((n) => (
          <div key={n.id} className="box box-purple small">{n.text}</div>
        ))}
        <div className="grid2">
          <label>Data di nascita<input type="date" value={dog.birthDate ?? ''} onChange={(e) => set('birthDate', e.target.value || null)} /></label>
          <label>oppure età (anni)<NumberInput value={dog.ageYears} onChange={(v) => set('ageYears', v)} /></label>
          <label>
            Sesso
            <select value={dog.sex ?? ''} onChange={(e) => set('sex', (e.target.value || null) as Dog['sex'])}>
              <option value="">—</option>
              <option value="M">Maschio</option>
              <option value="F">Femmina</option>
            </select>
          </label>
          <label>
            Sterilizzato
            <select value={dog.sterilized === null ? '' : dog.sterilized ? 'si' : 'no'} onChange={(e) => set('sterilized', e.target.value === '' ? null : e.target.value === 'si')}>
              <option value="">—</option>
              <option value="si">Sì</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
        <label>
          Fase di vita
          <select value={dog.lifeStage} onChange={(e) => set('lifeStage', e.target.value as LifeStage)}>
            {Object.entries(LIFE_STAGE).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        {dog.lifeStage !== 'adult_maintenance' && (
          <div className="box box-orange small">I riferimenti disponibili valgono solo per l’adulto in mantenimento: per questa fase le ricette risulteranno non verificabili. Serve un veterinario nutrizionista.</div>
        )}
      </div>

      <div className="card form">
        <h3>Peso ed energia</h3>
        <div className="grid2">
          <label>
            Peso attuale (kg)
            <NumberInput value={dog.weightCurrentKg || null} min={0} onChange={(v) => setDog({ ...dog, weightCurrentKg: v ?? 0, weightIdealKg: before ? dog.weightIdealKg : (v ?? 0) })} />
          </label>
          <label>
            Peso ideale / obiettivo (kg)
            <NumberInput value={dog.weightIdealKg || null} min={0} onChange={(v) => set('weightIdealKg', v ?? 0)} />
          </label>
          <label>Condizione corporea (BCS)<NumberInput value={dog.bcs} onChange={(v) => set('bcs', v)} /></label>
          <label>Attività (descrizione)<input value={dog.activity ?? ''} onChange={(e) => set('activity', e.target.value || null)} /></label>
        </div>
        {gap && (
          <div className="box box-orange">
            <strong>{WEIGHT_GAP_MESSAGE}.</strong>
            <div className="small">5 kg è una soglia concordata per l’app, non un limite clinico universale.</div>
            <label className="check">
              <input type="checkbox" checked={gapOk} onChange={(e) => setGapOk(e.target.checked)} /> Ho letto e confermo
            </label>
          </div>
        )}
        <p className="small muted">
          La stima iniziale del fabbisogno usa il peso ideale (convenzione dell’app): non sempre è clinicamente appropriata, soprattutto in sovrappeso, sottopeso o patologie.
        </p>
        <label>
          Fattore energetico (MER = RER × fattore)
          <NumberInput value={dog.activityFactor} step="0.05" onChange={(v) => set('activityFactor', v)} placeholder="da indicare (nessun valore predefinito)" />
        </label>
        {validWeights && (
          <dl className="kv">
            <dt>RER (70 × kg^0,75 sul peso ideale)</dt>
            <dd>{num(rer(dog.weightIdealKg), 0)} kcal/die</dd>
            <dt>MER stimata</dt>
            <dd>{estimate ? `${num(estimate, 0)} kcal/die` : 'serve il fattore energetico'}</dd>
            <dt>Riferimento FEDIAF 95 kcal/kg^0,75 (solo confronto)</dt>
            <dd>{num(fediafReferenceKcal(dog.weightIdealKg), 0)} kcal/die</dd>
          </dl>
        )}
        <div className="grid2">
          <label>
            Obiettivo kcal/die
            <NumberInput value={dog.kcalTarget} onChange={(v) => setDog({ ...dog, kcalTarget: v, kcalSource: dog.kcalSource === 'estimated' ? 'user' : dog.kcalSource })} />
          </label>
          <label>
            Provenienza
            <select value={dog.kcalSource} onChange={(e) => set('kcalSource', e.target.value as KcalSource)}>
              {Object.entries(KCAL_SOURCE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        {estimate && (
          <button className="secondary" type="button" onClick={() => setDog({ ...dog, kcalTarget: Math.round(estimate), kcalSource: 'estimated' })}>
            Usa la stima ({num(estimate, 0)} kcal)
          </button>
        )}
      </div>

      <div className="card form">
        <h3>Preferenze di formulazione</h3>
        {preset && <p className="small">{preset.text}</p>}
        <p className="small muted">
          Percentuali delle <strong>kcal</strong> (non del peso degli ingredienti). Sono preferenze, non limiti ufficiali né soglie di sicurezza: i controlli nutrizionali vengono prima. Il minimo dei carboidrati non è un fabbisogno essenziale.
        </p>
        {!factorsOk && <div className="box box-grey small">Nessun metodo energetico approvato: le preferenze vengono salvate ma non usate nel calcolo.</div>}
        {MACROS.map((m) => {
          const cur = dog.macroPreferences.find((x) => x.metric === m.metric);
          return (
            <div key={m.metric} className="grid3">
              <span>{m.label} (% kcal)</span>
              <NumberInput ariaLabel={`${m.label} minimo`} placeholder="min" value={cur?.lower ?? null} onChange={(v) => setMacro(m.metric, { lower: v })} />
              <NumberInput ariaLabel={`${m.label} massimo`} placeholder="max" value={cur?.upper ?? null} onChange={(v) => setMacro(m.metric, { upper: v })} />
              <label className="check small">
                <input type="checkbox" checked={!!cur?.locked} onChange={(e) => setMacro(m.metric, { locked: e.target.checked })} /> fissato da professionista (rigido)
              </label>
              <label className="check small">
                <input type="checkbox" checked={cur?.enabled !== false} onChange={(e) => setMacro(m.metric, { enabled: e.target.checked })} /> usa questa preferenza
              </label>
            </div>
          );
        })}
        <div className="grid3">
          <span>Fibra alimentare totale (non grezza), g/die</span>
          <NumberInput placeholder="min" value={fiber?.lower ?? null} onChange={(v) => set('fiberTarget', { lower: v, upper: fiber?.upper ?? null, basis: 'per_day', enabled: dog.fiberTarget?.enabled, auto: null })} />
          <NumberInput placeholder="max" value={fiber?.upper ?? null} onChange={(v) => set('fiberTarget', { lower: fiber?.lower ?? null, upper: v, basis: 'per_day', enabled: dog.fiberTarget?.enabled, auto: null })} />
          <label className="check small">
            <input type="checkbox" checked={dog.fiberTarget?.enabled !== false} onChange={(e) => set('fiberTarget', { lower: fiber?.lower ?? null, upper: fiber?.upper ?? null, basis: 'per_day', auto: dog.fiberTarget?.auto ?? null, enabled: e.target.checked })} /> usa questa preferenza
          </label>
        </div>
        <p className="small muted">
          {dog.fiberTarget?.auto
            ? `Fibra calcolata dall’obiettivo energetico (${num(dog.fiberTarget.auto.lowerPer1000, 1)}–${num(dog.fiberTarget.auto.upperPer1000, 1)} g per 1.000 kcal): si aggiorna se cambiano le calorie.`
            : 'Fibra con valori personalizzati: restano invariati se cambiano le calorie.'}
        </p>
        {preset && <button type="button" className="secondary" onClick={() => setDog(applyPreset(dog, preset))}>Ripristina i valori iniziali</button>}
        <label>Preferenze sugli ingredienti<textarea value={dog.ingredientPreferences ?? ''} onChange={(e) => set('ingredientPreferences', e.target.value || null)} /></label>
      </div>

      <TargetsEditor dog={dog} onChange={(t) => set('targets', t)} />

      <div className="card form">
        <h3>Note</h3>
        <label>Note cliniche<textarea value={dog.clinicalNotes ?? ''} onChange={(e) => set('clinicalNotes', e.target.value || null)} /></label>
        <label>
          Nota di attenzione individuale (viola, senza numeri)
          <textarea
            value={dog.notes.map((n) => n.text).join('\n')}
            onChange={(e) => set('notes', e.target.value.split('\n').filter(Boolean).map((text) => ({ text, source: 'nota individuale' })))}
          />
        </label>
      </div>

      <div className="row">
        <button onClick={submit}>Salva</button>
        <button className="ghost" onClick={() => nav(-1)}>Annulla</button>
      </div>

      {confirm && before && (
        <Modal title="Conferma modifiche" onClose={() => setConfirm(null)}>
          {confirm.plan.proposeKcalUpdate && confirm.plan.newEstimate !== null && (
            <p>
              Nuova stima energetica: <strong>{num(confirm.plan.newEstimate, 0)} kcal/die</strong> (attuali {confirm.next.kcalTarget ? num(confirm.next.kcalTarget, 0) : '—'}, {KCAL_SOURCE_LABEL[confirm.next.kcalSource]}).
            </p>
          )}
          {confirm.plan.formulationChanged && confirm.recipes > 0 && (
            <p className="box box-orange small">
              Cambiano dati che incidono sulla formulazione ({confirm.plan.changedFields.join(', ')}). Le {confirm.recipes} ricette di {before.name} verranno segnalate come da ricalcolare: nessuna viene modificata finché non confermi una nuova versione.
            </p>
          )}
          <div className="row">
            {confirm.plan.proposeKcalUpdate && (
              <button onClick={() => save(applyDogChange(before, confirm.next, true))}>Salva e usa la nuova stima</button>
            )}
            <button className={confirm.plan.proposeKcalUpdate ? 'secondary' : ''} onClick={() => save(applyDogChange(before, confirm.next, false))}>
              {confirm.plan.proposeKcalUpdate ? 'Salva mantenendo le kcal attuali' : 'Salva'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TargetsEditor({ dog, onChange }: { dog: Dog; onChange: (t: PersonalTarget[]) => void }) {
  const { catalog } = useApp();
  const nutrients = (catalog?.nutrients ?? []).filter((n) => n.kind !== 'composition');
  const add = () =>
    onChange([
      ...dog.targets,
      { id: uid(), metric: nutrients[0]?.id ?? 'protein', lower: null, upper: null, unit: nutrients[0]?.unit ?? 'g', basis: 'per_day', locked: false, setBy: '', setAt: new Date().toISOString().slice(0, 10) },
    ]);
  const upd = (i: number, p: Partial<PersonalTarget>) => onChange(dog.targets.map((t, j) => (j === i ? { ...t, ...p } : t)));
  return (
    <div className="card form">
      <h3>Target personalizzati</h3>
      <p className="small muted">Distinti dai limiti ufficiali. Rigidi solo se fissati da un professionista (indicare chi). Nessun valore è suggerito dall’app.</p>
      {dog.targets.map((t, i) => {
        const n = nutrients.find((x) => x.id === t.metric);
        return (
          <div key={t.id} className="target-row">
            <select value={t.metric} onChange={(e) => {
                const unit = nutrients.find((x) => x.id === e.target.value)?.unit ?? 'g';
                upd(i, { metric: e.target.value, unit, basis: unit === 'ratio' ? 'ratio' : unit === '%' ? 'energy_pct' : 'per_day' });
              }}>
              {nutrients.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
            <NumberInput placeholder="min" value={t.lower} onChange={(v) => upd(i, { lower: v })} />
            <NumberInput placeholder="max" value={t.upper} onChange={(v) => upd(i, { upper: v })} />
            <select value={t.basis} onChange={(e) => upd(i, { basis: e.target.value as PersonalTarget['basis'] })}>
              <option value="per_day">{n?.unit}/die</option>
              <option value="per_1000_kcal_me">{n?.unit}/1000 kcal</option>
              {n?.unit === 'ratio' && <option value="ratio">rapporto</option>}
              {n?.unit === '%' && <option value="energy_pct">% kcal</option>}
            </select>
            <input placeholder="impostato da" value={t.setBy} onChange={(e) => upd(i, { setBy: e.target.value })} />
            <label className="check small">
              <input type="checkbox" checked={t.locked} onChange={(e) => upd(i, { locked: e.target.checked })} /> professionista (rigido)
            </label>
            <button className="ghost" onClick={() => onChange(dog.targets.filter((_, j) => j !== i))}>Rimuovi</button>
          </div>
        );
      })}
      <button className="secondary" type="button" onClick={add}>+ Aggiungi target</button>
    </div>
  );
}
