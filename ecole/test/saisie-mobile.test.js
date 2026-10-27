'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Le même calcul est exécuté dans le navigateur Android et sur ordinateur.
// Le charger tel quel, sans bibliothèque DOM ni dépendance de navigateur.
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/util.js'), 'utf8'), sandbox);
const { moyenneCalc, noteValide } = sandbox.window;

test('moyenne en direct : les absences gardent leur place et la formule de la classe est respectée', () => {
  assert.equal(moyenneCalc(['', '', '12,5']), 12.5, 'composition seule, pas un devoir');
  assert.equal(moyenneCalc([null, '8', '14']), 12, 'devoir 1 absent, devoir 2 et composition');
  assert.equal(moyenneCalc(['10', null, '20']), 50 / 3, 'devoir 2 absent, pondération de la composition');
  assert.equal(moyenneCalc([null, '8', '14'], 'moy_co'), 11, 'formule alternative');
  assert.equal(moyenneCalc(['', '', '12,5'], 'moy_co'), 12.5);
  assert.equal(moyenneCalc(['10', '14', '18'], 'tiers'), 15, 'formule tiers de la classe');
  assert.equal(moyenneCalc(['', '', '']), null);
  assert.equal(moyenneCalc(['8', '12', '']), 10);
  assert.equal(moyenneCalc(['', '12', null]), 12);
});

test('saisie numérique Android : 0–20, virgule acceptée, aucune note invalide envoyée', () => {
  for (const note of ['', ' ', '0', '20', '12,5', '9.75', '20,00', '01']) {
    assert.equal(noteValide(note), true, String(note));
  }
  for (const note of ['-1', '20,01', '22', 'NaN', '1e1', 'Infinity', '12,5,8', 'abc', '12.', '0x10']) {
    assert.equal(noteValide(note), false, note);
  }
});
