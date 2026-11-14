'use strict';
/** Lecteurs locaux des listes : aucune conversion externe ni écriture en base. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { analyserListeFichier } = require('../server/liste-fichiers');

const fixture = nom => fs.readFileSync(path.join(__dirname, 'fixtures', nom));
const analyserCsv = texte => analyserListeFichier(Buffer.from(texte), 'liste.csv');

test('Word .docx : tableau avec titre, classe, sexe, dates et anciennetés explicites', async () => {
  const d = await analyserListeFichier(fixture('liste-eleves.docx'), 'classe.docx');
  assert.equal(d.format, 'Word');
  assert.equal(d.pages, 1);
  assert.equal(d.ocr, false);
  assert.deepEqual(d.eleves.map(e => [e.nom, e.prenom, e.classe, e.sexe,
    e.date_naissance, e.anciennete_etablissement]), [
    ['ADJOVI', 'Ama', '6ème A', 'F', '2012-03-14', 'ancien'],
    ['KOUASSI', 'Elom', '6ème A', 'M', '', 'nouveau']
  ]);
  assert.deepEqual(d.avertissements, []);
});

test('Excel .xlsx : plusieurs onglets, dates Excel, chaînes partagées, arrivée inconnue préservée', async () => {
  const d = await analyserListeFichier(fixture('liste-eleves.xlsx'), 'plusieurs-classes.xlsx');
  assert.equal(d.format, 'Excel');
  assert.equal(d.pages, 2);
  assert.deepEqual(d.eleves.map(e => [e.nom, e.matricule, e.classe,
    e.date_naissance, e.anciennete_etablissement, e.page]), [
    ['DOSSEH', 'ECO-001', '6ème A', '2012-03-14', 'ancien', 1],
    ['ASSOGBA', 'ECO-002', '6ème A', '', 'nouveau', 1],
    ['MENSAH', '', '5ème B', '2011-04-23', '', 2]
  ]);
  const partages = await analyserListeFichier(fixture('liste-eleves-partages.xlsx'), 'partages.xlsx');
  assert.deepEqual(partages.eleves.map(e => [e.nom, e.classe, e.anciennete_etablissement]), [
    ['KOFFI', '4ème C', 'nouveau'], ['KONDO', '4ème C', 'ancien']
  ]);
});

test('CSV Excel (BOM, point-virgule, cellules entre guillemets) : statut administratif distinct', async () => {
  const d = await analyserCsv('\ufeffsep=;\r\nMatricule;Nom;Prénom;Sexe;Naissance;Classe;Statut;Anciennete etablissement\r\n' +
    'ECO-003;ADJOVI;"Ama; Nadège";F;14/03/2012;6ème A;actif;Ancienne\r\n' +
    ';KOUASSI;Elom;M;;6ème A;inactif;\r\n');
  assert.equal(d.format, 'CSV');
  assert.deepEqual(d.eleves.map(e => [e.nom, e.prenom, e.matricule,
    e.date_naissance, e.anciennete_etablissement]), [
    ['ADJOVI', 'Ama; Nadège', 'ECO-003', '2012-03-14', 'ancien'],
    ['KOUASSI', 'Elom', '', '', '']
  ]);
  assert.equal(d.eleves[1].anciennete_etablissement, '',
    'ni le statut inactif ni une cellule vide ne veulent dire « nouveau »');
  assert.deepEqual(d.avertissements, []);
  const virgules = await analyserCsv('Nom,Prénom,Classe,Statut\nDOSSEH,"Kofi, Junior",6ème A,actif\n');
  assert.equal(virgules.eleves[0].prenom, 'Kofi, Junior');
  assert.equal(virgules.eleves[0].anciennete_etablissement, '');
  const citations = await analyserCsv('Nom;Prénom\nADJOVI;"Ama, Mina, Kofi"\n');
  assert.equal(citations.eleves[0].prenom, 'Ama, Mina, Kofi',
    'les virgules dans un champ cité ne remplacent pas le séparateur point-virgule');
  const cp1252 = await analyserListeFichier(
    Buffer.from('Nom;Pr\xe9nom;Classe;Arriv\xe9e dans l\x92\xe9tablissement\nASSOGBA;Afi;5\xe8me B;Ancienne\n', 'binary'), 'latin.csv');
  assert.equal(cp1252.eleves[0].prenom, 'Afi');
  assert.equal(cp1252.eleves[0].anciennete_etablissement, 'ancien');
  assert.match(cp1252.avertissements[0], /Windows-1252/);
});

test('CSV inconnu ou mauvais format : pas d’inscription silencieuse ni de confusion de statut', async () => {
  const inconnu = await analyserCsv('Nom;Prénom;Classe;Arrivée dans l’établissement\n' +
    'KONDO;Mensah;4ème C;transféré\n');
  assert.equal(inconnu.eleves[0].anciennete_etablissement, '');
  assert.equal(inconnu.eleves[0].incertain, true);
  assert.match(inconnu.avertissements.join(' '), /à préciser/);
  await assert.rejects(() => analyserCsv('Nom;Prénom\n"ADJOVI;Ama\n'), /guillemets non fermés/);
  await assert.rejects(() => analyserListeFichier(Buffer.from('abc\0ef'), 'classe.csv'), /fichier binaire/);
  await assert.rejects(() => analyserListeFichier(Buffer.alloc(8 * 1024 * 1024 + 1), 'classe.csv'), /8 Mo/);
  for (const extension of ['.doc', '.xls', '.ods']) {
    await assert.rejects(() => analyserListeFichier(fixture('liste-eleves.xlsx'), 'ancien' + extension),
      /non pris en charge|Choisissez un fichier/);
  }
  await assert.rejects(() => analyserListeFichier(Buffer.from('PK\x03\x04poubelle'), 'classe.xlsx'),
    /endommagé/);
  await assert.rejects(() => analyserListeFichier(fixture('liste-eleves.docx'), 'fausse-liste.xlsx'),
    /Excel .*invalide/);
});
