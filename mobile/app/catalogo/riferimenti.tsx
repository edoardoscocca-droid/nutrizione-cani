import { Stack } from 'expo-router';
import { useState } from 'react';
import { estimateMeFromMacros } from '../../../src/engine/energy';
import { num } from '../../../src/ui/format';
import { useApp } from '../../lib/AppContext';
import { Box, Button, Card, ErrorBox, Field, H, Loading, NumField, Row, Screen, T, Toggle } from '../../lib/ui';

export default function ReferencesScreen() {
  const { catalog, isAdmin, repo, refresh } = useApp();
  const [f, setF] = useState({ version: '', protein: null as number | null, fat: null as number | null, carbohydrate: null as number | null, source: '', approvedBy: '' });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!catalog || !repo) return <Loading />;
  const label = new Map(catalog.nutrients.map((n) => [n.id, n.label]));
  const ef = catalog.energyFactors;
  const candidates = catalog.foods.filter((x) => x.kcalMePer100g === null && x.dataStatus !== 'test_fixture' && estimateMeFromMacros(x.nutrients, ef) !== null);
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Riferimenti ed energia' }} />
      <ErrorBox error={error} />
      {msg && <Box color="green"><T small>{msg}</T></Box>}
      <Card>
        <H level={3}>Energia metabolizzabile per il cane</H>
        {ef.protein === null ? (
          <T small>Servono i fattori energetici approvati (decisione D4). Le energie «umane» delle tabelle non vengono usate.</T>
        ) : (
          <>
            <T small>EM = proteine × {ef.protein} + grassi × {ef.fat} + carboidrati disponibili × {ef.carbohydrate} kcal per 100 g ({ef.version}).</T>
            <Button
              title={`Calcola per ${candidates.length} alimenti senza energia`}
              small
              busy={busy}
              disabled={!isAdmin || !candidates.length}
              onPress={async () => {
                setBusy(true);
                for (const x of candidates) await repo.saveFood({ ...x, kcalMePer100g: estimateMeFromMacros(x.nutrients, ef), meMethod: `Calcolata da macronutrienti, fattori ${ef.version} (${ef.source ?? ''})` });
                await refresh();
                setBusy(false);
                setMsg(`Energia calcolata per ${candidates.length} alimenti.`);
              }}
            />
          </>
        )}
      </Card>
      <Card>
        <H level={3}>Fattori energetici (kcal/g)</H>
        <T small>In uso: {ef.protein === null ? 'nessuno' : `proteine ${ef.protein}, grassi ${ef.fat}, carboidrati ${ef.carbohydrate} — ${ef.source}`}</T>
        {isAdmin && (
          <>
            <Row>
              <NumField label="Proteine" value={f.protein} onChange={(v) => setF({ ...f, protein: v })} />
              <NumField label="Grassi" value={f.fat} onChange={(v) => setF({ ...f, fat: v })} />
              <NumField label="Carboidrati" value={f.carbohydrate} onChange={(v) => setF({ ...f, carbohydrate: v })} />
            </Row>
            <Field label="Versione (es. NRC-2006-modificati)" value={f.version} onChange={(v) => setF({ ...f, version: v })} />
            <Field label="Fonte" value={f.source} onChange={(v) => setF({ ...f, source: v })} />
            <Field label="Approvato da" value={f.approvedBy} onChange={(v) => setF({ ...f, approvedBy: v })} />
            <Button
              title="Attiva questi fattori"
              small
              onPress={async () => {
                setError(null);
                if (!f.version || !f.source || !f.approvedBy || !f.protein || !f.fat || !f.carbohydrate) return setError('Compila tutti i campi: valori, versione, fonte e approvazione.');
                await repo.saveEnergyFactors(f);
                await refresh();
              }}
            />
          </>
        )}
      </Card>
      <Card>
        <H level={3}>Soglie non ufficiali (allegato C)</H>
        {catalog.customThresholds.map((t) => (
          <Toggle key={t.id} label={`${t.metric}: ${num(t.lower)}–${num(t.upper)} (${t.status})`} value={t.enabled} disabled={!isAdmin} onChange={async (v) => { await repo.saveThreshold({ ...t, enabled: v }); await refresh(); }} />
        ))}
      </Card>
      <Card>
        <H level={3}>Standard in uso</H>
        {catalog.referenceVersions.map((r) => (
          <T key={r.id} small>{r.label} — {r.status}</T>
        ))}
        {catalog.limits.map((l) => (
          <T key={l.id} small muted>
            {label.get(l.metric) ?? l.metric}: {l.lower !== null ? `min ${num(l.lower, 3)}` : ''} {l.upper !== null ? `max ${num(l.upper, 3)}` : ''} {l.unit}
            {l.basis === 'per_1000_kcal_me' ? '/1000 kcal' : ''} · {l.limitClass}
            {l.status !== 'verified' ? ' · da rivedere' : ''}
          </T>
        ))}
      </Card>
    </Screen>
  );
}
