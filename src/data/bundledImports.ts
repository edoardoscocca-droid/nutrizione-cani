// Dati reali ricevuti e convertiti con scripts/adapters/*: nella modalità prova vengono applicati al catalogo
// con lo stesso importatore usato dagli amministratori (in Supabase si importano dalla scheda Catalogo → Importa).

import foods20261016 from '../../dati/importazioni/2026-10-16/import_alimenti.json';
import supps20261016 from '../../dati/importazioni/2026-10-16/import_integratori.json';
import type { ImportKind } from './catalogImport';

export const BUNDLED_IMPORTS: { label: string; kind: ImportKind; data: unknown }[] = [
  { label: 'Alimenti 16/10/2026', kind: 'foods', data: foods20261016 },
  { label: 'Integratori 16/10/2026', kind: 'supplements', data: supps20261016 },
];
