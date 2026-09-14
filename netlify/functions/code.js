import { getStore } from '@netlify/blobs';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CONFIG_DEFAULT = {
  modalita: 'fisso',
  codiceFisso: 'ABCD-2345',
  prefisso: '',
  oreValidita: 24,
  attivo: false,
};

function blocco() {
  let out = '';
  for (let i = 0; i < 4; i += 1) out += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return out;
}

function generaAutomatico(prefisso) {
  const base = `${blocco()}-${blocco()}`;
  return prefisso ? `${prefisso}-${base}` : base;
}

async function leggiConfig(store) {
  const salvata = await store.get('config', { type: 'json' });
  return { ...CONFIG_DEFAULT, ...(salvata || {}) };
}

export default async (req) => {
  const store = getStore('fenvex-codice');
  const config = await leggiConfig(store);

  // POST = "Genera il codice" lato utente. Il codice esce solo se attivato dall'operatore.
  if (req.method === 'POST') {
    if (!config.attivo) {
      return Response.json({
        pronto: false,
        messaggio: 'Il codice non è ancora disponibile. Riprova tra poco.',
      });
    }
    const codice =
      config.modalita === 'automatico' ? generaAutomatico(config.prefisso) : config.codiceFisso;
    return Response.json({ pronto: true, codice, oreValidita: config.oreValidita });
  }

  // GET = stato pubblico, senza mai rivelare il codice.
  return Response.json({ attivo: config.attivo, oreValidita: config.oreValidita });
};
