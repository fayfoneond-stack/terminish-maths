'use strict';
/** Parcours HTTP réel sur une base temporaire : jamais sur alwaysdata. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { autoriseEnSuspension } = require('../server/acces-abonnement');

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

async function serveur(t) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'terminish-suspension-'));
  const port = await portLibre();
  const enfant = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), IP: '127.0.0.1',
      TERMINISH_DATA_DIR: dossier, TERMINISH_SEED: 'prod', NODE_ENV: 'test',
      ADMIN_EMAIL: 'admin-suspension@test.tg', ADMIN_PASSWORD: 'mot-de-passe-de-test' },
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
    enfant.once('exit', code => { clearTimeout(limite); reject(new Error(`Serveur arrêté (${code}) : ${log}`)); });
  });
  base = new DatabaseSync(path.join(dossier, 'terminish-ecole.db'));
  base.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
  const appeler = async (uri, { method = 'GET', cookie, body } = {}) => {
    const r = await fetch(`http://127.0.0.1:${port}${uri}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const type = r.headers.get('content-type') || '';
    return { status: r.status, cookie: r.headers.get('set-cookie'),
      data: type.includes('application/json') ? await r.json()
        : type.includes('application/pdf') ? await r.arrayBuffer() : await r.text() };
  };
  const ok = async (uri, options) => {
    const r = await appeler(uri, options);
    assert.equal(r.status, 200, `${options?.method || 'GET'} ${uri} : ${JSON.stringify(r.data).slice(0, 250)}`);
    return r.data;
  };
  const connecter = async (email, password) => {
    const r = await appeler('/api/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.cookie.split(';')[0];
  };
  const admin = await connecter('admin-suspension@test.tg', 'mot-de-passe-de-test');
  const creerEcole = async (nom, email) => {
    const r = await appeler('/api/inscription', { method: 'POST', body: {
      etablissement: nom, nom: 'Chef test', email, password: 'chef-local-2026', type: 'college'
    } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return { id: r.data.ecole_id, cookie: r.cookie.split(';')[0], email };
  };
  const suspendre = async (id) => ok(`/api/admin/etablissements/${id}/abonnement`, {
    method: 'PATCH', cookie: admin, body: { action: 'suspendre', motif: 'Essai du mode consultation' }
  });
  return { appeler, ok, connecter, creerEcole, suspendre, admin, base };
}

test('Politique restrictive : lecture et paiement permis, toute autre écriture refusée', () => {
  for (const methode of ['GET', 'HEAD']) {
    for (const chemin of ['/api/notes/grille', '/print/classe/1', '/api/fusion/pdf', '/api/paiements/1/recu.pdf']) {
      assert.equal(autoriseEnSuspension(methode, chemin), true);
    }
  }
  for (const chemin of ['/api/auth/logout', '/api/auth/password', '/api/passages/apercu',
    '/api/paiement/declarer', '/api/paiement/cinetpay/initier', '/api/paiement/paydunya/initier']) {
    assert.equal(autoriseEnSuspension('POST', chemin), true, chemin);
  }
  for (const methode of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const chemin of ['/api/notes/saisie', '/api/eleves', '/api/enseignants', '/api/futur-endpoint']) {
      assert.equal(autoriseEnSuspension(methode, chemin), false, `${methode} ${chemin}`);
    }
  }
  assert.equal(autoriseEnSuspension('PUT', '/api/paiement/declarer'), false);
  assert.equal(autoriseEnSuspension('POST', '/api/paiement/declarer/plus'), false);
});

test('Une école suspendue lit, télécharge ses PDF et calcule un aperçu, sans pouvoir modifier ses données',
  { timeout: 30000 }, async t => {
    const { appeler, ok, creerEcole, suspendre, admin, base } = await serveur(t);
    const a = await creerEcole('École en consultation', 'chef-lecture@test.tg');
    const m = await ok('/api/matieres', { method: 'POST', cookie: a.cookie, body: { nom: 'Mathématiques' } });
    const c = await ok('/api/classes', { method: 'POST', cookie: a.cookie,
      body: { nom: '6ème A', niveau: '6ème', cycle: 'college', matieres: [{ matiere_id: m.id, coefficient: 2 }] } });
    const cible = await ok('/api/classes', { method: 'POST', cookie: a.cookie,
      body: { nom: '5ème A', niveau: '5ème', cycle: 'college' } });
    const el = await ok('/api/eleves', { method: 'POST', cookie: a.cookie,
      body: { nom: 'KOUASSI', prenom: 'Ama', classe_id: c.id } });
    const periode = (await ok('/api/periodes', { cookie: a.cookie })).find(p => p.cycle === 'college');
    for (const type of ['devoir1', 'composition']) {
      await ok('/api/notes/saisie', { method: 'POST', cookie: a.cookie, body: {
        classe_id: c.id, matiere_id: m.id, periode_id: periode.id, type,
        notes: [{ eleve_id: el.id, valeur: 14 }]
      } });
    }
    const ex = await ok('/api/examens', { method: 'POST', cookie: a.cookie, body: { nom: 'Examen blanc de test' } });
    const paye = await ok('/api/admin/paiements', { method: 'POST', cookie: admin,
      body: { ecole_id: a.id, montant: 7500, plan: 'effectif', duree_jours: 30,
        reference: 'REC-SUSPENSION', confirmation_releve: true } });
    assert.equal((await ok('/api/me', { cookie: a.cookie })).etablissement.statut, 'actif');
    await suspendre(a.id);
    assert.equal((await ok('/api/me', { cookie: a.cookie })).etablissement.statut, 'suspendu');

    for (const url of ['/api/etablissement', '/api/periodes', '/api/eleves', '/api/classes', '/api/matieres',
      '/api/examens', '/api/dashboard', '/api/paiements', '/api/paiement/options',
      `/api/bulletins/classe?classe_id=${c.id}&periode_id=${periode.id}`,
      `/api/notes/grille?classe_id=${c.id}&matiere_id=${m.id}&periode_id=${periode.id}`,
      `/api/passages/options`, `/api/fusion?classe_ids=${c.id}&periode_id=${periode.id}`]) {
      await ok(url, { cookie: a.cookie });
    }
    const html = await ok(`/print/classe/${c.id}?periode_id=${periode.id}`, { cookie: a.cookie });
    assert.match(html, /KOUASSI/, 'bulletin imprimable toujours accessible');
    const pdf = await ok(`/api/fusion/pdf?classe_ids=${c.id}&periode_id=${periode.id}`, { cookie: a.cookie });
    assert.ok(pdf.byteLength > 500, 'PDF des résultats téléchargé pendant la suspension');
    const recu = await ok(`/api/paiements/${paye.id}/recu.pdf`, { cookie: a.cookie });
    assert.ok(recu.byteLength > 500, 'reçu déjà payé toujours accessible');
    const apercu = await ok('/api/passages/apercu', { method: 'POST', cookie: a.cookie,
      body: { classe_id: c.id, cible_id: cible.id, seuil: 10 } });
    assert.equal(apercu.lignes.length, 1);
    assert.equal(apercu.lignes[0].decision, 'incomplet', 'le calcul ne valide aucun passage');

    const compte = table => base.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ecole_id = ?`).get(a.id).n;
    const avant = Object.fromEntries(['matieres', 'classes', 'eleves', 'evaluations', 'notes', 'bulletins',
      'examens', 'decisions_finales'].map(table => [table, table === 'notes'
      ? base.prepare('SELECT COUNT(*) AS n FROM notes WHERE eleve_id = ?').get(el.id).n : compte(table)]));
    const ecritures = [
      ['POST', '/api/matieres', { nom: 'Nouvelle matière' }],
      ['PUT', `/api/matieres/${m.id}`, { nom: 'Autre nom' }],
      ['POST', '/api/matieres/init', {}],
      ['POST', '/api/classes', { nom: '6ème B' }],
      ['PUT', `/api/classes/${c.id}`, { nom: 'Classe changée' }],
      ['DELETE', `/api/classes/${cible.id}`],
      ['POST', '/api/eleves', { nom: 'Élève ajouté', classe_id: c.id }],
      ['PUT', `/api/eleves/${el.id}`, { nom: 'Élève modifié' }],
      ['DELETE', `/api/eleves/${el.id}`],
      ['POST', '/api/eleves/import', { lignes: [] }],
      ['POST', '/api/eleves/import-pdf/analyser', {}],
      ['POST', '/api/eleves/import-pdf/verifier', {}],
      ['POST', '/api/eleves/import-pdf/confirmer', {}],
      ['POST', '/api/notes/saisie', { classe_id: c.id, matiere_id: m.id, periode_id: periode.id,
        type: 'composition', notes: [{ eleve_id: el.id, valeur: 2 }] }],
      ['POST', '/api/examens', { nom: 'Autre examen' }],
      ['PATCH', `/api/examens/${ex.id}`, { nom: 'Renommé' }],
      ['DELETE', `/api/examens/${ex.id}`],
      ['PUT', `/api/periodes/${periode.id}`, { statut: 'fermee' }],
      ['PUT', '/api/etablissement', { nom: 'École modifiée' }],
      ['PUT', '/api/moi/signature', { signature: '' }],
      ['POST', '/api/bulletins/publier', { classe_id: c.id, periode_id: periode.id, publie: true }],
      ['PUT', `/api/bulletins/${el.id}/${periode.id}`, { appreciation: 'Modifiée' }],
      ['POST', '/api/passages/valider', { classe_id: c.id }],
      ['POST', '/api/passages/annee-suivante', {}],
      ['POST', '/api/demandes-mdp/123/traiter', {}],
      ['POST', '/api/enseignants', { nom: 'Nouveau professeur' }],
      ['POST', '/api/eleves?ecole_id=9999', { nom: 'Tentative sur autre école' }]
    ];
    for (const [method, url, body] of ecritures) {
      const r = await appeler(url, { method, cookie: a.cookie, body });
      assert.equal(r.status, 403, `${method} ${url} : ${JSON.stringify(r.data)}`);
      assert.equal(r.data.code, 'ABONNEMENT_SUSPENDU', `${method} ${url}`);
      assert.match(r.data.error, /consultation seulement/i);
    }
    assert.deepEqual(Object.fromEntries(Object.keys(avant).map(table => [table,
      table === 'notes' ? base.prepare('SELECT COUNT(*) AS n FROM notes WHERE eleve_id = ?').get(el.id).n
        : compte(table)])), avant, 'les données scolaires n’ont pas changé');
    assert.equal(base.prepare('SELECT valeur FROM notes WHERE eleve_id = ? LIMIT 1').get(el.id).valeur, 14);
  });

test('Le paiement manuel reste possible, l’éditeur réactive sans reconnexion ; essai et super-admin restent libres',
  { timeout: 30000 }, async t => {
    const { appeler, ok, creerEcole, suspendre, admin, base } = await serveur(t);
    const a = await creerEcole('École A suspendue', 'chef-payeur@test.tg');
    const b = await creerEcole('École B en essai', 'chef-essai@test.tg');
    await suspendre(a.id);
    assert.equal((await ok('/api/me', { cookie: b.cookie })).etablissement.statut, 'essai');
    await ok('/api/matieres', { method: 'POST', cookie: b.cookie, body: { nom: 'Français' } });
    await ok(`/api/matieres?ecole_id=${a.id}`, { method: 'POST', cookie: admin,
      body: { nom: 'Matière créée par super-admin' } });
    assert.equal((await appeler('/api/matieres', { method: 'POST', cookie: a.cookie,
      body: { nom: 'Impossible' } })).data.code, 'ABONNEMENT_SUSPENDU');
    for (const chemin of ['/api/paiement/cinetpay/initier', '/api/paiement/paydunya/initier']) {
      const r = await appeler(chemin, { method: 'POST', cookie: a.cookie, body: { plan: 'essentiel', mois: 3 } });
      assert.equal(r.status, 410, 'nouvelle initiation en ligne désactivée : paiement manuel toujours permis');
      assert.notEqual(r.data.code, 'ABONNEMENT_SUSPENDU');
    }
    const declaration = await ok('/api/paiement/declarer', { method: 'POST', cookie: a.cookie, body: {
      plan: 'effectif', mois: 1, operateur: 'mixx', telephone_payeur: '+22893000000',
      transaction_ref: 'MM-SUSPENDU-2026-01'
    } });
    assert.equal(declaration.statut, 'en_attente');
    assert.equal(base.prepare('SELECT statut FROM etablissements WHERE id = ?').get(a.id).statut, 'suspendu',
      'une simple déclaration ne suffit pas à réactiver');
    assert.equal((await appeler('/api/matieres', { method: 'POST', cookie: a.cookie,
      body: { nom: 'Encore impossible' } })).status, 403);
    await ok(`/api/admin/paiements/${declaration.id}`, { method: 'PATCH', cookie: admin, body: { action: 'valider' } });
    assert.equal((await ok('/api/me', { cookie: a.cookie })).etablissement.statut, 'actif');
    await ok('/api/matieres', { method: 'POST', cookie: a.cookie, body: { nom: 'Écriture revenue' } });
    await suspendre(a.id);
    await ok(`/api/admin/etablissements/${a.id}`, { method: 'PATCH', cookie: admin, body: { statut: 'essai' } });
    await ok('/api/matieres', { method: 'POST', cookie: a.cookie, body: { nom: 'Essai aussi libre' } });
    assert.equal((await ok('/api/me', { cookie: a.cookie })).etablissement.statut, 'essai');
  });

test('Comptes enseignant/famille : lecture maintenue ; mot de passe et déconnexion toujours possibles',
  { timeout: 30000 }, async t => {
    const { appeler, ok, connecter, creerEcole, suspendre, base } = await serveur(t);
    const a = await creerEcole('École avec professeurs', 'chef-prof@test.tg');
    const m = await ok('/api/matieres', { method: 'POST', cookie: a.cookie, body: { nom: 'Histoire' } });
    const c = await ok('/api/classes', { method: 'POST', cookie: a.cookie, body: {
      nom: '6ème C', matieres: [{ matiere_id: m.id, coefficient: 1 }]
    } });
    const el = await ok('/api/eleves', { method: 'POST', cookie: a.cookie,
      body: { nom: 'ADJOVI', prenom: 'Kofi', classe_id: c.id } });
    const periode = (await ok('/api/periodes', { cookie: a.cookie }))[0];
    await ok('/api/bulletins/publier', { method: 'POST', cookie: a.cookie,
      body: { classe_id: c.id, periode_id: periode.id, publie: true } });
    const prof = await ok('/api/enseignants', { method: 'POST', cookie: a.cookie, body: {
      nom: 'Professeur test', email: 'prof-suspension@test.tg', password: 'prof-local-2026',
      affectations: [{ classe_id: c.id, matiere_id: m.id }]
    } });
    const profCookie = await connecter('prof-suspension@test.tg', 'prof-local-2026');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('famille-local-2026', salt, 64).toString('hex');
    const familleId = Number(base.prepare(`INSERT INTO utilisateurs
      (ecole_id, nom, email, mot_de_passe, role, actif, cree_le) VALUES (?, ?, ?, ?, 'eleve', 1, ?)`)
      .run(a.id, 'Famille test', 'famille-suspension@test.tg', `scrypt$${salt}$${hash}`,
        new Date().toISOString()).lastInsertRowid);
    base.prepare('UPDATE eleves SET user_id = ? WHERE id = ?').run(familleId, el.id);
    const familleCookie = await connecter('famille-suspension@test.tg', 'famille-local-2026');
    await suspendre(a.id);
    assert.equal((await ok('/api/me', { cookie: profCookie })).etablissement.statut, 'suspendu');
    await ok('/api/classes', { cookie: profCookie });
    await ok(`/api/notes/grille?classe_id=${c.id}&matiere_id=${m.id}&periode_id=${periode.id}`,
      { cookie: profCookie });
    assert.equal((await appeler('/api/notes/saisie', { method: 'POST', cookie: profCookie, body: {
      classe_id: c.id, matiere_id: m.id, periode_id: periode.id,
      type: 'composition', notes: [{ eleve_id: el.id, valeur: 18 }]
    } })).data.code, 'ABONNEMENT_SUSPENDU');
    assert.equal((await ok('/api/me', { cookie: familleCookie })).etablissement.statut, 'suspendu');
    await ok('/api/eleve/espace', { cookie: familleCookie });
    const bulletin = await ok(`/print/bulletin/${el.id}?periode_id=${periode.id}`, { cookie: familleCookie });
    assert.match(bulletin, /ADJOVI/);
    const change = await ok('/api/auth/password', { method: 'POST', cookie: profCookie,
      body: { ancien: 'prof-local-2026', nouveau: 'prof-nouveau-2026' } });
    assert.equal(change.ok, true);
    assert.equal((await ok('/api/me', { cookie: profCookie })).user.id, prof.id);
    await ok('/api/auth/password', { method: 'POST', cookie: a.cookie,
      body: { ancien: 'chef-local-2026', nouveau: 'chef-nouveau-2026' } });
    assert.equal((await appeler('/api/auth/logout', { method: 'POST', cookie: a.cookie })).status, 200);
    assert.equal((await appeler('/api/me', { cookie: a.cookie })).status, 401);
    const revenu = await connecter(a.email, 'chef-nouveau-2026');
    assert.equal((await ok('/api/me', { cookie: revenu })).etablissement.statut, 'suspendu');
    assert.equal((await appeler('/api/eleves', { method: 'POST', cookie: revenu,
      body: { nom: 'Nouvel élève interdit' } })).data.code, 'ABONNEMENT_SUSPENDU');
  });
