import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Menu, X, Upload, FileText, Copy, Check, RotateCcw, Lock, Settings } from 'lucide-react';

type Documento = {
  id: string;
  nome: string;
  peso: number;
};

type Marchio = {
  nome: string;
  grande: boolean;
  src?: string;
  render?: (classe: string) => ReactNode;
};

type Pagina = 'home' | 'tutorial' | 'confronta' | 'soluzioni';

const LINK_NAV: { id: Pagina; label: string }[] = [
  { id: 'home', label: 'Piattaforma' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'confronta', label: 'Confronta' },
  { id: 'soluzioni', label: 'Soluzioni' },
];

const BRAND = 'GaraFacile.it';

// I due cerchi Mastercard sono disegnati inline: la CDN monocromatica non
// restituisce il rosso/arancio del marchio ufficiale.
function MarchioMastercard({ classe }: { classe: string }) {
  return (
    <svg viewBox="0 0 48 30" className={classe} role="img" aria-label="Mastercard">
      <defs>
        <clipPath id="mastercard-intersezione">
          <circle cx="18" cy="15" r="14" />
        </clipPath>
      </defs>
      <circle cx="18" cy="15" r="14" fill="#EB001B" />
      <circle cx="30" cy="15" r="14" fill="#F79E1B" />
      <circle cx="30" cy="15" r="14" fill="#FF5F00" clipPath="url(#mastercard-intersezione)" />
    </svg>
  );
}

// cdn.simpleicons.org restituisce lo stesso tracciato di simple-icons ma
// colorato: /<slug>/<hex> senza # davanti al colore.
const LOGHI: Marchio[] = [
  { nome: 'Shopify', src: 'https://cdn.simpleicons.org/shopify/95BF47', grande: false },
  { nome: 'Stripe', src: 'https://cdn.simpleicons.org/stripe/635BFF', grande: false },
  { nome: 'Visa', src: 'https://cdn.simpleicons.org/visa/1434CB', grande: true },
  { nome: 'Apple Pay', src: 'https://cdn.simpleicons.org/applepay/000000', grande: true },
  { nome: 'Mastercard', grande: true, render: (classe) => <MarchioMastercard classe={classe} /> },
  { nome: 'PayPal', src: 'https://cdn.simpleicons.org/paypal/003087', grande: false },
];

const STILE_SCURO = {
  background: 'linear-gradient(to bottom, #3a3a3a, #111111)',
  border: '1.5px solid transparent',
} as const;

const STILE_CHIARO = {
  border: '1.5px solid #222222',
  color: '#222222',
} as const;

const ESTENSIONI_AMMESSE = ['pdf', 'jpg', 'jpeg', 'png'];
const PESO_MASSIMO = 10 * 1024 * 1024;

type ModalitaCodice = 'automatico' | 'fisso';

type ConfigCodice = {
  modalita: ModalitaCodice;
  prefisso: string; // usato solo in automatico
  codiceFisso: string; // usato solo in fisso
  oreValidita: number;
  attivo: boolean; // interruttore operatore: se false il sito non rilascia il codice
};

const CONFIG_DEFAULT: ConfigCodice = {
  modalita: 'fisso',
  prefisso: '',
  codiceFisso: 'ABCD-2345',
  oreValidita: 24,
  attivo: false,
};

const API_CODE = '/.netlify/functions/code';
const API_ADMIN = '/.netlify/functions/admin';

