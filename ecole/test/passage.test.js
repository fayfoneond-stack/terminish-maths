'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const net = require('node:net');

// Une vraie base SQLite, isolée de la production et du jeu de démonstration.
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'terminish-passage-'));
process.env.TERMINISH_DATA_DIR = dossier;
process.env.TERMINISH_SEED = 'prod';
process.env.ADMIN_PASSWORD = 'test-admin-local';
const { db, createEtablissement, createUser, now } = require('../server/db');
const { computeClasse, computeFusion, bulletinData } = require('../server/stats');
const { renderBulletin } = require('../server/print');
const { optionsPassage, preparerPassage, validerPassage, annulerPassage,
  ouvrirAnneeSuivante, niveauDe, memoriserInscription } = require('../server/passage');
const { importerListe } = require('../server/import-eleves-pdf');

function ecole(type = 'college') {
  const id = createEtablissement({ nom: `École test ${Date.now()}-${Math.random()}`,
    type, annee_scolaire: '2026-2027', ville: 'Lomé' });
  const direction = createUser({ ecole_id: id, nom: 'Directeur test', email: `directeur-${id}@test.tg`,
    password: 'test-direction', role: 'directeur' });
  const enseignant = createUser({ ecole_id: id, nom: 'Prof test', email: `prof-${id}@test.tg`,
    password: 'test-prof', role: 'enseignant' });
  const matiere = Number(db.prepare("INSERT INTO matieres(ecole_id,nom,code,groupe) VALUES (?,'Mathématiques','MATH','Scientifique')")
    .run(id).lastInsertRowid);
  const periodes = db.prepare('SELECT * FROM periodes WHERE ecole_id = ? ORDER BY cycle, ordre').all(id);
  const classe = (nom, niveau, cycle = 'college') => {
    const cid = Number(db.prepare(`INSERT INTO classes (ecole_id,nom,niveau,cycle,annee)
      VALUES (?,?,?,?,?)`).run(id, nom, niveau, cycle, '2026-2027').lastInsertRowid);
    db.prepare('INSERT INTO classe_matieres(classe_id,matiere_id,coefficient) VALUES (?,?,4)')
      .run(cid, matiere);
    return cid;
  };
  const eleve = (nom, cid) => Number(db.prepare(`INSERT INTO eleves
    (ecole_id,matricule,nom,prenom,classe_id,statut,cree_le) VALUES (?,?,?,?,?,'actif',?)`)
    .run(id, `${id}-${nom}`, nom, 'Test', cid, now()).lastInsertRowid);
  const notes = (cid, cycle, eleves, notesParEleve) => {
    const scope = periodes.filter(p => p.cycle === cycle);
    scope.forEach((p, i) => {
      const ev = Number(db.prepare(`INSERT INTO evaluations
        (ecole_id,classe_id,matiere_id,periode_id,type,libelle,cree_le)
        VALUES (?,?,?,?,'composition','Composition',?)`)
        .run(id, cid, matiere, p.id, now()).lastInsertRowid);
      eleves.forEach((eid, j) => {
        const note = notesParEleve[j][i];
        if (note == null) return;
        db.prepare(`INSERT INTO notes(evaluation_id,eleve_id,valeur,absent,modifie_le)
          VALUES (?,?,?,0,?)`).run(ev, eid, note, now());
      });
    });
  };
  return { id, direction, enseignant, matiere, periodes, classe, eleve, notes };
}
function fermerPeriodes(e) {
  db.prepare("UPDATE periodes SET statut = 'fermee' WHERE ecole_id = ? AND annee_scolaire = '2026-2027'").run(e.id);
}

