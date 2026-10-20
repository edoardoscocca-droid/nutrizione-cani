import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AuditResult, CheckRow, RecipeStatus } from '../../src/engine/audit';
import { CATALOG_STATUS_HELP, CATALOG_STATUS_LABEL, type CatalogStatus } from '../../src/engine/catalogStatus';
import type { CostSummary } from '../../src/engine/cost';
import type { Conflict, ConstraintInfo } from '../../src/engine/formulate';
import type { RecipeSnapshot } from '../../src/engine/snapshot';
import type { Color, RecipeItem } from '../../src/engine/types';
import { PROCESSING_LABEL } from '../../src/data/packageCatalog';
import { COLOR_LABEL, dose, euro, GROUP_LABEL, num, smart } from '../../src/ui/format';
import { Badge, Box, Bullets, Card, Check, Disclaimer, Divider, Dot, FONTS, H, Row, Sheet, T, useTheme } from './ui';
import { methodsSummary } from '../../src/engine/energy';

const STATUS_COLOR: Record<RecipeStatus, Color> = {
  VERIFIED_AVAILABLE_CHECKS: 'green',
  PREFERENCES_VIOLATED: 'orange',
  TARGETS_NOT_MET: 'orange',
  INSUFFICIENT_DATA: 'grey',
  FAILS_OFFICIAL_LIMITS: 'red',
  NO_VALID_SOLUTION: 'red',
};

export function StatusBox({ audit }: { audit: AuditResult }) {
  const t = useTheme();
  const sum = audit.summary;
  const total = sum ? sum.satisfied.length + sum.notMet.length + sum.unverifiable.length : 0;
  const ring = sum && sum.notMet.length ? t.red : sum && sum.unverifiable.length ? t.grey : t.green;
  return (
    <Card>
      {audit.dataFlags.testData && <Badge label="PROVA — dati fittizi, non usare per alimentare un cane" color="orange" />}
      {sum ? (
        <Row style={{ gap: 14, alignItems: 'center' }}>
          <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 7, borderColor: ring, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: t.text }}>{sum.satisfied.length}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T bold>
              {sum.satisfied.length} di {total} fabbisogni soddisfatti
            </T>
            {sum.notMet.length > 0 && <T small style={{ color: t.red }}>Non soddisfatti: {sum.notMet.join(', ')}</T>}
            {sum.unverifiable.length > 0 && <T small muted>Senza dati per verificarli: {sum.unverifiable.join(', ')}</T>}
          </View>
        </Row>
      ) : null}
      {(audit.additional ?? []).length > 0 && (
        <View style={{ gap: 4 }}>
          <T small bold>Obiettivi aggiuntivi (distinti dai requisiti FEDIAF)</T>
          {audit.additional!.map((a) => (
            <Row key={a.id} style={{ alignItems: 'flex-start' }}>
              <View style={{ marginTop: 5 }}>
                <Dot color={a.color} />
              </View>
              <T small style={{ flex: 1 }}>
                <T small bold>{a.label}: </T>
                {a.color === 'green' ? 'raggiunto' : a.color === 'orange' ? 'non raggiunto' : 'non verificabile'}
                {a.amount != null && a.required != null ? ` — ${smart(a.amount)} su ${smart(a.required)} ${a.unit}/die` : ''}
              </T>
            </Row>
          ))}
        </View>
      )}
      <Row style={{ gap: 8, alignItems: 'flex-start' }}>
        <View style={{ marginTop: 5 }}>
          <Dot color={STATUS_COLOR[audit.status]} />
        </View>
        <T bold style={{ flex: 1 }}>{audit.statusLabel}</T>
      </Row>
      {audit.status === 'VERIFIED_AVAILABLE_CHECKS' && <T small muted>Non è una garanzia di completezza clinica: vale solo per i controlli e i dati disponibili.</T>}
      {audit.blockers.length > 0 && <Bullets small items={audit.blockers} />}
    </Card>
  );
}

