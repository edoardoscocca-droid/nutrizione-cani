// Esiti distinti di una formulazione (senza il motore: l'app iPhone li usa senza includere il risolutore).
import type { FormulationResult } from './formulate';

export type Diagnosis = 'constraints_incompatible' | 'preferences_unreachable' | 'insufficient_data' | 'verified' | 'not_completed';

export function diagnosisOf(r: Pick<FormulationResult, 'outcome' | 'audit'>): Diagnosis {
  if (r.outcome === 'infeasible') return 'constraints_incompatible';
  if (r.outcome === 'preferences_unreachable') return 'preferences_unreachable';
  if (r.outcome === 'solved') return r.audit?.status === 'INSUFFICIENT_DATA' ? 'insufficient_data' : 'verified';
  return 'not_completed';
}

export const DIAGNOSIS_LABEL: Record<Diagnosis, string> = {
  constraints_incompatible: 'Vincoli nutrizionali o di quantità incompatibili: nessuna soluzione con questi componenti',
  preferences_unreachable: 'Preferenze non raggiungibili: vincoli del modello sui contributi noti rispettati, preferenze no; non è un menù',
  insufficient_data: 'Vincoli del modello sui contributi noti rispettati; verifica nutrizionale incompleta (dati non verificabili)',
  verified: 'Verifica nutrizionale completa sui dati disponibili',
  not_completed: 'Calcolo non completato',
};
