'use strict';
/**
 * Module de paiement — Mobile Money Togo (Mixx by Yas, Moov Money) + CinetPay.
 *
 * Le nouveau parcours est manuel : Mixx/Moov, capture ou référence + téléphone,
 * puis contrôle humain du relevé et autorisation du reçu par l'éditeur.
 * Les fonctions CinetPay/PayDunya sont conservées pour les webhooks de paiements
 * historiques déjà initiés ; aucun nouveau lien n'est créé.
 */
const crypto = require('node:crypto');

const OPERATEURS = {
  mixx: {
    code: 'mixx',
    nom: 'Mixx by Yas',
    ancien: 'ex T-Money · Yas Togo',
    reseau: 'Yas (Togocom)',
    prefixe: '+228 9',
    ussd_menu: '*145#',
    ussd_paiement: '*145*5#',
    couleur: '#e4022d',
    logo: 'mixx',
    comment_payer: 'Composez <b>*145*5#</b> (Paiement marchand), saisissez le numéro marchand puis le montant, et validez avec votre code secret Mixx. Vous pouvez aussi utiliser l’application Mixx by Yas.',
    cinetpay_code: 'TMOBILE'
  },
  moov: {
    code: 'moov',
    nom: 'Moov Money',
    ancien: 'Flooz · Moov Africa',
    reseau: 'Moov Africa Togo',
    prefixe: '+228 9',
    ussd_menu: '*155#',
    ussd_paiement: '*155*2*2#',
    couleur: '#005baa',
    logo: 'moov',
    comment_payer: 'Composez <b>*155#</b> puis choisissez l’option <b>2 (Paiement marchand)</b>, saisissez le numéro marchand et le montant, puis validez avec votre code Flooz. Vous pouvez aussi composer directement <b>*155*2*2*numéro marchand*montant*code secret#</b>.',
    cinetpay_code: 'FLOOZ'
  }
};

const PLANS = {
  // Forfaits historiques : leurs reçus et activations déjà enregistrés restent lisibles.
  essentiel: { code: 'essentiel', nom: 'Essentiel', cle_prix: 'prix_essentiel', defaut: 15000 },
  standard: { code: 'standard', nom: 'Standard', cle_prix: 'prix_standard', defaut: 25000 },
  reseau: { code: 'reseau', nom: 'Réseau', cle_prix: null, defaut: null },
  effectif: { code: 'effectif', nom: 'Abonnement mensuel selon l’effectif', cle_prix: null, defaut: null }
};

// Historique uniquement : l'API des nouveaux paiements expose exclusivement un mois.
const DUREES = [
  { mois: 1, libelle: '1 mois', remise: 0 },
  { mois: 3, libelle: '3 mois', remise: 0 },
  { mois: 12, libelle: '12 mois', remise: 2 }
];

function lireReglages(db) {
  const out = {};
  db.prepare('SELECT cle, valeur FROM reglages').all().forEach(r => { out[r.cle] = r.valeur; });
  return out;
}

function ecrireReglages(db, valeurs) {
  const stmt = db.prepare(`INSERT INTO reglages (cle, valeur) VALUES (?,?)
    ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`);
  Object.entries(valeurs).forEach(([k, v]) => {
    if (v !== undefined && v !== null) stmt.run(k, String(v));
  });
}

function prixMensuel(reglages, plan) {
  const p = PLANS[plan];
  if (!p) return null;
  if (!p.cle_prix) return null; // le tarif « effectif » dépend de l'école, pas d'un prix libre
  const v = Number(reglages[p.cle_prix]);
  return Number.isFinite(v) && v > 0 ? v : p.defaut;
}

/** Montant à payer pour un plan et une durée. Le 12 mois facture 10 mois. */
function montantPour(reglages, plan, mois) {
  const mensuel = prixMensuel(reglages, plan);
  if (mensuel == null) return null;
  const d = DUREES.find(x => x.mois === Number(mois)) || DUREES[0];
  return Math.max(0, (d.mois - d.remise) * mensuel);
}