export function Warnings({ audit }: { audit: AuditResult }) {
  const items = [...audit.warnings, ...audit.dataFlags.reviewRequiredLimits.map((w) => `Riferimento da rivedere in uso — ${w}`)];
  if (!items.length) return null;
  return (
    <Box color="purple">
      <Bullets small items={items} />
    </Box>
  );
}

/** Preferenze e obiettivi non rispettati: intervallo richiesto, risultato, scostamento e (se individuati) i vincoli che lo impediscono. */
export function GapsCard({ audit }: { audit: AuditResult }) {
  const missed = audit.rows.flatMap((r) => r.checks.filter((c) => c.gap && c.color === 'orange').map((c) => ({ r, c })));
  if (!missed.length) return null;
  const analysis = audit.softGaps ?? [];
  return (
    <Card>
      <H level={3}>Preferenze e obiettivi non rispettati</H>
      {missed.map(({ r, c }) => {
        const side = c.gap!.deviation < 0 ? 'lower' : 'upper';
        const a = analysis.find((x) => x.metric === r.metric && (side === 'lower' ? /minimo|raccomandato/i.test(x.label) : /massimo/i.test(x.label)));
        return (
          <View key={c.limit.id} style={{ gap: 2, paddingVertical: 4 }}>
            <T bold>{r.label} — {c.limit.limitClass === 'RECOMMENDED_ALLOWANCE' ? (c.limit.displayLabel ?? 'obiettivo aggiuntivo') : 'preferenza'}</T>
            <T small>
              Richiesto {c.gap!.requested} · risultato {smart(c.gap!.result)} {c.gap!.unit} · scostamento {c.gap!.deviation > 0 ? '+' : ''}
              {smart(c.gap!.deviation)} {c.gap!.unit}
            </T>
            {a?.unreachable && <T small muted>Con gli ingredienti selezionati non si raggiunge in nessuna quantità.</T>}
            {a && !a.unreachable && a.blockedBy.length > 0 && (
              <>
                <T small muted>Per rispettarla andrebbero violati questi vincoli, che hanno la precedenza:</T>
                <Bullets small items={a.blockedBy} />
              </>
            )}
          </View>
        );
      })}
    </Card>
  );
}

/** Origine dell'energia di ogni componente e confronto con i macronutrienti (metodo energetico del componente). */
export function EnergySourcesCard({ audit }: { audit: AuditResult }) {
  const [open, setOpen] = useState(false);
  const src = audit.energySources ?? [];
  if (!src.length) return null;
  const sum = audit.macroEnergySumPct;
  return (
    <Card onPress={() => setOpen(!open)}>
      <T bold>Da dove viene l’energia {open ? '▾' : '▸'}</T>
      {sum !== null && sum !== undefined && (
        <T small muted>Le quote di proteine, grassi e carboidrati disponibili sommano al {num(sum, 1)}% delle kcal{Math.abs(sum - 100) > 0.5 ? ': la differenza viene dall’energia inserita, non da un arrotondamento' : ''}.</T>
      )}
      {open &&
        src.map((e) => (
          <View key={e.name} style={{ paddingVertical: 4 }}>
            <T small bold>{e.name}</T>
            <T small>
              {e.origin === null
                ? e.partial !== null && e.partial !== undefined
                  ? `Energia metabolizzabile completa sconosciuta. Dai soli macronutrienti dichiarati: ${num(e.partial, 4)} ${e.basis} (contributo parziale: la fermentazione della fibra non è stimata; escluso dal totale)`
                  : 'Energia sconosciuta (non dichiarata e non calcolabile)'
                : `${num(e.kcal as number, 1)} ${e.basis} — ${e.origin === 'declared' ? `inserita${e.source ? ` (${e.source})` : ''}` : `calcolata dai macronutrienti (${e.methodLabel})`}`}
            </T>
            {e.origin === 'declared' && e.fromMacros !== null && (
              <T small muted>
                Dai macronutrienti ({e.methodLabel}): {num(e.fromMacros, 1)} {e.basis}
                {e.diffPct !== null ? ` · differenza ${e.diffPct > 0 ? '+' : ''}${num(e.diffPct, 1)}%` : ''}
              </T>
            )}
          </View>
        ))}
    </Card>
  );
}

