import type { AuditResult } from '../engine/audit';
import type { CostSummary } from '../engine/cost';
import type { ConstraintInfo } from '../engine/formulate';
import type { RecipeSnapshot } from '../engine/snapshot';
import type { RecipeItem } from '../engine/types';
import { PROCESSING_LABEL } from '../data/packageCatalog';
import { CostBox, Disclaimer, NutrientTable, StatusBox, Warnings } from './components';
import { dose, num } from './format';
import { methodsSummary } from '../engine/energy';

export function ItemsTable({ items, snapshot, suggested }: { items: RecipeItem[]; snapshot: Pick<RecipeSnapshot, 'foods' | 'supplements'>; suggested?: RecipeItem[] }) {
  return (
    <table className="items">
      <thead>
        <tr>
          <th>Componente</th>
          <th className="r">Dose giornaliera</th>
          {suggested && <th className="r">Proposta motore</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((it) => {
          const f = it.kind === 'food' ? snapshot.foods[it.id] : null;
          const s = it.kind === 'supplement' ? snapshot.supplements[it.id] : null;
          const sug = suggested?.find((x) => x.id === it.id && x.kind === it.kind);
          const unit = s ? s.doseUnit : 'g';
          return (
            <tr key={`${it.kind}:${it.id}`}>
              <td>
                {f?.name ?? s?.name}
                <div className="small muted">
                  {f ? `${PROCESSING_LABEL[f.processingState]} · dati ${f.dataStatus === 'test_fixture' ? 'di PROVA' : f.dataStatus} · v${f.profileVersion}` : null}
                  {s ? `integratore · ${s.status === 'test_fixture' ? 'dati di PROVA' : s.status} · v${s.profileVersion}${s.massPerUnitG && unit !== 'g' ? ` · ${num(s.massPerUnitG, 2)} g per unità` : ''}` : null}
                </div>
              </td>
              <td className="r big">{dose(it.qty, unit)}</td>
              {suggested && (
                <td className={`r ${sug && sug.qty !== it.qty ? 'changed' : 'muted'}`}>{sug ? dose(sug.qty, unit) : '—'}</td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ResultView({
  audit,
  items,
  suggested,
  snapshot,
  cost,
  constraints,
  notes,
  meta,
}: {
  audit: AuditResult;
  items: RecipeItem[];
  suggested?: RecipeItem[];
  snapshot: Pick<RecipeSnapshot, 'foods' | 'supplements'> & Partial<RecipeSnapshot>;
  cost: CostSummary;
  constraints?: ConstraintInfo[];
  notes?: string[];
  meta?: string;
}) {
  return (
    <div>
      <StatusBox audit={audit} />
      <Warnings audit={audit} />
      <div className="card">
        <h3>Dosi giornaliere</h3>
        <ItemsTable items={items} snapshot={snapshot} suggested={suggested} />
        <p>
          <strong>{num(audit.kcal ?? audit.totals.energy.known, 0)} kcal</strong>
          {!audit.kcalComplete && ' (parziali)'} su obiettivo {audit.kcalTarget ? num(audit.kcalTarget, 0) : '—'} kcal
        </p>
        {notes && notes.length > 0 && (
          <ul className="small muted">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
      <CostBox cost={cost} />
      <div className="card">
        <h3>Nutrienti e rapporti</h3>
        <NutrientTable audit={audit} />
      </div>
      {constraints && constraints.length > 0 && (
        <details className="card">
          <summary>Vincoli usati dal motore ({constraints.length})</summary>
          <ul className="small">
            {constraints.map((c) => (
              <li key={c.name}>
                <span className={`tag ${c.hardness === 'hard' ? '' : 'grey'}`}>{c.hardness === 'hard' ? 'rigido' : 'flessibile'}</span> {c.label}
              </li>
            ))}
          </ul>
        </details>
      )}
      {snapshot.referenceVersionIds && (
        <p className="small muted">
          Fonti: {snapshot.referenceVersionIds.join(', ')} · metodo energetico: {methodsSummary(snapshot.foods, snapshot.factors?.version)} · {meta}
        </p>
      )}
      <Disclaimer compact />
    </div>
  );
}
