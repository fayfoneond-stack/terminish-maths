'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBulletin, renderBulletinBatch } = require('../server/print');

// Trois colonnes affichées ; les clés historiques de la base ne bougent pas.
function exemple(mode) {
  const eleve = { id: 1, nom: 'KOUASSI', prenom: 'Exemple', matricule: 'A1', sexe: 'F' };
  const ligne = { eleve, rang: 1, mention: 'Bien', moyenne: 12.67, moyenne_composition: 14,
    total_coef: 1, total_points: 12.67,
    lignes: [{ id: 1, matiere_id: 1, nom: 'Mathématiques', coefficient: 1,
      detail: { devoir1: 8, devoir2: 11, composition: 14 },
      moyenne: 12.67, points: 12.67, rang: 1, appreciation: 'Bien' }] };
  const periode = { libelle: '1er Trimestre', annee_scolaire: '2026-2027' };
  return {
    promo: { etablissement: { nom: 'École fictive', annee_scolaire: '2026-2027' },
      classe: { nom: '4ème A', cycle: 'college' }, periode,
      scope: mode ? { mode } : {}, resultats: [ligne],
      stats: { effectif_classe: 1, moyenne: 12.67, max: 12.67, min: 12.67,
        taux_reussite: 100, mediane: 12.67, ecart_type: 0 } },
    ligne, eleve, bulletin: {}, professeurs: {}, principal: null, chef: null
  };
}

test('Bulletin complet : note de classe, devoir, composition dans cet ordre, sans modifier les valeurs', () => {
  const bulletin = exemple();
  const html = renderBulletin(bulletin);
  assert.match(html, /<th>Note de classe<\/th><th>Devoir<\/th>\s*<th>Composition<\/th>/);
  assert.match(html, /<td class="mat">Mathématiques<\/td>\s*<td class="moy bad">8,00<\/td>\s*<td class="moy warn">11,00<\/td>\s*<td class="moy ok">14,00<\/td>/);
  assert.doesNotMatch(html, /<th>Devoir [12]<\/th>/);
  assert.deepEqual(bulletin.ligne.lignes[0].detail,
    { devoir1: 8, devoir2: 11, composition: 14 }, 'aucune note ni clé historique modifiée');

  const lot = renderBulletinBatch([bulletin, bulletin], bulletin.promo.periode);
  assert.equal((lot.match(/<th>Note de classe<\/th><th>Devoir<\/th>/g) || []).length, 2);
});

test('Bulletin de composition seule : pas de note de classe ni de devoir', () => {
  const html = renderBulletin(exemple('composition'));
  assert.match(html, /<th>Composition<\/th>/);
  assert.doesNotMatch(html, /<th>Note de classe<\/th>|<th>Devoir<\/th>/);
  assert.match(html, /<td class="mat">Mathématiques<\/td>\s*<td class="moy ok">14,00<\/td>/);
});
