'use strict';
/** Arrivée dans cet établissement, indépendante de l'archivage actif/inactif. */
function ancienneteValide(valeur, defaut = null) {
  if (valeur === undefined) return defaut;
  if (valeur === '' || valeur === null) return null; // « À préciser »
  if (valeur === 'nouveau' || valeur === 'ancien') return valeur;
  const e = new Error('Arrivée dans l’établissement : choisissez Nouveau, Ancien ou À préciser.');
  e.status = 400;
  throw e;
}

module.exports = { ancienneteValide };
