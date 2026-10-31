'use strict';
/**
 * Alerte facultative via l'API OFFICIELLE WhatsApp Business Cloud.
 * Un modèle de message approuvé et l'accord du destinataire sont nécessaires.
 * Rien n'est envoyé sans configuration ; l'échec n'active jamais un paiement.
 */
const MESSAGE_MODELE = 'terminish_paiement';

function configuration(env = process.env) {
  const id = String(env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const token = String(env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const destinataire = String(env.WHATSAPP_ADMIN_DESTINATION || '').replace(/\D/g, '');
  const modele = String(env.WHATSAPP_TEMPLATE_NAME || MESSAGE_MODELE).trim();
  const langue = String(env.WHATSAPP_TEMPLATE_LANG || 'fr').trim();
  const version = String(env.WHATSAPP_GRAPH_VERSION || 'v23.0').trim();
  if (!/^\d{5,30}$/.test(id) || token.length < 20 || token.length > 2000 ||
      !/^\d{10,15}$/.test(destinataire) || !/^[a-z][a-z0-9_]{1,99}$/.test(modele) ||
      !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(langue) || !/^v\d{1,2}\.\d{1,2}$/.test(version)) {
    return { actif: false };
  }
  return { actif: true, id, token, destinataire, modele, langue, version };
}

function details(paiement) {
  return [
    String(paiement.ecole_nom || 'Établissement').slice(0, 70),
    `${Number(paiement.montant).toLocaleString('fr-FR')} F CFA`,
    String(paiement.telephone_payeur || 'non précisé').slice(0, 30),
    `${paiement.operateur === 'moov' ? 'Moov Money' : 'Mixx by Yas'} : ${String(paiement.transaction_ref || 'à lire sur la capture').slice(0, 60)}`,
    String(paiement.reference || '').slice(0, 60),
    String(paiement.effectif_facture ?? 'non connu')
  ];
}

async function envoyer(config, paiement, fetchImpl = globalThis.fetch) {
  if (!config.actif) return { statut: 'non_configure' };
  const params = details(paiement).map(text => ({ type: 'text', text }));
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetchImpl(`https://graph.facebook.com/${config.version}/${config.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: config.destinataire,
        type: 'template', template: { name: config.modele, language: { code: config.langue },
          components: [{ type: 'body', parameters: params }] } }),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`WhatsApp HTTP ${res.status}`);
    const json = await res.json();
    if (!json.messages?.[0]?.id) throw new Error('WhatsApp n’a pas retourné de confirmation');
    return { statut: 'envoye' };
  } finally { clearTimeout(timeout); }
}

async function notifierPaiement(db, id, fetchImpl = globalThis.fetch, env = process.env) {
  const paiement = db.prepare(`SELECT p.*, e.nom AS ecole_nom FROM paiements p
    JOIN etablissements e ON e.id = p.ecole_id WHERE p.id = ?`).get(id);
  if (!paiement || paiement.canal !== 'manuel' || paiement.statut !== 'en_attente') {
    const e = new Error('Seule une déclaration Mobile Money en attente peut être signalée.');
    e.status = 409; throw e;
  }
  if (paiement.notification_whatsapp === 'envoye') return { statut: 'envoye', deja: true };
  const cfg = configuration(env);
  if (!cfg.actif) {
    db.prepare("UPDATE paiements SET notification_whatsapp = 'non_configure' WHERE id = ?").run(id);
    return { statut: 'non_configure' };
  }
  // Pas de doublon si deux boutons sont pressés pendant l'appel réseau.
  if (paiement.notification_whatsapp === 'en_cours' &&
      Date.now() - Date.parse(paiement.notification_le || '') < 60000) {
    return { statut: 'en_cours' };
  }
  // Prise atomique du dossier, y compris si plusieurs processus reçoivent la requête.
  const pris = db.prepare(`UPDATE paiements SET notification_whatsapp = 'en_cours', notification_le = ?
    WHERE id = ? AND statut = 'en_attente' AND notification_whatsapp IS ? AND notification_le IS ?`)
    .run(new Date().toISOString(), id, paiement.notification_whatsapp, paiement.notification_le);
  if (!pris.changes) return { statut: 'en_cours' };
  try {
    const resultat = await envoyer(cfg, paiement, fetchImpl);
    db.prepare('UPDATE paiements SET notification_whatsapp = ?, notification_le = ? WHERE id = ?')
      .run(resultat.statut, new Date().toISOString(), id);
    return resultat;
  } catch (e) {
    console.warn(`Alerte WhatsApp du paiement ${id} non envoyée : ${e.message}`);
    db.prepare("UPDATE paiements SET notification_whatsapp = 'echec', notification_le = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
    return { statut: 'echec' };
  }
}

module.exports = { MESSAGE_MODELE, configuration, details, envoyer, notifierPaiement };
