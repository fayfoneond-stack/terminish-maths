'use strict';
/** Parcours HTTP avec Gmail simulé : aucune donnée réelle, aucun réseau SMTP. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const PDFDocument = require('pdfkit');

function portLibre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

function pdf(texte) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4' });
    const morceaux = [];
    doc.on('data', c => morceaux.push(c));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);
    doc.fontSize(15).text('Liste des élèves — 6ème A', 45, 45);
    doc.fontSize(11).text(texte, 45, 100);
    doc.end();
  });
}

async function attendre(verifier, label) {
  const limite = Date.now() + 5000;
  do {
    const resultat = await verifier();
    if (resultat) return resultat;
    await new Promise(resolve => setTimeout(resolve, 35));
  } while (Date.now() < limite);
  assert.fail(`Attente dépassée : ${label}`);
}

async function serveur(t, { gmail = true } = {}) {
  const port = await portLibre();
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'terminish-gmail-test-'));
  const capture = path.join(dossier, 'messages.jsonl');
  const enfant = spawn(process.execPath, [
    '--require', path.join(__dirname, 'fixtures', 'gmail-simule.js'), 'server/index.js'
  ], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), IP: '127.0.0.1', NODE_ENV: 'test',
      TERMINISH_DATA_DIR: dossier, TERMINISH_SEED: 'prod',
      ADMIN_EMAIL: 'admin@test.tg', ADMIN_PASSWORD: 'test-admin-local',
      APP_PUBLIC_URL: `http://127.0.0.1:${port}`, GMAIL_USER: 'simulateur@gmail.com',
      GMAIL_APP_PASSWORD: gmail ? 'faux-mot-de-passe-de-test' : '', TEST_MAIL_CAPTURE: capture
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let base;
  t.after(async () => {
    if (base) base.close();
    if (enfant.exitCode === null && enfant.signalCode === null) {
      enfant.kill('SIGTERM');
      await new Promise(resolve => {
        const minuteur = setTimeout(() => {
          if (enfant.exitCode === null && enfant.signalCode === null) enfant.kill('SIGKILL');
          resolve();
        }, 4000);
        enfant.once('exit', () => { clearTimeout(minuteur); resolve(); });
      });
    }
    fs.rmSync(dossier, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    let journal = '';
    const minuterie = setTimeout(() => reject(new Error(`Serveur non prêt : ${journal}`)), 12000);
    enfant.stdout.on('data', b => {
      journal += b.toString();
      if (journal.includes('serveur démarré')) { clearTimeout(minuterie); resolve(); }
    });
    enfant.stderr.on('data', b => { journal += b.toString(); });
    enfant.once('exit', code => { clearTimeout(minuterie); reject(new Error(`Serveur arrêté ${code} : ${journal}`)); });
  });
  base = new DatabaseSync(path.join(dossier, 'terminish-ecole.db'));
  base.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
  const appeler = async (uri, { cookie, method = 'GET', body, pdf: fichier } = {}) => {
    const reponse = await fetch(`http://127.0.0.1:${port}${uri}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(fichier ? { 'content-type': 'application/pdf' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), ...(fichier ? { body: fichier } : {})
    });
    const type = reponse.headers.get('content-type') || '';
    return { status: reponse.status, cookie: reponse.headers.get('set-cookie'),
      data: type.includes('application/json') ? await reponse.json() : await reponse.text() };
  };
  const messages = () => fs.existsSync(capture)
    ? fs.readFileSync(capture, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  return { appeler, messages, base };
}

const jetonDuMessage = m => m.texte.match(/#\/reinitialiser\/([a-f0-9]{64})/)?.[1];

test('HTTP : courriel Gmail simulé, chef/admin seulement, enseignants par le chef, lien consommé', { timeout: 30000 }, async t => {
  const { appeler, messages, base } = await serveur(t);
  const dir = await appeler('/api/inscription', { method: 'POST', body: {
    etablissement: 'École de test', nom: 'Direction Test', email: 'chef@test.tg',
    password: 'ancien-chef-test', type: 'college'
  } });
  assert.equal(dir.status, 200);
  const cookie = dir.cookie.split(';')[0];
  const prof = await appeler('/api/enseignants', { method: 'POST', cookie, body: {
    nom: 'Enseignant test', email: 'prof@test.tg', password: 'ancien-prof-test'
  } });
  assert.equal(prof.status, 200);
  const inconnu = await appeler('/api/auth/oubli', { method: 'POST', body: { email: 'inconnu@test.tg' } });
  const enseignant = await appeler('/api/auth/oubli', { method: 'POST', body: {
    email: 'prof@test.tg', message: 'Besoin du chef'
  } });
  const chef = await appeler('/api/auth/oubli', { method: 'POST', body: { email: 'CHEF@TEST.TG' } });
  assert.equal(chef.status, 200);
  assert.equal(inconnu.data.message, chef.data.message, 'pas de fuite sur les adresses existantes');
  assert.equal(enseignant.data.message, chef.data.message, 'pas de fuite sur les rôles');
  const mail = await attendre(() => messages().find(m => m.destinataire === 'chef@test.tg'), 'lien de direction');
  assert.equal(messages().length, 1, 'aucun courriel pour un enseignant ou un inconnu');
  assert.equal(jetonDuMessage(mail).length, 64);
  assert.ok(mail.texte.includes('/app#/reinitialiser/'));
  assert.equal(base.prepare('SELECT COUNT(*) AS n FROM demandes_mdp WHERE email=?').get('chef@test.tg').n, 0);
  await attendre(() => base.prepare('SELECT id FROM demandes_mdp WHERE email=?').get('prof@test.tg'), 'demande enseignant');
  const demandes = await appeler('/api/demandes-mdp', { cookie });
  assert.ok(demandes.data.some(d => d.email === 'prof@test.tg' && d.role === 'enseignant'));
  const ancien = jetonDuMessage(mail);
  assert.equal((await appeler('/api/auth/recuperation/verifier', { method: 'POST', body: { jeton: ancien } })).data.valide, true);
  const court = await appeler('/api/auth/recuperation/terminer', { method: 'POST', body: {
    jeton: ancien, nouveau: 'trop-court'
  } });
  assert.equal(court.status, 400);
  assert.equal((await appeler('/api/auth/recuperation/verifier', { method: 'POST', body: { jeton: ancien } })).data.valide, true);
  const nouveau = 'phrase-secrete-fiable-2026';
  assert.equal((await appeler('/api/auth/recuperation/terminer', { method: 'POST', body: {
    jeton: ancien, nouveau
  } })).status, 200);
  assert.equal((await appeler('/api/me', { cookie })).status, 401, 'anciennes sessions fermées');
  assert.equal((await appeler('/api/auth/login', { method: 'POST', body: {
    email: 'chef@test.tg', password: 'ancien-chef-test'
  } })).status, 401);
  const reconnecte = await appeler('/api/auth/login', { method: 'POST', body: {
    email: 'chef@test.tg', password: nouveau
  } });
  assert.equal(reconnecte.status, 200);
  assert.equal((await appeler('/api/auth/recuperation/terminer', { method: 'POST', body: {
    jeton: ancien, nouveau: 'autre-phrase-secrete-2026'
  } })).status, 400, 'le même lien est à usage unique');
  await appeler('/api/auth/oubli', { method: 'POST', body: { email: 'chef@test.tg' } });
  const mailPlusTard = await attendre(() => messages().filter(m => m.destinataire === 'chef@test.tg')[1],
    'nouveau lien après utilisation');
  const jetonEnAttente = jetonDuMessage(mailPlusTard);
  assert.equal((await appeler('/api/auth/password', { method: 'POST',
    cookie: reconnecte.cookie.split(';')[0], body: {
      ancien: nouveau, nouveau: 'changement-depuis-le-compte'
    } })).status, 200);
  assert.equal((await appeler('/api/auth/recuperation/verifier', { method: 'POST',
    body: { jeton: jetonEnAttente } })).data.valide, false,
  'modifier soi-même le mot de passe révoque les liens restants');
  assert.equal((await appeler('/api/auth/oubli', { method: 'POST', body: {
    email: 'admin@test.tg'
  } })).status, 200);
  const adminMail = await attendre(() => messages().find(m => m.destinataire === 'admin@test.tg'), 'lien administrateur');
  assert.equal((await appeler('/api/auth/recuperation/verifier', { method: 'POST', body: {
    jeton: jetonDuMessage(adminMail)
  } })).data.valide, true);
});

test('HTTP : PDF → élève sans naissance → compléter plus tard sans modifier les notes ; droits', { timeout: 30000 }, async t => {
  const { appeler, base } = await serveur(t, { gmail: false });
  const dir = await appeler('/api/inscription', { method: 'POST', body: {
    etablissement: 'École de test PDF', nom: 'Chef PDF', email: 'pdf@test.tg',
    password: 'ancien-chef-test', type: 'college'
  } });
  const cookie = dir.cookie.split(';')[0];
  const classe = await appeler('/api/classes', { method: 'POST', cookie, body: {
    nom: '6ème A', niveau: '6ème', cycle: 'college'
  } });
  assert.equal(classe.status, 200);
  const fichier = await pdf('1 20260001 KOUASSI Elom\n2 20260002 DOSSEH Kofi');
  const lu = await appeler('/api/eleves/import-pdf/analyser', { method: 'POST', cookie, pdf: fichier });
  assert.equal(lu.status, 200, JSON.stringify(lu.data));
  assert.equal(lu.data.eleves.length, 2);
  const lignes = lu.data.eleves.map(e => ({ ...e, classe_id: classe.data.id }));
  const apercu = await appeler('/api/eleves/import-pdf/verifier', { method: 'POST', cookie, body: { lignes } });
  assert.equal(apercu.status, 200);
  assert.deepEqual(apercu.data.statuts.map(x => x.etat), ['pret', 'pret']);
  assert.equal((await appeler('/api/eleves', { cookie })).data.length, 0, 'aperçu sans écriture');
  const conf = await appeler('/api/eleves/import-pdf/confirmer', { method: 'POST', cookie, body: { lignes } });
  assert.equal(conf.status, 200);
  assert.equal(conf.data.crees, 2);
  const eleve = conf.data.eleves[0];
  assert.equal((await appeler('/api/eleves', { cookie })).data.find(e => e.id === eleve.id).date_naissance, '');
  assert.equal((await appeler('/api/dashboard', { cookie })).data.compteurs.dossiers_a_completer, 2,
    'le chef voit les dossiers à traiter sur son tableau de bord');
  assert.equal((await appeler('/api/eleves/import-pdf/confirmer', { method: 'POST', cookie,
    body: { lignes } })).data.crees, 0, 'réimport sans doublon');
  const materiel = base.prepare("INSERT INTO matieres(ecole_id, nom) VALUES (?, 'Mathématiques')").run(dir.data.ecole_id);
  const periode = base.prepare('SELECT id FROM periodes WHERE ecole_id=? ORDER BY ordre LIMIT 1').get(dir.data.ecole_id);
  const ev = Number(base.prepare(`INSERT INTO evaluations(ecole_id,classe_id,matiere_id,periode_id,type,cree_le)
    VALUES (?,?,?,?,'composition',?)`).run(dir.data.ecole_id, classe.data.id, Number(materiel.lastInsertRowid),
    periode.id, new Date().toISOString()).lastInsertRowid);
  base.prepare('INSERT INTO notes(evaluation_id,eleve_id,valeur,modifie_le) VALUES (?,?,?,?)')
    .run(ev, eleve.id, 17.25, new Date().toISOString());
  assert.equal((await appeler(`/api/eleves/${eleve.id}`, { cookie })).data.eleve.date_naissance, '');
  const correction = await appeler(`/api/eleves/${eleve.id}`, { method: 'PUT', cookie, body: {
    nom: eleve.nom, prenom: 'Elom', classe_id: classe.data.id,
    sexe: 'M', date_naissance: '2012-04-03', lieu_naissance: 'Lomé',
    tuteur_nom: 'KOUASSI Akou', tuteur_tel: '+228 90 01 02 03', statut: 'actif'
  } });
  assert.equal(correction.status, 200, JSON.stringify(correction.data));
  const apres = (await appeler('/api/eleves', { cookie })).data.find(e => e.id === eleve.id);
  assert.equal(apres.date_naissance, '2012-04-03');
  assert.equal(apres.lieu_naissance, 'Lomé');
  assert.equal(apres.tuteur_nom, 'KOUASSI Akou');
  assert.equal((await appeler('/api/dashboard', { cookie })).data.compteurs.dossiers_a_completer, 1,
    'un dossier complété disparaît du décompte sans effacer le second');
  assert.equal(base.prepare('SELECT valeur FROM notes WHERE eleve_id=?').get(eleve.id).valeur, 17.25);
  assert.equal((await appeler(`/api/eleves/${eleve.id}`, { method: 'PUT', cookie,
    body: { date_naissance: '2012-02-31' } })).status, 400, 'date impossible refusée');
  assert.equal((await appeler(`/api/eleves/${eleve.id}`, { method: 'PUT', cookie,
    body: { date_naissance: '2040-01-01' } })).status, 400, 'date future refusée');
  assert.equal((await appeler('/api/eleves', { cookie })).data.find(e => e.id === eleve.id).date_naissance, '2012-04-03');
  const prof = await appeler('/api/enseignants', { method: 'POST', cookie, body: {
    nom: 'Prof test', email: 'prof-pdf@test.tg', password: 'test-prof-local'
  } });
  assert.equal(prof.status, 200);
  const enseignant = await appeler('/api/auth/login', { method: 'POST', body: {
    email: 'prof-pdf@test.tg', password: 'test-prof-local'
  } });
  const cookieProf = enseignant.cookie.split(';')[0];
  assert.equal((await appeler('/api/eleves/import-pdf/confirmer', { method: 'POST', cookie: cookieProf,
    body: { lignes } })).status, 403, 'import réservé à la direction');
  assert.equal((await appeler(`/api/eleves/${eleve.id}`, { method: 'PUT', cookie: cookieProf,
    body: { date_naissance: '2010-01-01' } })).status, 403, 'complément réservé à la direction');
  const oubli = await appeler('/api/auth/oubli', { method: 'POST', body: { email: 'pdf@test.tg' } });
  assert.match(oubli.data.message, /pas encore configuré/i);
  assert.equal(base.prepare('SELECT COUNT(*) AS n FROM reinitialisations_mdp').get().n, 0,
    'aucun lien fictif sans configuration Gmail');
  const demandeProf = await appeler('/api/auth/oubli', { method: 'POST', body: {
    email: 'prof-pdf@test.tg'
  } });
  assert.equal(demandeProf.data.message, oubli.data.message);
  await attendre(() => base.prepare('SELECT id FROM demandes_mdp WHERE email=?').get('prof-pdf@test.tg'),
    'demande enseignant même sans Gmail');
});
