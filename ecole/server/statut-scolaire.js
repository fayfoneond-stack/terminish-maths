'use strict';
/**
 * Situation de l'élève dans son niveau cette année : indépendante de son
 * arrivée dans l'établissement et de l'archivage actif/inactif.
 * NULL signifie que l'historique antérieur n'est pas connu (« À préciser »).
 */
const VALEURS = Object.freeze({
  nouveau: 'nouveau', nouvelle: 'nouveau',
  doublant: 'doublant', doublante: 'doublant',
  triplant: 'triplant', triplante: 'triplant',
  quatriplant: 'quatriplant', quatriplante: 'quatriplant'
});
const SUIVANT = Object.freeze({
  nouveau: 'doublant', doublant: 'triplant', triplant: 'quatriplant',
  // Au-delà de la quatrième année, ne pas prétendre qu'il est à nouveau « nouveau ».
  quatriplant: 'quatriplant'
});
function statutScolaireValide(valeur, defaut = null) {
  if (valeur === undefined) return defaut;
  if (valeur === '' || valeur === null) return null;
  const cle = typeof valeur === 'string' ? valeur.trim().toLowerCase() : '';
  if (Object.hasOwn(VALEURS, cle)) return VALEURS[cle];
  const e = new Error('Statut scolaire : choisissez Nouveau, Doublant, Triplant, Quatriplant ou À préciser.');
  e.status = 400;
  throw e;
}
function statutAnneeSuivante(actuel, memeNiveau) {
  if (!memeNiveau) return 'nouveau'; // premier passage dans un autre niveau
  return Object.hasOwn(SUIVANT, actuel) ? SUIVANT[actuel] : null;
  // Historique inconnu : ne pas inventer le nombre de répétitions.
}
module.exports = { statutScolaireValide, statutAnneeSuivante };
