import { useState, type ReactNode } from 'react';
import type { AuditResult, CheckRow, RecipeStatus } from '../engine/audit';
import type { CostSummary } from '../engine/cost';
import type { Conflict } from '../engine/formulate';
import type { Color } from '../engine/types';
import { COLOR_LABEL, DISCLAIMER, euro, GROUP_LABEL, num, smart } from './format';

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return <p className={compact ? 'disclaimer compact' : 'disclaimer'}>⚕︎ {DISCLAIMER}</p>;
}

export function Dot({ color, title }: { color: Color; title?: string }) {
  return <span className={`dot dot-${color}`} title={title ?? COLOR_LABEL[color]} aria-label={COLOR_LABEL[color]} />;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="ghost" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div className="box box-red">{error}</div>;
}

const STATUS_CLASS: Record<RecipeStatus, string> = {
  VERIFIED_AVAILABLE_CHECKS: 'box-green',
  PREFERENCES_VIOLATED: 'box-orange',
  INSUFFICIENT_DATA: 'box-grey',
  FAILS_OFFICIAL_LIMITS: 'box-red',
  NO_VALID_SOLUTION: 'box-red',
};

export function StatusBox({ audit }: { audit: AuditResult }) {
  return (
    <div className={`box ${STATUS_CLASS[audit.status]}`}>
      {audit.dataFlags.testData && <div className="test-flag">PROVA — dati fittizi, non usare per alimentare un cane</div>}
      <strong>{audit.statusLabel}</strong>
      {audit.status === 'VERIFIED_AVAILABLE_CHECKS' && <div className="small">Non è una garanzia di completezza clinica: vale solo per i controlli e i dati disponibili.</div>}
      {audit.summary && (
        <div className="small">
          <div><strong>Fabbisogni dimostrabilmente soddisfatti ({audit.summary.satisfied.length}):</strong> {audit.summary.satisfied.join(', ') || '—'}</div>
          <div><strong>Non soddisfatti ({audit.summary.notMet.length}):</strong> {audit.summary.notMet.join(', ') || '—'}</div>
          <div><strong>Non verificabili per dati mancanti ({audit.summary.unverifiable.length}):</strong> {audit.summary.unverifiable.join(', ') || '—'}</div>
        </div>
      )}
      {audit.blockers.length > 0 && (
        <ul>
          {audit.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Warnings({ audit }: { audit: AuditResult }) {
  if (!audit.warnings.length && !audit.dataFlags.reviewRequiredLimits.length) return null;
  return (
    <div className="box box-purple">
      <ul>
        {audit.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
        {audit.dataFlags.reviewRequiredLimits.map((w) => (
          <li key={w}>Riferimento da rivedere in uso — {w}</li>
        ))}
      </ul>
    </div>
  );
}

function amountText(r: CheckRow) {
  if (r.unit === 'ratio') return r.amount === null ? '—' : `${num(r.amount, 2)} : 1`;
  if (r.unit === '%') return r.amount === null ? '—' : `${num(r.amount, 1)} %`;
  return `${smart(r.amount)} ${r.unit}`;
}

export function NutrientTable({ audit, onlyIssues = false }: { audit: AuditResult; onlyIssues?: boolean }) {
  const [open, setOpen] = useState<CheckRow | null>(null);
  const [filter, setFilter] = useState(onlyIssues);
  const rows = audit.rows.filter((r) => !filter || r.color === 'red' || r.color === 'orange' || r.purple.length > 0 || (r.color === 'grey' && r.checks.length > 0));
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <div>
      <div className="row between">
        <label className="check">
          <input type="checkbox" checked={filter} onChange={(e) => setFilter(e.target.checked)} /> Solo da controllare
        </label>
        <Legend />
      </div>
      <div className="energy-line">
        <Dot color={audit.energyRow.color} /> <strong>Energia</strong> {audit.energyRow.note}
        {audit.energyRow.missingFrom.length > 0 && <span className="muted"> — kcal mancanti: {audit.energyRow.missingFrom.join(', ')}</span>}
      </div>
      {groups.map((g) => (
        <div key={g} className="nut-group">
          <h4>{GROUP_LABEL[g] ?? g}</h4>
          <table className="nut">
            <thead>
              <tr>
                <th />
                <th>Nutriente</th>
                <th className="r">Al giorno</th>
                <th className="r">per 1000 kcal</th>
                <th>Riferimento</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.group === g)
                .map((r) => (
                  <tr key={r.metric} onClick={() => setOpen(r)} className="clickable">
                    <td>
                      <Dot color={r.color} />
                      {r.purple.length > 0 && <Dot color="purple" />}
                    </td>
                    <td>
                      {r.label}
                      {!r.complete && r.missingFrom.length > 0 && <span className="muted small"> · dati mancanti</span>}
                      {r.checks.some((c) => c.uncertain) && <span className="muted small"> · sulla composizione dichiarata</span>}
                    </td>
                    <td className="r">{amountText(r)}</td>
                    <td className="r">{r.per1000kcal === null || r.unit === 'ratio' || r.unit === '%' ? '' : smart(r.per1000kcal)}</td>
                    <td className="small">
                      {r.checks.length
                        ? r.checks
                            .map((c) => [c.limit.lower !== null ? `≥ ${num(c.limit.lower, 3)}` : null, c.limit.upper !== null ? `≤ ${num(c.limit.upper, 3)}` : null].filter(Boolean).join(' '))
                            .join(' · ')
                        : <span className="muted">nessun limite</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
      {open && <NutrientDetail row={open} kcal={audit.kcal} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function Legend() {
  return (
    <details className="legend">
      <summary>Legenda colori</summary>
      <ul>
        {(Object.keys(COLOR_LABEL) as Color[]).map((c) => (
          <li key={c}>
            <Dot color={c} /> {COLOR_LABEL[c]}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function NutrientDetail({ row, kcal, onClose }: { row: CheckRow; kcal: number | null; onClose: () => void }) {
  return (
    <Modal title={row.label} onClose={onClose}>
      <p>
        <Dot color={row.color} /> {COLOR_LABEL[row.color]}
      </p>
      <dl className="kv">
        <dt>Quantità effettiva</dt>
        <dd>{amountText(row)}{!row.complete && ' (solo contributi noti)'}</dd>
        {row.per1000kcal !== null && row.unit !== 'ratio' && row.unit !== '%' && (
          <>
            <dt>Densità</dt>
            <dd>
              {smart(row.per1000kcal)} {row.unit}/1000 kcal{kcal ? ` (su ${num(kcal, 0)} kcal effettive)` : ''}
            </dd>
          </>
        )}
      </dl>
      {row.checks.length === 0 && <p className="muted">{row.note ?? 'Nessun limite numerico disponibile: non viene inventato.'}</p>}
      {row.checks.map((c) => (
        <div key={c.limit.id} className="check-card">
          <div>
            <Dot color={c.color} /> {c.message}
          </div>
          <div className="small">
            Fonte: {c.limit.source}
            {c.limit.status !== 'verified' && <strong> · da rivedere</strong>}
            <br />
            Natura: {c.limit.limitClass.startsWith('OFFICIAL') || c.limit.limitClass === 'LEGAL_MAX' ? 'ufficiale' : c.limit.limitClass === 'PERSONAL_TARGET' ? 'personalizzata' : c.limit.limitClass === 'NON_OFFICIAL_ATTENTION' ? 'NON ufficiale (attenzione, non tossicità)' : 'informativa'}
            {' · '}Base: {c.limit.basis === 'per_1000_kcal_me' ? 'per 1000 kcal EM' : c.limit.basis === 'per_day' ? 'al giorno' : c.limit.basis === 'ratio' ? 'rapporto' : c.limit.basis === 'energy_pct' ? '% delle kcal' : c.limit.basis}
            {c.dailyReference !== null && c.limit.basis === 'per_1000_kcal_me' && <> · equivale a {smart(c.dailyReference)} {row.unit}/die su queste kcal</>}
            {c.limit.notes && <><br />Nota: {c.limit.notes}</>}
          </div>
        </div>
      ))}
      {row.purple.map((p) => (
        <div key={p} className="box box-purple small">{p}</div>
      ))}
      {row.missingFrom.length > 0 && (
        <div className="box box-grey small">Dato mancante (non considerato zero) in: {row.missingFrom.join(', ')}</div>
      )}
      {(row.undeclaredFrom ?? []).length > 0 && (
        <div className="box box-grey small">Non dichiarato in etichetta (sconosciuto, non zero) da: {row.undeclaredFrom.join(', ')}. Il totale comprende solo i valori dichiarati.</div>
      )}
      {row.contributions.length > 0 && (
        <>
          <h4>Da dove arriva</h4>
          <ul className="small">
            {[...row.contributions].sort((a, b) => b.amount - a.amount).map((c) => (
              <li key={c.name}>
                {c.name}: {smart(c.amount)} {row.unit}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

export function ConflictList({ conflicts, suggestions }: { conflicts: Conflict[]; suggestions: string[] }) {
  return (
    <div className="box box-red">
      <strong>Vincoli che non possono essere rispettati insieme</strong>
      <ul>
        {conflicts.map((c) => (
          <li key={c.label}>
            {c.label}
            {c.shortfall > 0 && <span className="muted small"> (scarto minimo {smart(c.shortfall)})</span>}
          </li>
        ))}
      </ul>
      {suggestions.length > 0 && (
        <>
          <strong>Cosa si può rivedere</strong>
          <ul>
            {suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      <div className="small">Nessuna sostituzione o integrazione viene inventata: scegli tu cosa cambiare (ingredienti, integratori disponibili, limiti, target).</div>
    </div>
  );
}

export function CostBox({ cost }: { cost: CostSummary }) {
  return (
    <div className="card">
      <h3>Costo</h3>
      <table className="nut">
        <tbody>
          {cost.lines.map((l) => (
            <tr key={l.id}>
              <td>{l.name}</td>
              <td className="r">{l.cost === null ? <span className="muted">prezzo mancante</span> : euro(l.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cost.lines.some((l) => l.cost !== null) ? (
        <p>
          <strong>{euro(cost.daily)}</strong> al giorno{cost.partial ? ' (parziale)' : ''} · {euro(cost.weekly)} a settimana · {euro(cost.monthly)} al mese (30 giorni)
        </p>
      ) : (
        <p className="muted">Costo non calcolabile: nessun prezzo inserito per questi prodotti (pagina Prezzi).</p>
      )}
      {cost.partial && <div className="box box-grey small">Costo parziale: mancano i prezzi di {cost.missing.join(', ')}.</div>}
    </div>
  );
}

export function NumberInput({ value, onChange, step = 'any', min, placeholder, ariaLabel }: { value: number | null; onChange: (v: number | null) => void; step?: string; min?: number; placeholder?: string; ariaLabel?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value === null || Number.isNaN(value) ? '' : value}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}
