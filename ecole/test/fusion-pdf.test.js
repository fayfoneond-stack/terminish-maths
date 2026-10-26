'use strict';
/* Exécuter depuis ecole/ : node --test test/fusion-pdf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { inflateSync } = require('node:zlib');
const { computeFusion } = require('../server/stats');
const { genererFusionPDF, notesEleveParMatiere } = require('../server/fusion-pdf');

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
    // Chaque bloc du classement donne une note /20 pour chaque matière de l'élève.
    assert.deepEqual(notesEleveParMatiere(d.classement[0], d.matieres), [18]);
    assert.deepEqual(notesEleveParMatiere(d.classement[2], d.matieres), [1]);
    assert.deepEqual(notesEleveParMatiere(d.resultats.find(r => r.moyenne == null), d.matieres), [null]);
    assert.deepEqual(notesEleveParMatiere({ lignes: [
      { matiere_id: 9, moyenne: 16 }, { matiere_id: 1, moyenne: 5 }
    ] }, [{ id: 1 }, { id: 2 }, { id: 9 }]), [5, null, 16]);
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

/** Extrait les caractères des flux PDFKit en police standard, sans ajout de dépendance. */
function textePDF(pdf) {
  const brut = pdf.toString('latin1');
  let resultat = '';
  for (const flux of brut.matchAll(/\/Length (\d+)\n\/Filter \/FlateDecode\n>>\nstream\n/g)) {
    const debut = flux.index + flux[0].length;
    const contenu = inflateSync(pdf.subarray(debut, debut + Number(flux[1]))).toString('latin1');
    for (const commande of contenu.matchAll(/\[(.*?)\] TJ/gs)) {
      const lettres = [...commande[1].matchAll(/<([0-9a-fA-F]+)>/g)].map(m => Buffer.from(m[1], 'hex'));
      resultat += Buffer.concat(lettres).toString('latin1') + '\n';
    }
  }
  return resultat;
}

test('PDF fusionné : les notes Mathématiques et SVT sont sous chaque nom dans le classement', async () => {
  const db = jeuEssai();
  try {
    const comp = computeFusion(db, 1, { classe_ids: [1, 2, 3], periode_id: 1, mode: 'composition' });
    const pdf = await genererFusionPDF(comp, { proclamation: true });
    assert.match(pdf.subarray(0, 8).toString(), /^%PDF-1\./);
    assert.ok(pdf.length > 5000);
    const nbPages = buffer => (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    const nbPaysages = buffer => (buffer.toString('latin1').match(/\/MediaBox \[0 0 841\.89 595\.28\]/g) || []).length;
    assert.equal(nbPaysages(pdf), 0, 'Les notes doivent être sous le nom, pas dans une annexe paysage');
    const texteComp = textePDF(pdf);
    const classement = texteComp.slice(texteComp.indexOf('Classement général'));
    const kouassi = classement.slice(classement.indexOf('KOUASSI Elom'), classement.indexOf('DOSSEH Kofi'));
    assert.match(kouassi, /Mathématiques\n18,00/); // composition uniquement, pas le devoir
    assert.match(classement, /Élèves non classés[\s\S]*KODJO Non noté[\s\S]*Mathématiques/);

    const examen = computeFusion(db, 1, { classe_ids: [1, 2, 3], examen_id: 1 });
    const pdfExamen = await genererFusionPDF(examen);
    assert.match(pdfExamen.subarray(0, 8).toString(), /^%PDF-1\./);
    assert.equal(nbPaysages(pdfExamen), 0);
    const texteExamen = textePDF(pdfExamen);
    const classeExamen = texteExamen.slice(texteExamen.indexOf('Classement général'));
    const dosseh = classeExamen.slice(classeExamen.indexOf('DOSSEH Kofi'), classeExamen.indexOf('KOUASSI Elom'));
    assert.match(dosseh, /Mathématiques\n17,00/); // épreuve programmée, pas composition

    // Deux matières, dont SVT absente pour un élève et complètement absente pour le non-classé.
    db.prepare("INSERT INTO matieres VALUES (2, 'Sciences de la Vie et de la Terre', NULL, 'SVT', 'Scientifique')").run();
    for (let c = 1; c <= 3; c++) {
      db.prepare('INSERT INTO classe_matieres VALUES (?, 2, 2)').run(c);
      db.prepare("INSERT INTO evaluations VALUES (?, 1, ?, 2, 1, NULL, 'composition', 20)")
        .run(20 + c, c);
    }
    db.prepare('INSERT INTO notes VALUES (21, 1, 13, 0), (23, 3, 8, 0)').run();
    const avecSvt = computeFusion(db, 1, { classe_ids: [1, 2, 3], periode_id: 1, mode: 'composition' });
    const texteSvt = textePDF(await genererFusionPDF(avecSvt, { proclamation: true }));
    const classeSvt = texteSvt.slice(texteSvt.indexOf('Classement général'));
    const blocKouassi = classeSvt.slice(classeSvt.indexOf('KOUASSI Elom'), classeSvt.indexOf('DOSSEH Kofi'));
    assert.match(blocKouassi, /Mathématiques\n18,00/);
    assert.match(blocKouassi, /SVT.*Sciences de la Vie et de la Terre\n13,00/);
    assert.match(classeSvt, /Élèves non classés[\s\S]*KODJO Non noté[\s\S]*SVT/);

    // Plus de huit matières : chacun garde la liste complète sous SON nom.
    for (let id = 3; id <= 11; id++) {
      db.prepare('INSERT INTO matieres VALUES (?, ?, NULL, ?, ?)').run(id, `Matière ${id}`, `MAT${id}`, 'Autres');
      for (let classeId = 1; classeId <= 3; classeId++) {
        db.prepare('INSERT INTO classe_matieres VALUES (?, ?, 1)').run(classeId, id);
        const evId = 100 + id * 10 + classeId;
        db.prepare("INSERT INTO evaluations VALUES (?, 1, ?, ?, 1, NULL, 'composition', 20)")
          .run(evId, classeId, id);
        db.prepare('INSERT INTO notes VALUES (?, ?, ?, 0)').run(evId, classeId, id);
      }
    }
    const plusieurs = computeFusion(db, 1, { classe_ids: [1, 2, 3], periode_id: 1, mode: 'composition' });
    assert.equal(plusieurs.matieres.length, 11);
    const pdfPlusieurs = await genererFusionPDF(plusieurs, { proclamation: true });
    assert.equal(nbPaysages(pdfPlusieurs), 0);
    const textePlusieurs = textePDF(pdfPlusieurs);
    const premierBloc = textePlusieurs.slice(textePlusieurs.indexOf('KOUASSI Elom', textePlusieurs.indexOf('Classement général')));
    assert.match(premierBloc, /Mathématiques\n18,00/);
    assert.match(premierBloc, /Matière 11\n11,00/);

    // Une liste de 150 élèves reste lisible sur plusieurs pages toutes numérotées.
    const source = comp.classement[0];
    comp.classement = Array.from({ length: 150 }, (_, i) => ({ ...source, rang: i + 1,
      eleve: { ...source.eleve, id: i + 10, nom: `TEST${i + 1}` } }));
    comp.resultats = comp.classement;
    comp.stats.effectif_total = 150;
    const grandPDF = await genererFusionPDF(comp, { proclamation: true });
    assert.ok(nbPages(grandPDF) >= 5, `Seulement ${nbPages(grandPDF)} page(s) pour 150 élèves`);
    assert.equal(nbPaysages(grandPDF), 0);
  } finally { db.close(); }
});
