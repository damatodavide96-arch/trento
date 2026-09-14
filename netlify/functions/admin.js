import { getStore } from '@netlify/blobs';

const CONFIG_DEFAULT = {
  modalita: 'fisso',
  codiceFisso: 'ABCD-2345',
  prefisso: '',
  oreValidita: 24,
  attivo: false,
};

function autorizzato(req) {
  const pin = req.headers.get('x-admin-pin');
  return Boolean(pin) && Boolean(process.env.ADMIN_PIN) && pin === process.env.ADMIN_PIN;
}

function normalizzaCodice(grezzo) {
  return String(grezzo || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
}

function normalizzaConfig(dati) {
  const modalita = dati.modalita === 'automatico' ? 'automatico' : 'fisso';
  const ore = Math.min(720, Math.max(1, Math.round(Number(dati.oreValidita) || 24)));
  return {
    modalita,
    prefisso: normalizzaCodice(dati.prefisso),
    codiceFisso: normalizzaCodice(dati.codiceFisso) || CONFIG_DEFAULT.codiceFisso,
    oreValidita: ore,
    attivo: Boolean(dati.attivo),
  };
}

async function leggiConfig(store) {
  const salvata = await store.get('config', { type: 'json' });
  return { ...CONFIG_DEFAULT, ...(salvata || {}) };
}

export default async (req) => {
  if (!autorizzato(req)) {
    return new Response(JSON.stringify({ errore: 'Non autorizzato' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const store = getStore('fenvex-codice');

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const attuale = await leggiConfig(store);
    const nuova = normalizzaConfig({ ...attuale, ...(body.config || {}) });
    await store.setJSON('config', nuova);
    return Response.json({ ok: true, config: nuova });
  }

  const config = await leggiConfig(store);
  return Response.json({ config });
};