function normalizzaCodice(grezzo: string): string {
  return grezzo.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function contaCaratteri(codice: string): number {
  return codice.replace(/[^A-Z0-9]/gi, '').length;
}

type EsitoCodice = { pronto: boolean; codice?: string; oreValidita?: number; messaggio?: string };

// Chiede al backend di emettere il codice (rispetta l'interruttore attivo).
async function emettiCodice(): Promise<EsitoCodice> {
  const risposta = await fetch(API_CODE, { method: 'POST' });
  return (await risposta.json()) as EsitoCodice;
}

// Pannello: legge la configurazione corrente (richiede PIN admin).
async function caricaConfigAdmin(pin: string): Promise<ConfigCodice> {
  const risposta = await fetch(API_ADMIN, { headers: { 'x-admin-pin': pin } });
  if (risposta.status === 401) throw new Error('PIN non corretto.');
  if (!risposta.ok) throw new Error('Servizio non raggiungibile.');
  const dati = await risposta.json();
  return { ...CONFIG_DEFAULT, ...(dati.config || {}) };
}

// Pannello: salva la configurazione (richiede PIN admin).
async function salvaConfigAdmin(pin: string, config: ConfigCodice): Promise<ConfigCodice> {
  const risposta = await fetch(API_ADMIN, {
    method: 'POST',
    headers: { 'x-admin-pin': pin, 'content-type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (risposta.status === 401) throw new Error('PIN non corretto.');
  if (!risposta.ok) throw new Error('Salvataggio non riuscito.');
  const dati = await risposta.json();
  return { ...CONFIG_DEFAULT, ...(dati.config || {}) };
}

function pesoLeggibile(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

type Anagrafica = {
  nome: string;
  cognome: string;
  cellulare: string;
  codiceFiscale: string;
  indirizzo: string;
  cap: string;
  societa: string;
  piva: string;
  pec: string;
  emailAziendale: string;
  codiceUnivoco: string;
};

const ANAGRAFICA_VUOTA: Anagrafica = {
  nome: '',
  cognome: '',
  cellulare: '',
  codiceFiscale: '',
  indirizzo: '',
  cap: '',
  societa: '',
  piva: '',
  pec: '',
  emailAziendale: '',
  codiceUnivoco: '',
};

type CampoAnagrafica = {
  chiave: keyof Anagrafica;
  label: string;
  tipo?: string;
  larga?: boolean;
  placeholder?: string;
  maiuscolo?: boolean;
};

const CAMPI: CampoAnagrafica[] = [
  { chiave: 'nome', label: 'Nome' },
  { chiave: 'cognome', label: 'Cognome' },
  { chiave: 'cellulare', label: 'Numero di cellulare', tipo: 'tel', placeholder: '+39 ...' },
  { chiave: 'codiceFiscale', label: 'Codice Fiscale', maiuscolo: true },
  { chiave: 'indirizzo', label: 'Indirizzo', larga: true },
  { chiave: 'cap', label: 'CAP', placeholder: '00000' },
  { chiave: 'societa', label: 'Nome società', larga: true },
  { chiave: 'piva', label: 'P.IVA', placeholder: '11 cifre' },
  { chiave: 'pec', label: 'PEC', tipo: 'email' },
  { chiave: 'emailAziendale', label: 'Email aziendale', tipo: 'email' },
  { chiave: 'codiceUnivoco', label: 'Codice univoco', maiuscolo: true, placeholder: 'SDI · 7 caratteri' },
];

function emailValida(valore: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valore);
}

function validaAnagrafica(dati: Anagrafica): Partial<Record<keyof Anagrafica, string>> {
  const errori: Partial<Record<keyof Anagrafica, string>> = {};
  (Object.keys(ANAGRAFICA_VUOTA) as (keyof Anagrafica)[]).forEach((chiave) => {
    if (!dati[chiave].trim()) errori[chiave] = 'Campo obbligatorio';
  });
  if (dati.cap && !/^\d{5}$/.test(dati.cap)) errori.cap = 'Il CAP ha 5 cifre';
  if (dati.piva && !/^\d{11}$/.test(dati.piva)) errori.piva = 'La P.IVA ha 11 cifre';
  if (dati.cellulare && dati.cellulare.replace(/\D/g, '').length < 8) errori.cellulare = 'Numero non valido';
  if (dati.codiceFiscale && !/^[A-Z0-9]{11,16}$/.test(dati.codiceFiscale)) errori.codiceFiscale = 'Codice non valido';
  if (dati.codiceUnivoco && !/^[A-Z0-9]{6,7}$/.test(dati.codiceUnivoco)) errori.codiceUnivoco = '6-7 caratteri';
  if (dati.pec && !emailValida(dati.pec)) errori.pec = 'Indirizzo non valido';
  if (dati.emailAziendale && !emailValida(dati.emailAziendale)) errori.emailAziendale = 'Indirizzo non valido';
  return errori;
}

const DOCUMENTI_RICHIESTI = [
  'Visura camerale aggiornata',
  'Ultimo bilancio depositato e situazione contabile aggiornata dell\u2019anno in corso',
  'Eventuale situazione debitoria/creditoria aggiornata',
  'Elenco dei finanziamenti, mutui, leasing o altri impegni finanziari in essere',
  'Principali contratti aziendali in essere (locazioni, fornitori, clienti o altri contratti rilevanti)',
  'Documentazione relativa a eventuali contenziosi o posizioni aperte',
  'Organigramma aziendale ed eventuale elenco dei dipendenti/collaboratori',
  'Eventuale ulteriore documentazione utile per un quadro completo della società',
];

// 7 minuti e mezzo
const DURATA_ELABORAZIONE_SEC = 450;

const DOMANDE_REATI: { titolo: string; testo: string }[] = [
  {
    titolo: 'Partecipazione a un\u2019organizzazione criminale',
    testo:
      'L\u2019operatore economico o uno dei soggetti rilevanti è stato condannato con sentenza definitiva o decreto penale irrevocabile per partecipazione a un\u2019organizzazione criminale?',
  },
  {
    titolo: 'Corruzione',
    testo:
      'È stata pronunciata condanna definitiva o decreto penale irrevocabile per reati di corruzione?',
  },
  {
    titolo: 'Frode',
    testo: 'È stata pronunciata condanna definitiva o decreto penale irrevocabile per frode?',
  },
  {
    titolo: 'Reati terroristici o connessi ad attività terroristiche',
    testo:
      'È stata pronunciata condanna definitiva o decreto penale irrevocabile per reati terroristici o reati connessi alle attività terroristiche?',
  },
  {
    titolo: 'Riciclaggio o finanziamento del terrorismo',
    testo:
      'È stata pronunciata condanna definitiva o decreto penale irrevocabile per riciclaggio di proventi di attività criminose o finanziamento del terrorismo?',
  },
  {
    titolo: 'Lavoro minorile e tratta di esseri umani',
    testo:
      'È stata pronunciata condanna definitiva o decreto penale irrevocabile per sfruttamento del lavoro minorile e altre forme di tratta di esseri umani?',
  },
];

function formattaTempo(percentuale: number, durataSec: number): string {
  const rimasti = Math.max(0, Math.round(((100 - percentuale) / 100) * durataSec));
  const minuti = Math.floor(rimasti / 60);
  const secondi = rimasti % 60;
  return `${minuti}:${secondi.toString().padStart(2, '0')}`;
}

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pagina, setPagina] = useState<Pagina>('home');

  function vaiA(destinazione: Pagina) {
    setPagina(destinazione);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [codice, setCodice] = useState<string | null>(null);
  const [oreValiditaCorrenti, setOreValiditaCorrenti] = useState(24);
  const [generazioneInCorso, setGenerazioneInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [trascinamento, setTrascinamento] = useState(false);
  const [allegati, setAllegati] = useState<(Documento | null)[]>(() => DOCUMENTI_RICHIESTI.map(() => null));
  const [erroreAllegato, setErroreAllegato] = useState<string | null>(null);
  const [risposteReati, setRisposteReati] = useState<('si' | 'no' | null)[]>(() =>
    DOMANDE_REATI.map(() => null),
  );
  const [mostraSoci, setMostraSoci] = useState(false);
  const [soci, setSoci] = useState<{ nome: string; cognome: string; cf: string }[]>([
    { nome: '', cognome: '', cf: '' },
  ]);
  const inputFile = useRef<HTMLInputElement>(null);

  // --- Dati anagrafici (prima del caricamento documenti) ---
  const [dati, setDati] = useState<Anagrafica>(ANAGRAFICA_VUOTA);
  const [datiConfermati, setDatiConfermati] = useState(false);
  const [erroriDati, setErroriDati] = useState<Partial<Record<keyof Anagrafica, string>>>({});

  function aggiornaDato(chiave: keyof Anagrafica, valore: string, maiuscolo?: boolean) {
    const pulito = maiuscolo ? valore.toUpperCase() : valore;
    setDati((precedente) => ({ ...precedente, [chiave]: pulito }));
    if (erroriDati[chiave]) {
      setErroriDati((precedente) => {
        const copia = { ...precedente };
        delete copia[chiave];
        return copia;
      });
    }
  }

  function confermaDati() {
    const errori = validaAnagrafica(dati);
    setErroriDati(errori);
    if (Object.keys(errori).length > 0) return;
    setDatiConfermati(true);
    document.getElementById('carica-documenti')?.scrollIntoView({ behavior: 'smooth' });
  }

  function modificaDati() {
    setDatiConfermati(false);
    setCodice(null);
    azzeraElaborazione();
    setAllegati(DOCUMENTI_RICHIESTI.map(() => null));
    setErroreAllegato(null);
    setRisposteReati(DOMANDE_REATI.map(() => null));
    setMostraSoci(false);
    setSoci([{ nome: '', cognome: '', cf: '' }]);
    document.getElementById('dati-anagrafici')?.scrollIntoView({ behavior: 'smooth' });
  }

  // --- Elaborazione (barra di caricamento da 7,5 minuti) ---
  const [avanzamento, setAvanzamento] = useState(0);
  const [elaborazioneAttiva, setElaborazioneAttiva] = useState(false);
  const [elaborazioneCompletata, setElaborazioneCompletata] = useState(false);
  const intervalloRef = useRef<number | null>(null);

  function azzeraElaborazione() {
    if (intervalloRef.current) {
      window.clearInterval(intervalloRef.current);
      intervalloRef.current = null;
    }
    setElaborazioneAttiva(false);
    setElaborazioneCompletata(false);
    setAvanzamento(0);
  }

  function avviaElaborazione() {
    if (intervalloRef.current) window.clearInterval(intervalloRef.current);
    setElaborazioneCompletata(false);
    setElaborazioneAttiva(true);
    setAvanzamento(0);
    const durataMs = DURATA_ELABORAZIONE_SEC * 1000;
    const inizio = Date.now();
    intervalloRef.current = window.setInterval(() => {
      const trascorso = Date.now() - inizio;
      const perc = Math.min(100, (trascorso / durataMs) * 100);
      setAvanzamento(perc);
      if (perc >= 100) {
        if (intervalloRef.current) window.clearInterval(intervalloRef.current);
        intervalloRef.current = null;
        setElaborazioneAttiva(false);
        setElaborazioneCompletata(true);
      }
    }, 500);
  }

  // Ferma il timer se il componente viene smontato
  useEffect(() => {
    return () => {
      if (intervalloRef.current) window.clearInterval(intervalloRef.current);
    };
  }, []);

  // --- Pannello gestione interno (backend condiviso) ---
  const [pannelloAperto, setPannelloAperto] = useState(false);
  const [sbloccato, setSbloccato] = useState(false);
  const [pin, setPin] = useState('');
  const [bozza, setBozza] = useState<ConfigCodice>(CONFIG_DEFAULT);
  const [erroreGestione, setErroreGestione] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [gestioneInCorso, setGestioneInCorso] = useState(false);

  function apriPannello() {
    setPin('');
    setSbloccato(false);
    setErroreGestione(null);
    setSalvato(false);
    setPannelloAperto(true);
  }

  function chiudiPannello() {
    setPannelloAperto(false);
    setSbloccato(false);
    setPin('');
    if (window.location.hash === '#gestione') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  // Apre il pannello anche via URL con #gestione
  useEffect(() => {
    const controlla = () => {
      if (window.location.hash === '#gestione') apriPannello();
    };
    controlla();
    window.addEventListener('hashchange', controlla);
    return () => window.removeEventListener('hashchange', controlla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verificaPin() {
    setGestioneInCorso(true);
    setErroreGestione(null);
    try {
      const attuale = await caricaConfigAdmin(pin);
      setBozza(attuale);
      setSbloccato(true);
    } catch (e) {
      setErroreGestione(e instanceof Error ? e.message : 'Accesso non riuscito.');
    } finally {
      setGestioneInCorso(false);
    }
  }

  async function salvaGestione() {
    if (bozza.modalita === 'fisso' && contaCaratteri(bozza.codiceFisso) < 4) {
      setErroreGestione('Il codice fisso deve avere almeno 4 caratteri alfanumerici.');
      return;
    }
    setGestioneInCorso(true);
    setErroreGestione(null);
    try {
      const salvata = await salvaConfigAdmin(pin, bozza);
      setBozza(salvata);
      setSalvato(true);
      window.setTimeout(() => setSalvato(false), 2000);
    } catch (e) {
      setErroreGestione(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setGestioneInCorso(false);
    }
  }

  // Interruttore rapido: rilascia o sospende il codice al volo.
  async function commutaAttivo() {
    const aggiornata = { ...bozza, attivo: !bozza.attivo };
    setBozza(aggiornata);
    setGestioneInCorso(true);
    setErroreGestione(null);
    try {
      const salvata = await salvaConfigAdmin(pin, aggiornata);
      setBozza(salvata);
    } catch (e) {
      setBozza((precedente) => ({ ...precedente, attivo: !aggiornata.attivo }));
      setErroreGestione(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setGestioneInCorso(false);
    }
  }

  function aggiungiFile(lista: FileList | null) {
    if (!lista || lista.length === 0) return;

    const accettati: Documento[] = [];
    const scartati: string[] = [];

    Array.from(lista).forEach((file) => {
      const estensione = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ESTENSIONI_AMMESSE.includes(estensione) || file.size > PESO_MASSIMO) {
        scartati.push(file.name);
        return;
      }
      accettati.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        nome: file.name,
        peso: file.size,
      });
    });

    if (accettati.length > 0) {
      setDocumenti((precedenti) => [...precedenti, ...accettati]);
      setCodice(null);
      setCopiato(false);
    }

    setErrore(
      scartati.length > 0
        ? `Non caricati: ${scartati.join(', ')}. Accettiamo PDF, JPG e PNG fino a 10 MB.`
        : null,
    );
  }

  function rimuoviDocumento(id: string) {
    setDocumenti((precedenti) => precedenti.filter((documento) => documento.id !== id));
    setCodice(null);
    setCopiato(false);
  }

  function allegaFile(indice: number, lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const file = lista[0];
    const estensione = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ESTENSIONI_AMMESSE.includes(estensione) || file.size > PESO_MASSIMO) {
      setErroreAllegato(`"${file.name}" non allegato. Accettiamo PDF, JPG e PNG fino a 10 MB.`);
      return;
    }
    setErroreAllegato(null);
    setAllegati((precedenti) =>
      precedenti.map((corrente, i) =>
        i === indice ? { id: `${file.name}-${file.size}-${Date.now()}`, nome: file.name, peso: file.size } : corrente,
      ),
    );
  }

  function rimuoviAllegato(indice: number) {
    setAllegati((precedenti) => precedenti.map((corrente, i) => (i === indice ? null : corrente)));
  }

  function rispondiReato(indice: number, valore: 'si' | 'no') {
    setRisposteReati((precedenti) => precedenti.map((corrente, i) => (i === indice ? valore : corrente)));
  }

  function aggiornaSocio(indice: number, campo: 'nome' | 'cognome' | 'cf', valore: string) {
    const pulito = campo === 'cf' ? valore.toUpperCase() : valore;
    setSoci((precedenti) => precedenti.map((s, i) => (i === indice ? { ...s, [campo]: pulito } : s)));
  }

  function aggiungiSocio() {
    setSoci((precedenti) => [...precedenti, { nome: '', cognome: '', cf: '' }]);
  }

  function rimuoviSocio(indice: number) {
    setSoci((precedenti) => (precedenti.length === 1 ? precedenti : precedenti.filter((_, i) => i !== indice)));
  }

  async function generaCodice() {
    if (documenti.length === 0) {
      setErrore('Aggiungi almeno un documento per generare il codice.');
      return;
    }
    setErrore(null);
    setCopiato(false);
    azzeraElaborazione();
    setGenerazioneInCorso(true);
    try {
      const esito = await emettiCodice();
      if (!esito.pronto || !esito.codice) {
        setCodice(null);
        setErrore(esito.messaggio ?? 'Il codice non è ancora disponibile. Riprova tra poco.');
      } else {
        setCodice(esito.codice);
        setOreValiditaCorrenti(esito.oreValidita ?? 24);
      }
    } catch {
      setCodice(null);
      setErrore('Impossibile contattare il servizio. Controlla la connessione e riprova.');
    } finally {
      setGenerazioneInCorso(false);
    }
  }

  async function copiaCodice() {
    if (!codice) return;
    try {
      await navigator.clipboard.writeText(codice);
      setCopiato(true);
      window.setTimeout(() => setCopiato(false), 2000);
    } catch {
      setErrore('Il browser ha bloccato la copia. Seleziona il codice e copialo a mano.');
    }
  }

  function ricomincia() {
    setDocumenti([]);
    setCodice(null);
    setErrore(null);
    setCopiato(false);
    azzeraElaborazione();
    setAllegati(DOCUMENTI_RICHIESTI.map(() => null));
    setErroreAllegato(null);
    setRisposteReati(DOMANDE_REATI.map(() => null));
    setMostraSoci(false);
    setSoci([{ nome: '', cognome: '', cf: '' }]);
    if (inputFile.current) inputFile.current.value = '';
  }

  // Chiude il percorso e riporta in cima con tutti i campi da ricompilare.
  function completaERicompila() {
    setDati(ANAGRAFICA_VUOTA);
    setDatiConfermati(false);
    setErroriDati({});
    ricomincia();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ fontFamily: "'ITC Avant Garde Gothic W02 Bk', sans-serif" }}
    >
      {pagina === 'home' && (
        <video
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{ filter: 'saturate(0)' }}
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-poster.jpg"
          src="/hero.mp4"
        />
      )}

      <div className="relative z-10 flex flex-col min-h-screen">
        <nav className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 max-w-7xl mx-auto w-full">
          <button
            onClick={() => vaiA('home')}
            className="text-lg sm:text-xl font-semibold tracking-tight select-none"
            style={{ color: '#111111' }}
          >
            {BRAND}
          </button>

          <div
            className="hidden md:flex md:mx-auto items-center gap-1 px-2 py-1.5 rounded-full"
            style={{ background: '#e5e5e5' }}
          >
            {LINK_NAV.map((voce) => {
              const attivo = pagina === voce.id;
              return (
                <button
                  key={voce.id}
                  onClick={() => vaiA(voce.id)}
                  className="text-sm px-4 py-1.5 rounded-full transition-colors duration-200"
                  style={
                    attivo
                      ? { background: '#ffffff', color: '#111111' }
                      : { color: '#1a1a1a', background: 'transparent' }
                  }
                >
                  {voce.label}
                </button>
              );
            })}
          </div>

          <button
            className="md:hidden p-2 rounded-full transition-colors duration-200 hover:bg-white/20"
            onClick={() => setMobileMenuOpen((aperto) => !aperto)}
            aria-label={mobileMenuOpen ? 'Chiudi il menu' : 'Apri il menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} color="#111111" /> : <Menu size={22} color="#111111" />}
          </button>
        </nav>

        {mobileMenuOpen && (
          <div
            className="relative z-20 mx-4 rounded-2xl px-4 py-4 flex flex-col gap-2 md:hidden"
            style={{ background: '#e5e5e5' }}
          >
            {LINK_NAV.map((voce) => (
              <button
                key={voce.id}
                onClick={() => vaiA(voce.id)}
                className="text-left text-sm px-4 py-2 rounded-xl transition-colors duration-200"
                style={
                  pagina === voce.id
                    ? { background: '#ffffff', color: '#111111' }
                    : { color: '#1a1a1a', background: 'transparent' }
                }
              >
                {voce.label}
              </button>
            ))}
          </div>
        )}

        {pagina !== 'home' && <PaginaContenuto pagina={pagina} onInizia={() => vaiA('home')} />}

        {pagina === 'home' && (
        <>
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-8 pb-32 sm:pb-40">
          <h1
            className="font-bold leading-tight mb-4 sm:mb-5"
            style={{
              fontSize: 'clamp(1.75rem, 6vw, 3.75rem)',
              maxWidth: '800px',
              lineHeight: 1.1,
              color: '#111111',
            }}
          >
            Carica e firma le buste amministrative per le tue gare d&apos;appalto
          </h1>
          <p
            className="text-sm sm:text-base md:text-lg mb-8 sm:mb-10 max-w-xs sm:max-w-md leading-relaxed"
            style={{ color: '#333333' }}
          >
            Usa la piattaforma GaraFacile per preparare, firmare e trasmettere la documentazione di gara in modo
            veloce, tracciato e a norma.
          </p>

          <div id="dati-anagrafici" className="w-full max-w-2xl">
            <div
              className="bg-white rounded-2xl px-4 sm:px-7 py-6 sm:py-7 text-left"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)' }}
            >
              <h2 className="text-base sm:text-lg font-semibold mb-1" style={{ color: '#111111' }}>
                I tuoi dati
              </h2>
              <p className="text-xs sm:text-sm mb-5" style={{ color: '#666666' }}>
                Compila i dati dell&apos;intestatario, poi passi al caricamento dei documenti.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CAMPI.map((campo) => {
                  const err = erroriDati[campo.chiave];
                  return (
                    <div key={campo.chiave} className={campo.larga ? 'sm:col-span-2' : undefined}>
                      <label className="block text-xs mb-1" style={{ color: '#555555' }}>
                        {campo.label}
                      </label>
                      <input
                        type={campo.tipo ?? 'text'}
                        value={dati[campo.chiave]}
                        placeholder={campo.placeholder}
                        onChange={(evento) => aggiornaDato(campo.chiave, evento.target.value, campo.maiuscolo)}
                        className={`w-full text-sm px-3.5 py-2.5 rounded-xl outline-none transition-colors duration-200 focus:border-[#111111] ${
                          campo.maiuscolo ? 'tracking-wide' : ''
                        }`}
                        style={{ border: `1.5px solid ${err ? '#e5a5a0' : '#d5d5d5'}` }}
                        aria-invalid={err ? true : undefined}
                      />
                      {err && (
                        <p className="mt-1 text-xs" style={{ color: '#b42318' }}>
                          {err}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={confermaDati}
                className="mt-5 w-full text-center text-white text-sm px-7 py-3 rounded-full transition-all duration-200 hover:opacity-90 shadow-lg"
                style={STILE_SCURO}
              >
                Prosegui al caricamento documenti
              </button>
              <p className="mt-3 text-xs text-center" style={{ color: '#8a8a8a' }}>
                Oppure{' '}
                <button className="underline underline-offset-2 hover:text-[#111111] transition-colors duration-200">
                  parla con il team
                </button>
                .
              </p>
            </div>
          </div>
        </main>

        <div className="w-full px-4 pb-6 sm:pb-10 flex justify-center">
          <div
            className="w-full max-w-4xl bg-white rounded-2xl px-4 sm:px-8 py-5 sm:py-6 grid grid-cols-3 sm:flex sm:items-center sm:justify-between gap-4 sm:gap-6"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)' }}
          >
            {LOGHI.map((logo) => {
              const classe = logo.grande ? 'h-7 sm:h-8 w-auto' : 'h-6 sm:h-7 w-auto';
              return (
                <div
                  key={logo.nome}
                  className="flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity duration-200"
                  title={logo.nome}
                >
                  {logo.render ? logo.render(classe) : <img src={logo.src} alt={logo.nome} className={classe} />}
                </div>
              );
            })}
          </div>
        </div>
        </>
        )}
      </div>

      {pagina === 'home' && (
      <section
        id="carica-documenti"
        className="relative z-10 w-full px-4 py-14 sm:py-20 flex justify-center"
        style={{ background: '#e9e9e9' }}
      >
        <div className="w-full max-w-3xl">
          <h2
            className="font-bold mb-3"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', lineHeight: 1.15, color: '#111111' }}
          >
            Carica i documenti e ricevi il tuo codice
          </h2>
          <p className="text-sm sm:text-base mb-8 max-w-xl leading-relaxed" style={{ color: '#333333' }}>
            Aggiungi i documenti necessari all&apos;attivazione dell&apos;account. Al termine ottieni un codice da
            comunicare al nostro team per completare la verifica.
          </p>

          {!datiConfermati ? (
            <div
              className="bg-white rounded-2xl px-4 sm:px-8 py-8 flex flex-col items-center text-center gap-3"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)' }}
            >
              <div className="p-3 rounded-full" style={{ background: '#f2f2f2' }}>
                <Lock size={20} color="#111111" />
              </div>
              <p className="text-sm sm:text-base" style={{ color: '#111111' }}>
                Prima compila i tuoi dati nel modulo in alto.
              </p>
              <button
                onClick={() =>
                  document.getElementById('dati-anagrafici')?.scrollIntoView({ behavior: 'smooth' })
                }
                className="text-sm px-6 py-2.5 rounded-full transition-colors duration-200 hover:bg-black/5"
                style={STILE_CHIARO}
              >
                Vai al modulo
              </button>
            </div>
          ) : (
          <>
            <div
              className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
              style={{ background: '#ffffff', border: '1px solid #dedede' }}
            >
              <p className="text-sm truncate" style={{ color: '#333333' }}>
                <span style={{ color: '#8a8a8a' }}>Intestatario:</span>{' '}
                <span className="font-medium">
                  {dati.nome} {dati.cognome}
                </span>
                {dati.societa ? ` · ${dati.societa}` : ''}
              </p>
              <button
                onClick={modificaDati}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors duration-200 hover:bg-black/5"
                style={{ color: '#444444' }}
              >
                Modifica dati
              </button>
            </div>

          <div
            className="bg-white rounded-2xl px-4 sm:px-8 py-6 sm:py-8"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)' }}
          >
            <label
              className="flex flex-col items-center justify-center text-center gap-2 px-4 py-10 rounded-2xl cursor-pointer transition-colors duration-200"
              style={{
                border: `1.5px dashed ${trascinamento ? '#111111' : '#c0c0c0'}`,
                background: trascinamento ? '#f2f2f2' : 'transparent',
              }}
              onDragOver={(evento) => {
                evento.preventDefault();
                setTrascinamento(true);
              }}
              onDragLeave={() => setTrascinamento(false)}
              onDrop={(evento) => {
                evento.preventDefault();
                setTrascinamento(false);
                aggiungiFile(evento.dataTransfer.files);
              }}
            >
              <Upload size={22} color="#111111" />
              <span className="text-sm sm:text-base" style={{ color: '#111111' }}>
                Trascina qui i file oppure scegli dal dispositivo
              </span>
              <span className="text-xs" style={{ color: '#666666' }}>
                PDF, JPG o PNG · massimo 10 MB per file
              </span>
              <input
                ref={inputFile}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={(evento) => aggiungiFile(evento.target.files)}
              />
            </label>

            {documenti.length > 0 && (
              <ul className="mt-5 flex flex-col gap-2">
                {documenti.map((documento) => (
                  <li
                    key={documento.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: '#f2f2f2' }}
                  >
                    <FileText size={18} color="#111111" />
                    <span className="text-sm truncate flex-1" style={{ color: '#1a1a1a' }}>
                      {documento.nome}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: '#666666' }}>
                      {pesoLeggibile(documento.peso)}
                    </span>
                    <button
                      onClick={() => rimuoviDocumento(documento.id)}
                      className="p-1 rounded-full transition-colors duration-200 hover:bg-white"
                      aria-label={`Rimuovi ${documento.nome}`}
                    >
                      <X size={16} color="#444444" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {errore && (
              <p className="mt-4 text-sm" style={{ color: '#b42318' }} role="alert">
                {errore}
              </p>
            )}

            <div className="mt-6 flex flex-col sm:flex-row sm:items-stretch gap-3">
              <button
                onClick={generaCodice}
                className="w-full sm:w-auto shrink-0 text-center text-white text-sm px-7 py-3 rounded-full transition-all duration-200 hover:opacity-90 shadow-lg disabled:opacity-40 disabled:shadow-none"
                style={STILE_SCURO}
                disabled={documenti.length === 0 || generazioneInCorso}
              >
                {generazioneInCorso ? 'Generazione…' : 'Genera il codice'}
              </button>

              <div
                className="flex-1 min-w-0 flex items-center justify-between gap-3 px-5 py-3 rounded-full transition-colors duration-200"
                style={
                  codice
                    ? { background: '#111111', border: '1.5px solid transparent' }
                    : { border: '1.5px dashed #c8c8c8' }
                }
                aria-live="polite"
              >
                {codice ? (
                  <>
                    <span className="text-base sm:text-lg font-semibold tracking-widest text-white select-all truncate">
                      {codice}
                    </span>
                    <button
                      onClick={copiaCodice}
                      className="shrink-0 flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full bg-white transition-opacity duration-200 hover:opacity-90"
                      style={{ color: '#111111' }}
                    >
                      {copiato ? <Check size={14} /> : <Copy size={14} />}
                      {copiato ? 'Copiato' : 'Copia'}
                    </button>
                  </>
                ) : (
                  <span className="text-sm truncate" style={{ color: '#8a8a8a' }}>
                    {documenti.length === 0
                      ? 'Carica prima i documenti'
                      : 'Qui comparirà il tuo codice'}
                  </span>
                )}
              </div>
            </div>

            {(documenti.length > 0 || codice) && (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs" style={{ color: '#666666' }}>
                  {codice
                    ? `Valido ${oreValiditaCorrenti} ore per ${documenti.length} ${
                        documenti.length === 1 ? 'documento caricato' : 'documenti caricati'
                      }.`
                    : 'Se cambi i documenti il codice viene rigenerato.'}
                </p>
                <button
                  onClick={ricomincia}
                  className="self-start sm:self-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors duration-200 hover:bg-black/5"
                  style={{ color: '#444444' }}
                >
                  <RotateCcw size={14} />
                  Ricomincia
                </button>
              </div>
            )}

            {codice && (
              <div className="mt-5 px-4 sm:px-5 py-4 rounded-2xl" style={{ background: '#f2f2f2' }}>
                <p className="text-sm font-semibold mb-2" style={{ color: '#111111' }}>
                  Come inserire il codice su WhatsApp
                </p>
                <ol className="flex flex-col gap-1.5 text-sm" style={{ color: '#333333' }}>
                  <li>
                    <span style={{ color: '#8a8a8a' }}>1.</span> Apri WhatsApp e vai su{' '}
                    <span className="font-medium">Impostazioni</span>.
                  </li>
                  <li>
                    <span style={{ color: '#8a8a8a' }}>2.</span> Tocca{' '}
                    <span className="font-medium">Dispositivi collegati</span>.
                  </li>
                  <li>
                    <span style={{ color: '#8a8a8a' }}>3.</span> Inserisci il codice
                    {codice && contaCaratteri(codice) === 8 ? ' a 8 cifre alfanumeriche' : ''} qui sopra per
                    completare la verifica.
                  </li>
                </ol>
              </div>
            )}

            {codice && (
              <div className="mt-5 px-4 sm:px-5 py-4 rounded-2xl" style={{ background: '#f2f2f2' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#111111' }}>
                  Dichiarazioni sui motivi di esclusione (reati)
                </p>
                <p className="text-xs mb-3 leading-relaxed" style={{ color: '#666666' }}>
                  Indica, per ciascun punto, se sussiste una condanna definitiva. Le dichiarazioni sono rese ai
                  sensi di legge dal legale rappresentante.
                </p>
                <ul className="flex flex-col gap-2">
                  {DOMANDE_REATI.map((domanda, indice) => {
                    const risposta = risposteReati[indice];
                    return (
                      <li
                        key={indice}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3 py-3 rounded-xl"
                        style={{ background: '#ffffff' }}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: '#111111' }}>
                            {domanda.titolo}
                          </p>
                          <p className="text-xs leading-relaxed" style={{ color: '#777777' }}>
                            {domanda.testo}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {(['si', 'no'] as const).map((valore) => {
                            const attivo = risposta === valore;
                            return (
                              <button
                                key={valore}
                                onClick={() => rispondiReato(indice, valore)}
                                className="text-xs px-4 py-1.5 rounded-full transition-colors duration-200"
                                style={
                                  attivo
                                    ? valore === 'no'
                                      ? { background: '#15803d', color: '#ffffff', border: '1.5px solid transparent' }
                                      : { background: '#b42318', color: '#ffffff', border: '1.5px solid transparent' }
                                    : { background: '#ffffff', color: '#333333', border: '1.5px solid #d5d5d5' }
                                }
                              >
                                {valore === 'si' ? 'Sì' : 'No'}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {codice && (
              <div className="mt-5 px-4 sm:px-5 py-4 rounded-2xl" style={{ background: '#f2f2f2' }}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-semibold" style={{ color: '#111111' }}>
                    Documentazione da predisporre
                  </p>
                  <span className="text-xs shrink-0" style={{ color: '#666666' }}>
                    {allegati.filter(Boolean).length}/{DOCUMENTI_RICHIESTI.length} allegati
                  </span>
                </div>

                {erroreAllegato && (
                  <p className="mb-3 text-sm" style={{ color: '#b42318' }} role="alert">
                    {erroreAllegato}
                  </p>
                )}

                <ul className="flex flex-col gap-2">
                  {DOCUMENTI_RICHIESTI.map((voce, indice) => {
                    const allegato = allegati[indice];
                    return (
                      <li
                        key={indice}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: '#ffffff' }}
                      >
                        <span className="flex-1 text-sm leading-relaxed" style={{ color: '#333333' }}>
                          {voce}
                        </span>
                        {allegato ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <FileText size={16} color="#111111" />
                            <span className="text-xs truncate max-w-[160px]" style={{ color: '#1a1a1a' }}>
                              {allegato.nome}
                            </span>
                            <span className="text-xs" style={{ color: '#8a8a8a' }}>
                              {pesoLeggibile(allegato.peso)}
                            </span>
                            <button
                              onClick={() => rimuoviAllegato(indice)}
                              className="p-1 rounded-full transition-colors duration-200 hover:bg-black/5"
                              aria-label={`Rimuovi allegato: ${voce}`}
                            >
                              <X size={14} color="#444444" />
                            </button>
                          </div>
                        ) : (
                          <label
                            className="shrink-0 inline-flex items-center gap-1.5 cursor-pointer text-xs px-3.5 py-1.5 rounded-full transition-colors duration-200 hover:bg-black/5"
                            style={STILE_CHIARO}
                          >
                            <Upload size={14} />
                            Allega
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="sr-only"
                              onChange={(evento) => {
                                allegaFile(indice, evento.target.files);
                                evento.currentTarget.value = '';
                              }}
                            />
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {!elaborazioneAttiva && !elaborazioneCompletata && (
                  <button
                    onClick={avviaElaborazione}
                    className="mt-5 w-full sm:w-auto text-center text-white text-sm px-7 py-3 rounded-full transition-all duration-200 hover:opacity-90 shadow-lg"
                    style={STILE_SCURO}
                  >
                    Avvia elaborazione
                  </button>
                )}

                {(elaborazioneAttiva || elaborazioneCompletata) && (
                  <div className="mt-5">
                    <div
                      className="w-full h-2.5 rounded-full overflow-hidden"
                      style={{ background: '#dcdcdc' }}
                      role="progressbar"
                      aria-valuenow={Math.floor(avanzamento)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-500 ease-linear"
                        style={{
                          width: `${avanzamento}%`,
                          background: 'linear-gradient(to right, #3a3a3a, #111111)',
                        }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs" style={{ color: '#666666' }}>
                      <span>{Math.floor(avanzamento)}%</span>
                      <span>
                        {elaborazioneCompletata
                          ? 'Completato'
                          : `Tempo stimato rimanente ~ ${formattaTempo(avanzamento, DURATA_ELABORAZIONE_SEC)}`}
                      </span>
                    </div>

                    {elaborazioneCompletata ? (
                      <p className="mt-3 text-sm font-medium" style={{ color: '#15803d' }}>
                        Elaborazione completata. Puoi procedere.
                      </p>
                    ) : (
                      <p className="mt-3 text-xs leading-relaxed font-medium" style={{ color: '#b45309' }}>
                        L&apos;operazione richiede dai 5 ai 10 minuti. Non spegnere né chiudere il dispositivo fino al
                        completamento.
                      </p>
                    )}
                  </div>
                )}

                {elaborazioneCompletata && !mostraSoci && (
                  <button
                    onClick={() => setMostraSoci(true)}
                    className="mt-5 w-full text-center text-white text-sm px-7 py-3 rounded-full transition-all duration-200 hover:opacity-90 shadow-lg"
                    style={STILE_SCURO}
                  >
                    Inserisci i dati dei tuoi soci per continuare
                  </button>
                )}

                {elaborazioneCompletata && mostraSoci && (
                  <div className="mt-5">
                    <p className="text-sm font-semibold mb-1" style={{ color: '#111111' }}>
                      Dati dei soci
                    </p>
                    <p className="text-xs mb-3" style={{ color: '#666666' }}>
                      Aggiungi i soci della società. Puoi inserirne quanti ne servono.
                    </p>
                    <div className="flex flex-col gap-3">
                      {soci.map((socio, indice) => (
                        <div
                          key={indice}
                          className="px-3 py-3 rounded-xl"
                          style={{ background: '#ffffff' }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium" style={{ color: '#666666' }}>
                              Socio {indice + 1}
                            </span>
                            {soci.length > 1 && (
                              <button
                                onClick={() => rimuoviSocio(indice)}
                                className="p-1 rounded-full transition-colors duration-200 hover:bg-black/5"
                                aria-label={`Rimuovi socio ${indice + 1}`}
                              >
                                <X size={14} color="#444444" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={socio.nome}
                              placeholder="Nome"
                              onChange={(evento) => aggiornaSocio(indice, 'nome', evento.target.value)}
                              className="w-full text-sm px-3 py-2 rounded-lg outline-none focus:border-[#111111] transition-colors duration-200"
                              style={{ border: '1.5px solid #d5d5d5' }}
                            />
                            <input
                              type="text"
                              value={socio.cognome}
                              placeholder="Cognome"
                              onChange={(evento) => aggiornaSocio(indice, 'cognome', evento.target.value)}
                              className="w-full text-sm px-3 py-2 rounded-lg outline-none focus:border-[#111111] transition-colors duration-200"
                              style={{ border: '1.5px solid #d5d5d5' }}
                            />
                            <input
                              type="text"
                              value={socio.cf}
                              placeholder="Codice Fiscale"
                              onChange={(evento) => aggiornaSocio(indice, 'cf', evento.target.value)}
                              className="w-full text-sm px-3 py-2 rounded-lg outline-none tracking-wide focus:border-[#111111] transition-colors duration-200"
                              style={{ border: '1.5px solid #d5d5d5' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={aggiungiSocio}
                      className="mt-3 text-sm px-5 py-2 rounded-full transition-colors duration-200 hover:bg-black/5"
                      style={STILE_CHIARO}
                    >
                      + Aggiungi socio
                    </button>

                    <button
                      onClick={completaERicompila}
                      className="mt-5 w-full text-center text-white text-sm px-7 py-3 rounded-full transition-all duration-200 hover:opacity-90 shadow-lg"
                      style={STILE_SCURO}
                    >
                      Completa e invia richiesta
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </section>
      )}

      {/* Accesso discreto al pannello interno (in alternativa: URL con #gestione) */}
      <button
        onClick={apriPannello}
        aria-label="Apri il pannello di gestione"
        className="fixed bottom-4 left-4 z-40 p-2.5 rounded-full opacity-40 hover:opacity-100 transition-opacity duration-200"
        style={{ background: '#111111', color: '#ffffff' }}
      >
        <Lock size={16} />
      </button>

      {pannelloAperto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={chiudiPannello}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl p-5 sm:p-7 max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: '0 24px 70px rgba(0,0,0,0.35)' }}
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Settings size={18} color="#111111" />
                <h2 className="text-lg font-semibold" style={{ color: '#111111' }}>
                  Pannello gestione
                </h2>
              </div>
              <button
                onClick={chiudiPannello}
                aria-label="Chiudi il pannello"
                className="p-1.5 rounded-full transition-colors duration-200 hover:bg-black/5"
              >
                <X size={18} color="#444444" />
              </button>
            </div>

            {!sbloccato ? (
              <div className="mt-4">
                <p className="text-sm mb-4" style={{ color: '#555555' }}>
                  Area riservata. Inserisci il PIN per gestire come viene generato il codice.
                </p>
                <label className="block text-xs mb-1.5" style={{ color: '#666666' }}>
                  PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  autoFocus
                  onChange={(evento) => setPin(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') verificaPin();
                  }}
                  className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
                  style={{ border: '1.5px solid #d0d0d0' }}
                  placeholder="••••"
                />
                {erroreGestione && (
                  <p className="mt-2 text-sm" style={{ color: '#b42318' }} role="alert">
                    {erroreGestione}
                  </p>
                )}
                <button
                  onClick={verificaPin}
                  disabled={gestioneInCorso || pin.length === 0}
                  className="mt-4 w-full text-white text-sm px-6 py-2.5 rounded-full transition-all duration-200 hover:opacity-90 disabled:opacity-40"
                  style={STILE_SCURO}
                >
                  {gestioneInCorso ? 'Verifica…' : 'Sblocca'}
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-5">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                  style={{ background: bozza.attivo ? '#eafaf0' : '#f2f2f2' }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#111111' }}>
                      {bozza.attivo ? 'Codice in rilascio' : 'Codice sospeso'}
                    </p>
                    <p className="text-xs" style={{ color: '#666666' }}>
                      {bozza.attivo
                        ? 'Gli utenti che premono “Genera” ricevono il codice.'
                        : 'Nessun codice viene rilasciato finché non lo attivi.'}
                    </p>
                  </div>
                  <button
                    onClick={commutaAttivo}
                    disabled={gestioneInCorso}
                    className="shrink-0 text-sm px-5 py-2.5 rounded-full transition-all duration-200 hover:opacity-90 disabled:opacity-40"
                    style={
                      bozza.attivo
                        ? { border: '1.5px solid #222222', color: '#222222' }
                        : { background: 'linear-gradient(to bottom, #3a3a3a, #111111)', color: '#ffffff' }
                    }
                  >
                    {bozza.attivo ? 'Sospendi' : 'Rilascia ora'}
                  </button>
                </div>

                <div>
                  <p className="text-xs mb-2" style={{ color: '#666666' }}>
                    Modalità del codice
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['automatico', 'fisso'] as ModalitaCodice[]).map((modo) => {
                      const attivo = bozza.modalita === modo;
                      return (
                        <button
                          key={modo}
                          onClick={() => setBozza((precedente) => ({ ...precedente, modalita: modo }))}
                          className="text-sm px-4 py-2.5 rounded-xl transition-colors duration-200"
                          style={
                            attivo
                              ? { background: '#111111', color: '#ffffff', border: '1.5px solid transparent' }
                              : { background: '#ffffff', color: '#333333', border: '1.5px solid #d0d0d0' }
                          }
                        >
                          {modo === 'automatico' ? 'Automatico' : 'Fisso'}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: '#8a8a8a' }}>
                    {bozza.modalita === 'automatico'
                      ? 'Ogni utente riceve un codice casuale diverso.'
                      : 'A tutti gli utenti viene mostrato lo stesso codice fisso.'}
                  </p>
                </div>

                {bozza.modalita === 'automatico' ? (
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: '#666666' }}>
                      Prefisso (opzionale)
                    </label>
                    <input
                      type="text"
                      value={bozza.prefisso}
                      onChange={(evento) =>
                        setBozza((precedente) => ({ ...precedente, prefisso: normalizzaCodice(evento.target.value) }))
                      }
                      className="w-full text-sm px-4 py-2.5 rounded-xl outline-none tracking-widest"
                      style={{ border: '1.5px solid #d0d0d0' }}
                      placeholder="Es. FNVX"
                    />
                    <p className="mt-2 text-xs" style={{ color: '#8a8a8a' }}>
                      Anteprima:{' '}
                      <span className="font-medium" style={{ color: '#333333' }}>
                        {(bozza.prefisso ? bozza.prefisso + '-' : '') + 'AB2C-D34E'}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: '#666666' }}>
                      Codice fisso
                    </label>
                    <input
                      type="text"
                      value={bozza.codiceFisso}
                      onChange={(evento) =>
                        setBozza((precedente) => ({
                          ...precedente,
                          codiceFisso: normalizzaCodice(evento.target.value),
                        }))
                      }
                      className="w-full text-base px-4 py-2.5 rounded-xl outline-none tracking-widest font-semibold"
                      style={{ border: '1.5px solid #d0d0d0', color: '#111111' }}
                      placeholder="ABCD-2345"
                    />
                    <p className="mt-2 text-xs" style={{ color: '#8a8a8a' }}>
                      Solo lettere e numeri; il trattino è ammesso. Caratteri: {contaCaratteri(bozza.codiceFisso)}.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#666666' }}>
                    Validità (ore)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={bozza.oreValidita}
                    onChange={(evento) =>
                      setBozza((precedente) => ({ ...precedente, oreValidita: Number(evento.target.value) }))
                    }
                    className="w-32 text-sm px-4 py-2.5 rounded-xl outline-none"
                    style={{ border: '1.5px solid #d0d0d0' }}
                  />
                </div>

                {erroreGestione && (
                  <p className="text-sm" style={{ color: '#b42318' }} role="alert">
                    {erroreGestione}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={salvaGestione}
                    disabled={gestioneInCorso}
                    className="flex items-center gap-2 text-white text-sm px-6 py-2.5 rounded-full transition-all duration-200 hover:opacity-90 disabled:opacity-40"
                    style={STILE_SCURO}
                  >
                    {salvato ? <Check size={16} /> : null}
                    {salvato ? 'Salvato' : gestioneInCorso ? 'Salvataggio…' : 'Salva impostazioni'}
                  </button>
                  <button
                    onClick={chiudiPannello}
                    className="text-sm px-6 py-2.5 rounded-full transition-colors duration-200 hover:bg-black/5"
                    style={STILE_CHIARO}
                  >
                    Chiudi
                  </button>
                </div>

                <p className="text-xs leading-relaxed pt-1" style={{ color: '#9a9a9a', borderTop: '1px solid #eee' }}>
                  Le impostazioni sono condivise da tutti i visitatori e salvate sul server. Il rilascio del codice
                  dipende dall&apos;interruttore qui sopra.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Pagine di contenuto: Tutorial, Confronta, Soluzioni
// ------------------------------------------------------------------

type PassoTutorial = { titolo: string; testo: string };
type Domanda = { d: string; r: string };

const TUTORIAL_PASSI: PassoTutorial[] = [
  {
    titolo: '1. Inserisci i tuoi dati',
    testo:
      'Compila l’anagrafica dell’intestatario e dell’impresa: nome, contatti, Codice Fiscale, P.IVA, PEC e codice univoco. Bastano pochi minuti.',
  },
  {
    titolo: '2. Allega i documenti',
    testo:
      'Carica la documentazione richiesta, ogni voce nel suo campo dedicato: visura, bilancio, contratti, organigramma e tutto il resto. Formati PDF, JPG o PNG.',
  },
  {
    titolo: '3. Genera il codice',
    testo:
      'Al termine ottieni un codice univoco che identifica la tua pratica e che ti serve per completare la verifica.',
  },
  {
    titolo: '4. Completa e attendi',
    testo:
      'Segui le istruzioni a schermo per confermare l’invio. L’elaborazione della pratica richiede pochi minuti: non chiudere la pagina fino al termine.',
  },
];

const TUTORIAL_FAQ: Domanda[] = [
  { d: 'Quali formati posso caricare?', r: 'PDF, JPG e PNG, fino a 10 MB per ciascun file.' },
  {
    d: 'Serve installare qualcosa?',
    r: 'No: funziona da qualsiasi browser, anche da smartphone o tablet.',
  },
  {
    d: 'Posso correggere i dati dopo averli inseriti?',
    r: 'Sì. Finché non completi l’invio puoi tornare indietro con “Modifica dati” e aggiornare quello che vuoi.',
  },
  {
    d: 'Quanto tempo richiede?',
    r: 'La compilazione richiede pochi minuti; l’elaborazione della pratica dai 5 ai 10 minuti circa.',
  },
];

const CONFRONTO_RIGHE: { voce: string; tradizionale: string; garafacile: string }[] = [
  { voce: 'Tempi di preparazione', tradizionale: 'Ore tra fascicoli e scansioni', garafacile: 'Pochi minuti guidati' },
  { voce: 'Raccolta documenti', tradizionale: 'Cartelle sparse ed email', garafacile: 'Un campo dedicato per ogni documento' },
  { voce: 'Errori e dimenticanze', tradizionale: 'Facile perdere un allegato', garafacile: 'Checklist che ti guida passo passo' },
  { voce: 'Accesso', tradizionale: 'Solo dal computer dell’ufficio', garafacile: 'Da qualsiasi dispositivo, ovunque' },
  { voce: 'Tracciabilità', tradizionale: 'Difficile sapere a che punto sei', garafacile: 'Codice univoco per ogni pratica' },
];

const SOLUZIONI: { titolo: string; testo: string }[] = [
  {
    titolo: 'Imprese e ditte individuali',
    testo:
      'Prepara le buste amministrative per le tue gare senza perdere tempo tra scartoffie e scansioni. Tutto in un unico flusso ordinato.',
  },
  {
    titolo: 'Raggruppamenti (RTI / ATI)',
    testo:
      'Raccogli in un solo posto la documentazione di tutti i partecipanti, con una checklist chiara per non lasciare indietro nulla.',
  },
  {
    titolo: 'Consulenti e studi',
    testo:
      'Gestisci le pratiche dei tuoi clienti in modo ripetibile e professionale, con un percorso identico per ogni gara.',
  },
];

function PaginaContenuto({ pagina, onInizia }: { pagina: Pagina; onInizia: () => void }) {
  return (
    <main className="flex-1 w-full px-4 py-12 sm:py-16 flex justify-center">
      <div className="w-full max-w-3xl">
        {pagina === 'tutorial' && (
          <>
            <h1 className="font-bold mb-3" style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)', lineHeight: 1.1, color: '#111111' }}>
              Come funziona GaraFacile
            </h1>
            <p className="text-sm sm:text-base mb-8 leading-relaxed" style={{ color: '#333333' }}>
              In pochi passaggi prepari e trasmetti la documentazione della tua gara d’appalto.
            </p>
            <div className="flex flex-col gap-3">
              {TUTORIAL_PASSI.map((passo) => (
                <div
                  key={passo.titolo}
                  className="bg-white rounded-2xl px-5 py-4"
                  style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                >
                  <p className="text-sm font-semibold mb-1" style={{ color: '#111111' }}>
                    {passo.titolo}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: '#444444' }}>
                    {passo.testo}
                  </p>
                </div>
              ))}
            </div>

            <h2 className="font-bold mt-10 mb-3" style={{ fontSize: '1.25rem', color: '#111111' }}>
              Domande frequenti
            </h2>
            <div className="flex flex-col gap-3">
              {TUTORIAL_FAQ.map((faq) => (
                <div key={faq.d} className="rounded-2xl px-5 py-4" style={{ background: '#f2f2f2' }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#111111' }}>
                    {faq.d}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: '#444444' }}>
                    {faq.r}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {pagina === 'confronta' && (
          <>
            <h1 className="font-bold mb-3" style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)', lineHeight: 1.1, color: '#111111' }}>
              Perché scegliere GaraFacile
            </h1>
            <p className="text-sm sm:text-base mb-8 leading-relaxed" style={{ color: '#333333' }}>
              Il modo tradizionale di gestire le buste amministrative a confronto con GaraFacile.
            </p>

            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
              <div className="grid grid-cols-3 text-xs sm:text-sm font-semibold" style={{ background: '#111111', color: '#ffffff' }}>
                <div className="px-4 py-3" />
                <div className="px-4 py-3 text-center">Metodo tradizionale</div>
                <div className="px-4 py-3 text-center">GaraFacile</div>
              </div>
              {CONFRONTO_RIGHE.map((riga, i) => (
                <div
                  key={riga.voce}
                  className="grid grid-cols-3 text-xs sm:text-sm items-center"
                  style={{ background: i % 2 === 0 ? '#ffffff' : '#f6f6f6' }}
                >
                  <div className="px-4 py-3 font-medium" style={{ color: '#111111' }}>
                    {riga.voce}
                  </div>
                  <div className="px-4 py-3 text-center" style={{ color: '#888888' }}>
                    {riga.tradizionale}
                  </div>
                  <div className="px-4 py-3 text-center font-medium" style={{ color: '#15803d' }}>
                    {riga.garafacile}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {pagina === 'soluzioni' && (
          <>
            <h1 className="font-bold mb-3" style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)', lineHeight: 1.1, color: '#111111' }}>
              Soluzioni per ogni esigenza
            </h1>
            <p className="text-sm sm:text-base mb-8 leading-relaxed" style={{ color: '#333333' }}>
              GaraFacile si adatta a chi partecipa alle gare in prima persona e a chi le gestisce per altri.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SOLUZIONI.map((s) => (
                <div
                  key={s.titolo}
                  className="bg-white rounded-2xl px-5 py-5"
                  style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                >
                  <p className="text-sm font-semibold mb-2" style={{ color: '#111111' }}>
                    {s.titolo}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: '#444444' }}>
                    {s.testo}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-10">
          <button
            onClick={onInizia}
            className="text-center text-white text-sm px-7 py-3 rounded-full transition-all duration-200 hover:opacity-90 shadow-lg"
            style={STILE_SCURO}
          >
            Inizia ora
          </button>
        </div>
      </div>
    </main>
  );
}
