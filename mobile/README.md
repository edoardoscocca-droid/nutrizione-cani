# Nutrizione cani — app per iPhone

App Expo (SDK 58) con lo **stesso motore, le stesse regole e lo stesso database** dell'app web (cartella `../src`).
Il calcolo dei grammi (ottimizzazione + verifica) avviene sul server di calcolo `../server` pubblicato su Render:
https://nutrizione-cani-motore-q58c.onrender.com (piano gratuito: il primo calcolo dopo una pausa può impiegare fino a un minuto).

- Senza Supabase collegato l'app parte in **prova**: dati salvati sul telefono, catalogo del pacchetto + dati [TEST] + dati ricevuti.
- Con `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (da impostare su expo.dev → progetto → Environment variables,
  mai in chat) usa l'archivio condiviso con accesso via codice email.

## Comandi
```bash
npm install
npx tsc --noEmit                         # controllo dei tipi
npx expo export --platform ios           # verifica che l'app si impacchetti
npx expo export --platform web && node e2e/flow.mjs <url> <cartella>   # prova automatica delle schermate nel browser
```

## Installare sui vostri iPhone (senza pubblicare)
Progetto Expo: https://expo.dev/accounts/edoardodroid/projects/nutrizione-cani

- **TestFlight (consigliato)**: profilo `testflight` → `eas build -p ios --profile testflight --auto-submit`.
  Si installa con l'app TestFlight, solo per le persone invitate; nessuna pubblicazione sull'App Store.
- **Installazione interna**: profilo `interna` (ad hoc) → serve registrare ogni iPhone (`eas device:create`).

Gli aggiornamenti successivi arrivano da soli: `eas update --channel interna --platform ios`.
