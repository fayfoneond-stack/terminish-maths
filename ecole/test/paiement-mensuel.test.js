'use strict';
/** Nouveau parcours : tests HTTP et SQLite isolés, aucun argent ou WhatsApp réel. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { createCanvas } = require('@napi-rs/canvas');
const Tarif = require('../server/tarifs-effectif');
const Preuve = require('../server/preuves-paiement');
const WhatsApp = require('../server/whatsapp-paiement');

async function portLibre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

async function serveur(t, { migration = false } = {}) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'terminish-paiement-mensuel-'));
  if (migration) {
    const ancienne = new DatabaseSync(path.join(dossier, 'terminish-ecole.db'));
    ancienne.exec(`CREATE TABLE paiements (id INTEGER PRIMARY KEY, ecole_id INTEGER, montant REAL,
      devise TEXT DEFAULT 'FCFA', plan TEXT, reference TEXT, statut TEXT, periode_debut TEXT,
      periode_fin TEXT, cree_le TEXT NOT NULL);
      INSERT INTO paiements (ecole_id,montant,plan,reference,statut,cree_le)
      VALUES (17,25000,'standard','ANCIEN-RECU-001','paye','2026-10-01');`);
    ancienne.close();
  }
  const port = await portLibre();
  const enfant = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), IP: '127.0.0.1', NODE_ENV: 'test',
      TERMINISH_DATA_DIR: dossier, TERMINISH_SEED: 'prod',
      ADMIN_EMAIL: 'admin-mensuel@test.tg', ADMIN_PASSWORD: 'mot-de-passe-local-de-test',
      WHATSAPP_ACCESS_TOKEN: '', WHATSAPP_PHONE_NUMBER_ID: '', WHATSAPP_ADMIN_DESTINATION: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let base;
  t.after(async () => {
    if (base) base.close();
    if (enfant.exitCode === null && enfant.signalCode === null) {
      enfant.kill('SIGTERM');
      await new Promise(resolve => {
        const limite = setTimeout(() => { enfant.kill('SIGKILL'); resolve(); }, 4000);
        enfant.once('exit', () => { clearTimeout(limite); resolve(); });
      });
    }
    fs.rmSync(dossier, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    let log = '';
    const limite = setTimeout(() => reject(new Error('Démarrage trop lent : ' + log)), 12000);
    enfant.stdout.on('data', b => {
      log += b.toString();
      if (log.includes('serveur démarré')) { clearTimeout(limite); resolve(); }
    });
    enfant.stderr.on('data', b => { log += b.toString(); });
    enfant.once('exit', code => { clearTimeout(limite); reject(new Error(`Arrêt serveur (${code}) : ${log}`)); });
  });
  base = new DatabaseSync(path.join(dossier, 'terminish-ecole.db'));
  base.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON');
  const appeler = async (uri, { method = 'GET', cookie, body } = {}) => {
    const r = await fetch(`http://127.0.0.1:${port}${uri}`, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const type = r.headers.get('content-type') || '';
    return { status: r.status, headers: r.headers, cookie: r.headers.get('set-cookie'),
      data: type.includes('application/json') ? await r.json()
        : type.includes('image/jpeg') || type.includes('application/pdf') ? Buffer.from(await r.arrayBuffer())
          : await r.text() };
  };
  const ok = async (uri, opt = {}) => {
    const r = await appeler(uri, opt);
    assert.equal(r.status, 200, `${opt.method || 'GET'} ${uri}: ${JSON.stringify(r.data).slice(0, 220)}`);
    return r.data;
  };
  const connecter = async (email, password) => {
    const r = await appeler('/api/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.cookie.split(';')[0];
  };
  const admin = await connecter('admin-mensuel@test.tg', 'mot-de-passe-local-de-test');
  const creerEcole = async (nom, email) => {
    const r = await appeler('/api/inscription', { method: 'POST', body: {
      etablissement: nom, nom: 'Chef test', email, password: 'chef-mensuel-local', type: 'college'
    } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return { id: r.data.ecole_id, cookie: r.cookie.split(';')[0] };
  };
  const suspendre = id => ok(`/api/admin/etablissements/${id}/abonnement`, {
    method: 'PATCH', cookie: admin, body: { action: 'suspendre', motif: 'Test paiement en consultation' }
  });
  return { dossier, base, appeler, ok, admin, creerEcole, suspendre };
}

function ajouterEleves(db, ecoleId, nombre, debut = 0) {
  const ins = db.prepare(`INSERT INTO eleves (ecole_id,matricule,nom,prenom,statut,cree_le)
    VALUES (?,?,?,?,?,?)`);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (let i = debut; i < debut + nombre; i++) {
      ins.run(ecoleId, `ELEVE-${i}`, 'Test', 'A', 'actif', '2026-10-31');
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

async function capturePNG(lignes = ['PAIEMENT MIXx BY YAS', 'REF: MP260531X12345',
  'MONTANT: 7 500 F CFA', 'NUMERO: +228 90 12 34 56']) {
  const c = createCanvas(1000, 500);
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#000'; x.font = 'bold 42px Arial';
  lignes.forEach((texte, i) => x.fillText(texte, 45, 90 + i * 95));
  return 'data:image/png;base64,' + (await c.encode('png')).toString('base64');
}

const declaration = (operateur = 'mixx', transaction_ref = 'TEST-20261031') => ({
  plan: 'effectif', mois: 1, option: 'reference', operateur,
  telephone_payeur: '+228 90 12 34 56', transaction_ref
});

test('Images malformées refusées et texte OCR traité seulement comme aide', async () => {
  await assert.rejects(Preuve.normaliserCapture('data:image/png;base64,PHNjcmlwdD5hPC9zY3JpcHQ+'),
    /corrompue|PNG/);
  await assert.rejects(Preuve.normaliserCapture('data:image/jpeg;base64,' + Buffer.alloc(300).toString('base64')),
    /JPEG/);
  const petite = createCanvas(30, 30);
  await assert.rejects(Preuve.normaliserCapture('data:image/png;base64,' +
    (await petite.encode('png')).toString('base64')), /Dimensions/);
  assert.deepEqual(Preuve.extraire('ID TRANSACTION: TG20261031Z9', 7500).references, ['TG20261031Z9']);
  assert.match(Preuve.extraire('MONTANT 15 000 F CFA', 7500).alertes.join(' '), /ne correspond pas/);
});

test('Tranches 0 / 299 / 300 / 999 / 1000, élèves archivés exclus, et ancien parcours rejeté',
  { timeout: 30000 }, async t => {
    assert.deepEqual([0, 299, 300, 999, 1000].map(n => Tarif.tarifPourEffectif(n).montant),
      [7500, 7500, 15000, 15000, 20000]);
    assert.throws(() => Tarif.tarifPourEffectif(-1));
    const { base, appeler, ok, creerEcole, admin } = await serveur(t);
    const a = await creerEcole('École tarif', 'tarif@test.tg');
    const b = await creerEcole('École autre', 'autre@test.tg');
    const prix = async () => (await ok('/api/paiement/options', { cookie: a.cookie })).tarif;
    assert.deepEqual({ e: (await prix()).effectif, m: (await prix()).montant }, { e: 0, m: 7500 });
    ajouterEleves(base, a.id, 299);
    assert.deepEqual({ e: (await prix()).effectif, m: (await prix()).montant }, { e: 299, m: 7500 });
    ajouterEleves(base, a.id, 1, 299);
    assert.deepEqual({ e: (await prix()).effectif, m: (await prix()).montant }, { e: 300, m: 15000 });
    ajouterEleves(base, a.id, 699, 300);
    assert.equal((await prix()).montant, 15000);
    ajouterEleves(base, a.id, 1, 999);
    assert.deepEqual({ e: (await prix()).effectif, m: (await prix()).montant }, { e: 1000, m: 20000 });
    base.prepare("UPDATE eleves SET statut='archive' WHERE ecole_id=? AND matricule='ELEVE-999'").run(a.id);
    assert.equal((await prix()).montant, 15000, 'l’archivé est exclu');
    assert.equal((await ok('/api/paiement/options', { cookie: b.cookie })).tarif.effectif, 0,
      'autre école isolée');
    assert.equal((await ok(`/api/admin/paiements/tarif?ecole_id=${a.id}`, { cookie: admin })).effectif, 999);
    assert.equal((await appeler(`/api/admin/paiements/tarif?ecole_id=${a.id}`, { cookie: a.cookie })).status, 403);
    const opts = await ok('/api/paiement/options', { cookie: a.cookie });
    assert.deepEqual(opts.durees.map(x => x.mois), [1]);
    assert.deepEqual(opts.plans.map(x => x.code), ['effectif']);
    assert.equal(opts.whatsapp_api.actif, false);
    const ancien = await appeler('/api/paiement/declarer', { method: 'POST', cookie: a.cookie,
      body: { ...declaration(), plan: 'standard', mois: 12 } });
    assert.equal(ancien.status, 400);
    assert.equal((await appeler('/api/paiement/cinetpay/initier', {
      method: 'POST', cookie: a.cookie, body: {} })).status, 410);
    assert.equal((await appeler('/api/admin/paiements', { method: 'POST', cookie: admin,
      body: { ecole_id: a.id, plan: 'effectif', montant: 7500, duree_jours: 30 } })).status, 400,
    'même l’admin ne peut pas facturer une mauvaise tranche');
    assert.equal(base.prepare('SELECT COUNT(*) AS n FROM paiements WHERE ecole_id=?').get(a.id).n, 0);
  });

test('Référence + téléphone : dossier en attente, reçu verrouillé, accord humain et annulation sûre',
  { timeout: 30000 }, async t => {
    const { base, appeler, ok, admin, creerEcole, suspendre } = await serveur(t);
    const a = await creerEcole('École suspendue', 'suspendu@test.tg');
    const b = await creerEcole('École voisine', 'voisine@test.tg');
    await suspendre(a.id);
    const p = await ok('/api/paiement/declarer', { method: 'POST', cookie: a.cookie,
      body: { ...declaration('mixx', 'MM-SANS-CAPTURE-26'), montant: 1 } });
    assert.equal(p.montant, 7500, 'le serveur ignore le prix transmis par le client');
    assert.equal(p.effectif, 0);
    assert.equal(p.statut, 'en_attente');
    assert.equal(p.notification_whatsapp, 'non_configure');
    assert.equal((await appeler('/api/admin/paiements', { method: 'POST', cookie: admin,
      body: { ecole_id: a.id, montant: 7500, plan: 'effectif', reference: 'ADMIN-DOIT-CONFIRMER' }
    })).status, 400, 'encaissement direct sans confirmation du relevé interdit');
    assert.equal((await appeler('/api/admin/paiements', { method: 'POST', cookie: admin,
      body: { ecole_id: a.id, montant: 7500, plan: 'effectif', reference: 'MM-SANS-CAPTURE-26',
        operateur: 'mixx', confirmation_releve: true } })).status, 409,
    'même le super-admin ne peut pas réutiliser la référence encore en attente');
    assert.equal((await ok('/api/me', { cookie: a.cookie })).etablissement.statut, 'suspendu');
    assert.equal((await appeler(`/api/paiements/${p.id}/recu.pdf`, { cookie: a.cookie })).status, 400);
    assert.equal((await appeler(`/api/paiements/${p.id}/preuve`, { cookie: a.cookie })).status, 404);
    assert.deepEqual(await ok('/api/paiements', { cookie: b.cookie }), []);
    assert.equal((await appeler('/api/paiement/declarer', { method: 'POST', cookie: b.cookie,
      body: declaration('mixx', 'MM-SANS-CAPTURE-26') })).status, 409, 'même transaction non réutilisable');
    assert.equal((await appeler(`/api/paiements/${p.id}/recu.pdf`, { cookie: b.cookie })).status, 403);
    assert.equal((await appeler(`/api/admin/paiements/${p.id}/notifier`, { method: 'POST',
      cookie: a.cookie, body: {} })).status, 403);
    assert.equal((await ok(`/api/admin/paiements/${p.id}/notifier`, { method: 'POST',
      cookie: admin, body: {} })).statut, 'non_configure');
    assert.equal((await appeler(`/api/admin/paiements/${p.id}`, { method: 'PATCH',
      cookie: b.cookie, body: { action: 'valider' } })).status, 403);
    assert.equal((await ok(`/api/admin/paiements/${p.id}`, { method: 'PATCH',
      cookie: admin, body: { action: 'valider' } })).statut, 'paye');
    assert.equal((await ok('/api/me', { cookie: a.cookie })).etablissement.statut, 'actif');
    assert.equal(base.prepare('SELECT plan,mois,effectif_facture FROM paiements WHERE id=?').get(p.id).plan, 'effectif');
    const recu = await ok(`/api/paiements/${p.id}/recu.pdf`, { cookie: a.cookie });
    assert.ok(recu.subarray(0, 5).equals(Buffer.from('%PDF-')));
    assert.equal((await appeler(`/api/admin/paiements/${p.id}/notifier`, { method: 'POST',
      cookie: admin, body: {} })).status, 409, 'pas d’envoi après validation');
    await ok(`/api/admin/paiements/${p.id}`, { method: 'PATCH', cookie: admin,
      body: { action: 'annuler', motif: 'Paiement mal attribué' } });
    assert.equal((await appeler(`/api/paiements/${p.id}/recu.pdf`, { cookie: a.cookie })).status, 400);
    assert.equal(base.prepare('SELECT statut FROM paiements WHERE id=?').get(p.id).statut, 'annule');
  });

test('Capture PNG privée : OCR indicatif, duplication bloquée, accès école/admin limité',
  { timeout: 30000 }, async t => {
    const { dossier, base, appeler, ok, admin, creerEcole, suspendre } = await serveur(t);
    const a = await creerEcole('École photo', 'photo@test.tg');
    const b = await creerEcole('Autre école', 'voisin-photo@test.tg');
    await ok('/api/enseignants', { method: 'POST', cookie: a.cookie, body: {
      nom: 'Professeur local', email: 'prof-photo@test.tg', password: 'prof-local-2026'
    } });
    const prof = await (async () => {
      const r = await appeler('/api/auth/login', { method: 'POST',
        body: { email: 'prof-photo@test.tg', password: 'prof-local-2026' } });
      assert.equal(r.status, 200);
      return r.cookie.split(';')[0];
    })();
    const capture = await capturePNG();
    await suspendre(a.id);
    const p = await ok('/api/paiement/declarer', { method: 'POST', cookie: a.cookie,
      body: { plan: 'effectif', option: 'capture', mois: 1, operateur: 'mixx', capture } });
    assert.equal(p.statut, 'en_attente', 'OCR n’active jamais');
    assert.ok(p.analyse, 'image analysée automatiquement');
    assert.ok(p.analyse.montants.includes(7500), JSON.stringify(p.analyse));
    assert.ok(p.analyse.references.includes('MP260531X12345'), JSON.stringify(p.analyse));
    const row = base.prepare('SELECT * FROM paiements WHERE id=?').get(p.id);
    assert.equal(row.preuve_analyse.includes('MIXx BY YAS'), false, 'texte brut OCR non conservé');
    assert.equal(row.notification_whatsapp, 'non_configure');
    assert.equal(row.telephone_payeur, '22890123456', 'numéro lu sans prendre le numéro marchand');
    assert.match(row.preuve_fichier, /^[0-9a-f-]{36}\.jpg$/);
    const fichier = path.join(dossier, 'preuves-paiement', row.preuve_fichier);
    assert.equal(fs.statSync(fichier).mode & 0o777, 0o600);
    const image = await appeler(`/api/paiements/${p.id}/preuve`, { cookie: a.cookie });
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/jpeg');
    assert.match(image.headers.get('cache-control'), /no-store/);
    assert.equal(image.data[0], 0xff);
    assert.equal((await appeler(`/api/paiements/${p.id}/preuve`, { cookie: b.cookie })).status, 404);
    assert.equal((await appeler(`/api/paiements/${p.id}/preuve`, { cookie: prof })).status, 403);
    assert.equal((await appeler(`/api/paiements/${p.id}/preuve`)).status, 401);
    assert.equal((await appeler(`/api/admin/paiements/${p.id}/preuve`, { cookie: b.cookie })).status, 403);
    assert.equal((await appeler(`/api/admin/paiements/${p.id}/preuve`, { cookie: admin })).status, 200);
    assert.equal((await appeler(`/data/preuves-paiement/${row.preuve_fichier}`)).status, 404);
    assert.equal(Preuve.lireFichier('../secret'), null);
    const doublon = await appeler('/api/paiement/declarer', { method: 'POST', cookie: b.cookie,
      body: { option: 'capture', operateur: 'mixx', capture } });
    assert.equal(doublon.status, 409, JSON.stringify(doublon.data));
    assert.equal((await appeler(`/api/paiements/${p.id}/recu.pdf`, { cookie: a.cookie })).status, 400);
  });

test('Capture sans ID lisible acceptée pour vérification ; OCR n’est pas un justificatif d’encaissement',
  { timeout: 30000 }, async t => {
    const { base, appeler, ok, admin, creerEcole } = await serveur(t);
    const a = await creerEcole('École OCR', 'ocr@test.tg');
    const image = await capturePNG(['PAIEMENT A CONTROLER', 'INFORMATIONS NON LISIBLES']);
    const p = await ok('/api/paiement/declarer', { method: 'POST', cookie: a.cookie,
      body: { plan: 'effectif', option: 'capture', operateur: 'moov', capture: image } });
    assert.equal(p.statut, 'en_attente');
    assert.equal(base.prepare('SELECT transaction_ref FROM paiements WHERE id=?').get(p.id).transaction_ref, null);
    assert.match(p.analyse.alertes.join(' '), /identifiant illisible/i);
    assert.equal((await appeler(`/api/paiements/${p.id}/recu.pdf`, { cookie: a.cookie })).status, 400);
    assert.equal((await appeler('/api/paiement/declarer', { method: 'POST', cookie: a.cookie,
      body: { ...declaration('moov', 'MM-TEST-CAPTURE-26'), capture: image } })).status, 400,
    'référence et capture sont des choix exclusifs');
    assert.equal((await appeler('/api/paiement/declarer', { method: 'POST', cookie: a.cookie,
      body: { ...declaration('moov', 'MM-TEST-CAPTURE-26'), telephone_payeur: '' } })).status, 400);
    await ok(`/api/admin/paiements/${p.id}`, { method: 'PATCH', cookie: admin,
      body: { action: 'rejeter', note: 'Aucun encaissement sur notre relevé' } });
    assert.equal(base.prepare('SELECT statut FROM paiements WHERE id=?').get(p.id).statut, 'rejete');
  });

test('Nouvelle tranche entre déclaration et accord : montant insuffisant, aucun reçu ni activation',
  { timeout: 30000 }, async t => {
    const { base, appeler, ok, admin, creerEcole, suspendre } = await serveur(t);
    const a = await creerEcole('École croissance', 'croissance@test.tg');
    ajouterEleves(base, a.id, 299);
    await suspendre(a.id);
    const p = await ok('/api/paiement/declarer', { method: 'POST', cookie: a.cookie,
      body: declaration('moov', 'MM-MONTEE-300') });
    assert.equal(p.montant, 7500);
    ajouterEleves(base, a.id, 1, 299);
    const refuse = await appeler(`/api/admin/paiements/${p.id}`, { method: 'PATCH', cookie: admin,
      body: { action: 'valider' } });
    assert.equal(refuse.status, 409, JSON.stringify(refuse.data));
    assert.equal(base.prepare('SELECT statut FROM paiements WHERE id=?').get(p.id).statut, 'en_attente');
    assert.equal((await ok('/api/me', { cookie: a.cookie })).etablissement.statut, 'suspendu');
    assert.equal((await appeler(`/api/paiements/${p.id}/recu.pdf`, { cookie: a.cookie })).status, 400);
  });

test('Encaissement direct de l’éditeur : confirmation exigée, tarif serveur, référence non réutilisable',
  { timeout: 30000 }, async t => {
    const { base, appeler, ok, admin, creerEcole } = await serveur(t);
    const a = await creerEcole('École encaissement direct', 'direct@test.tg');
    ajouterEleves(base, a.id, 300);
    const corps = { ecole_id: a.id, plan: 'effectif', montant: 15000, duree_jours: 30,
      operateur: 'moov', reference: 'FLOOZ-RELEVE-2026-31', confirmation_releve: true };
    assert.equal((await appeler('/api/admin/paiements', { method: 'POST', cookie: admin,
      body: { ...corps, duree_jours: 60 } })).status, 400);
    const p = await ok('/api/admin/paiements', { method: 'POST', cookie: admin, body: corps });
    assert.equal(p.montant, 15000);
    const row = base.prepare('SELECT * FROM paiements WHERE id=?').get(p.id);
    assert.equal(row.effectif_facture, 300);
    assert.equal(row.plan, 'effectif');
    assert.equal(row.mois, 1);
    assert.equal(row.transaction_ref_norm, 'FLOOZRELEVE202631');
    assert.equal((await ok('/api/me', { cookie: a.cookie })).etablissement.statut, 'actif');
    assert.ok((await ok(`/api/paiements/${p.id}/recu.pdf`, { cookie: a.cookie })).length > 500);
    assert.equal((await appeler('/api/paiement/declarer', { method: 'POST', cookie: a.cookie,
      body: declaration('moov', 'FLOOZ-RELEVE-2026-31') })).status, 409);
  });

test('Migration depuis une base avec anciens paiements : aucune perte, colonnes et index prêts',
  { timeout: 30000 }, async t => {
    const { base } = await serveur(t, { migration: true });
    const old = base.prepare("SELECT * FROM paiements WHERE reference = 'ANCIEN-RECU-001'").get();
    assert.equal(old.plan, 'standard');
    assert.equal(old.montant, 25000);
    assert.equal(old.preuve_fichier, null);
    for (const col of ['effectif_facture', 'tarif_code', 'preuve_fichier', 'preuve_analyse',
      'preuve_empreinte', 'transaction_ref_norm', 'notification_whatsapp', 'notification_le']) {
      assert.ok(Object.hasOwn(old, col), col);
    }
  });

test('WhatsApp : API désactivée sans configuration ; faux envoi testé et jamais doublé', async () => {
  assert.equal(WhatsApp.configuration({}).actif, false);
  const env = { WHATSAPP_PHONE_NUMBER_ID: '1234567890',
    WHATSAPP_ACCESS_TOKEN: 'faux-jeton-uniquement-pour-tests',
    WHATSAPP_ADMIN_DESTINATION: '22893150178' };
  assert.equal(WhatsApp.configuration(env).actif, true);
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE etablissements (id INTEGER PRIMARY KEY, nom TEXT);
    CREATE TABLE paiements (id INTEGER PRIMARY KEY, ecole_id INTEGER, canal TEXT, statut TEXT,
      montant REAL, operateur TEXT, telephone_payeur TEXT, transaction_ref TEXT, reference TEXT,
      effectif_facture INTEGER, notification_whatsapp TEXT, notification_le TEXT);
    INSERT INTO etablissements VALUES (1, 'École locale');
    INSERT INTO paiements (id,ecole_id,canal,statut,montant,operateur,telephone_payeur,
      transaction_ref,reference,effectif_facture) VALUES
      (1,1,'manuel','en_attente',15000,'mixx','22890123456','MM-001','DOSSIER-01',345);`);
  let appels = 0, corps;
  const simulation = async (url, options) => {
    appels++;
    assert.match(url, /^https:\/\/graph\.facebook\.com\/v23\.0\/1234567890\/messages$/);
    corps = JSON.parse(options.body);
    await new Promise(resolve => setTimeout(resolve, 15));
    return { ok: true, json: async () => ({ messages: [{ id: 'message-de-test' }] }) };
  };
  const [premier, second] = await Promise.all([
    WhatsApp.notifierPaiement(db, 1, simulation, env),
    WhatsApp.notifierPaiement(db, 1, simulation, env)
  ]);
  assert.equal(premier.statut, 'envoye');
  assert.ok(['en_cours', 'envoye'].includes(second.statut));
  assert.equal(appels, 1, 'un seul appel réseau malgré deux demandes simultanées');
  assert.equal(corps.template.components[0].parameters.length, 6);
  assert.match(corps.template.components[0].parameters.map(x => x.text).join(' '), /École locale.*15.*22890123456.*MM-001/);
  assert.equal((await WhatsApp.notifierPaiement(db, 1, simulation, env)).deja, true);
  assert.equal(db.prepare('SELECT notification_whatsapp FROM paiements WHERE id=1').get().notification_whatsapp, 'envoye');
  db.exec(`INSERT INTO paiements (id,ecole_id,canal,statut,montant,operateur,reference)
    VALUES (2,1,'manuel','en_attente',7500,'moov','DOSSIER-02')`);
  const echec = await WhatsApp.notifierPaiement(db, 2, async () => ({ ok: false, status: 503 }), env);
  assert.equal(echec.statut, 'echec');
  assert.equal(db.prepare('SELECT statut FROM paiements WHERE id=2').get().statut, 'en_attente',
    'échec d’alerte n’active jamais l’abonnement');
  assert.equal((await WhatsApp.notifierPaiement(db, 2, simulation, env)).statut, 'envoye',
    'l’éditeur peut relancer après un échec');
  db.close();
});