export function ItemsList({ items, snapshot, suggested }: { items: RecipeItem[]; snapshot: Pick<RecipeSnapshot, 'foods' | 'supplements'>; suggested?: RecipeItem[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2 }}>
      {items.map((it) => {
        const f = it.kind === 'food' ? snapshot.foods[it.id] : null;
        const s = it.kind === 'supplement' ? snapshot.supplements[it.id] : null;
        const unit = s ? s.doseUnit : 'g';
        const sug = suggested?.find((x) => x.id === it.id && x.kind === it.kind);
        return (
          <View key={`${it.kind}:${it.id}`} style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: t.line }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <T>{f?.name ?? s?.name}</T>
                <T small muted>
                  {f ? `${PROCESSING_LABEL[f.processingState]} · v${f.profileVersion}` : `integratore · v${s?.profileVersion}`}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T bold size={18}>{dose(it.qty, unit)}</T>
                {sug && sug.qty !== it.qty && <T small style={{ color: t.orange }}>proposta: {dose(sug.qty, unit)}</T>}
              </View>
            </Row>
          </View>
        );
      })}
    </View>
  );
}

function amountText(r: CheckRow) {
  if (r.unit === 'ratio') return r.amount === null ? '—' : `${num(r.amount, 2)} : 1`;
  if (r.unit === '%') return r.amount === null ? '—' : `${num(r.amount, 1)} %`;
  return `${smart(r.amount)} ${r.unit}`;
}

export function NutrientList({ audit }: { audit: AuditResult }) {
  const [open, setOpen] = useState<CheckRow | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(true);
  // da controllare: limiti non rispettati o non verificabili e note; le voci informative senza limiti restano in «tutti»
  const rows = audit.rows.filter((r) => !onlyIssues || r.color === 'red' || r.color === 'orange' || r.purple.length > 0 || (r.color === 'grey' && r.checks.length > 0));
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <View style={{ gap: 8 }}>
      <Check label="Mostra solo ciò che va controllato" value={onlyIssues} onChange={setOnlyIssues} />
      <Row>
        <Dot color={audit.energyRow.color} />
        <T style={{ flex: 1 }}>
          <T bold>Energia </T>
          {audit.energyRow.note}
        </T>
      </Row>
      {audit.minimaBasis && (
        <T small muted>
          {audit.minimaBasis.text}
        </T>
      )}
      {groups.map((g) => (
        <View key={g} style={{ gap: 2 }}>
          <T small muted bold>
            {GROUP_LABEL[g] ?? g}
          </T>
          {rows
            .filter((r) => r.group === g)
            .map((r) => (
              <Pressable key={r.metric} onPress={() => setOpen(r)} accessibilityRole="button" style={{ paddingVertical: 6 }}>
                <Row>
                  <Dot color={r.color} />
                  {r.purple.length > 0 && <Dot color="purple" />}
                  <T style={{ flex: 1 }}>{r.label}</T>
                  <T>{amountText(r)}</T>
                </Row>
                {!r.complete && r.missingFrom.length > 0 && (
                  <T small muted style={{ marginLeft: 20 }}>
                    dati mancanti
                  </T>
                )}
                {r.checks.some((c) => c.uncertain) && (
                  <T small muted style={{ marginLeft: 20 }}>
                    sulla composizione dichiarata
                  </T>
                )}
              </Pressable>
            ))}
        </View>
      ))}
      {rows.length === 0 && <T muted>Niente da segnalare.</T>}
      <Legend />
      {open && <NutrientDetail row={open} kcal={audit.kcal} onClose={() => setOpen(null)} />}
    </View>
  );
}

