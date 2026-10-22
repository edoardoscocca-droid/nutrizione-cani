// Dati reali ricevuti e convertiti con scripts/adapters/*: nella modalità prova vengono applicati al catalogo
// con lo stesso importatore usato dagli amministratori (in Supabase si importano dalla scheda Catalogo → Importa).

import foods20261016 from '../../dati/importazioni/2026-10-16/import_alimenti.json';
import supps20261016 from '../../dati/importazioni/2026-10-16/import_integratori.json';
// pacchetto del 20/10/2026 (verifica del menù di Ker), schema definitivo: stessi file di supabase/data/2026-10-20/
import foodsUpd20261020 from '../../dati/importazioni/2026-10-20/alimenti_esistenti_aggiornati.json';
import foodsNew20261020 from '../../dati/importazioni/2026-10-20/alimenti_nuovi_confronto.json';
import supps20261019 from '../../dati/importazioni/2026-10-20/integratori_riferimento_19ott.json';
import psyllium20261020 from '../../dati/importazioni/2026-10-20/psillio_confronto.json';
// specifica v2 del 21/10/2026 (§6): B5 del QDiet dal calcio D-pantotenato
import qdietB520261021 from '../../dati/importazioni/2026-10-21/qdiet_b5.json';
// catalogo unico corretto del 22/10/2026 (95 alimenti, verificato con l'importatore rigoroso: 87 nuovi, 8 aggiornati)
import foods20261022 from '../../dati/importazioni/2026-10-22/catalogo_cani_corretto.json';
import type { ImportKind, ImportMode } from './catalogImport';

/** In ordine: ogni file si confronta con il catalogo già aggiornato dai precedenti. */
export const BUNDLED_IMPORTS: { label: string; kind: ImportKind; data: unknown; mode: ImportMode; date: string }[] = [
  { label: 'Alimenti 16/10/2026', kind: 'foods', data: foods20261016, mode: 'legacy', date: '2026-10-16' },
  { label: 'Integratori 16/10/2026', kind: 'supplements', data: supps20261016, mode: 'legacy', date: '2026-10-16' },
  { label: 'Alimenti aggiornati 20/10/2026', kind: 'foods', data: foodsUpd20261020, mode: 'strict', date: '2026-10-20' },
  { label: 'Alimenti di confronto 20/10/2026', kind: 'foods', data: foodsNew20261020, mode: 'strict', date: '2026-10-20' },
  { label: 'Integratori 19/10/2026', kind: 'supplements', data: supps20261019, mode: 'strict', date: '2026-10-20' },
  { label: 'Psillio di confronto 20/10/2026', kind: 'supplements', data: psyllium20261020, mode: 'strict', date: '2026-10-20' },
  { label: 'QDiet B5 21/10/2026', kind: 'supplements', data: qdietB520261021, mode: 'strict', date: '2026-10-21' },
  { label: 'Catalogo alimenti 22/10/2026', kind: 'foods', data: foods20261022, mode: 'strict', date: '2026-10-22' },
];
