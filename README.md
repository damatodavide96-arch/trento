# Fenvex — Firma buste di gara

Landing page React + Vite + TypeScript (Tailwind) con **backend su Netlify Functions + Netlify Blobs**.
Il codice mostrato all'utente è deciso da te, dall'interno di un pannello riservato, e viene
rilasciato solo quando lo attivi.

## Sviluppo in locale

```bash
npm install
npm run dev        # solo frontend (le Functions NON girano con Vite)
```

Per provare anche le Functions e il pannello in locale serve la Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev        # serve frontend + /.netlify/functions/*
```

## Deploy su Netlify

1. Carica questa cartella su un repository GitHub/GitLab.
2. Su Netlify: **Add new site → Import an existing project** e collega il repo.
   Le impostazioni sono già in `netlify.toml` (build `npm run build`, publish `dist`,
   functions in `netlify/functions`).
3. **Imposta la variabile d'ambiente del PIN admin** (obbligatoria):
   *Site configuration → Environment variables → Add a variable*
   - Key: `ADMIN_PIN`
   - Value: un PIN a tua scelta (es. una stringa lunga)
   Poi fai un nuovo deploy. Senza `ADMIN_PIN` il pannello risponde sempre "Non autorizzato".
4. Netlify Blobs si attiva da solo: nessun database da configurare.

## Come funziona il codice

- **Pannello riservato**: apri `https://iltuosito/#gestione` (o il lucchetto in basso a
  sinistra) e inserisci il PIN (`ADMIN_PIN`).
- Scegli **Fisso** e scrivi il codice che vuoi far uscire, oppure **Automatico** (casuale).
- Usa l'interruttore **Rilascia ora / Sospendi** per decidere il momento:
  - *Sospeso* → chi preme "Genera il codice" riceve "non ancora disponibile".
  - *In rilascio* → viene emesso il codice che hai impostato.
- Le impostazioni sono condivise tra tutti i visitatori (salvate lato server).

## Sicurezza — da sapere

- Il PIN viaggia in HTTPS ed è verificato **lato server** contro `ADMIN_PIN` (non è nel bundle).
- I dati anagrafici e i file restano nel browser dell'utente: **non** vengono ancora inviati
  al server. Se vuoi riceverli (con informativa privacy/GDPR, cifratura e conservazione a
  norma) va aggiunta una Function dedicata all'upload.

## Struttura

- `src/App.tsx` — tutta la pagina.
- `netlify/functions/code.js` — stato pubblico (GET) ed emissione codice (POST).
- `netlify/functions/admin.js` — lettura/salvataggio configurazione (protetta da `ADMIN_PIN`).