// Ces tests restent séquentiels dans ce fichier : les écoles partagent une
// seule connexion, mais chaque jeu de données est séparé par ecole_id.
test('Collège : moyenne des 3 trimestres, aperçu sans écriture, admission et archives conservées', () => {
  const e = ecole();
  const six = e.classe('6ème A', '6ème');
  const cinq = e.classe('5ème A', '5ème');
  const cinqB = e.classe('5ème B', '5ème');
  const trois = e.classe('3ème A', '3ème');
  const quatre = e.classe('4ème A', '4ème');
  const admis = e.eleve('ADMIS', six), maintenu = e.eleve('MAINTENU', six);
  const incomplet = e.eleve('INCOMPLET', six), ancienCinq = e.eleve('CINQUIEME', cinq);
  const dejaArchive = e.eleve('ARCHIVE', trois);
  e.notes(six, 'college', [admis, maintenu, incomplet], [[12, 14, 13], [9, 8, 7], [15, null, 18]]);
  e.notes(cinq, 'college', [ancienCinq], [[10, 11, 12]]);
  e.notes(trois, 'college', [dejaArchive], [[11, 12, 13]]);
  db.prepare("UPDATE eleves SET statut='inactif' WHERE id=?").run(dejaArchive);
  const t1 = e.periodes.find(p => p.cycle === 'college');
  assert.equal(t1.date_debut, '2026-09-15');
  assert.equal(niveauDe({ nom: '2nde A' }), '2');
  assert.equal(niveauDe({ nom: '1ère D' }), '1');
  const avant = db.prepare('SELECT COUNT(*) AS n FROM decisions_finales WHERE ecole_id = ?').get(e.id).n;
  const demande = { classe_id: six, cible_id: cinqB, seuil: 10 };
  const apercu = preparerPassage(db, e.id, demande);
  assert.deepEqual(apercu.lignes.map(l => [l.moyenne_annuelle, l.decision]),
    [[13, 'admis'], [null, 'incomplet'], [8, 'maintenu']]);
  assert.deepEqual(apercu.lignes.find(l => l.eleve_id === incomplet).moyennes, [15, null, 18]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM decisions_finales WHERE ecole_id = ?').get(e.id).n, avant);
  assert.equal(db.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(admis).classe_id, six);
  assert.throws(() => validerPassage(db, e.id, { ...demande, empreinte: apercu.empreinte }, e.direction, now),
    /Fermez d’abord/);
  fermerPeriodes(e);
  db.prepare('UPDATE notes SET valeur = 11 WHERE eleve_id = ? AND valeur = 12').run(admis);
  assert.throws(() => validerPassage(db, e.id, { ...demande, empreinte: apercu.empreinte }, e.direction, now),
    /ont changé depuis l’aperçu/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inscriptions_historiques WHERE ecole_id = ?').get(e.id).n, 0,
    'aperçu périmé : la transaction a été annulée');
  db.prepare('UPDATE notes SET valeur = 12 WHERE eleve_id = ? AND valeur = 11').run(admis);
  const correct = preparerPassage(db, e.id, demande);
  const notesAvant = db.prepare('SELECT evaluation_id,eleve_id,valeur FROM notes WHERE eleve_id = ? ORDER BY evaluation_id')
    .all(admis).map(r => ({ ...r }));
  assert.deepEqual(validerPassage(db, e.id, { ...demande, empreinte: correct.empreinte }, e.direction, now), {
    ok: true, annee_scolaire: '2026-2027', classe: { id: six, nom: '6ème A' },
    cible: { id: cinqB, nom: '5ème B' }, admis: 1, maintenus: 1, incomplets: 1
  });
  assert.equal(db.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(admis).classe_id, cinqB);
  assert.equal(db.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(maintenu).classe_id, six);
  assert.equal(db.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(incomplet).classe_id, six);
  assert.deepEqual(db.prepare('SELECT evaluation_id,eleve_id,valeur FROM notes WHERE eleve_id = ? ORDER BY evaluation_id')
    .all(admis).map(r => ({ ...r })), notesAvant);
  assert.equal(db.prepare('SELECT classe_id FROM inscriptions_historiques WHERE eleve_id = ?').get(admis).classe_id, six);
  assert.equal(db.prepare('SELECT classe_id FROM inscriptions_historiques WHERE eleve_id = ?').get(ancienCinq).classe_id, cinq);
  assert.equal(bulletinData(db, e.id, dejaArchive, t1.id).ligne.moyenne, 11,
    'les notes d’un élève déjà archivé restent accessibles après le passage');
  assert.deepEqual(computeClasse(db, e.id, { classe_id: six, periode_id: t1.id }).resultats.map(r => r.eleve.id).sort(),
    [admis, maintenu, incomplet].sort());
  assert.deepEqual(computeClasse(db, e.id, { classe_id: cinq, periode_id: t1.id }).resultats.map(r => r.eleve.id),
    [ancienCinq], 'le nouvel élève de 5ème ne figure pas dans les anciens bulletins de 5ème');
  assert.equal(computeFusion(db, e.id, { classe_ids: [six], periode_id: t1.id }).classement.length, 3);
  const ancienBulletin = bulletinData(db, e.id, admis, t1.id);
  assert.equal(ancienBulletin.promo.classe.id, six);
  assert.equal(ancienBulletin.ligne.moyenne, 12);
  assert.match(renderBulletin(ancienBulletin), /Année scolaire<strong>2026-2027<\/strong>/);
  assert.equal(optionsPassage(db, e.id).sources.find(c => c.id === six).valides, 3);
  assert.throws(() => preparerPassage(db, e.id, demande), /déjà validée/);
  assert.throws(() => ouvrirAnneeSuivante(db, e.id, '2027-2028'), /Décisions manquantes pour 5ème A/);

  // Même après que les 6e ont rejoint les 5e, la décision des 5e ne porte
  // que sur les élèves qui étaient réellement en 5e cette année-là.
  const versQuatre = { classe_id: cinq, cible_id: quatre, seuil: 11 };
  const cinqApercu = preparerPassage(db, e.id, versQuatre);
  assert.deepEqual(cinqApercu.lignes.map(r => r.eleve_id), [ancienCinq]);
  validerPassage(db, e.id, { ...versQuatre, empreinte: cinqApercu.empreinte }, e.direction, now);
  assert.equal(db.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(ancienCinq).classe_id, quatre);
  assert.equal(optionsPassage(db, e.id).sources.find(c => c.id === cinqB).valides, 0,
    'une destination vide en début d’année ne nécessite pas sa propre décision');
  db.prepare("UPDATE eleves SET statut='inactif' WHERE id=?").run(maintenu);
  const apresArchivage = optionsPassage(db, e.id).sources.find(c => c.id === six);
  assert.equal(apresArchivage.effectif, 2);
  assert.equal(apresArchivage.valides, 2, 'une décision archivée ne bloque pas la nouvelle année');
  const nouvelle = ouvrirAnneeSuivante(db, e.id, '2027-2028');
  assert.equal(nouvelle.periodes_creees, 3);
  assert.equal(db.prepare('SELECT annee_scolaire FROM etablissements WHERE id = ?').get(e.id).annee_scolaire, '2027-2028');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM periodes WHERE ecole_id = ? AND annee_scolaire = '2027-2028'")
    .get(e.id).n, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM decisions_finales WHERE ecole_id = ?').get(e.id).n, 4);
  assert.equal(computeClasse(db, e.id, { classe_id: six, periode_id: t1.id }).resultats.length, 3);
  assert.equal(bulletinData(db, e.id, admis, t1.id).promo.classe.id, six);
  assert.match(renderBulletin(bulletinData(db, e.id, admis, t1.id)), /Année scolaire<strong>2026-2027<\/strong>/);
  const nouveauT1 = db.prepare("SELECT id FROM periodes WHERE ecole_id = ? AND code = 'T1@2027-2028'").get(e.id).id;
  db.prepare(`INSERT INTO evaluations(ecole_id,classe_id,matiere_id,periode_id,type,cree_le)
    VALUES (?,?,?,?,'composition',?)`).run(e.id, cinqB, e.matiere, nouveauT1, now());
  const nouvelleEval = db.prepare('SELECT MAX(id) AS id FROM evaluations').get().id;
  db.prepare('INSERT INTO notes(evaluation_id,eleve_id,valeur,modifie_le) VALUES (?,?,16,?)')
    .run(nouvelleEval, admis, now());
  assert.equal(computeClasse(db, e.id, { classe_id: cinqB, periode_id: nouveauT1 }).resultats[0].moyenne, 16);
  assert.equal(computeClasse(db, e.id, { classe_id: six, periode_id: t1.id }).resultats[0].moyenne, 12);
  db.prepare("UPDATE etablissements SET formule_moyenne='moy_co' WHERE id=?").run(e.id);
  db.prepare('UPDATE classe_matieres SET coefficient=7 WHERE classe_id=?').run(six);
  db.prepare("UPDATE classes SET nom='6ème Nouvelle' WHERE id=?").run(six);
  db.prepare("UPDATE matieres SET nom='Algèbre' WHERE id=?").run(e.matiere);
  const garde = computeClasse(db, e.id, { classe_id: six, periode_id: t1.id });
  assert.equal(garde.resultats.find(r => r.eleve.id === admis).moyenne, 12);
  assert.equal(garde.classe.nom, '6ème A');
  assert.equal(garde.matieres[0].nom, 'Mathématiques');
  assert.equal(garde.matieres[0].coefficient, 4);
  assert.equal(bulletinData(db, e.id, admis, t1.id).promo.classe.nom, '6ème A');
  assert.throws(() => ouvrirAnneeSuivante(db, e.id, '2027-2028'), /Année suivante incorrecte/);
  assert.equal(trois > 0, true);
});

test('Lycée : 2 semestres, choix de la 1ère D, absence bloquante, isolation entre établissements', () => {
  const e = ecole('lycee'), autre = ecole('lycee');
  const deux = e.classe('2nde A', '2nde', 'lycee');
  const unA = e.classe('1ère A', '1ère', 'lycee');
  const unD = e.classe('1ère D', '1ère', 'lycee');
  const unAutre = autre.classe('1ère D', '1ère', 'lycee');
  const reussi = e.eleve('REUSSI', deux), autreAdmis = e.eleve('SERIEA', deux);
  const absent = e.eleve('ABSENT', deux);
  e.notes(deux, 'lycee', [reussi, autreAdmis, absent], [[13, 14], [16, 16], [17, null]]);
  const options = optionsPassage(db, e.id);
  assert.deepEqual(options.sources.find(c => c.id === deux).cibles.map(c => c.id), [unA, unD]);
  assert.throws(() => preparerPassage(db, e.id, { classe_id: deux, cible_id: unAutre, seuil: 10 }),
    /même établissement/);
  assert.throws(() => preparerPassage(db, autre.id, { classe_id: deux, cible_id: unAutre, seuil: 10 }),
    /Seules les classes/);
  const demande = { classe_id: deux, cible_id: unD, seuil: 13.5 };
  const defaut = preparerPassage(db, e.id, demande);
  const destinations = { [autreAdmis]: unA };
  const apercu = preparerPassage(db, e.id, { ...demande, affectations: destinations });
  assert.deepEqual(apercu.periodes.map(p => p.libelle), ['1er Semestre', '2ème Semestre']);
  assert.equal(apercu.lignes.find(l => l.eleve_id === reussi).moyenne_annuelle, 13.5);
  assert.equal(apercu.lignes.find(l => l.eleve_id === autreAdmis).cible_id, unA);
  assert.equal(apercu.lignes.find(l => l.eleve_id === absent).decision, 'incomplet');
  assert.notEqual(apercu.empreinte, defaut.empreinte, 'les divisions individuelles sont signées avec l’aperçu');
  assert.throws(() => preparerPassage(db, e.id, { ...demande, affectations: { [autreAdmis]: unAutre } }),
    /division choisie/);
  assert.throws(() => preparerPassage(db, e.id, { ...demande, affectations: { [absent]: unA } }),
    /Seuls les élèves admis/);
  fermerPeriodes(e);
  assert.throws(() => validerPassage(db, e.id, { ...demande, affectations: destinations,
    empreinte: defaut.empreinte }, e.direction, now), /ont changé depuis l’aperçu/);
  validerPassage(db, e.id, { ...demande, affectations: destinations, empreinte: apercu.empreinte }, e.direction, now);
  assert.equal(db.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(reussi).classe_id, unD);
  assert.equal(db.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(autreAdmis).classe_id, unA);
  assert.equal(db.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(absent).classe_id, deux);
  assert.equal(optionsPassage(db, autre.id).annees_archivees.length, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM decisions_finales WHERE ecole_id = ?').get(autre.id).n, 0);
  assert.equal(annulerPassage(db, e.id, deux).annules, 3);
  assert.equal(db.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(reussi).classe_id, deux);
  assert.equal(db.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(autreAdmis).classe_id, deux);
  assert.equal(optionsPassage(db, e.id).sources.find(c => c.id === deux).valides, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inscriptions_historiques WHERE ecole_id = ?').get(e.id).n, 0,
    'la dernière annulation libère le travail courant');
});

test('Inscription PDF après une décision : nouvel élève visible dans l’autre classe et période manquante bloquante', () => {
  const e = ecole();
  const six = e.classe('6ème A', '6ème');
  const cinq = e.classe('5ème A', '5ème');
  const quatre = e.classe('4ème A', '4ème');
  const premier = e.eleve('PREMIER', six);
  e.notes(six, 'college', [premier], [[12, 13, 14]]);
  fermerPeriodes(e);
  const demande = { classe_id: six, cible_id: cinq, seuil: 10 };
  const apercu = preparerPassage(db, e.id, demande);
  validerPassage(db, e.id, { ...demande, empreinte: apercu.empreinte }, e.direction, now);
  const resultat = importerListe(db, e.id, [
    { nom: 'TARDIF', prenom: 'Ama', classe_id: cinq, date_naissance: '' }
  ], now, (id, classeId) => memoriserInscription(db, e.id, id, classeId));
  assert.equal(resultat.crees, 1);
  const tardif = resultat.eleves[0].id;
  assert.equal(optionsPassage(db, e.id).sources.find(c => c.id === cinq).effectif, 1,
    'l’élève admis de 6ème n’est pas ajouté aux 5èmes de cette année');
  const versQuatre = preparerPassage(db, e.id, { classe_id: cinq, cible_id: quatre, seuil: 10 });
  assert.deepEqual(versQuatre.lignes.map(r => [r.eleve_id, r.decision]), [[tardif, 'incomplet']]);
  assert.deepEqual(computeClasse(db, e.id, { classe_id: cinq,
    periode_id: e.periodes.find(p => p.cycle === 'college').id }).resultats.map(r => r.eleve.id), [tardif]);
});

test('La formule de l’ancienne année reste figée après un changement de formule pour la nouvelle année', () => {
  const e = ecole();
  const six = e.classe('6ème A', '6ème'), cinq = e.classe('5ème A', '5ème');
  const el = e.eleve('FORMULE', six);
  e.notes(six, 'college', [el], [[16, 16, 16]]);
  const t1 = e.periodes.find(p => p.cycle === 'college');
  const ev = Number(db.prepare(`INSERT INTO evaluations
    (ecole_id,classe_id,matiere_id,periode_id,type,cree_le)
    VALUES (?,?,?,?,'devoir1',?)`).run(e.id, six, e.matiere, t1.id, now()).lastInsertRowid);
  db.prepare('INSERT INTO notes(evaluation_id,eleve_id,valeur,modifie_le) VALUES (?,?,4,?)').run(ev, el, now());
  assert.equal(computeClasse(db, e.id, { classe_id: six, periode_id: t1.id }).resultats[0].moyenne, 12,
    '(4 + 2 × 16) ÷ 3 = 12');
  fermerPeriodes(e);
  const demande = { classe_id: six, cible_id: cinq, seuil: 10 };
  const apercu = preparerPassage(db, e.id, demande);
  validerPassage(db, e.id, { ...demande, empreinte: apercu.empreinte }, e.direction, now);
  ouvrirAnneeSuivante(db, e.id, '2027-2028');
  db.prepare("UPDATE etablissements SET formule_moyenne='moy_co' WHERE id=?").run(e.id);
  assert.equal(computeClasse(db, e.id, { classe_id: six, periode_id: t1.id }).resultats[0].moyenne, 12,
    'la nouvelle formule donnerait 10, mais le bulletin historique doit rester à 12');
  assert.equal(db.prepare(`SELECT formule_moyenne FROM classes_historiques WHERE ecole_id = ?
    AND annee_scolaire = '2026-2027' AND classe_id = ?`).get(e.id, six).formule_moyenne, 'co2');
});

test('Migration d’une ancienne base : année ajoutée aux périodes/examens sans perte de notes, relance idempotente', () => {
  const ancienDossier = path.join(dossier, 'base-ancienne');
  fs.mkdirSync(ancienDossier);
  const ancienne = new DatabaseSync(path.join(ancienDossier, 'terminish-ecole.db'));
  ancienne.exec(`CREATE TABLE etablissements (id INTEGER PRIMARY KEY, annee_scolaire TEXT);
    CREATE TABLE periodes (id INTEGER PRIMARY KEY, ecole_id INTEGER, code TEXT, libelle TEXT,
      cycle TEXT, ordre INTEGER, statut TEXT, date_debut TEXT, date_fin TEXT);
    CREATE TABLE examens (id INTEGER PRIMARY KEY, ecole_id INTEGER, nom TEXT, periode_id INTEGER,
      date_debut TEXT, date_fin TEXT, statut TEXT, cree_le TEXT);
    CREATE TABLE evaluations (id INTEGER PRIMARY KEY, ecole_id INTEGER, classe_id INTEGER,
      matiere_id INTEGER, periode_id INTEGER, epreuve_id INTEGER, type TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, evaluation_id INTEGER, eleve_id INTEGER, valeur REAL);
    INSERT INTO etablissements VALUES (42,'2024-2025');
    INSERT INTO periodes VALUES (17,42,'T1','1er Trimestre','college',1,'fermee',NULL,NULL);
    INSERT INTO examens VALUES (7,42,'Examen blanc',17,NULL,NULL,'termine','2025-01-01');
    INSERT INTO evaluations VALUES (5,42,11,3,17,NULL,'composition');
    INSERT INTO notes VALUES (8,5,22,17.25);`);
  ancienne.close();
  const script = `const {db}=require('./server/db'); console.log('MIGRE:'+JSON.stringify({
    periode:db.prepare('SELECT annee_scolaire FROM periodes WHERE id=17').get().annee_scolaire,
    examen:db.prepare('SELECT annee_scolaire FROM examens WHERE id=7').get().annee_scolaire,
    note:db.prepare('SELECT valeur FROM notes WHERE id=8').get().valeur,
    photos:db.prepare('SELECT COUNT(*) AS n FROM inscriptions_historiques').get().n,
    classes:db.prepare('SELECT COUNT(*) AS n FROM classes_historiques').get().n,
    matieres:db.prepare('SELECT COUNT(*) AS n FROM matieres_historiques').get().n,
    recuperation:db.prepare('SELECT COUNT(*) AS n FROM reinitialisations_mdp').get().n
  })); db.close();`;
  for (let i = 0; i < 2; i++) {
    const r = spawnSync(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..'), encoding: 'utf8',
      env: { ...process.env, TERMINISH_DATA_DIR: ancienDossier, TERMINISH_SEED: 'prod' }
    });
    assert.equal(r.status, 0, r.stderr);
    const ligne = r.stdout.split('\n').find(l => l.startsWith('MIGRE:'));
    assert.ok(ligne, r.stdout);
    assert.deepEqual(JSON.parse(ligne.slice(6)), {
      periode: '2024-2025', examen: '2024-2025', note: 17.25, photos: 0, classes: 0, matieres: 0,
      recuperation: 0
    });
  }
});

async function portLibre() {
  const serveur = net.createServer();
  await new Promise(resolve => serveur.listen(0, '127.0.0.1', resolve));
  const port = serveur.address().port;
  await new Promise(resolve => serveur.close(resolve));
  return port;
}
async function demarrerHTTP() {
  const port = await portLibre();
  const enfant = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), IP: '127.0.0.1', TERMINISH_DATA_DIR: dossier,
      TERMINISH_SEED: 'prod' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    await new Promise((resolve, reject) => {
      let journal = '';
      const minuteur = setTimeout(() => reject(new Error(`Serveur non prêt : ${journal}`)), 10000);
      enfant.stdout.on('data', chunk => {
        journal += chunk.toString();
        if (journal.includes('serveur démarré')) { clearTimeout(minuteur); resolve(); }
      });
      enfant.stderr.on('data', chunk => { journal += chunk.toString(); });
      enfant.once('exit', code => { clearTimeout(minuteur); reject(new Error(`Serveur arrêté (${code}) : ${journal}`)); });
    });
  } catch (e) { enfant.kill(); throw e; }
  const appeler = async (chemin, { cookie, method = 'GET', body } = {}) => {
    const reponse = await fetch(`http://127.0.0.1:${port}${chemin}`, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const type = reponse.headers.get('content-type') || '';
    return { status: reponse.status, cookie: reponse.headers.get('set-cookie'),
      data: type.includes('application/json') ? await reponse.json() : await reponse.text() };
  };
  return { enfant, appeler };
}

