'use strict';
/* Exécuter depuis ecole/ : node --test test/fusion-pdf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { computeFusion } = require('../server/stats');
const { genererFusionPDF } = require('../server/fusion-pdf');

function jeuEssai() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE etablissements (id INTEGER PRIMARY KEY, nom TEXT, ville TEXT, annee_scolaire TEXT,
      chef_nom TEXT, chef_titre TEXT, logo TEXT, formule_moyenne TEXT);
    CREATE TABLE classes (id INTEGER PRIMARY KEY, ecole_id INTEGER, nom TEXT, niveau TEXT, cycle TEXT);
    CREATE TABLE matieres (id INTEGER PRIMARY KEY, nom TEXT, nom_college TEXT, code TEXT, groupe TEXT);
    CREATE TABLE classe_matieres (classe_id INTEGER, matiere_id INTEGER, coefficient REAL);
    CREATE TABLE eleves (id INTEGER PRIMARY KEY, classe_id INTEGER, matricule TEXT, nom TEXT, prenom TEXT,
      sexe TEXT, date_naissance TEXT, lieu_naissance TEXT, tuteur_nom TEXT, tuteur_tel TEXT, statut TEXT);
    CREATE TABLE periodes (id INTEGER PRIMARY KEY, libelle TEXT);
    CREATE TABLE examens (id INTEGER PRIMARY KEY, nom TEXT);
    CREATE TABLE epreuves (id INTEGER PRIMARY KEY, examen_id INTEGER, coefficient REAL, bareme REAL);
    CREATE TABLE evaluations (id INTEGER PRIMARY KEY, ecole_id INTEGER, classe_id INTEGER, matiere_id INTEGER,
      periode_id INTEGER, epreuve_id INTEGER, type TEXT, bareme REAL);
    CREATE TABLE notes (evaluation_id INTEGER, eleve_id INTEGER, valeur REAL, absent INTEGER);
    INSERT INTO etablissements VALUES (1,'École test','Lomé','2026-2027','Chef Essai','Le chef',NULL,'co2');
    INSERT INTO periodes VALUES (1,'1er Trimestre');
    INSERT INTO examens VALUES (1,'BEPC blanc programmé');
    INSERT INTO matieres VALUES (1,'Mathématiques',NULL,'MATH','Scientifique');
    INSERT INTO classes VALUES (1,1,'6ème A','6ème','college'), (2,1,'6ème B','6ème','college'),
      (3,1,'6ème C','6ème','college');
    INSERT INTO classe_matieres VALUES (1,1,4), (2,1,4), (3,1,4);
    INSERT INTO eleves VALUES
      (1,1,'A01','KOUASSI','Elom','M',NULL,NULL,NULL,NULL,'actif'),
      (2,2,'B01','ADJOVI','Ama','F',NULL,NULL,NULL,NULL,'actif'),
      (3,3,'C01','DOSSEH','Kofi','M',NULL,NULL,NULL,NULL,'actif'),
      (4,3,'C02','KODJO','Non noté','M',NULL,NULL,NULL,NULL,'actif');
    INSERT INTO evaluations VALUES
      (1,1,1,1,1,NULL,'devoir1',20), (2,1,1,1,1,NULL,'composition',20),
      (3,1,2,1,1,NULL,'devoir1',20), (4,1,2,1,1,NULL,'composition',20),
      (5,1,3,1,1,NULL,'devoir1',20), (6,1,3,1,1,NULL,'composition',20),
      (7,1,1,1,NULL,1,'blanc',20), (8,1,2,1,NULL,2,'blanc',20),
      (9,1,3,1,NULL,3,'blanc',20);
    INSERT INTO epreuves VALUES (1,1,1,20), (2,1,1,20), (3,1,1,20);
    INSERT INTO notes VALUES (1,1,2,0),(2,1,18,0),(3,2,19,0),(4,2,1,0),
      (5,3,20,0),(6,3,10,0), (7,1,12,0),(8,2,9,0),(9,3,17,0);
  `);
  return db;
}

test('compositions seules : rangs recalculés sans les devoirs, non notés distingués', () => {
  const db = jeuEssai();
  try {
    const d = computeFusion(db, 1, { classe_ids: [1, 2, 3], periode_id: 1, mode: 'composition' });
    assert.equal(d.stats.mode, 'composition');
    assert.equal(d.stats.effectif_total, 4);
    assert.deepEqual(d.classement.map(r => [r.eleve.nom, r.moyenne, r.rang]),
      [['KOUASSI', 18, 1], ['DOSSEH', 10, 2], ['ADJOVI', 1, 3]]);
    assert.equal(d.matieres[0].plus_faible.nom, 'ADJOVI');
    assert.equal(d.matieres[0].repartition[1].n, 1);
    assert.equal(d.stats.repartition[10].n, 1);
    assert.equal(d.resultats.filter(r => r.moyenne == null).length, 1);
    const toutes = computeFusion(db, 1, { classe_ids: [1, 2, 3], periode_id: 1 });
    assert.equal(toutes.classement[0].eleve.nom, 'DOSSEH'); // les devoirs changent le rang
  } finally { db.close(); }
});

test('examen programmé : seules les épreuves séparées entrent dans le classement', () => {
  const db = jeuEssai();
  try {
    const d = computeFusion(db, 1, { classe_ids: [1, 2, 3], examen_id: 1 });
    assert.equal(d.examen.nom, 'BEPC blanc programmé');
    assert.equal(d.classement[0].eleve.nom, 'DOSSEH');
    assert.deepEqual(d.classement.map(r => r.moyenne), [17, 12, 9]);
  } finally { db.close(); }
});

test('PDF de proclamation et PDF d’examen programmé : fichiers A4 multipages valides', async () => {
  const db = jeuEssai();
  try {
    const comp = computeFusion(db, 1, { classe_ids: [1, 2, 3], periode_id: 1, mode: 'composition' });
    const pdf = await genererFusionPDF(comp, { proclamation: true });
    assert.match(pdf.subarray(0, 8).toString(), /^%PDF-1\./);
    assert.ok(pdf.length > 5000);
    const examen = computeFusion(db, 1, { classe_ids: [1, 2, 3], examen_id: 1 });
    const pdfExamen = await genererFusionPDF(examen);
    assert.match(pdfExamen.subarray(0, 8).toString(), /^%PDF-1\./);
    assert.ok(pdfExamen.length > 5000);
    // Une liste plus longue se prolonge sur plusieurs pages, chacune numérotée.
    const source = comp.classement[0];
    comp.classement = Array.from({ length: 150 }, (_, i) => ({ ...source, rang: i + 1,
      eleve: { ...source.eleve, nom: `TEST${i + 1}` } }));
    comp.resultats = comp.classement;
    comp.stats.effectif_total = 150;
    const grandPDF = await genererFusionPDF(comp, { proclamation: true });
    const objetsPages = (grandPDF.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    assert.ok(objetsPages >= 5, `Seulement ${objetsPages} page(s) pour 150 élèves`);
  } finally { db.close(); }
});
