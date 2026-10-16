import { useState } from 'react';
import { CATALOG_STATUS_LABEL } from '../../engine/catalogStatus';
import { parseImport, planImport, type ImportKind, type ImportPlan, type PlanItem } from '../../data/catalogImport';
import { useApp, useData } from '../AppContext';
import { ErrorBox } from '../components';
import { smart } from '../format';
import { StatusBadge } from './CatalogPage';

const ACTION_LABEL: Record<PlanItem['action'], string> = { create: 'nuovo', update: 'aggiornato', unchanged: 'invariato' };

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ImportTab() {
  const { repo, catalog, refresh } = useApp();
  const [kind, setKind] = useState<ImportKind>('foods');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('incollato');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [impact, setImpact] = useState<{ recipe: string; dog: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { data: log, reload } = useData((r) => r.listImports());
  if (!catalog || !repo) return null;

  const analyze = async () => {
    setError(null);
    setDone(null);
    const p = planImport(parseImport(text, kind, catalog.nutrients), catalog, fileName);
    setPlan(p);
    // ricette (visibili a te) che useranno dati aggiornati: saranno segnalate «da ricalcolare»
    const changed = new Set(p.items.filter((i) => i.action === 'update').map((i) => i.id));
    const hits: { recipe: string; dog: string }[] = [];
    if (changed.size) {
      const [dogs, recipes] = await Promise.all([repo.listDogs(), repo.listRecipes()]);
      for (const r of recipes) {
        const vs = await repo.listVersions(r.id);
        const cur = vs.find((v) => v.id === r.currentVersionId) ?? vs[vs.length - 1];
        if (!cur) continue;
        const ids = [...Object.keys(cur.snapshot.foods), ...Object.keys(cur.snapshot.supplements)];
        if (ids.some((id) => changed.has(id))) hits.push({ recipe: r.name, dog: dogs.find((d) => d.id === r.dogId)?.name ?? '' });
      }
    }
    setImpact(hits);
  };
  const apply = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      await repo.applyCatalogImport(plan);
      await refresh();
      setDone(`Importazione completata: ${plan.summary.create} nuovi, ${plan.summary.update} aggiornati, ${plan.summary.values} valori. Le versioni precedenti sono nello storico di ogni prodotto.`);
      setPlan(null);
      setText('');
      reload();
    } catch (e) {
      setError(`Importazione rifiutata, nessuna modifica applicata: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    setText(await f.text());
    setPlan(null);
  };
  const templateCsv = () => {
    const unitOf = (id: string) => catalog.nutrients.find((n) => n.id === id)?.unit ?? 'g';
    const req = catalog.nutrients.filter((n) => n.kind !== 'derived' && n.kind !== 'composition' && n.id !== 'epa_dha');
    if (kind === 'foods') {
      const head = 'product_id,nutrient_id,value_per_100g,unit,basis,source_id,status\n';
      download('modello_composizione_alimenti.csv', head + req.map((n) => `id_alimento,${n.id},,${unitOf(n.id)},crudo_parte_edibile,,`).join('\n') + '\n', 'text/csv');
    } else {
      const head = 'supplement_id,nutrient_id,declared_amount,unit,per_dose,source_id,declared_total_or_added,status\n';
      download('modello_composizione_integratori.csv', head + req.map((n) => `id_integratore,${n.id},,${unitOf(n.id)},1,,total,label`).join('\n') + '\n', 'text/csv');
    }
  };
  const templateJson = () => {
    const example =
      kind === 'foods'
        ? { foods: [{ id: 'anchovies', name_it: 'Acciughe', category: 'animal', subcategory: 'fish', processing_state: 'raw', edible_portion: 'filetti senza lisca', kcal_me_per_100g: null, me_method: '', source_identifier: 'FDC 000000', source_version: '', nutrients: { protein: { value: null, unit: 'g', status: 'measured', source: '' } } }] }
        : { supplements: [{ id: 'qdiet', name_it: 'Q-Diet', brand: '', product_variant: '', dose_unit: 'g', kcal_per_unit: null, label_source: '', product_version: '', nutrients: { calcium: { value: null, unit: 'g', status: 'label', source: '' } } }] };
    download(`modello_${kind}.json`, JSON.stringify(example, null, 2), 'application/json');
  };

  return (
    <div>
      <div className="card form">
        <h3>Importazione e aggiornamento massivo</h3>
        <p className="small muted">
          CSV o JSON con gli identificativi stabili del catalogo (es. <code>beef_lean</code>). Prodotti esistenti vengono aggiornati, quelli nuovi creati: niente duplicati.
          I nutrienti si riconoscono da ID, nome italiano o inglese (es. «Calcio (mg)»). Celle vuote = nessuna modifica; <code>NA</code> = rendi «non disponibile».
          Unità di massa convertite automaticamente; IU↔mg mai senza fattore documentato. Nulla viene salvato prima della conferma.
        </p>
        <fieldset>
          <legend>Catalogo</legend>
          <label className="check"><input type="radio" checked={kind === 'foods'} onChange={() => { setKind('foods'); setPlan(null); }} /> Alimenti</label>
          <label className="check"><input type="radio" checked={kind === 'supplements'} onChange={() => { setKind('supplements'); setPlan(null); }} /> Integratori</label>
        </fieldset>
        <label>
          File (.csv o .json)
          <input type="file" accept=".csv,.json,.txt,text/csv,application/json" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <label>
          …oppure incolla qui il contenuto
          <textarea className="mono" rows={6} value={text} onChange={(e) => { setText(e.target.value); setFileName('incollato'); setPlan(null); }} />
        </label>
        <div className="row wrap">
          <button disabled={!text.trim()} onClick={analyze}>Analizza (anteprima)</button>
          <button className="secondary small" onClick={templateCsv}>Modello CSV</button>
          <button className="secondary small" onClick={templateJson}>Esempio JSON</button>
        </div>
      </div>
      <ErrorBox error={error} />
      {done && <div className="box box-green">{done}</div>}

      {plan && (
        <div className="card">
          <h3>Anteprima — {plan.fileName}</h3>
          <p>
            {plan.summary.create} nuovi · {plan.summary.update} aggiornati · {plan.summary.unchanged} invariati · {plan.summary.values} valori nutrizionali
            <span className="small muted"> (formato {plan.format})</span>
          </p>
          {plan.errors.length > 0 && (
            <div className="box box-red">
              <strong>{plan.errors.length} errori: correggi il file, l’importazione non è possibile.</strong>
              <ul className="small">
                {plan.errors.slice(0, 200).map((e, i) => (
                  <li key={i}>
                    {e.line ? `riga ${e.line} · ` : ''}
                    {e.productId ? `${e.productId} · ` : ''}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.warnings.length > 0 && (
            <div className="box box-orange">
              <strong>Avvisi</strong>
              <ul className="small">
                {plan.warnings.slice(0, 100).map((w, i) => (
                  <li key={i}>
                    {w.line ? `riga ${w.line} · ` : ''}
                    {w.productId ? `${w.productId} · ` : ''}
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <table className="nut cat">
            <thead>
              <tr>
                <th>Prodotto</th>
                <th>Azione</th>
                <th>Stato dopo</th>
                <th className="r">Modifiche</th>
              </tr>
            </thead>
            <tbody>
              {plan.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.name} <span className="small muted">{it.id}</span>
                    {(it.fieldChanges.length > 0 || it.valueChanges.length > 0) && (
                      <details>
                        <summary className="small">dettaglio</summary>
                        <ul className="small">
                          {it.fieldChanges.map((c) => (
                            <li key={c.field}>
                              {c.field}: {String(c.before ?? '—')} → <strong>{String(c.after ?? '—')}</strong>
                            </li>
                          ))}
                          {it.valueChanges.map((v) => (
                            <li key={v.nutrientId}>
                              {v.label}: {v.before === null ? '—' : smart(v.before)} → <strong>{v.after === null ? 'non disponibile' : smart(v.after)}</strong> {v.unit}
                              {v.rule && v.rule !== 'identity' ? ` (da ${smart(v.sourceValue)} ${v.sourceUnit})` : ''} · {v.status} · {v.source}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {it.statusAfter.status !== 'verified' && <div className="small muted">{it.statusAfter.reasons.slice(0, 3).join(' · ')}</div>}
                  </td>
                  <td className="small">{ACTION_LABEL[it.action]}</td>
                  <td className="small">
                    {it.statusBefore && it.statusBefore !== it.statusAfter.status && <span className="muted">{CATALOG_STATUS_LABEL[it.statusBefore]} → </span>}
                    <StatusBadge status={it.statusAfter.status} test={'dataStatus' in it.next ? it.next.dataStatus === 'test_fixture' : it.next.status === 'test_fixture'} />
                  </td>
                  <td className="r small">
                    {it.fieldChanges.length + it.valueChanges.length}
                    {it.errors.length > 0 && <span className="tag orange">{it.errors.length} errori</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {impact.length > 0 && (
            <div className="box box-orange small">
              Dopo l’importazione queste tue ricette risulteranno <strong>da ricalcolare</strong> (nessuna viene cambiata da sola):{' '}
              {impact.map((h) => `${h.recipe} (${h.dog})`).join(', ')}. Le ricette degli altri utenti verranno segnalate a loro allo stesso modo.
            </div>
          )}
          {plan.items.some((i) => i.action === 'update') && impact.length === 0 && (
            <p className="small muted">Le ricette che usano i prodotti aggiornati verranno segnalate «da ricalcolare» ai rispettivi utenti.</p>
          )}
          <div className="row">
            <button disabled={!plan.canApply || busy} onClick={apply}>
              {busy ? 'Importazione…' : 'Conferma importazione'}
            </button>
            <button className="ghost" onClick={() => setPlan(null)}>Annulla</button>
          </div>
          {!plan.canApply && plan.errors.length === 0 && <p className="small muted">Nessuna modifica da applicare.</p>}
        </div>
      )}

      {log && log.length > 0 && (
        <details className="card">
          <summary>Importazioni precedenti ({log.length})</summary>
          <ul className="small">
            {log.map((l) => (
              <li key={l.id}>
                {new Date(l.createdAt).toLocaleString('it-IT')} · {l.kind === 'foods' ? 'alimenti' : 'integratori'} · {l.fileName ?? '—'} · {l.summary.create} nuovi, {l.summary.update} aggiornati, {l.summary.values} valori
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