export function Legend() {
  return (
    <View style={{ gap: 4, marginTop: 6 }}>
      {(Object.keys(COLOR_LABEL) as Color[]).map((c) => (
        <Row key={c}>
          <Dot color={c} />
          <T small muted style={{ flex: 1 }}>
            {COLOR_LABEL[c]}
          </T>
        </Row>
      ))}
    </View>
  );
}

function NutrientDetail({ row, kcal, onClose }: { row: CheckRow; kcal: number | null; onClose: () => void }) {
  return (
    <Sheet visible title={row.label} onClose={onClose}>
      <Row>
        <Dot color={row.color} />
        <T style={{ flex: 1 }}>{COLOR_LABEL[row.color]}</T>
      </Row>
      <Card>
        <T>
          Quantità al giorno: <T bold>{amountText(row)}</T>
          {!row.complete ? ' (solo contributi noti)' : ''}
        </T>
        {row.per1000kcal !== null && row.unit !== 'ratio' && row.unit !== '%' && (
          <T>
            Densità: {smart(row.per1000kcal)} {row.unit}/1000 kcal{kcal ? ` (su ${num(kcal, 0)} kcal effettive)` : ''}
          </T>
        )}
      </Card>
      {row.checks.length === 0 && <T muted>{row.note ?? 'Nessun limite numerico disponibile: non viene inventato.'}</T>}
      {row.checks.map((c) => (
        <Card key={c.limit.id}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Dot color={c.color} />
            <T style={{ flex: 1 }}>{c.message}</T>
          </Row>
          <T small muted>
            Fonte: {c.limit.source}
            {c.limit.status !== 'verified' ? ' · da rivedere' : ''}
          </T>
          <T small muted>
            Natura:{' '}
            {c.limit.limitClass.startsWith('OFFICIAL') || c.limit.limitClass === 'LEGAL_MAX'
              ? 'ufficiale'
              : c.limit.limitClass === 'PERSONAL_TARGET'
                ? 'personalizzata'
                : c.limit.limitClass === 'RECOMMENDED_ALLOWANCE'
                  ? 'obiettivo aggiuntivo (non è un minimo FEDIAF)'
                : c.limit.limitClass === 'NON_OFFICIAL_ATTENTION'
                  ? 'NON ufficiale (attenzione, non tossicità)'
                  : 'informativa'}
            {c.dailyReference !== null && c.limit.basis === 'per_1000_kcal_me' ? ` · equivale a ${smart(c.dailyReference)} ${row.unit}/die su queste kcal` : ''}
          </T>
          {c.limit.notes ? <T small muted>Nota: {c.limit.notes}</T> : null}
        </Card>
      ))}
      {row.purple.map((p) => (
        <Box key={p} color="purple">
          <T small>{p}</T>
        </Box>
      ))}
      {row.missingFrom.length > 0 && (
        <Box color="grey">
          <T small>Dato mancante (non considerato zero) in: {row.missingFrom.join(', ')}</T>
        </Box>
      )}
      {(row.undeclaredFrom ?? []).length > 0 && (
        <Box color="grey">
          <T small>Non dichiarato in etichetta (sconosciuto, non zero) da: {row.undeclaredFrom.join(', ')}. Il totale comprende solo i valori dichiarati.</T>
        </Box>
      )}
      {row.contributions.length > 0 && (
        <Card>
          <H level={3}>Da dove arriva</H>
          {[...row.contributions]
            .sort((a, b) => b.amount - a.amount)
            .map((c) => (
              <T key={c.name} small>
                {c.name}: {smart(c.amount)} {row.unit}
              </T>
            ))}
        </Card>
      )}
    </Sheet>
  );
}

