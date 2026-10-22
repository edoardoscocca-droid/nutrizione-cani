# Istruzioni per chi sviluppa questo progetto (persone o IA)

Leggi prima `docs/PASSAGGIO_SVILUPPO.md`: dove sono codice, app iPhone (Expo), server di calcolo (Render) e dati, e come si pubblica.
Per l'app iPhone leggi anche `mobile/AGENTS.md` (Expo cambia a ogni versione: usa la documentazione della versione in `mobile/package.json`).

- Rispondi in italiano semplice: l'utente non è un programmatore. Prima di lavori grandi proponi e aspetta l'ok.
- Mai chiedere password, token o chiavi in chat: si inseriscono direttamente su expo.dev, Render o GitHub.
- Ogni push su `main` aggiorna da solo il server di calcolo su Render.
- I dati dell'utente (cani, ricette, diario) sono solo sull'iPhone: non cambiare la chiave dell'archivio locale (`nutrizione-cani:prova:v1`).
- Non inventare dati nutrizionali (ciò che manca resta sconosciuto, mai zero) e non modificare in automatico ricette, prescrizioni o catalogo.
- Supabase non è usato: non eseguire i file in `supabase/` senza una decisione esplicita.
- Prima di dire «fatto»: `npm test` e `npx tsc --noEmit` nella radice; `npx tsc --noEmit` e `npx expo lint` in `mobile/`.
