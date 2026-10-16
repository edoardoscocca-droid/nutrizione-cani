import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { foodStatus, supplementStatus } from '../../../../src/engine/catalogStatus';
import type { Food, Supplement } from '../../../../src/engine/types';
import { PROCESSING_LABEL } from '../../../../src/data/packageCatalog';
import { GROUP_LABEL, num, smart } from '../../../../src/ui/format';
import { useApp, useData } from '../../../lib/AppContext';
import { CATALOG_STATUS_HELP, CatalogBadge } from '../../../lib/result';
import { Box, Bullets, Button, Card, ErrorBox, H, Loading, Row, Screen, T, Toggle } from '../../../lib/ui';

export default function ProductScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: 'food' | 'supplement'; id: string }>();
  const { catalog, isAdmin, repo, refresh } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: history } = useData((r) => r.listProfileHistory(kind, id), [kind, id]);
  if (!catalog || !repo) return <Loading />;
  const p: Food | Supplement | undefined = kind === 'food' ? catalog.foods.find((x) => x.id === id) : catalog.supplements.find((x) => x.id === id);
  if (!p) return <Screen><T>Prodotto non trovato.</T></Screen>;
  const st = kind === 'food' ? foodStatus(p as Food, catalog.nutrients) : supplementStatus(p as Supplement, catalog.nutrients);
  const active = kind === 'food' ? (p as Food).availableToFormulate : (p as Supplement).usableForOptimization;
  const isTest = kind === 'food' ? (p as Food).dataStatus === 'test_fixture' : (p as Supplement).status === 'test_fixture';
  const act = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  const groups = [...new Set(catalog.nutrients.filter((n) => n.kind !== 'derived' && n.kind !== 'composition').map((n) => n.group))];
  return (
    <Screen>
      <Stack.Screen options={{ title: p.name }} />
      <ErrorBox error={error} />
      <Row wrap>
        <CatalogBadge status={st.status} test={isTest} />
      </Row>
      <T small muted>{CATALOG_STATUS_HELP[st.status]}</T>
      {st.reasons.length > 0 && <Box color={st.status === 'to_complete' ? 'grey' : 'orange'}><Bullets small items={st.reasons} /></Box>}
      {st.info.length > 0 && <Box color="blue"><Bullets small items={st.info} /></Box>}
      {p.validatedAt && <T small muted>Convalidato da {p.validatedBy} il {new Date(p.validatedAt).toLocaleString('it-IT')}</T>}
      {isAdmin && (
        <Card>
          <Toggle
            label="Attivo per la formulazione"
            value={active}
            disabled={busy}
            onChange={(v) => act(() => (kind === 'food' ? repo.saveFood({ ...(p as Food), availableToFormulate: v }) : repo.saveSupplement({ ...(p as Supplement), usableForOptimization: v })))}
          />
          {st.status !== 'verified' && (
            <>
              <Button title="Convalida (dati controllati)" small busy={busy} disabled={!st.readyForValidation} onPress={() => act(() => repo.validateCatalogItem(kind, id))} />
              {!st.readyForValidation && <T small muted>Disponibile quando restano solo da convalidare i dati salvati.</T>}
            </>
          )}
        </Card>
      )}
      <Card>
        {kind === 'food' ? (
          <>
            <T small>Stato: {PROCESSING_LABEL[(p as Food).processingState]}{(p as Food).preparation ? ` — ${(p as Food).preparation}` : ''}</T>
            <T small>Energia EM: {(p as Food).kcalMePer100g === null ? 'non disponibile' : `${num((p as Food).kcalMePer100g, 1)} kcal/100 g`}{(p as Food).meMethod ? ` (${(p as Food).meMethod})` : ''}</T>
            {(p as Food).kcalMeOrigin === 'calculated' && (p as Food).energyMethod?.caution ? <T small muted>{(p as Food).energyMethod!.caution}</T> : null}
            <T small>Fonte: {(p as Food).source ?? '—'} {(p as Food).sourceVersion ?? ''}</T>
          </>
        ) : (
          <>
            <T small>Dose: {(p as Supplement).doseUnit}{(p as Supplement).massPerUnitG ? ` · ${(p as Supplement).massPerUnitG} g per unità` : ''}{(p as Supplement).maxDailyUnits ? ` · max ${(p as Supplement).maxDailyUnits}/die (${(p as Supplement).maxDailySource})` : ''}</T>
            <T small>Energia per dose: {(p as Supplement).kcalPerUnit ?? 'non indicata'}</T>
            <T small>Etichetta: {(p as Supplement).labelSource ?? '—'}</T>
          </>
        )}
        {p.notes ? <T small muted>{p.notes}</T> : null}
        <T small muted>Versione del profilo: {p.profileVersion}</T>
      </Card>
      <Card>
        <H level={3}>Composizione {kind === 'food' ? 'per 100 g' : `per ${(p as Supplement).doseUnit}`}</H>
        {groups.map((g) => (
          <Card key={g} style={{ padding: 8 }}>
            <T small muted bold>{GROUP_LABEL[g] ?? g}</T>
            {catalog.nutrients
              .filter((n) => n.group === g && n.kind !== 'derived')
              .map((n) => {
                const v = p.nutrients[n.id];
                return (
                  <Row key={n.id} style={{ justifyContent: 'space-between' }}>
                    <T small style={{ flex: 1 }}>{n.label}</T>
                    <T small muted={v?.value == null}>{v?.value == null ? 'non disponibile' : `${smart(v.value)} ${n.unit}${v.status === 'estimated' ? ' (stima)' : ''}`}</T>
                  </Row>
                );
              })}
          </Card>
        ))}
      </Card>
      <Card>
        <H level={3}>Versioni precedenti</H>
        {!history?.length ? <T small muted>Nessuna.</T> : history.map((h) => <T key={h.version} small>v{h.version} — sostituita il {new Date(h.changedAt).toLocaleString('it-IT')}{h.changedBy ? ` (${h.changedBy})` : ''}</T>)}
      </Card>
      {isAdmin && <T small muted>La modifica dei singoli valori si fa con l’importazione (CSV/JSON) o dalla versione web.</T>}
    </Screen>
  );
}
