'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const R = require('../server/recuperation');
const gmail = require('../server/courriel');

function base() {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE utilisateurs (id INTEGER PRIMARY KEY, email TEXT UNIQUE, mot_de_passe TEXT,
      role TEXT, actif INTEGER DEFAULT 1);
    CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id INTEGER REFERENCES utilisateurs(id), expire_le TEXT);
    CREATE TABLE reinitialisations_mdp (jeton_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
      cree_le TEXT NOT NULL, expire_le TEXT NOT NULL, utilise_le TEXT);
    INSERT INTO utilisateurs VALUES (1,'chef@ecole.tg','ancien','directeur',1);
    INSERT INTO utilisateurs VALUES (2,'admin@ecole.tg','ancien-admin','super_admin',1);
    INSERT INTO utilisateurs VALUES (3,'prof@ecole.tg','ancien-prof','enseignant',1);
    INSERT INTO utilisateurs VALUES (4,'inactif@ecole.tg','ancien-inactif','directeur',0);
    INSERT INTO sessions VALUES ('s1',1,'2030-01-01'),('s2',1,'2030-01-01'),('prof',3,'2030-01-01');`);
  return db;
}

const horloge = Date.parse('2026-10-27T12:00:00.000Z');
const origine = 'https://kodjone.alwaysdata.net';
const jetonDuLien = lien => lien.match(/#\/reinitialiser\/([a-f0-9]{64})$/)?.[1];

// Chaque appel contrôle son instant ; aucun délai artificiel ni vrai courriel Gmail.
test('Rôles autorisés, adresse inconnue/inactive, jeton haché, expiration et usage unique', async () => {
  const db = base();
  const courriels = [];
  const envoyer = async details => { courriels.push(details); };
  const demande = email => R.demanderLien(db, email, { publicUrl: origine, envoyer, instant: horloge });
  assert.equal(R.normaliserEmail('chef@ecole.tg,autre'), '');
  assert.equal(R.normaliserEmail('chef@ecole.tg\nBcc: pirate@ailleurs.tg'), '');
  assert.deepEqual(await demande('inconnu@ecole.tg'), { envoye: false });
  assert.deepEqual(await demande('prof@ecole.tg'), { envoye: false });
  assert.deepEqual(await demande('inactif@ecole.tg'), { envoye: false });
  assert.equal(await demande('CHEF@ECOLE.TG').then(r => r.envoye), true);
  assert.equal(await demande('admin@ecole.tg').then(r => r.envoye), true);
  assert.equal(courriels.length, 2);
  const jeton = jetonDuLien(courriels[0].lien);
  assert.ok(jeton, 'un jeton aléatoire de 256 bits dans un fragment non journalisé');
  assert.equal(db.prepare('SELECT jeton_hash FROM reinitialisations_mdp WHERE user_id=1').get().jeton_hash.length, 64);
  assert.notEqual(db.prepare('SELECT jeton_hash FROM reinitialisations_mdp WHERE user_id=1').get().jeton_hash, jeton);
  assert.equal(R.lienValide(db, jeton, horloge + 29 * 60_000)?.id, 1);
  assert.equal(R.lienValide(db, jeton, horloge + 30 * 60_000), null);
  assert.equal(R.lienValide(db, jeton.slice(1), horloge), null);
  const changement = R.terminerLien(db, jeton, 'une très bonne phrase secrète', x => `haché:${x}`, horloge + 60_000);
  assert.deepEqual(changement, { ok: true });
  assert.equal(db.prepare('SELECT mot_de_passe FROM utilisateurs WHERE id=1').get().mot_de_passe,
    'haché:une très bonne phrase secrète');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id=1').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id=3').get().n, 1);
  assert.equal(R.lienValide(db, jeton, horloge + 2 * 60_000), null);
  assert.equal(R.terminerLien(db, jeton, 'une autre phrase secrète', x => x, horloge + 2 * 60_000).ok, false,
    'un lien déjà utilisé ne modifie plus le mot de passe');
  db.close();
});

test('Limitation des renvois, ancien lien révoqué après livraison, échec Gmail nettoyé', async () => {
  const db = base();
  let lien1, lien2;
  const options = (instant, envoyer) => ({ publicUrl: origine, envoyer, instant });
  await R.demanderLien(db, 'chef@ecole.tg', options(horloge, async d => { lien1 = d.lien; }));
  const attente = await R.demanderLien(db, 'chef@ecole.tg', options(horloge + 60_000, async () => {
    assert.fail('un renvoi trop rapide ne doit pas provoquer d’e-mail');
  }));
  assert.equal(attente.attente, true);
  assert.equal(R.lienValide(db, jetonDuLien(lien1), horloge + 60_000).id, 1);
  await assert.rejects(() => R.demanderLien(db, 'chef@ecole.tg',
    options(horloge + 11 * 60_000, async () => { throw new Error('smtp temporaire'); })), /smtp temporaire/);
  assert.equal(R.lienValide(db, jetonDuLien(lien1), horloge + 11 * 60_000).id, 1,
    'l’ancien lien reste utilisable si le nouveau n’est pas parti');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reinitialisations_mdp WHERE user_id=1').get().n, 1);
  await R.demanderLien(db, 'chef@ecole.tg',
    options(horloge + 11 * 60_000, async d => { lien2 = d.lien; }));
  assert.equal(R.lienValide(db, jetonDuLien(lien1), horloge + 11 * 60_000), null);
  assert.equal(R.lienValide(db, jetonDuLien(lien2), horloge + 11 * 60_000).id, 1);
  assert.equal(R.terminerLien(db, jetonDuLien(lien2), 'trop court', x => x, horloge + 12 * 60_000).ok, false);
  assert.equal(R.lienValide(db, jetonDuLien(lien2), horloge + 12 * 60_000).id, 1,
    'un mot de passe invalide ne consomme pas le lien');
  db.prepare('UPDATE utilisateurs SET actif=0 WHERE id=1').run();
  assert.equal(R.lienValide(db, jetonDuLien(lien2), horloge + 12 * 60_000), null);
  db.close();
});

test('Configuration Gmail : HTTPS fixe, TLS et message sûr ; aucun secret ni lien non fiable', async () => {
  const env = { GMAIL_USER: 'exemple@gmail.com', GMAIL_APP_PASSWORD: 'mot-de-passe-de-test',
    APP_PUBLIC_URL: origine, NODE_ENV: 'production' };
  const cfg = gmail.configuration(env);
  assert.equal(cfg.actif, true);
  assert.equal(cfg.smtp.host, 'smtp.gmail.com');
  assert.equal(cfg.smtp.port, 465);
  assert.equal(cfg.smtp.secure, true);
  assert.equal(cfg.smtp.tls.minVersion, 'TLSv1.2');
  assert.equal(gmail.configuration({ ...env, APP_PUBLIC_URL: 'http://kodjone.alwaysdata.net' }).actif, false);
  assert.equal(gmail.configuration({ ...env, APP_PUBLIC_URL: 'https://attacker@kodjone.alwaysdata.net' }).actif, false);
  assert.equal(gmail.configuration({ ...env, APP_PUBLIC_URL: origine + '/autre' }).actif, false);
  assert.equal(gmail.configuration({ ...env, GMAIL_APP_PASSWORD: '' }).actif, false);
  let message;
  await gmail.envoyerLien({ email: 'chef@ecole.tg', lien: origine + '/app#/reinitialiser/' + 'a'.repeat(64),
    minutes: 30 }, cfg, { sendMail: async mail => { message = mail; } });
  assert.equal(message.from.address, env.GMAIL_USER);
  assert.equal(message.to, 'chef@ecole.tg');
  assert.match(message.text, /valable 30 minutes/);
  assert.match(message.html, /Choisir un nouveau mot de passe/);
  assert.doesNotMatch(message.text + message.html, /mot-de-passe-de-test/);
});
