import * as Print from 'expo-print';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { STATUS_LABEL } from '../../../src/engine/audit';
import type { RecipeItem } from '../../../src/engine/types';
import type { RecipeVersion } from '../../../src/data/model';
import { auditOnSnapshot, costOf, editedVersion, previewRecalculation, staleFor, versionFromResult, type RecalcPreview } from '../../../src/data/recipeService';
import { uid } from '../../../src/data/repository';
import { DISCLAIMER, dose, num } from '../../../src/ui/format';
import { useApp, useData } from '../../lib/AppContext';
import { formulateRemote } from '../../lib/engineClient';
import { ConflictList, ResultBlock, StatusBox } from '../../lib/result';
import { Badge, Box, Bullets, Button, Card, ErrorBox, Field, H, Loading, NumField, Row, Screen, Sheet, T } from '../../lib/ui';

const ORIGIN: Record<RecipeVersion['origin'], string> = {
  engine: 'proposta del motore',
  user_edit: 'modificata da te',
  recalculation: 'ricalcolo confermato',
  duplicate: 'nuova formulazione da copia',
};

function htmlOf(name: string, dogName: string, v: RecipeVersion) {
  const rows = v.chosenItems
    .filter((i) => i.qty > 0)
    .map((i) => {
      const f = i.kind === 'food' ? v.snapshot.foods[i.id] : null;
      const s = i.kind === 'supplement' ? v.snapshot.supplements[i.id] : null;
      return `<tr><td>${(f?.name ?? s?.name ?? '').replace(/</g, '&lt;')}</td><td style="text-align:right"><b>${dose(i.qty, s?.doseUnit ?? 'g')}</b></td></tr>`;
    })
    .join('');
  return `<html><body style="font-family:-apple-system,Helvetica;padding:24px"><h1>${name}</h1><p>${dogName} · versione ${v.revision} · ${new Date(v.createdAt).toLocaleDateString('it-IT')}</p>
  <p><b>${v.audit.statusLabel}</b>${v.audit.dataFlags.testData ? ' — PROVA, dati fittizi' : ''}</p>
  <table style="width:100%;border-collapse:collapse" border="0">${rows}</table>
  <p>${num(v.audit.kcal ?? v.audit.totals.energy.known, 0)} kcal al giorno</p>
  ${v.audit.blockers.length ? `<ul>${v.audit.blockers.map((b) => `<li>${b}</li>`).join('')}</ul>` : ''}
  <p style="font-size:11px;color:#555">${DISCLAIMER}</p></body></html>`;
}

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, catalog, settings, bump } = useApp();
  const [viewId, setViewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecipeItem[] | null>(null);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<RecalcPreview | null>(null);
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data } = useData(
    async (r) => {
      const recipe = (await r.listRecipes()).find((x) => x.id === id) ?? null;
      if (!recipe) return { recipe: null, dog: null, versions: [] as RecipeVersion[], prices: [] };
      const dog = (await r.listDogs()).find((d) => d.id === recipe.dogId) ?? null;
      return { recipe, dog, versions: await r.listVersions(recipe.id), prices: await r.listPrices() };
    },
    [id],
  );
  const shown = useMemo(() => {
    if (!data?.recipe) return null;
    const cur = data.versions.find((v) => v.id === data.recipe.currentVersionId) ?? data.versions[data.versions.length - 1];
    return data.versions.find((v) => v.id === viewId) ?? cur ?? null;
  }, [data, viewId]);
  const live = useMemo(() => (editing && shown ? auditOnSnapshot(shown.snapshot, editing, shown.excluded) : null), [editing, shown]);

  if (data && !data.recipe) return <Screen><T>Ricetta non trovata.</T></Screen>;
  if (!data?.recipe || !repo || !catalog || !settings || !shown) return <Loading />;
  const { dog, versions, prices } = data;
  const recipe = data.recipe;
  if (!dog) return <Loading />;
  const current = versions.find((v) => v.id === recipe.currentVersionId) ?? versions[versions.length - 1];
  const stale = staleFor(shown, dog, catalog);
  const nextRevision = Math.max(...versions.map((v) => v.revision)) + 1;

  const run = async (label: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  };
  const saveEdit = () =>
    run('Salvataggio…', async () => {
      if (!editing) return;
      for (const it of editing) if (it.kind === 'supplement' && shown.snapshot.supplements[it.id]?.integerDose && !Number.isInteger(it.qty)) throw new Error('Capsule e compresse vanno indicate come numeri interi.');
      const v = editedVersion(shown, editing, { id: uid(), revision: nextRevision, author: repo.userLabel(), note: note || null });
      await repo.addVersion(v);
      await repo.updateRecipe({ ...recipe, currentVersionId: v.id });
      setEditing(null);
      setNote('');
      setViewId(null);
      bump();
    });
  const openPreview = () => run('Calcolo dell’anteprima… (fino a un minuto se il server si sta avviando)', async () => setPreview(await previewRecalculation(shown, dog, catalog, settings, prices, formulateRemote)));
  const confirmRecalc = () =>
    run('Salvataggio…', async () => {
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
  const share = () =>
    run('Preparazione del PDF…', async () => {
      const { uri } = await Print.printToFileAsync({ html: htmlOf(recipe.name, dog.name, shown) });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: recipe.name }} />
      <Row wrap>
        {recipe.isPrimary && <Badge label="principale" />}
        {shown.id !== current?.id && <Badge label="versione precedente" color="orange" />}
      </Row>
      <T small muted>
        {dog.name} · versione {shown.revision} ({ORIGIN[shown.origin]}) del {new Date(shown.createdAt).toLocaleString('it-IT')}
      </T>
      {shown.note ? <T small>Nota: {shown.note}</T> : null}
      <ErrorBox error={error} />
      {busy && <Box color="blue"><T small>{busy}</T></Box>}

      {stale.length > 0 && (
        <Box color="orange">
          <T bold>Ricetta potenzialmente da aggiornare</T>
          <Bullets small items={stale.map((s) => `${s.name}: ${s.frozen} → ${s.current}`)} />
          <T small>I valori qui sotto restano quelli congelati di questa versione.</T>
          <Button title="Anteprima del ricalcolo" small busy={!!busy} onPress={openPreview} />
        </Box>
      )}

      {!editing && (
        <Row wrap>
          <Button title="Modifica quantità" kind="secondary" small onPress={() => setEditing(shown.chosenItems.map((i) => ({ ...i })))} />
          {stale.length === 0 && <Button title="Ricalcola" kind="secondary" small busy={!!busy} onPress={openPreview} />}
          <Button title="Storico" kind="secondary" small onPress={() => setHistory(true)} />
          <Button title="PDF" kind="secondary" small onPress={share} />
          {shown.id !== current?.id && <Button title="Usa questa versione" small onPress={() => run('…', async () => { await repo.updateRecipe({ ...recipe, currentVersionId: shown.id }); setViewId(null); bump(); })} />}
        </Row>
      )}

      {editing && live && (
        <Card>
          <H level={3}>Modifica quantità</H>
          <T small muted>La proposta del motore resta salvata. La tua versione sarà separata e verificata di nuovo da zero.</T>
          {editing.map((it, i) => {
            const f = it.kind === 'food' ? shown.snapshot.foods[it.id] : null;
            const s = it.kind === 'supplement' ? shown.snapshot.supplements[it.id] : null;
            const sug = shown.suggestedItems.find((x) => x.id === it.id)?.qty ?? 0;
            return (
              <View key={it.id} style={{ gap: 4 }}>
                <T small bold>{f?.name ?? s?.name}</T>
                <Row>
                  <NumField value={it.qty} onChange={(v) => setEditing(editing.map((x, j) => (j === i ? { ...x, qty: v ?? 0 } : x)))} />
                  <T small muted style={{ flex: 1 }}>
                    proposta {dose(sug, s?.doseUnit ?? 'g')}
                    {it.qty !== sug ? ` (${it.qty - sug > 0 ? '+' : ''}${num(it.qty - sug, 2)})` : ''}
                  </T>
                </Row>
              </View>
            );
          })}
          <StatusBox audit={live} />
          <Field label="Nota sulla modifica" value={note} onChange={setNote} />
          <Button title="Salva come nuova versione" busy={!!busy} onPress={saveEdit} />
          <Button title="Annulla" kind="ghost" onPress={() => setEditing(null)} />
        </Card>
      )}

      <ResultBlock
        audit={editing && live ? live : shown.audit}
        items={editing ?? shown.chosenItems}
        suggested={shown.origin === 'user_edit' || editing ? shown.suggestedItems : undefined}
        snapshot={shown.snapshot}
        cost={costOf({ chosenItems: editing ?? shown.chosenItems, snapshot: shown.snapshot }, prices)}
        constraints={shown.constraintsUsed}
        notes={shown.engineNotes}
      />

      <Sheet visible={history} title="Storico" onClose={() => setHistory(false)}>
        {[...versions].reverse().map((v) => (
          <Card key={v.id} onPress={() => { setViewId(v.id); setEditing(null); setHistory(false); }}>
            <T bold>
              v{v.revision} · {ORIGIN[v.origin]}
              {v.id === current?.id ? ' · in uso' : ''}
            </T>
            <T small muted>
              {new Date(v.createdAt).toLocaleString('it-IT')} · {STATUS_LABEL[v.audit.status]}
            </T>
          </Card>
        ))}
      </Sheet>

      <Sheet visible={!!preview} title="Anteprima del ricalcolo" onClose={() => setPreview(null)}>
        {preview && (
          <>
            {preview.stale.length > 0 && <Bullets small items={preview.stale.map((s) => `${s.name}: ${s.frozen} → ${s.current}`)} />}
            {preview.result.outcome === 'solved' && preview.result.audit ? (
              <>
                <Card>
                  {preview.diff.map((d) => (
                    <Row key={d.id} style={{ justifyContent: 'space-between' }}>
                      <T small style={{ flex: 1 }}>{d.name}</T>
                      <T small>
                        {d.before === null ? '—' : num(d.before, 1)} → <T bold small>{d.after === null ? '—' : num(d.after, 1)}</T>
                      </T>
                    </Row>
                  ))}
                </Card>
                <T>
                  Stato: {STATUS_LABEL[shown.audit.status]} → <T bold>{preview.result.audit.statusLabel}</T>
                </T>
                <Button title="Conferma e crea nuova versione" busy={!!busy} onPress={confirmRecalc} />
              </>
            ) : preview.result.outcome === 'infeasible' ? (
              <ConflictList conflicts={preview.result.conflicts} suggestions={preview.result.suggestions} />
            ) : (
              <Box color="grey"><T>{preview.result.message}</T></Box>
            )}
            <T small muted>Niente viene salvato senza conferma. La versione attuale resta nello storico.</T>
          </>
        )}
      </Sheet>
    </Screen>
  );
}
