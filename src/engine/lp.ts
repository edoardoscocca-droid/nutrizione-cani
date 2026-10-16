// Piccolo costruttore di modelli lineari in formato CPLEX LP, risolti con HiGHS (WebAssembly).

import type { LegacyHighs } from 'highs';

export interface Term {
  v: string;
  c: number;
}

export interface Row {
  name: string;
  terms: Term[];
  op: '>=' | '<=' | '=';
  rhs: number;
}

export interface VarDef {
  name: string;
  lb: number;
  ub: number | null;
  /** true = variabile intera (multipli di un passo, capsule). */
  integer: boolean;
}

export interface Model {
  vars: VarDef[];
  rows: Row[];
  objective: Term[];
}

export type SolveStatus = 'optimal' | 'infeasible' | 'timeout' | 'error';

export interface SolveResult {
  status: SolveStatus;
  rawStatus: string;
  objective: number;
  values: Record<string, number>;
}

let highsPromise: Promise<LegacyHighs> | null = null;

/** Carica HiGHS una sola volta. In browser il file .wasm viene servito come asset. */
export function loadSolver(locateFile?: (f: string) => string): Promise<LegacyHighs> {
  if (!highsPromise) {
    highsPromise = import('highs').then((m) => {
      const load = (m as unknown as { default: (o?: object) => Promise<LegacyHighs> }).default;
      return load(locateFile ? { locateFile } : undefined);
    });
  }
  return highsPromise;
}

function num(x: number): string {
  if (!Number.isFinite(x)) throw new Error('Coefficiente non finito nel modello');
  // notazione senza esponenti troppo piccoli: arrotonda a 12 cifre significative
  const s = Number(x.toPrecision(12)).toString();
  return s.includes('e') ? x.toFixed(15) : s;
}

function expr(terms: Term[]): string {
  const merged = new Map<string, number>();
  for (const t of terms) merged.set(t.v, (merged.get(t.v) ?? 0) + t.c);
  const parts: string[] = [];
  for (const [v, c] of merged) {
    if (Math.abs(c) < 1e-12) continue;
    parts.push(`${c < 0 ? '-' : '+'} ${num(Math.abs(c))} ${v}`);
  }
  if (!parts.length) return '0 dummy_zero';
  return parts.join(' ');
}

export function toLp(model: Model): string {
  const lines: string[] = ['Minimize', ` obj: ${model.objective.length ? expr(model.objective) : '0 dummy_zero'}`, 'Subject To'];
  model.rows.forEach((r) => {
    lines.push(` ${r.name}: ${expr(r.terms)} ${r.op} ${num(r.rhs)}`);
  });
  lines.push('Bounds');
  lines.push(' dummy_zero = 0');
  for (const v of model.vars) {
    lines.push(v.ub === null ? ` ${v.name} >= ${num(v.lb)}` : ` ${num(v.lb)} <= ${v.name} <= ${num(v.ub)}`);
  }
  const ints = model.vars.filter((v) => v.integer).map((v) => v.name);
  if (ints.length) {
    lines.push('Generals');
    lines.push(' ' + ints.join(' '));
  }
  lines.push('End');
  return lines.join('\n');
}

export function solve(highs: LegacyHighs, model: Model, timeLimitSeconds: number): SolveResult {
  const lp = toLp(model);
  let r;
  try {
    r = highs.solve(lp, { output_flag: false, time_limit: timeLimitSeconds, mip_rel_gap: 1e-6 } as never);
  } catch (e) {
    return { status: 'error', rawStatus: String(e), objective: NaN, values: {} };
  }
  const values: Record<string, number> = {};
  const cols = (r as { Columns?: Record<string, { Primal?: number }> }).Columns ?? {};
  for (const [k, c] of Object.entries(cols)) if (typeof c.Primal === 'number') values[k] = c.Primal;
  const raw = r.Status as string;
  if (raw === 'Optimal') return { status: 'optimal', rawStatus: raw, objective: r.ObjectiveValue, values };
  if (raw === 'Infeasible' || raw === 'Primal infeasible or unbounded') return { status: 'infeasible', rawStatus: raw, objective: NaN, values: {} };
  if (raw === 'Time limit reached') return { status: 'timeout', rawStatus: raw, objective: NaN, values };
  return { status: 'error', rawStatus: raw, objective: NaN, values: {} };
}
