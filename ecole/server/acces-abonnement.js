'use strict';
/**
 * Une école suspendue conserve ses lectures et ses téléchargements. Les seules
 * écritures permises sont la sécurité de sa propre session et le règlement
 * d'un abonnement ; l'aperçu de passage est un calcul sans écriture (POST pour
 * envoyer les choix de classes). Tout nouvel endpoint d'écriture est refusé
 * par défaut tant qu'il n'est pas explicitement audité ici.
 */
const EXCEPTIONS_POST = new Set([
  '/api/auth/logout',
  '/api/auth/password',
  '/api/passages/apercu',
  '/api/paiement/declarer',
  '/api/paiement/cinetpay/initier',
  '/api/paiement/paydunya/initier'
]);

function autoriseEnSuspension(methode, chemin) {
  if (methode === 'GET' || methode === 'HEAD') return true;
  return methode === 'POST' && EXCEPTIONS_POST.has(chemin);
}

module.exports = { autoriseEnSuspension };
