'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const PDFDocument = require('pdfkit');
const { createCanvas } = require('@napi-rs/canvas');
const { analyserListePDF, lireLignes, dateISO } = require('../server/liste-pdf');
const { verifierListe, importerListe } = require('../server/import-eleves-pdf');

function creerPDF(dessiner) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4' });
    const morceaux = [];
    pdf.on('data', c => morceaux.push(c));
    pdf.on('error', reject);
    pdf.on('end', () => resolve(Buffer.concat(morceaux)));
    Promise.resolve(dessiner(pdf)).then(() => pdf.end(), reject);
  });
}
function baseEnMemoire() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE etablissements (id INTEGER PRIMARY KEY, annee_scolaire TEXT);
    CREATE TABLE classes (id INTEGER PRIMARY KEY, ecole_id INTEGER, nom TEXT);
    CREATE TABLE eleves (id INTEGER PRIMARY KEY, ecole_id INTEGER, matricule TEXT, nom TEXT NOT NULL,
      prenom TEXT NOT NULL, sexe TEXT, date_naissance TEXT, lieu_naissance TEXT, classe_id INTEGER,
      tuteur_nom TEXT, tuteur_tel TEXT, statut TEXT, cree_le TEXT, UNIQUE(ecole_id,matricule));
    INSERT INTO etablissements VALUES (1,'2026-2027'), (2,'2026-2027');
    INSERT INTO classes VALUES (7,1,'6ème A'), (8,1,'6ème B'), (9,2,'6ème A');
    INSERT INTO eleves(ecole_id,matricule,nom,prenom,classe_id) VALUES (1,'20260010','ADJOVI','Ama',7);`);
  return db;
}

test('PDF textuel : colonnes, classe, naissance facultative et origine des noms', async () => {
  const xs = [40, 84, 168, 309, 407, 470];
  const pdf = await creerPDF(d => {
    d.fontSize(13).text('Liste des élèves — 6ème A', 40, 40);
    ['N°', 'Matricule', 'Nom', 'Prénom', 'Sexe', 'Date de naissance']
      .forEach((s, i) => d.fontSize(9).text(s, xs[i], 110, { width: 100 }));
    [['1', '20260001', 'KOUASSI', 'Elom', '', ''],
      ['2', '20260002', 'DOSSEH', 'Kofi', 'M', '14/03/2012']]
      .forEach((row, j) => row.forEach((s, i) => d.text(s, xs[i], 141 + j * 22, { width: 100 })));
  });
  const result = await analyserListePDF(pdf);
  assert.equal(result.ocr, false);
  assert.equal(result.pages, 1);
  assert.deepEqual(result.eleves.map(e => [e.nom, e.prenom, e.classe, e.date_naissance, e.sexe]), [
    ['KOUASSI', 'Elom', '6ème A', '', ''],
    ['DOSSEH', 'Kofi', '6ème A', '2012-03-14', 'M']
  ]);
});

test('La classe identifiée sur la première page s’applique à la suite de la liste', async () => {
  const pdf = await creerPDF(d => {
    d.text('Liste des élèves — 5ème B', 40, 40);
    d.text('1 20260001 KOUASSI Elom', 40, 75);
    d.addPage();
    d.text('2 20260002 ADJOVI Ama', 40, 75);
  });
  const result = await analyserListePDF(pdf);
  assert.equal(result.eleves.length, 2);
  assert.deepEqual(result.eleves.map(e => e.classe), ['5ème B', '5ème B']);
});

test('PDF scanné : OCR français local, sans service externe', { timeout: 30000 }, async () => {
  const image = createCanvas(1150, 1500);
  const ctx = image.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1150, 1500);
  ctx.fillStyle = 'black'; ctx.font = 'bold 40px Arial';
  ctx.fillText('LISTE DES ELEVES - 6ème A', 50, 70);
  ctx.font = 'bold 31px Arial'; ctx.fillText('N°   Matricule    Nom              Prénom', 55, 160);
  ctx.font = '28px Arial';
  ctx.fillText('1      20260001       KOUASSI      Elom', 55, 240);
  ctx.fillText('2      20260002       ADJOVI          Ama', 55, 300);
  const png = await image.encode('png');
  const pdf = await creerPDF(d => d.image(png, 0, 0, { width: 595 }));
  const result = await analyserListePDF(pdf);
  assert.equal(result.ocr, true);
  assert.ok(result.avertissements.some(a => a.includes('OCR')));
  assert.deepEqual(result.eleves.map(e => `${e.nom} ${e.prenom}`), ['KOUASSI Elom', 'ADJOVI Ama']);
});

test('En-tête textuel et grande image scannée : l’OCR lit quand même la liste', { timeout: 30000 }, async () => {
  const image = createCanvas(1000, 1350);
  const ctx = image.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1000, 1350);
  ctx.fillStyle = '#111'; ctx.font = 'bold 32px Arial';
  ctx.fillText('LISTE DES ELEVES - 6ème A', 55, 100);
  ctx.font = '28px Arial'; ctx.fillText('1  20260001   KOUASSI   Elom', 60, 205);
  const pdf = await creerPDF(async d => {
    d.text('Etablissement - liste scannée avec en-tête textuel supplémentaire', 20, 20);
    d.image(await image.encode('png'), 0, 0, { width: 595 });
  });
  const result = await analyserListePDF(pdf);
  assert.equal(result.ocr, true);
  assert.equal(result.eleves[0].nom, 'KOUASSI');
});

test('Les en-têtes et statistiques ne sont pas des élèves ; dates strictement valides', async () => {
  const lignes = [
    'Complexe Scolaire Les Palmiers', 'Classe 6ème A', 'Moyenne de la classe : 12',
    'Année scolaire 2026-2027', '1 20260001 KOUASSI Elom', 'Liste des élèves — 6ème A',
    '2 20260002 ADJOVI Ama'
  ].map(texte => ({ texte, items: [] }));
  assert.deepEqual(lireLignes(lignes, 1).eleves.map(e => e.nom), ['KOUASSI', 'ADJOVI']);
  assert.equal(dateISO('31/02/2012'), '');
  assert.equal(dateISO('04/11/2011'), '2011-11-04');
  await assert.rejects(() => analyserListePDF(Buffer.from('pas un pdf')), /PDF invalide/);
});

test('Aperçu et confirmation : doublons, nom seul, matricules, classes isolées, données facultatives', () => {
  const db = baseEnMemoire();
  const lignes = [
    { nom: 'Adjovi', prenom: 'Ama', matricule: 'autre-numero', classe_id: 8 }, // nom déjà dans une autre classe
    { nom: 'KOUASSI', prenom: 'Elom', classe_id: 7 },
    { nom: 'Mensah', prenom: '', classe_id: 7, date_naissance: '2012-04-03' },
    { nom: 'DOSSEH', prenom: 'Kofi', classe_id: 9 }, // autre établissement
    { nom: 'Kouassi', prenom: 'Elom', classe_id: 7 }, // doublon dans le fichier
    { nom: 'KOFFI', prenom: 'Akou', matricule: '20260010', classe_id: 7 } // matricule existant
  ];
  const avant = db.prepare('SELECT COUNT(*) AS n FROM eleves').get().n;
  assert.deepEqual(verifierListe(db, 1, lignes).statuts.map(s => s.etat),
    ['doublon', 'pret', 'pret', 'erreur', 'doublon', 'doublon']);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM eleves').get().n, avant, 'aperçu en lecture seule');
  const resultat = importerListe(db, 1, lignes, () => '2026-10-26');
  assert.equal(resultat.crees, 2);
  assert.equal(resultat.ignores.length, 4);
  assert.deepEqual(db.prepare('SELECT nom,prenom,sexe,date_naissance,tuteur_nom,matricule,classe_id FROM eleves WHERE id>1 ORDER BY id').all()
    .map(r => ({ ...r })), [
    { nom: 'KOUASSI', prenom: 'Elom', sexe: '', date_naissance: '', tuteur_nom: '', matricule: '20260011', classe_id: 7 },
    { nom: 'MENSAH', prenom: '', sexe: '', date_naissance: '2012-04-03', tuteur_nom: '', matricule: '20260012', classe_id: 7 }
  ]);
  assert.equal(importerListe(db, 1, lignes.slice(1, 3), () => '2026-10-26').crees, 0,
    'un second import du même PDF ne recrée pas les élèves');
  db.close();
});

test('La confirmation est atomique si une insertion échoue ; aucune note ne fait partie de la transaction', () => {
  const db = baseEnMemoire();
  db.exec(`CREATE TRIGGER refus_nom BEFORE INSERT ON eleves WHEN NEW.nom='ATTIOGBE'
    BEGIN SELECT RAISE(ABORT, 'Insertion interdite pour le test'); END;`);
  assert.throws(() => importerListe(db, 1, [
    { nom: 'KOUASSI', prenom: 'Elom', classe_id: 7 },
    { nom: 'ATTIOGBE', prenom: 'Ama', classe_id: 7 }
  ], () => '2026-10-26'), /Import annulé/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM eleves').get().n, 1);
  db.close();
});
