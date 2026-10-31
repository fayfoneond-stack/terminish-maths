'use strict';
/** Parcours HTTP réel, base SQLite isolée : aucun paiement ni e-mail réel. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

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
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'terminish-abonnements-'));
  const port = await portLibre();
  const enfant = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), IP: '127.0.0.1',
      TERMINISH_DATA_DIR: dossier, TERMINISH_SEED: 'prod', NODE_ENV: 'test',
      ADMIN_EMAIL: 'admin-abonnements@test.tg', ADMIN_PASSWORD: 'mot-de-passe-de-test' },
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
  const connecter = async (email, password) => {
    const r = await appeler('/api/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.cookie.split(';')[0];
  };
  const admin = await connecter('admin-abonnements@test.tg', 'mot-de-passe-de-test');
  const creerEcole = async (nom, email) => {
    const r = await appeler('/api/inscription', { method: 'POST', body: {
      etablissement: nom, nom: 'Chef test', email, password: 'chef-local-2026', type: 'college'
    } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return { id: r.data.ecole_id, cookie: r.cookie.split(';')[0] };
  };
  return { appeler, connecter, creerEcole, admin, base };
}

const ecole = (db, id) => db.prepare('SELECT statut, plan, date_fin_abonnement FROM etablissements WHERE id = ?').get(id);
const paiement = (db, id) => db.prepare('SELECT * FROM paiements WHERE id = ?').get(id);

// Les sous-tests de ce fichier se déroulent dans l'ordre, chaque serveur a sa propre base.
test('Annuler un paiement manuel : restaure l’essai, conserve la trace, protège les autres écoles', { timeout: 30000 }, async t => {
  const { appeler, admin, creerEcole, base } = await serveur(t);
  const a = await creerEcole('École A', 'chef-a@test.tg');
  const b = await creerEcole('École B', 'chef-b@test.tg');
  const avant = { ...ecole(base, a.id) };
  const details = { ecole_id: a.id, plan: 'effectif', montant: 7500,
    duree_jours: 30, reference: 'REF-TEST-ANNULE', confirmation_releve: true };
  for (const faux of [
    { montant: -500 }, { plan: 'inventé' }, { duree_jours: 0 }, { ecole_id: -1 }
  ]) {
    assert.ok([400, 404].includes((await appeler('/api/admin/paiements', {
      method: 'POST', cookie: admin, body: { ...details, ...faux }
    })).status));
  }
  const sansDroit = await appeler('/api/admin/paiements', { method: 'POST', cookie: a.cookie, body: details });
  assert.equal(sansDroit.status, 403, 'seul le super-administrateur peut activer');
  const cree = await appeler('/api/admin/paiements', { method: 'POST', cookie: admin, body: details });
  assert.equal(cree.status, 200, JSON.stringify(cree.data));
  const id = cree.data.id;
  assert.equal(paiement(base, id).statut, 'paye');
  assert.equal(ecole(base, a.id).plan, 'effectif');
  assert.equal(ecole(base, b.id).statut, 'essai');
  assert.equal((await appeler('/api/admin/paiements', { cookie: admin })).data.encaisse, 7500);
  const recu = await appeler(`/api/admin/paiements/${id}/recu.pdf`, { cookie: admin });
  assert.equal(recu.status, 200);
  assert.ok(recu.data.byteLength > 500);
  const endpoint = `/api/admin/paiements/${id}`;
  assert.equal((await appeler(endpoint, { method: 'PATCH', body: { action: 'annuler', motif: 'Erreur école' } })).status, 401);
  assert.equal((await appeler(endpoint, { method: 'PATCH', cookie: a.cookie,
    body: { action: 'annuler', motif: 'Erreur école' } })).status, 403);
  assert.equal((await appeler(endpoint, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', motif: ' ' } })).status, 400, 'motif obligatoire');
  assert.equal(paiement(base, id).statut, 'paye');
  const annule = await appeler(endpoint, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', motif: 'Activation de la mauvaise école' } });
  assert.equal(annule.status, 200, JSON.stringify(annule.data));
  assert.deepEqual({ ...ecole(base, a.id) }, avant);
  assert.equal(ecole(base, b.id).statut, 'essai');
  assert.equal(paiement(base, id).statut, 'annule');
  assert.equal(paiement(base, id).reference, 'REF-TEST-ANNULE', 'le paiement n’est pas supprimé');
  const historique = (await appeler('/api/admin/abonnements/historique', { cookie: admin })).data;
  assert.equal(historique[0].paiement_id, id);
  assert.equal(historique[0].motif_annulation, 'Activation de la mauvaise école');
  assert.ok(historique[0].annule_le);
  assert.equal((await appeler('/api/admin/paiements', { cookie: admin })).data.encaisse, 0,
    'la correction est exclue du total validé');
  const stats = (await appeler('/api/admin/statistiques', { cookie: admin })).data;
  assert.equal(stats.revenus, 0);
  assert.equal(stats.paiements.length, 0, 'un paiement corrigé ne figure pas dans les derniers paiements validés');
  assert.equal((await appeler(`/api/admin/paiements/${id}/recu.pdf`, { cookie: admin })).status, 400,
    'aucun nouveau reçu pour une validation annulée');
  assert.equal((await appeler(endpoint, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', motif: 'Encore une fois' } })).status, 409);
  assert.equal((await appeler(endpoint, { method: 'PATCH', cookie: admin,
    body: { action: 'valider' } })).status, 409, 'réactiver un paiement annulé est interdit');
  assert.equal((await appeler(endpoint, { method: 'PATCH', cookie: admin,
    body: { action: 'rejeter' } })).status, 409);
  assert.equal((await appeler('/api/admin/abonnements/historique', { cookie: a.cookie })).status, 403);
  assert.equal((await appeler('/api/paiements', { cookie: a.cookie })).data.find(x => x.id === id).statut, 'annule');
});

test('Deux activations : impossible d’annuler la plus ancienne avant la nouvelle, même à échéance identique', { timeout: 30000 }, async t => {
  const { appeler, admin, creerEcole, base } = await serveur(t);
  const a = await creerEcole('École C', 'chef-c@test.tg');
  const essai = { ...ecole(base, a.id) };
  const enregistrer = async reference => {
    const r = await appeler('/api/admin/paiements', { method: 'POST', cookie: admin, body: {
      ecole_id: a.id, plan: 'effectif', montant: 7500, duree_jours: 30, reference,
      confirmation_releve: true
    } });
    assert.equal(r.status, 200);
    return r.data.id;
  };
  const premier = await enregistrer('REF-1');
  const apresPremier = { ...ecole(base, a.id) };
  const second = await enregistrer('REF-2');
  // L'ancien code enregistrait même une deuxième activation avec la même date
  // finale. On force ce cas pour vérifier que le journal, pas la date, protège.
  base.prepare('UPDATE etablissements SET date_fin_abonnement = ? WHERE id = ?')
    .run(apresPremier.date_fin_abonnement, a.id);
  base.prepare('UPDATE operations_abonnement SET nouvelle_date_fin = ? WHERE paiement_id = ?')
    .run(apresPremier.date_fin_abonnement, second);
  const tropTot = await appeler(`/api/admin/paiements/${premier}`, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', motif: 'Ancien paiement' } });
  assert.equal(tropTot.status, 409);
  assert.match(tropTot.data.error, /plus récente/);
  assert.equal(paiement(base, premier).statut, 'paye');
  base.prepare("UPDATE etablissements SET statut = 'suspendu' WHERE id = ?").run(a.id);
  assert.equal((await appeler(`/api/admin/paiements/${second}`, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', motif: 'État modifié entre-temps' } })).status, 409,
  'un état d’établissement changé hors de cette activation n’est pas écrasé');
  assert.equal(paiement(base, second).statut, 'paye');
  base.prepare("UPDATE etablissements SET statut = 'actif' WHERE id = ?").run(a.id);
  assert.equal((await appeler(`/api/admin/paiements/${second}`, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', motif: 'Deuxième activation erronée' } })).status, 200);
  assert.deepEqual({ ...ecole(base, a.id) }, apresPremier);
  assert.equal(paiement(base, second).statut, 'annule');
  assert.equal(paiement(base, premier).statut, 'paye');
  assert.equal((await appeler(`/api/admin/paiements/${premier}`, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', motif: 'Première activation erronée' } })).status, 200);
  assert.deepEqual({ ...ecole(base, a.id) }, essai);
  assert.equal((await appeler('/api/admin/paiements', { cookie: admin })).data.encaisse, 0);
});

test('Validation déclarée, modification directe et anciennes activations : annulation ou suspension sûre', { timeout: 30000 }, async t => {
  const { appeler, admin, creerEcole, base } = await serveur(t);
  const a = await creerEcole('École D', 'chef-d@test.tg');
  const ancien = await creerEcole('École héritée', 'chef-ancien@test.tg');
  const essai = { ...ecole(base, a.id) };
  const declare = await appeler('/api/paiement/declarer', { method: 'POST', cookie: a.cookie, body: {
    plan: 'effectif', mois: 1, operateur: 'mixx', telephone_payeur: '+22893000001',
    transaction_ref: 'MM-TEST-2026-001'
  } });
  assert.equal(declare.status, 200, JSON.stringify(declare.data));
  const id = declare.data.id;
  assert.equal((await appeler(`/api/admin/paiements/${id}`, { method: 'PATCH', cookie: a.cookie,
    body: { action: 'valider' } })).status, 403);
  const valide = await appeler(`/api/admin/paiements/${id}`, { method: 'PATCH', cookie: admin,
    body: { action: 'valider' } });
  assert.equal(valide.status, 200, JSON.stringify(valide.data));
  assert.ok(ecole(base, a.id).date_fin_abonnement > essai.date_fin_abonnement);
  assert.equal((await appeler(`/api/admin/paiements/${id}`, { method: 'PATCH', cookie: admin,
    body: { action: 'valider' } })).data.deja, true, 'double clic sans deuxième prolongation');
  const nouvelleDate = '2028-12-31';
  assert.equal((await appeler(`/api/admin/etablissements/${a.id}`, { method: 'PATCH', cookie: admin,
    body: { date_fin_abonnement: nouvelleDate, plan: 'standard' } })).status, 200);
  assert.equal((await appeler(`/api/admin/paiements/${id}`, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', motif: 'Validation erronée' } })).status, 409,
  'la modification directe plus récente empêche de retirer le paiement');
  const courante = (await appeler('/api/admin/etablissements', { cookie: admin })).data.find(e => e.id === a.id);
  assert.equal((await appeler(`/api/admin/etablissements/${a.id}/abonnement`, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', operation_id: courante.operation_id, motif: 'Date incorrecte' } })).status, 200);
  assert.equal(ecole(base, a.id).plan, 'effectif');
  assert.equal((await appeler(`/api/admin/paiements/${id}`, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', motif: 'Validation erronée' } })).status, 200);
  assert.deepEqual({ ...ecole(base, a.id) }, essai);
  const legacy = base.prepare(`INSERT INTO paiements (ecole_id, montant, plan, reference, statut, cree_le)
    VALUES (?, 10000, 'standard', 'LEGACY-2026', 'paye', ?)`).run(ancien.id, new Date().toISOString());
  const legacyId = Number(legacy.lastInsertRowid);
  base.prepare("UPDATE etablissements SET statut = 'actif', plan = 'standard' WHERE id = ?").run(ancien.id);
  assert.equal((await appeler(`/api/admin/paiements/${legacyId}`, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', motif: 'Ancienne erreur' } })).status, 409,
  'pas de restauration devinée pour les anciennes données');
  const avantSuspension = { ...ecole(base, ancien.id) };
  assert.equal((await appeler(`/api/admin/etablissements/${ancien.id}/abonnement`, { method: 'PATCH', cookie: a.cookie,
    body: { action: 'suspendre', motif: 'Sans droit' } })).status, 403);
  assert.equal((await appeler(`/api/admin/etablissements/${ancien.id}/abonnement`, { method: 'PATCH', cookie: admin,
    body: { action: 'suspendre', motif: 'Ancienne activation incorrecte' } })).status, 200);
  assert.equal(ecole(base, ancien.id).statut, 'suspendu');
  assert.equal(paiement(base, legacyId).statut, 'paye', 'la suspension ne falsifie pas le paiement historique');
  const derniere = (await appeler('/api/admin/etablissements', { cookie: admin })).data.find(e => e.id === ancien.id);
  assert.equal((await appeler(`/api/admin/etablissements/${ancien.id}/abonnement`, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', operation_id: derniere.operation_id, motif: 'Suspension saisie par erreur' } })).status, 200);
  assert.deepEqual({ ...ecole(base, ancien.id) }, avantSuspension);
});

test('Paiement en ligne : aucune validation manuelle ni réactivation par un webhook tardif', { timeout: 30000 }, async t => {
  const { appeler, admin, creerEcole, base } = await serveur(t);
  const a = await creerEcole('École E', 'chef-e@test.tg');
  const fin = ecole(base, a.id).date_fin_abonnement;
  const enLigne = base.prepare(`INSERT INTO paiements
    (ecole_id, montant, plan, reference, statut, canal, transaction_ref, mois, cree_le)
    VALUES (?, 25000, 'standard', 'CINETPAY-TEST-1', 'en_attente', 'cinetpay', 'TOKEN-TEST', 1, ?)`)
    .run(a.id, new Date().toISOString());
  const id = Number(enLigne.lastInsertRowid);
  for (const action of ['valider', 'rejeter']) {
    assert.equal((await appeler(`/api/admin/paiements/${id}`, { method: 'PATCH', cookie: admin,
      body: { action } })).status, 409, 'seule la passerelle peut vérifier le paiement en ligne');
  }
  assert.equal(ecole(base, a.id).date_fin_abonnement, fin);
  // Simulation d'une validation en ligne puis annulation de son abonnement
  // (sans annulation financière, que seul le prestataire peut effectuer).
  const old = ecole(base, a.id);
  const paidFin = '2030-01-01';
  base.prepare("UPDATE paiements SET statut='paye' WHERE id=?").run(id);
  base.prepare("UPDATE etablissements SET statut='actif', plan='standard', date_fin_abonnement=? WHERE id=?")
    .run(paidFin, a.id);
  const op = base.prepare(`INSERT INTO operations_abonnement
    (ecole_id,paiement_id,type,ancien_statut,ancien_plan,ancienne_date_fin,
     nouveau_statut,nouveau_plan,nouvelle_date_fin,cree_le)
    VALUES (?,?,'paiement',?,?,?,'actif','standard',?,?)`)
    .run(a.id, id, old.statut, old.plan, old.date_fin_abonnement, paidFin, new Date().toISOString());
  assert.equal((await appeler(`/api/admin/etablissements/${a.id}/abonnement`, { method: 'PATCH', cookie: admin,
    body: { action: 'annuler', operation_id: Number(op.lastInsertRowid), motif: 'Demande en ligne' } })).status, 409);
  assert.equal(paiement(base, id).statut, 'paye');
  assert.equal((await appeler(`/api/admin/etablissements/${a.id}/abonnement`, { method: 'PATCH', cookie: admin,
    body: { action: 'suspendre', motif: 'Activation du mauvais compte' } })).status, 200);
  for (const webhook of [
    ['/api/webhooks/cinetpay', { cpm_trans_id: 'CINETPAY-TEST-1' }],
    ['/api/webhooks/paydunya', { token: 'TOKEN-TEST' }]
  ]) {
    const r = await appeler(webhook[0], { method: 'POST', body: webhook[1] });
    assert.ok([200, 404].includes(r.status), JSON.stringify(r.data));
  }
  assert.equal(ecole(base, a.id).statut, 'suspendu');
  // Un règlement corrigé, rejeté ou annulé ne doit jamais être prolongé à
  // nouveau par un rappel du prestataire (même avant la vérification externe).
  base.prepare("UPDATE paiements SET statut='annule' WHERE id=?").run(id);
  assert.equal((await appeler('/api/webhooks/cinetpay', { method: 'POST', body: {
    cpm_trans_id: 'CINETPAY-TEST-1'
  } })).data.statut, 'annule');
  base.prepare(`INSERT INTO paiements
    (ecole_id, montant, plan, reference, statut, canal, transaction_ref, cree_le)
    VALUES (?, 25000, 'standard', 'PAYDUNYA-TEST', 'annule', 'paydunya', 'TOKEN-ANNULE', ?)`)
    .run(a.id, new Date().toISOString());
  assert.equal((await appeler('/api/webhooks/paydunya', { method: 'POST', body: {
    token: 'TOKEN-ANNULE'
  } })).data.statut, 'annule');
  assert.equal(ecole(base, a.id).statut, 'suspendu');
});
