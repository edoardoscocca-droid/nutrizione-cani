import { useState } from 'react';
import { View } from 'react-native';
import { unitPrice, type PriceMode, type UserPrice } from '../../../src/engine/cost';
import { uid } from '../../../src/data/repository';
import { DOSE_LABEL, euro } from '../../../src/ui/format';
import { useApp, useData } from '../../lib/AppContext';
import { Button, Card, Choice, ErrorBox, Field, Loading, NumField, Row, Screen, T } from '../../lib/ui';

const MODE_LABEL: Record<PriceMode, string> = { per_kg: 'Al kg', package_mass: 'Confezione (g)', package_units: 'Confezione (unità)' };

export default function PricesScreen() {
  const { repo, catalog, bump } = useApp();
  const { data: prices } = useData((r) => r.listPrices());
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<UserPrice>>({ mode: 'package_mass' });
  const [error, setError] = useState<string | null>(null);
  if (!catalog || !repo || !prices) return <Loading />;
  const products = [
    ...catalog.foods.map((f) => ({ kind: 'food' as const, id: f.id, name: f.name, doseUnit: 'g' as const, massPerUnitG: null })),
    ...catalog.supplements.map((s) => ({ kind: 'supplement' as const, id: s.id, name: s.name, doseUnit: s.doseUnit, massPerUnitG: s.massPerUnitG })),
  ].filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));
  const add = async (p: (typeof products)[number]) => {
    setError(null);
    if (draft.price === undefined || draft.price === null || !(draft.price >= 0)) return setError('Inserisci il prezzo.');
    if (draft.mode === 'package_mass' && !(draft.packageGrams! > 0)) return setError('Inserisci il contenuto in grammi.');
    if (draft.mode === 'package_units' && !(draft.packageUnits! > 0)) return setError('Inserisci il numero di unità.');
    try {
      for (const e of prices.filter((x) => x.productId === p.id && x.productKind === p.kind && x.active)) await repo.savePrice({ ...e, active: false });
      await repo.savePrice({ id: uid(), productKind: p.kind, productId: p.id, supplier: draft.supplier ?? null, mode: draft.mode as PriceMode, price: draft.price, packageGrams: draft.packageGrams ?? null, packageUnits: draft.packageUnits ?? null, active: true, createdAt: new Date().toISOString() });
      setDraft({ mode: 'package_mass' });
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Screen>
      <T small muted>I prezzi sono solo tuoi e non cambiano mai grammi o valori nutrizionali: aggiornano solo i costi.</T>
      <ErrorBox error={error} />
      <Field placeholder="Cerca prodotto…" value={query} onChange={setQuery} />
      {products.map((p) => {
        const ps = prices.filter((x) => x.productId === p.id && x.productKind === p.kind);
        const active = ps.find((x) => x.active);
        const up = active ? unitPrice(active, p.doseUnit, p.massPerUnitG) : null;
        return (
          <Card key={p.kind + p.id} onPress={open === p.id ? undefined : () => setOpen(p.id)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={{ flex: 1 }}>{p.name}</T>
              <T small muted={up === null}>{up !== null ? `${euro(up * (p.doseUnit === 'g' ? 1000 : 1))}${p.doseUnit === 'g' ? '/kg' : `/${DOSE_LABEL[p.doseUnit][0]}`}` : 'nessun prezzo'}</T>
            </Row>
            {open === p.id && (
              <View style={{ gap: 8 }}>
                {ps.map((x) => (
                  <Row key={x.id} style={{ justifyContent: 'space-between' }}>
                    <T small style={{ flex: 1 }}>
                      {x.active ? '● ' : '○ '}
                      {x.supplier || 'senza fornitore'} · {euro(x.price)} {x.mode === 'per_kg' ? 'al kg' : x.mode === 'package_mass' ? `per ${x.packageGrams} g` : `per ${x.packageUnits} unità`}
                    </T>
                    {!x.active && <Button title="Usa" kind="ghost" small onPress={async () => { for (const e of ps) await repo.savePrice({ ...e, active: e.id === x.id }); bump(); }} />}
                    <Button title="Elimina" kind="ghost" small onPress={async () => { await repo.deletePrice(x.id); bump(); }} />
                  </Row>
                ))}
                <Choice options={(Object.keys(MODE_LABEL) as PriceMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))} value={draft.mode as PriceMode} onChange={(m) => setDraft({ ...draft, mode: m })} />
                <Row>
                  <NumField label="Prezzo €" value={draft.price ?? null} onChange={(v) => setDraft({ ...draft, price: v ?? undefined })} />
                  {draft.mode === 'package_mass' && <NumField label="Grammi netti" value={draft.packageGrams ?? null} onChange={(v) => setDraft({ ...draft, packageGrams: v })} />}
                  {draft.mode === 'package_units' && <NumField label="N. unità" value={draft.packageUnits ?? null} onChange={(v) => setDraft({ ...draft, packageUnits: v })} />}
                </Row>
                <Field label="Fornitore" value={draft.supplier ?? ''} onChange={(v) => setDraft({ ...draft, supplier: v || null })} />
                <Button title="Aggiungi prezzo (diventa attivo)" small onPress={() => add(p)} />
                <Button title="Chiudi" kind="ghost" small onPress={() => setOpen(null)} />
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
