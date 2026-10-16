import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SUPPLEMENT_ENERGY_CATEGORY } from '../../../src/engine/energy';
import type { EnergyAssignment, ProcessingGroup } from '../../../src/engine/types';
import { num } from '../../../src/ui/format';
import { useApp } from '../../lib/AppContext';
import { Box, Button, Card, Choice, ErrorBox, Field, H, Loading, NumField, Row, Screen, T, Toggle } from '../../lib/ui';

const GROUP: Record<ProcessingGroup, string> = { any: 'qualsiasi stato', raw: 'crudo', cooked: 'cotto' };

export default function ReferencesScreen() {
  const { catalog, isAdmin, repo, refresh } = useApp();
  const empty = { id: '', version: '', label: '', protein: null as number | null, fat: null as number | null, carbohydrate: null as number | null, source: '', approvedBy: '', notes: '' };
  const [edit, setEdit] = useState<typeof empty | null>(null);
  const [rows, setRows] = useState<EnergyAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!catalog || !repo) return <Loading />;
  const label = new Map(catalog.nutrients.map((n) => [n.id, n.label]));
  const methods = catalog.energyMethods;
  const assignments = rows ?? catalog.energyAssignments;
  const catLabel = (id: string) => (id === SUPPLEMENT_ENERGY_CATEGORY ? 'Integratori (solo quote energetiche)' : (catalog.categories.find((c) => c.id === id)?.label ?? id));
  const calculated = catalog.foods.filter((f) => f.kcalMeOrigin === 'calculated').length;
  const saveMethod = async () => {
    if (!edit) return;
    setError(null);
    const prev = methods.find((m) => m.id === edit.id);
    if (!edit.id || !edit.version || !edit.label || !edit.source || !edit.approvedBy || !edit.protein || !edit.fat || !edit.carbohydrate) return setError('Compila tutti i campi: fattori, versione, nome, fonte e approvazione.');
    if (prev && prev.version === edit.version && (prev.protein !== edit.protein || prev.fat !== edit.fat || prev.carbohydrate !== edit.carbohydrate)) return setError('Hai cambiato i fattori: indica una nuova versione (le ricette verranno segnalate da ricalcolare).');
    setBusy(true);
    try {
      await repo.saveEnergyMethod({ id: edit.id, version: edit.version, label: edit.label, protein: edit.protein, fat: edit.fat, carbohydrate: edit.carbohydrate, source: edit.source, approvedBy: edit.approvedBy, approvedAt: new Date().toISOString().slice(0, 10), notes: edit.notes || null, active: true });
      setEdit(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Riferimenti ed energia' }} />
      <ErrorBox error={error} />
      <Card>
        <H level={3}>Energia metabolizzabile per il cane</H>
        <T small>
          Si calcola da proteine, grassi e carboidrati disponibili con il metodo della tipologia di alimento (e dello stato crudo o cotto), se non è stato
          inserito un valore misurato. L’energia «umana» delle tabelle non viene mai usata. Oggi {calculated} alimenti usano l’energia calcolata.
        </T>
        {methods.map((m) => (
          <Box key={m.id} color="blue">
            <T small bold>{m.label} · v. {m.version}</T>
            <T small>Proteine {m.protein} · grassi {m.fat} · carboidrati disponibili {m.carbohydrate} kcal/g{!m.active ? ' · non attivo' : ''}</T>
            <T small muted>{m.source} — approvato da {m.approvedBy}{m.approvedAt ? ` (${m.approvedAt})` : ''}</T>
            {m.notes ? <T small muted>{m.notes}</T> : null}
            {isAdmin && <Button title="Modifica" small onPress={() => setEdit({ ...m, notes: m.notes ?? '' })} />}
          </Box>
        ))}
        {isAdmin && !edit && <Button title="Nuovo metodo" small onPress={() => setEdit({ ...empty })} />}
        {edit && (
          <>
            <Field label="Codice" value={edit.id} onChange={(v) => setEdit({ ...edit, id: v.trim() })} autoCapitalize="none" />
            <Field label="Nome" value={edit.label} onChange={(v) => setEdit({ ...edit, label: v })} />
            <Row>
              <NumField label="Proteine" value={edit.protein} onChange={(v) => setEdit({ ...edit, protein: v })} />
              <NumField label="Grassi" value={edit.fat} onChange={(v) => setEdit({ ...edit, fat: v })} />
              <NumField label="Carboidrati" value={edit.carbohydrate} onChange={(v) => setEdit({ ...edit, carbohydrate: v })} />
            </Row>
            <Field label="Versione" value={edit.version} onChange={(v) => setEdit({ ...edit, version: v })} />
            <Field label="Fonte" value={edit.source} onChange={(v) => setEdit({ ...edit, source: v })} />
            <Field label="Approvato da" value={edit.approvedBy} onChange={(v) => setEdit({ ...edit, approvedBy: v })} />
            <Field label="Note (preparazione, digeribilità…)" value={edit.notes} onChange={(v) => setEdit({ ...edit, notes: v })} multiline />
            <Row>
              <Button title="Salva metodo" small busy={busy} onPress={saveMethod} />
              <Button title="Annulla" small kind="ghost" onPress={() => setEdit(null)} />
            </Row>
          </>
        )}
      </Card>
      <Card>
        <H level={3}>Metodo per tipologia di alimento</H>
        {assignments.map((a, i) => (
          <View key={`${a.categoryId}:${a.processing}`} style={{ gap: 4, paddingVertical: 6 }}>
            <T small bold>{catLabel(a.categoryId)} · {GROUP[a.processing]}</T>
            {isAdmin ? (
              <Choice options={methods.map((m) => ({ value: m.id, label: m.label }))} value={a.methodId} onChange={(v) => setRows(assignments.map((x, j) => (j === i ? { ...x, methodId: v } : x)))} />
            ) : (
              <T small>{methods.find((m) => m.id === a.methodId)?.label ?? a.methodId}</T>
            )}
            {isAdmin ? (
              <Field label="Avvertenza (digeribilità, preparazione)" value={a.caution ?? ''} onChange={(v) => setRows(assignments.map((x, j) => (j === i ? { ...x, caution: v || null } : x)))} multiline />
            ) : a.caution ? (
              <T small muted>{a.caution}</T>
            ) : null}
          </View>
        ))}
        {isAdmin && rows && (
          <Button
            title="Salva associazioni"
            small
            busy={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await repo.saveEnergyAssignments(rows);
                setRows(null);
                await refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </Card>
      <Card>
        <H level={3}>Conversioni di unità approvate</H>
        <T small muted>Usate dall’importazione. La vitamina E si converte solo se il file indica la forma chimica.</T>
        {catalog.unitConversions.map((c) => (
          <T key={c.id} small>{c.formLabel}: 1 {c.fromUnit} = {String(c.factor).replace('.', ',')} {c.toUnit}</T>
        ))}
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
