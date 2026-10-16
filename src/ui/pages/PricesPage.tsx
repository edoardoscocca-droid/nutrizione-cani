import { useState } from 'react';
import { unitPrice, type PriceMode, type UserPrice } from '../../engine/cost';
import { uid } from '../../data/repository';
import { useApp, useData } from '../AppContext';
import { ErrorBox, NumberInput } from '../components';
import { DOSE_LABEL, euro } from '../format';

const MODE_LABEL: Record<PriceMode, string> = {
  per_kg: 'Prezzo al kg',
  package_mass: 'Confezione (prezzo + grammi netti)',
  package_units: 'Confezione (prezzo + numero di unità)',
};

export function PricesPage() {
  const { repo, catalog, bump } = useApp();
  const { data: prices } = useData((r) => r.listPrices());
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<UserPrice>>({ mode: 'package_mass' });
  const [error, setError] = useState<string | null>(null);
  if (!catalog || !repo || !prices) return <p>Caricamento…</p>;
  const products = [
    ...catalog.foods.map((f) => ({ kind: 'food' as const, id: f.id, name: f.name, doseUnit: 'g' as const, massPerUnitG: null })),
    ...catalog.supplements.map((s) => ({ kind: 'supplement' as const, id: s.id, name: s.name, doseUnit: s.doseUnit, massPerUnitG: s.massPerUnitG })),
  ].filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));

  const add = async (p: (typeof products)[number]) => {
    setError(null);
    if (!(draft.price! >= 0) || draft.price === undefined) return setError('Inserisci il prezzo.');
    if (draft.mode === 'package_mass' && !(draft.packageGrams! > 0)) return setError('Inserisci il contenuto netto in grammi.');
    if (draft.mode === 'package_units' && !(draft.packageUnits! > 0)) return setError('Inserisci il numero di unità.');
    const existing = prices.filter((x) => x.productId === p.id && x.productKind === p.kind);
    try {
      for (const e of existing) if (e.active) await repo.savePrice({ ...e, active: false });
      await repo.savePrice({
        id: uid(),
        productKind: p.kind,
        productId: p.id,
        supplier: draft.supplier ?? null,
        mode: draft.mode as PriceMode,
        price: draft.price,
        packageGrams: draft.packageGrams ?? null,
        packageUnits: draft.packageUnits ?? null,
        active: true,
        createdAt: new Date().toISOString(),
      });
      setDraft({ mode: 'package_mass' });
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const activate = async (p: UserPrice) => {
    for (const e of prices.filter((x) => x.productId === p.productId && x.productKind === p.productKind)) await repo.savePrice({ ...e, active: e.id === p.id });
    bump();
  };

  return (
    <div>
      <h2>Prezzi</h2>
      <p className="small muted">I prezzi sono solo tuoi e non cambiano mai grammi o valori nutrizionali: aggiornano solo i costi.</p>
      <ErrorBox error={error} />
      <input type="search" placeholder="Cerca prodotto…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="list">
        {products.map((p) => {
          const ps = prices.filter((x) => x.productId === p.id && x.productKind === p.kind);
          const active = ps.find((x) => x.active);
          const up = active ? unitPrice(active, p.doseUnit, p.massPerUnitG) : null;
          return (
            <div key={p.kind + p.id} className="card">
              <div className="row between clickable" onClick={() => setOpen(open === p.id ? null : p.id)}>
                <span>{p.name}</span>
                <span className="small">
                  {up !== null ? `${euro(up * (p.doseUnit === 'g' ? 1000 : 1))} ${p.doseUnit === 'g' ? '/kg' : `/${DOSE_LABEL[p.doseUnit][0]}`}` : <span className="muted">nessun prezzo</span>}
                </span>
              </div>
              {open === p.id && (
                <div>
                  {ps.length > 0 && (
                    <ul className="small">
                      {ps.map((x) => (
                        <li key={x.id}>
                          <label className="check">
                            <input type="radio" checked={x.active} onChange={() => activate(x)} /> {x.supplier || 'senza fornitore'} · {euro(x.price)}{' '}
                            {x.mode === 'per_kg' ? 'al kg' : x.mode === 'package_mass' ? `per ${x.packageGrams} g` : `per ${x.packageUnits} unità`} ·{' '}
                            {new Date(x.createdAt).toLocaleDateString('it-IT')}
                          </label>{' '}
                          <button className="ghost small" onClick={async () => { await repo.deletePrice(x.id); bump(); }}>elimina</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="form">
                    <select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as PriceMode })}>
                      {Object.entries(MODE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <div className="grid3">
                      <NumberInput placeholder="prezzo €" value={draft.price ?? null} onChange={(v) => setDraft({ ...draft, price: v ?? undefined })} />
                      {draft.mode === 'package_mass' && <NumberInput placeholder="grammi netti" value={draft.packageGrams ?? null} onChange={(v) => setDraft({ ...draft, packageGrams: v })} />}
                      {draft.mode === 'package_units' && <NumberInput placeholder="n. unità" value={draft.packageUnits ?? null} onChange={(v) => setDraft({ ...draft, packageUnits: v })} />}
                      <input placeholder="fornitore" value={draft.supplier ?? ''} onChange={(e) => setDraft({ ...draft, supplier: e.target.value || null })} />
                    </div>
                    <button className="small" onClick={() => add(p)}>Aggiungi prezzo (diventa attivo)</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
