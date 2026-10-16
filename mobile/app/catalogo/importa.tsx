import * as DocumentPicker from 'expo-document-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CATALOG_STATUS_LABEL } from '../../../src/engine/catalogStatus';
import { parseImport, planImport, type ImportKind, type ImportPlan } from '../../../src/data/catalogImport';
import { smart } from '../../../src/ui/format';
import { useApp, useData } from '../../lib/AppContext';
import { CatalogBadge } from '../../lib/result';
import { Box, Bullets, Button, Card, Choice, ErrorBox, Field, H, Loading, Screen, T } from '../../lib/ui';

const ACTION = { create: 'nuovo', update: 'aggiornato', unchanged: 'invariato' } as const;

export default function ImportScreen() {
  const { repo, catalog, refresh, isAdmin } = useApp();
  const [kind, setKind] = useState<ImportKind>('foods');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('incollato');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [impact, setImpact] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { data: log, reload } = useData((r) => r.listImports());
  if (!catalog || !repo) return <Loading />;
  if (!isAdmin) return <Screen><T>Solo gli amministratori possono importare.</T></Screen>;

  const pick = async () => {
    setError(null);
    const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/json', 'text/plain', 'text/comma-separated-values', '*/*'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    try {
      setText(await (await fetch(a.uri)).text());
      setFileName(a.name);
      setPlan(null);
    } catch (e) {
      setError(`Impossibile leggere il file: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const analyze = async () => {
    setDone(null);
    const p = planImport(parseImport(text, kind, catalog.nutrients), catalog, fileName);
    setPlan(p);
    const changed = new Set(p.items.filter((i) => i.action === 'update').map((i) => i.id));
    const hits: string[] = [];
    if (changed.size) {
      for (const r of await repo.listRecipes()) {
        const vs = await repo.listVersions(r.id);
        const cur = vs.find((v) => v.id === r.currentVersionId) ?? vs[vs.length - 1];
        if (cur && [...Object.keys(cur.snapshot.foods), ...Object.keys(cur.snapshot.supplements)].some((id) => changed.has(id))) hits.push(r.name);
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
      setDone(`Importazione completata: ${plan.summary.create} nuovi, ${plan.summary.update} aggiornati, ${plan.summary.values} valori. Le versioni precedenti restano nello storico.`);
      setPlan(null);
      setText('');
      reload();
    } catch (e) {
      setError(`Importazione rifiutata, nessuna modifica applicata: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Importa nel catalogo' }} />
      <T small muted>
        CSV o JSON con gli identificativi stabili (es. beef_lean): stesso ID = aggiornamento, ID nuovo = nuovo prodotto, nessun duplicato. Nutrienti riconosciuti da ID o nome; celle vuote = nessuna modifica; NA = «non disponibile». Nulla viene salvato prima della conferma.
      </T>
      <Choice options={[{ value: 'foods' as const, label: 'Alimenti' }, { value: 'supplements' as const, label: 'Integratori' }]} value={kind} onChange={(k) => { setKind(k); setPlan(null); }} />
      <Button title="Scegli un file…" kind="secondary" onPress={pick} />
      <Field label={`Contenuto (${fileName})`} value={text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text} onChange={(v) => { setText(v); setFileName('incollato'); setPlan(null); }} multiline />
      <Button title="Analizza (anteprima)" disabled={!text.trim()} onPress={analyze} />
      <ErrorBox error={error} />
      {done && <Box color="green"><T>{done}</T></Box>}
      {plan && (
        <View style={{ gap: 10 }}>
          <H level={3}>Anteprima</H>
          <T>
            {plan.summary.create} nuovi · {plan.summary.update} aggiornati · {plan.summary.unchanged} invariati · {plan.summary.values} valori
          </T>
          {plan.errors.length > 0 && (
            <Box color="red">
              <T bold>{plan.errors.length} errori: correggi il file, l’importazione non è possibile.</T>
              <Bullets small items={plan.errors.slice(0, 80).map((e) => `${e.line ? `riga ${e.line} · ` : ''}${e.productId ? `${e.productId} · ` : ''}${e.message}`)} />
            </Box>
          )}
          {plan.warnings.length > 0 && (
            <Box color="orange">
              <T bold>Avvisi</T>
              <Bullets small items={plan.warnings.slice(0, 60).map((w) => `${w.productId ? `${w.productId} · ` : ''}${w.message}`)} />
            </Box>
          )}
          {plan.items.map((it) => (
            <Card key={it.id}>
              <T bold>{it.name}</T>
              <T small muted>{it.id} · {ACTION[it.action]} · {it.fieldChanges.length + it.valueChanges.length} modifiche</T>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {it.statusBefore && it.statusBefore !== it.statusAfter.status && <T small muted>{CATALOG_STATUS_LABEL[it.statusBefore]} →</T>}
                <CatalogBadge status={it.statusAfter.status} />
              </View>
              {it.valueChanges.length > 0 && (
                <Bullets small items={it.valueChanges.slice(0, 12).map((v) => `${v.label}: ${v.before === null ? '—' : smart(v.before)} → ${v.after === null ? 'non disponibile' : smart(v.after)} ${v.unit}`)} />
              )}
              {it.valueChanges.length > 12 && <T small muted>…e altri {it.valueChanges.length - 12}</T>}
            </Card>
          ))}
          {impact.length > 0 && (
            <Box color="orange">
              <T small>Dopo l’importazione queste tue ricette risulteranno da ricalcolare (nessuna cambia da sola): {impact.join(', ')}.</T>
            </Box>
          )}
          <Button title="Conferma importazione" busy={busy} disabled={!plan.canApply} onPress={apply} />
          {!plan.canApply && plan.errors.length === 0 && <T small muted>Nessuna modifica da applicare.</T>}
        </View>
      )}
      {log && log.length > 0 && (
        <Card>
          <H level={3}>Importazioni precedenti</H>
          {log.map((l) => (
            <T key={l.id} small>
              {new Date(l.createdAt).toLocaleString('it-IT')} · {l.kind === 'foods' ? 'alimenti' : 'integratori'} · {l.fileName ?? '—'} · {l.summary.create} nuovi, {l.summary.update} aggiornati
            </T>
          ))}
        </Card>
      )}
    </Screen>
  );
}
