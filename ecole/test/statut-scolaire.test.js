'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { statutScolaireValide, statutAnneeSuivante } = require('../server/statut-scolaire');

test('Statut scolaire : féminin accepté, historique inconnu conservé, états administratifs exclus', () => {
  for (const [saisie, code] of [
    ['Nouveau', 'nouveau'], ['nouvelle', 'nouveau'],
    ['Doublante', 'doublant'], ['triplant', 'triplant'], ['quatriplante', 'quatriplant']
  ]) assert.equal(statutScolaireValide(saisie), code);
  assert.equal(statutScolaireValide(''), null);
  assert.equal(statutScolaireValide(null), null);
  assert.equal(statutScolaireValide(undefined), null);
  assert.equal(statutScolaireValide(undefined, 'doublant'), 'doublant');
  for (const valeur of ['actif', 'inactif', 'ancien', '__proto__', {}, 2])
    assert.throws(() => statutScolaireValide(valeur), /Statut scolaire/);
});

test('Nouvelle année : progression jusqu’à quatriplant (ou plus), remise à nouveau après changement de niveau', () => {
  assert.deepEqual(['nouveau', 'doublant', 'triplant', 'quatriplant', null]
    .map(v => statutAnneeSuivante(v, true)),
  ['doublant', 'triplant', 'quatriplant', 'quatriplant', null]);
  assert.equal(statutAnneeSuivante('triplant', false), 'nouveau');
  assert.equal(statutAnneeSuivante(null, false), 'nouveau');
  assert.equal(statutAnneeSuivante('__proto__', true), null);
});