function cinetpayConfig(reglages) {
  const apikey = process.env.CINETPAY_APIKEY || reglages.cinetpay_apikey || '';
  const siteId = process.env.CINETPAY_SITE_ID || reglages.cinetpay_site_id || '';
  return {
    actif: !!(apikey && siteId),
    apikey,
    siteId,
    mode: process.env.CINETPAY_MODE || reglages.cinetpay_mode || 'test',
    base: process.env.CINETPAY_BASE || 'https://api-checkout.cinetpay.com/v2'
  };
}

function paydunyaConfig(reglages) {
  const master = process.env.PAYDUNYA_MASTER_KEY || reglages.paydunya_master_key || '';
  const priv = process.env.PAYDUNYA_PRIVATE_KEY || reglages.paydunya_private_key || '';
  const token = process.env.PAYDUNYA_TOKEN || reglages.paydunya_token || '';
  const mode = (process.env.PAYDUNYA_MODE || reglages.paydunya_mode || 'test') === 'live' ? 'live' : 'test';
  return {
    actif: !!(master && priv && token),
    master, priv, token, mode,
    base: process.env.PAYDUNYA_BASE
      || (mode === 'live' ? 'https://app.paydunya.com/api/v1' : 'https://app.paydunya.com/sandbox-api/v1'),
    checkout: mode === 'live' ? 'https://app.paydunya.com/checkout/invoice/' : 'https://app.paydunya.com/sandbox-checkout/invoice/'
  };
}

/** Passerelles de paiement en ligne réellement utilisables. */
function passerelles(reglages) {
  const cp = cinetpayConfig(reglages);
  const pd = paydunyaConfig(reglages);
  return [
    { code: 'cinetpay', nom: 'CinetPay', actif: cp.actif, mode: cp.mode,
      description: 'Mobile Money & carte bancaire · confirmation automatique' },
    { code: 'paydunya', nom: 'PayDunya', actif: pd.actif, mode: pd.mode,
      description: 'T-Money (Mixx), Flooz (Moov), cartes · confirmation automatique' }
  ];
}

const OPERATEURS_PAYDUNYA = { mixx: 't-money-togo', moov: 'moov-togo' };

/**
 * Crée une facture PayDunya (redirection checkout).
 * @returns {{url:string, token:string}}
 */
