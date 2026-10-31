'use strict';
/** Tarifs mensuels demandés par l'éditeur, calculés CÔTÉ SERVEUR. */
const TARIFS = Object.freeze([
  { maximum: 299, code: 'moins_300', libelle: 'Moins de 300 élèves', montant: 7500 },
  { maximum: 999, code: '300_999', libelle: 'De 300 à 999 élèves', montant: 15000 },
  { maximum: Infinity, code: '1000_plus', libelle: '1 000 élèves et plus', montant: 20000 }
]);

function tarifPourEffectif(effectif) {
  if (!Number.isSafeInteger(effectif) || effectif < 0) throw new Error('Effectif invalide');
  const tranche = TARIFS.find(t => effectif <= t.maximum);
  return { effectif, code: tranche.code, libelle: tranche.libelle, montant: tranche.montant, mois: 1 };
}

function tarifPourEcole(db, ecoleId) {
  const effectif = db.prepare("SELECT COUNT(*) AS n FROM eleves WHERE ecole_id = ? AND statut = 'actif'")
    .get(ecoleId).n;
  return tarifPourEffectif(effectif);
}

function verifierDemandeMensuelle(corps = {}) {
  // Les anciens écrans proposent encore des forfaits de 3 et 12 mois : ne
  // jamais les accepter silencieusement au nouveau prix d'un mois.
  if (corps.mois !== undefined && Number(corps.mois) !== 1) {
    const e = new Error('Un paiement couvre désormais un mois seulement. Rechargez la page Abonnement.');
    e.status = 400; throw e;
  }
  if (corps.plan !== undefined && corps.plan !== 'effectif') {
    const e = new Error('Les anciens forfaits ont changé. Rechargez la page Abonnement pour voir le tarif lié à l’effectif.');
    e.status = 400; throw e;
  }
}

module.exports = { TARIFS, tarifPourEffectif, tarifPourEcole, verifierDemandeMensuelle };