test('API : droits de la direction, confirmation, historique archivé et année protégée', async () => {
  const e = ecole();
  const source = e.classe('6ème A', '6ème'), cible = e.classe('5ème A', '5ème');
  const eleve = e.eleve('HTTP', source);
  e.notes(source, 'college', [eleve], [[14, 13, 15]]);
  const examenId = Number(db.prepare(`INSERT INTO examens
    (ecole_id, nom, periode_id, statut, annee_scolaire, cree_le)
    VALUES (?, 'Examen test', ?, 'termine', '2026-2027', ?)`)
    .run(e.id, e.periodes[0].id, now()).lastInsertRowid);
  const epreuveId = Number(db.prepare(`INSERT INTO epreuves (ecole_id, examen_id, classe_id, matiere_id)
    VALUES (?,?,?,?)`).run(e.id, examenId, source, e.matiere).lastInsertRowid);
  const evalExamen = Number(db.prepare(`INSERT INTO evaluations
    (ecole_id, classe_id, matiere_id, periode_id, epreuve_id, type, cree_le)
    VALUES (?,?,?,?,?,'blanc',?)`).run(e.id, source, e.matiere, e.periodes[0].id, epreuveId, now()).lastInsertRowid);
  db.prepare('INSERT INTO notes(evaluation_id,eleve_id,valeur,modifie_le) VALUES (?,?,12,?)')
    .run(evalExamen, eleve, now());
  const serveur = await demarrerHTTP();
  const { appeler, enfant } = serveur;
  try {
    const connecter = async (email, password) => {
      const r = await appeler('/api/auth/login', { method: 'POST', body: { email, password } });
      assert.equal(r.status, 200);
      return r.cookie.split(';')[0];
    };
    const prof = await connecter(`prof-${e.id}@test.tg`, 'test-prof');
    const chef = await connecter(`directeur-${e.id}@test.tg`, 'test-direction');
    assert.equal((await appeler('/api/passages/options', { cookie: prof })).status, 403);
    assert.equal((await appeler('/api/passages/historique', { cookie: prof })).status, 403);
    assert.ok((await appeler('/api/passages/options', { cookie: chef })).data.sources.some(c => c.id === source));
    assert.equal((await appeler(`/api/passages/apercu?classe_id=${source}&cible_id=${cible}&seuil=10`, { cookie: prof })).status, 403);
    const apercu = await appeler(`/api/passages/apercu?classe_id=${source}&cible_id=${cible}&seuil=10`, { cookie: chef });
    assert.equal(apercu.status, 200);
    assert.equal(apercu.data.stats.admis, 1);
    const formulaire = { classe_id: source, cible_id: cible, seuil: 10, affectations: { [eleve]: cible } };
    assert.equal((await appeler('/api/passages/apercu', { method: 'POST', cookie: prof, body: formulaire })).status, 403);
    const apercuChoix = await appeler('/api/passages/apercu', { method: 'POST', cookie: chef, body: formulaire });
    assert.equal(apercuChoix.status, 200);
    assert.equal(apercuChoix.data.empreinte, apercu.data.empreinte);
    assert.equal(apercuChoix.data.lignes[0].cible_id, cible);
    const saisir = { classe_id: source, matiere_id: e.matiere, periode_id: e.periodes[0].id,
      type: 'composition', notes: [{ eleve_id: eleve, valeur: 19 }] };
    assert.equal((await appeler('/api/passages/valider', { method: 'POST', cookie: prof,
      body: { classe_id: source, cible_id: cible, seuil: 10, empreinte: apercu.data.empreinte } })).status, 403);
    assert.equal((await appeler('/api/passages/valider', { method: 'POST', cookie: chef,
      body: { classe_id: source, cible_id: cible, seuil: 10, empreinte: apercu.data.empreinte } })).status, 409);
    fermerPeriodes(e);
    assert.equal((await appeler('/api/passages/valider', { method: 'POST', cookie: chef,
      body: { classe_id: source, cible_id: cible, seuil: 10, empreinte: 'incorrect' } })).status, 409);
    assert.equal((await appeler('/api/passages/valider', { method: 'POST', cookie: chef,
      body: { classe_id: source, cible_id: cible, seuil: 10, empreinte: apercu.data.empreinte } })).status, 200);
    assert.equal((await appeler('/api/notes/saisie', { method: 'POST', cookie: chef, body: saisir })).status, 409,
      'la direction ne peut plus modifier les notes d’une classe validée');
    assert.equal((await appeler(`/api/eleves/${eleve}`, { method: 'PUT', cookie: chef,
      body: { classe_id: source } })).status, 409,
      'un déplacement manuel ne doit pas contourner le passage confirmé');
    assert.equal((await appeler('/api/etablissement', { method: 'PUT', cookie: chef,
      body: { annee_scolaire: '2027-2028' } })).status, 409);
    assert.equal((await appeler('/api/etablissement', { method: 'PUT', cookie: chef,
      body: { formule_moyenne: 'moy_co' } })).status, 409);
    assert.equal((await appeler(`/api/classes/${source}`, { method: 'PUT', cookie: chef,
      body: { nom: '6ème Nouvelle' } })).status, 409);
    assert.equal((await appeler(`/api/matieres/${e.matiere}`, { method: 'PUT', cookie: chef,
      body: { nom: 'Algèbre' } })).status, 409);
    assert.equal((await appeler(`/api/periodes/${e.periodes[0].id}`, { method: 'PUT', cookie: chef,
      body: { statut: 'ouverte' } })).status, 409);
    const mauvaiseNote = await appeler('/api/notes/saisie', { method: 'POST', cookie: chef,
      body: { classe_id: cible, matiere_id: e.matiere, periode_id: e.periodes[0].id,
        type: 'composition', notes: [{ eleve_id: eleve, valeur: 19 }] } });
    assert.equal(mauvaiseNote.status, 200);
    assert.equal(mauvaiseNote.data.saved, 0, 'un élève promu ne rejoint pas les notes de l’ancienne 5ème');
    assert.equal((await appeler('/api/passages/historique?annee_scolaire=2026-2027', { cookie: chef })).data.length, 1);
    assert.equal((await appeler('/api/passages/annee-suivante', { method: 'POST', cookie: chef,
      body: { annee_scolaire: '2027-2028' } })).status, 200);
    const periodes = await appeler('/api/periodes', { cookie: chef });
    assert.equal(periodes.data.length, 3);
    assert.ok(periodes.data.every(p => p.annee_scolaire === '2027-2028'));
    const historiques = await appeler('/api/periodes?historique=1', { cookie: chef });
    assert.equal(historiques.data.length, 6, 'les anciennes périodes restent sélectionnables dans Bulletins');
    assert.equal((await appeler('/api/passages/historique?annee_scolaire=2026-2027', { cookie: chef })).data.length, 1);
    assert.equal((await appeler('/api/passages/options', { cookie: chef })).data.annees_archivees[0], '2026-2027');
    assert.equal((await appeler('/api/examens', { cookie: chef })).data.length, 0);
    assert.equal((await appeler('/api/examens?historique=1', { cookie: chef })).data[0].id, examenId);
    assert.equal((await appeler(`/api/examens/${examenId}`, { method: 'DELETE', cookie: chef })).status, 409);
    assert.equal((await appeler(`/api/examens/${examenId}/epreuves/${epreuveId}`, { method: 'DELETE', cookie: chef })).status, 409);
    const ancienExamen = await appeler(`/print/examen/${examenId}?classe_id=${source}`, { cookie: chef });
    assert.equal(ancienExamen.status, 200);
    assert.match(ancienExamen.data, /Année 2026-2027/);
    assert.equal((await appeler('/api/notes/saisie', { method: 'POST', cookie: chef, body: saisir })).status, 409,
      'une ancienne période reste protégée après ouverture de la nouvelle année');
    assert.equal((await appeler('/api/etablissement', { method: 'PUT', cookie: chef,
      body: { formule_moyenne: 'moy_co' } })).status, 200);
    assert.equal((await appeler(`/api/classes/${source}`, { method: 'PUT', cookie: chef,
      body: { nom: '6ème Nouvelle' } })).status, 200);
    const ancienResultat = await appeler(`/api/bulletins/classe?classe_id=${source}&periode_id=${e.periodes[0].id}`, { cookie: chef });
    assert.equal(ancienResultat.data.resultats.length, 1);
    assert.equal(ancienResultat.data.classe.nom, '6ème A', 'l’ancien nom de la classe est conservé');
    const decisionsAnciennes = await appeler('/api/passages/historique?annee_scolaire=2026-2027', { cookie: chef });
    assert.equal(decisionsAnciennes.data[0].classe_origine_nom, '6ème A');
    const dossier = await appeler(`/api/eleves/${eleve}`, { cookie: chef });
    assert.equal(dossier.data.historique.find(h => h.periode.id === e.periodes[0].id).classe_nom, '6ème A');
    assert.equal((await appeler(`/api/eleves/${eleve}?definitif=1`, { method: 'DELETE', cookie: chef })).status, 409,
      'la suppression définitive ne doit pas effacer les résultats');
    assert.equal((await appeler(`/api/eleves/${eleve}`, { method: 'DELETE', cookie: chef })).status, 200);
    assert.equal((await appeler(`/api/bulletins/classe?classe_id=${source}&periode_id=${e.periodes[0].id}`, { cookie: chef }))
      .data.resultats.length, 1, 'l’archivage ne fait pas disparaître les anciens bulletins');
    const ancienBulletin = await appeler(`/print/bulletin/${eleve}?periode_id=${e.periodes[0].id}`, { cookie: chef });
    assert.equal(ancienBulletin.status, 200);
    assert.match(ancienBulletin.data, /Année scolaire<strong>2026-2027<\/strong>/);
    assert.match(ancienBulletin.data, /6ème A/);
    assert.doesNotMatch(ancienBulletin.data, /6ème Nouvelle/);
  } finally {
    enfant.kill('SIGTERM');
    await new Promise(resolve => { if (enfant.exitCode !== null) resolve(); else enfant.once('exit', resolve); });
  }
});

// Les fichiers temporaires sont hors dépôt ; une exécution interrompue ne touche jamais à la base du site.
test.after(() => {
  try { db.close(); } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
});