export function CostCard({ cost }: { cost: CostSummary }) {
  return (
    <Card>
      <H level={3}>Costo</H>
      {cost.lines.map((l) => (
        <Row key={l.id} style={{ justifyContent: 'space-between' }}>
          <T small style={{ flex: 1 }}>
            {l.name}
          </T>
          <T small muted={l.cost === null}>{l.cost === null ? 'prezzo mancante' : euro(l.cost)}</T>
        </Row>
      ))}
      <Divider />
      {cost.lines.some((l) => l.cost !== null) ? (
        <T>
          <T bold>{euro(cost.daily)}</T> al giorno{cost.partial ? ' (parziale)' : ''} · {euro(cost.weekly)} a settimana · {euro(cost.monthly)} al mese (30 giorni)
        </T>
      ) : (
        <T muted>Costo non calcolabile: nessun prezzo inserito (scheda Prezzi).</T>
      )}
    </Card>
  );
}

export function ConflictList({ conflicts, suggestions }: { conflicts: Conflict[]; suggestions: string[] }) {
  return (
    <Box color="red">
      <T bold>Vincoli che non possono essere rispettati insieme</T>
      <Bullets small items={conflicts.map((c) => c.label + (c.shortfall > 0 ? ` (scarto minimo ${smart(c.shortfall)})` : ''))} />
      {suggestions.length > 0 && (
        <>
          <T bold>Cosa si può rivedere</T>
          <Bullets small items={suggestions} />
        </>
      )}
      <T small>Nessuna sostituzione o integrazione viene inventata: scegli tu cosa cambiare.</T>
    </Box>
  );
}

export function ConstraintsCard({ constraints }: { constraints: ConstraintInfo[] }) {
  const [open, setOpen] = useState(false);
  if (!constraints.length) return null;
  return (
    <Card onPress={() => setOpen(!open)}>
      <T bold>
        Vincoli usati dal motore ({constraints.length}) {open ? '▾' : '▸'}
      </T>
      {open && <Bullets small items={constraints.map((c) => `${c.hardness === 'hard' ? '[rigido]' : '[flessibile]'} ${c.label}`)} />}
    </Card>
  );
}

const BADGE: Record<CatalogStatus, 'green' | 'orange' | 'grey'> = { verified: 'green', partial: 'orange', to_complete: 'grey' };
export function CatalogBadge({ status, test }: { status: CatalogStatus; test?: boolean }) {
  return <Badge label={`${test ? 'PROVA · ' : ''}${CATALOG_STATUS_LABEL[status]}`} color={BADGE[status]} />;
}
export { CATALOG_STATUS_HELP };

export function ResultBlock({
  audit,
  items,
  suggested,
  snapshot,
  cost,
  constraints,
  notes,
}: {
  audit: AuditResult;
  items: RecipeItem[];
  suggested?: RecipeItem[];
  snapshot: Pick<RecipeSnapshot, 'foods' | 'supplements'> & Partial<RecipeSnapshot>;
  cost: CostSummary;
  constraints?: ConstraintInfo[];
  notes?: string[];
}) {
  return (
    <View style={{ gap: 12 }}>
      <StatusBox audit={audit} />
      <GapsCard audit={audit} />
      <Warnings audit={audit} />
      <Card>
        <H level={3}>Dosi giornaliere</H>
        <ItemsList items={items} snapshot={snapshot} suggested={suggested} />
        <T>
          <T bold>{num(audit.kcal ?? audit.totals.energy.known, 0)} kcal</T>
          {!audit.kcalComplete ? ' (parziali)' : ''} su obiettivo {audit.kcalTarget ? num(audit.kcalTarget, 0) : '—'} kcal
        </T>
        {notes && notes.length > 0 && <Bullets small items={notes} />}
      </Card>
      <EnergySourcesCard audit={audit} />
      <CostCard cost={cost} />
      <Card>
        <H level={3}>Nutrienti e rapporti</H>
        <NutrientList audit={audit} />
      </Card>
      {constraints && <ConstraintsCard constraints={constraints} />}
      {snapshot.referenceVersionIds && (
        <T small muted>
          Fonti: {snapshot.referenceVersionIds.join(', ')} · metodo energetico: {methodsSummary(snapshot.foods, snapshot.factors?.version)} · motore {snapshot.engineVersion ?? ''}
        </T>
      )}
      <Disclaimer compact />
    </View>
  );
}