async function initierPaydunya(cfg, { montant, description, ecole, telephone, email, nom, baseUrl, operateur }) {
  if (!cfg.actif) throw new Error('PayDunya n’est pas configuré sur cette plateforme');
  const payload = {
    invoice: {
      total_amount: Math.round(montant),
      description: String(description).slice(0, 190)
    },
    store: { name: (nom || ecole.nom || 'Terminish École').slice(0, 30) },
    custom_data: { ecole_id: ecole.id, ecole: ecole.nom },
    actions: {
      cancel_url: `${baseUrl}/app#/abonnement`,
      return_url: `${baseUrl}/app#/abonnement`,
      callback_url: `${baseUrl}/api/webhooks/paydunya`
    }
  };
  if (email) payload.invoice.customer = { name: nom || ecole.nom, email, phone: telephone || '' };
  else if (telephone) payload.invoice.customer = { name: nom || ecole.nom, phone: telephone };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  let json;
  try {
    const res = await fetch(`${cfg.base}/checkout-invoice/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'PAYDUNYA-MASTER-KEY': cfg.master,
        'PAYDUNYA-PRIVATE-KEY': cfg.priv,
        'PAYDUNYA-TOKEN': cfg.token
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    json = await res.json();
  } catch {
    throw new Error('Impossible de joindre PayDunya (vérifiez la connexion du serveur). Utilisez le paiement Mobile Money manuel.');
  } finally {
    clearTimeout(t);
  }
  if (!json || String(json.response_code) !== '00' || !json.token) {
    throw new Error(json && (json.response_text || json.description) || 'PayDunya a refusé la création de la facture');
  }
  const url = typeof json.response_text === 'string' && /^https:\/\//.test(json.response_text)
    ? json.response_text
    : cfg.checkout + json.token;
  return { url, token: json.token };
}

/** Vérifie une facture PayDunya (source de vérité). */
async function verifierPaydunya(cfg, token) {
  if (!cfg.actif) throw new Error('PayDunya non configuré');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${cfg.base}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
      headers: {
        Accept: 'application/json',
        'PAYDUNYA-MASTER-KEY': cfg.master,
        'PAYDUNYA-PRIVATE-KEY': cfg.priv,
        'PAYDUNYA-TOKEN': cfg.token
      },
      signal: ctrl.signal
    });
    const json = await res.json();
    const inv = (json && json.invoice) || {};
    const brut = JSON.stringify(json).toLowerCase();
    const operateur = brut.includes('t-money') || brut.includes('tmoney') ? 'mixx'
      : brut.includes('moov') || brut.includes('flooz') ? 'moov' : '';
    return {
      statut: (json && json.status) || 'unknown',
      montant: inv.total_amount != null ? Number(inv.total_amount) : null,
      moyen: (json && json.payment_method) || '',
      operateur,
      recu: (json && json.receipt_url) || inv.receipt_url || '',
      brut: json
    };
  } finally {
    clearTimeout(t);
  }
}

function referencePaiement(operateur) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const alea = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${String(operateur || 'PAY').toUpperCase()}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${alea}`;
}

/**
 * Initialise un paiement CinetPay (paiement en ligne, USSD push ou carte).
 * Retourne { url } ou lève une erreur explicite.
 */
async function initierCinetPay(cfg, { montant, devise, transactionId, description, ecole, telephone, email, nom, baseUrl }) {
  if (!cfg.actif) throw new Error('CinetPay n’est pas configuré sur cette plateforme');
  const body = {
    apikey: cfg.apikey,
    site_id: cfg.siteId,
    transaction_id: transactionId,
    amount: Math.round(montant),
    currency: devise === 'FCFA' ? 'XOF' : devise,
    description: String(description).slice(0, 100),
    notify_url: `${baseUrl}/api/webhooks/cinetpay`,
    return_url: `${baseUrl}/app#/abonnement?paiement=${encodeURIComponent(transactionId)}`,
    channels: 'MOBILE_MONEY',
    lang: 'fr',
    metadata: JSON.stringify({ ecole_id: ecole.id, ecole: ecole.nom }),
    customer_name: nom || ecole.nom,
    customer_email: email || ecole.email || 'contact@terminish-ecole.com',
    customer_phone_number: telephone || ecole.telephone || '',
    customer_address: ecole.adresse || '',
    customer_city: ecole.ville || 'Lomé',
    customer_country: 'TG'
  };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  let json;
  try {
    const res = await fetch(`${cfg.base}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    json = await res.json();
  } catch (e) {
    throw new Error('Impossible de joindre CinetPay (vérifiez la connexion du serveur). Utilisez le paiement Mobile Money manuel.');
  } finally {
    clearTimeout(t);
  }
  if (!json || String(json.code) !== '201' || !json.data || !json.data.payment_url) {
    throw new Error((json && (json.message || json.description)) || 'CinetPay a refusé la demande de paiement');
  }
  return { url: json.data.payment_url, token: json.data.payment_token };
}

/** Vérifie l'état réel d'une transaction auprès de CinetPay (source de vérité). */
async function verifierCinetPay(cfg, transactionId) {
  if (!cfg.actif) throw new Error('CinetPay non configuré');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${cfg.base}/payment/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ apikey: cfg.apikey, site_id: cfg.siteId, transaction_id: transactionId }),
      signal: ctrl.signal
    });
    const json = await res.json();
    const d = (json && json.data) || {};
    return {
      statut: d.status || (json && json.code === '00' ? 'ACCEPTED' : 'UNKNOWN'),
      montant: d.amount != null ? Number(d.amount) : null,
      moyen: d.payment_method || '',
      operateur: d.operator_id || '',
      brut: json
    };
  } finally {
    clearTimeout(t);
  }
}

module.exports = {
  OPERATEURS, PLANS, DUREES, OPERATEURS_PAYDUNYA,
  lireReglages, ecrireReglages, prixMensuel, montantPour,
  cinetpayConfig, initierCinetPay, verifierCinetPay,
  paydunyaConfig, initierPaydunya, verifierPaydunya, passerelles,
  referencePaiement
};
