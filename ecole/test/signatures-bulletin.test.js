'use strict';
/** Régression du bulletin PDF : photo cassée dans les matières et chez le titulaire. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { createCanvas } = require('@napi-rs/canvas');

const donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'terminish-signatures-'));
process.env.TERMINISH_DATA_DIR = donnees;
process.env.TERMINISH_SEED = 'prod';
process.env.ADMIN_EMAIL = 'admin-signatures@test.tg';
process.env.ADMIN_PASSWORD = 'mot-de-passe-temporaire-de-test';
const { db, createEtablissement, createUser, now } = require('../server/db');
const { bulletinData } = require('../server/stats');
const { imagePourBulletin, preparerSignatures } = require('../server/signatures-bulletin');
const { renderBulletin, renderBulletinBatch } = require('../server/print');

test.after(() => { db.close(); fs.rmSync(donnees, { recursive: true, force: true }); });

function photo(encre) {
  const toile = createCanvas(160, 52);
  const dessin = toile.getContext('2d');
  dessin.fillStyle = '#fff'; dessin.fillRect(0, 0, 160, 52);
  dessin.strokeStyle = encre; dessin.lineWidth = 3;
  dessin.beginPath(); dessin.moveTo(9, 30);
  dessin.bezierCurveTo(50, 2, 36, 49, 95, 22);
  dessin.bezierCurveTo(110, 9, 145, 46, 154, 16); dessin.stroke();
  return `data:image/png;base64,${toile.toBuffer('image/png').toString('base64')}`;
}
const PHOTO_A = photo('#123456');
const PHOTO_B = photo('#654321');
const PHOTO_CHEF = photo('#008855');

function jeuEssai() {
  const ecole = createEtablissement({ nom: 'École test A', chef_nom: 'Mme Chef A',
    type: 'college', annee_scolaire: '2026-2027' });
  const autre = createEtablissement({ nom: 'École test B', chef_nom: 'Mme Chef B', type: 'college' });
  // Le premier directeur est un ancien compte : sa photo ne doit pas signer
  // au nom de Mme Chef A.
  const ancien = createUser({ ecole_id: ecole, nom: 'Ancien chef',
    email: `ancien-${ecole}@test.tg`, password: 'test-local-2026', role: 'directeur' });
  const chef = createUser({ ecole_id: ecole, nom: 'Mme Chef A',
    email: `chef-${ecole}@test.tg`, password: 'test-local-2026', role: 'directeur' });
  const profA = createUser({ ecole_id: ecole, nom: 'Prof A',
    email: `prof-a-${ecole}@test.tg`, password: 'test-local-2026', role: 'enseignant' });
  const profB = createUser({ ecole_id: ecole, nom: 'Prof B',
    email: `prof-b-${ecole}@test.tg`, password: 'test-local-2026', role: 'enseignant' });
  const chefAutre = createUser({ ecole_id: autre, nom: 'Mme Chef B',
    email: `chef-${autre}@test.tg`, password: 'test-local-2026', role: 'directeur' });
  const classe = Number(db.prepare(`INSERT INTO classes(ecole_id,nom,niveau,cycle,annee,titulaire_id)
    VALUES (?,'4ème A','4ème','college','2026-2027',?)`).run(ecole, profA).lastInsertRowid);
  const matiere = nom => Number(db.prepare('INSERT INTO matieres(ecole_id,nom) VALUES (?,?)')
    .run(ecole, nom).lastInsertRowid);
  const matA = matiere('SVT'), matB = matiere('PCT');
  for (const [mid, prof] of [[matA, profA], [matB, profB]]) {
    db.prepare('INSERT INTO classe_matieres(classe_id,matiere_id,coefficient) VALUES (?,?,2)').run(classe, mid);
    db.prepare('INSERT INTO affectations(ecole_id,enseignant_id,classe_id,matiere_id) VALUES (?,?,?,?)')
      .run(ecole, prof, classe, mid);
  }
  const eleve = Number(db.prepare(`INSERT INTO eleves(ecole_id,matricule,nom,prenom,classe_id,statut,cree_le)
    VALUES (?,'E1','ELEVE','Test',?,'actif',?)`).run(ecole, classe, now()).lastInsertRowid);
  db.prepare(`INSERT INTO eleves(ecole_id,matricule,nom,prenom,classe_id,statut,cree_le)
    VALUES (?,'E2','AUTRE','Test',?,'actif',?)`).run(ecole, classe, now());
  const periode = db.prepare("SELECT id FROM periodes WHERE ecole_id = ? AND code = 'T1'").get(ecole).id;
  return { ecole, autre, ancien, chef, profA, profB, chefAutre, classe, eleve, periode };
}

async function portLibre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}

async function lancer(t) {
  const port = await portLibre();
  const enfant = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), IP: '127.0.0.1', NODE_ENV: 'test',
      TERMINISH_DATA_DIR: donnees, TERMINISH_SEED: 'prod',
      STORAGE_PROVIDERS: 'mega,cloudinary,local', MEGA_RCLONE_REMOTE: 'mega:test-seulement',
      CLOUDINARY_ACCOUNTS: 'demo|fausse-cle|faux-secret' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    if (enfant.exitCode === null && enfant.signalCode === null) {
      enfant.kill('SIGTERM');
      await new Promise(resolve => {
        const limite = setTimeout(() => { enfant.kill('SIGKILL'); resolve(); }, 4000);
        enfant.once('exit', () => { clearTimeout(limite); resolve(); });
      });
    }
  });
  await new Promise((resolve, reject) => {
    let log = '';
    const limite = setTimeout(() => reject(new Error('Serveur trop lent : ' + log)), 12000);
    enfant.stdout.on('data', b => {
      log += b.toString();
      if (log.includes('serveur démarré')) { clearTimeout(limite); resolve(); }
    });
    enfant.stderr.on('data', b => { log += b.toString(); });
    enfant.once('exit', code => { clearTimeout(limite); reject(new Error(`Serveur arrêté (${code}) : ${log}`)); });
  });
  const appeler = async (url, { method = 'GET', cookie, body } = {}) => {
    const r = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const txt = await r.text();
    return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? JSON.parse(txt) : txt,
      cookie: r.headers.get('set-cookie') };
  };
  const connecter = async id => {
    const r = await appeler('/api/auth/login', { method: 'POST', body: {
      email: db.prepare('SELECT email FROM utilisateurs WHERE id = ?').get(id).email,
      password: 'test-local-2026'
    } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.cookie.split(';')[0];
  };
  return { appeler, connecter };
}

test('Ancien lien distant : uniquement des fournisseurs d’images autorisés, jamais MEGA ou une URL privée', async () => {
  const ancienFetch = global.fetch;
  const appels = [];
  try {
    global.fetch = async url => {
      appels.push(url);
      if (url.includes('/redirect')) return new Response(null, {
        status: 302, headers: { location: 'http://127.0.0.1/photo' }
      });
      return new Response(Buffer.from(PHOTO_A.split(',')[1], 'base64'), {
        headers: { 'content-type': 'image/png' }
      });
    };
    assert.equal(await imagePourBulletin('https://mega.nz/file/abc#cle'), null);
    assert.equal(await imagePourBulletin('http://127.0.0.1/photo'), null);
    assert.equal(await imagePourBulletin('https://res.cloudinary.com.evil.tg/demo/image/upload/photo.png'), null);
    assert.deepEqual(appels, []);
    assert.equal(await imagePourBulletin('https://res.cloudinary.com/demo/image/upload/v1/photo.png'), PHOTO_A);
    assert.equal(await imagePourBulletin('https://res.cloudinary.com/demo/image/upload/redirect'), null);
    assert.equal(appels.length, 2, 'la redirection vers une adresse locale n’est pas suivie');
    assert.equal(await imagePourBulletin('data:image/png;base64,SGVsbG8='), null);
    assert.equal(await imagePourBulletin('/media/signatures/../../.env'), null);
  } finally { global.fetch = ancienFetch; }
});

test('Bulletin réel et impression par classe : signatures incorporées, cas cassé signalé, écoles isolées', async t => {
  const j = jeuEssai();
  const { appeler, connecter } = await lancer(t);
  const chef = await connecter(j.chef), profA = await connecter(j.profA), profB = await connecter(j.profB);
  const autre = await connecter(j.chefAutre);
  const depot = async (cookie, url, signature) => {
    const r = await appeler(url, { method: 'PUT', cookie, body: { signature } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data;
  };
  const sigA = await depot(profA, '/api/moi/signature', PHOTO_A);
  const faussePhoto = await appeler('/api/moi/signature', { method: 'PUT', cookie: profA,
    body: { signature: `data:image/png;base64,${Buffer.from('<html>pas une image</html>').toString('base64')}` } });
  assert.equal(faussePhoto.status, 400, 'un fichier déguisé en image est refusé');
  assert.equal(db.prepare('SELECT signature FROM utilisateurs WHERE id = ?').get(j.profA).signature, sigA.signature);
  const sigB = await depot(profB, '/api/moi/signature', PHOTO_B);
  const sigChef = await depot(chef, '/api/etablissement/signature', PHOTO_CHEF);
  const sigAutre = await depot(autre, '/api/etablissement/signature', PHOTO_B);
  for (const s of [sigA, sigB, sigChef, sigAutre]) {
    assert.match(s.signature, /^\/media\/signatures\/signatures-[0-9a-f-]+\.png$/);
    assert.ok(fs.existsSync(path.join(donnees, s.signature)));
  }
  assert.equal(sigA.provider, 'local');
  assert.equal(db.prepare('SELECT chef_signature FROM etablissements WHERE id = ?').get(j.ecole).chef_signature,
    sigChef.signature);
  assert.equal(db.prepare('SELECT chef_signature FROM etablissements WHERE id = ?').get(j.autre).chef_signature,
    sigAutre.signature);

  const individuel = `/print/bulletin/${j.eleve}?periode_id=${j.periode}`;
  const enLot = `/print/classe/${j.classe}?periode_id=${j.periode}`;
  const b = await appeler(individuel, { cookie: chef });
  assert.equal(b.status, 200);
  assert.ok(b.data.includes(PHOTO_A) && b.data.includes(PHOTO_B) && b.data.includes(PHOTO_CHEF));
  assert.ok(!b.data.includes(sigAutre.signature), 'photo de l’autre école non partagée');
  assert.doesNotMatch(b.data, /src="\/media\/signatures\//);
  assert.match(b.data, /LE PROFESSEUR TITULAIRE/i);
  assert.match(b.data, /<button onclick="imprimerBulletin\(\)"/);
  assert.match(b.data, /min-height: 280mm/); // pied de page éloigné des signatures sur le PDF
  const lot = await appeler(enLot, { cookie: chef });
  assert.equal(lot.status, 200);
  assert.equal((lot.data.match(/function imprimerBulletin/g) || []).length, 1);
  assert.equal((lot.data.match(/class="page"/g) || []).length, 2);
  assert.ok(lot.data.includes(PHOTO_A) && lot.data.includes(PHOTO_CHEF));
  assert.equal((lot.data.match(/src="\/media\/signatures\//g) || []).length, 0);

  // Plus de fichier local, mais le lien reste en base : prévenir et conserver
  // les autres photos (ne jamais fabriquer une signature de remplacement).
  fs.unlinkSync(path.join(donnees, sigB.signature));
  const casse = await appeler(individuel, { cookie: chef });
  assert.equal(casse.status, 200);
  assert.match(casse.data, /Photo de signature introuvable : Prof B/);
  assert.match(casse.data, /data-signature-indisponible="1"/);
  assert.ok(casse.data.includes(PHOTO_A) && casse.data.includes(PHOTO_CHEF));
  assert.ok(!casse.data.includes(PHOTO_B));
  assert.equal(db.prepare('SELECT signature FROM utilisateurs WHERE id = ?').get(j.profB).signature, sigB.signature);
  const nouveauB = await depot(profB, '/api/moi/signature', PHOTO_B);
  assert.notEqual(nouveauB.signature, sigB.signature);
  assert.ok((await appeler(individuel, { cookie: chef })).data.includes(PHOTO_B));

  // Un directeur ancien et distinct du chef ne doit jamais signer pour lui.
  db.prepare('UPDATE utilisateurs SET signature = ? WHERE id = ?').run(sigA.signature, j.ancien);
  db.prepare('UPDATE etablissements SET chef_signature = NULL, chef_signature_nom = NULL WHERE id = ?').run(j.ecole);
  db.prepare('UPDATE utilisateurs SET signature = ? WHERE id = ?').run(sigChef.signature, j.chef);
  assert.equal(bulletinData(db, j.ecole, j.eleve, j.periode).chef.signature, sigChef.signature);
  db.prepare('UPDATE utilisateurs SET actif = 0 WHERE id = ?').run(j.chef);
  assert.equal(bulletinData(db, j.ecole, j.eleve, j.periode).chef.signature, null);
  db.prepare('UPDATE utilisateurs SET actif = 1 WHERE id = ?').run(j.chef);

  // Nom changé : l'ancienne photo officielle est conservée en base mais non imprimée.
  db.prepare('UPDATE etablissements SET chef_signature = ?, chef_signature_nom = ?, chef_nom = ? WHERE id = ?')
    .run(sigChef.signature, 'Mme Chef A', 'Mme Nouvelle Chef', j.ecole);
  assert.equal(bulletinData(db, j.ecole, j.eleve, j.periode).chef.signature, null);
  db.prepare("UPDATE etablissements SET chef_nom = 'Mme Chef A' WHERE id = ?").run(j.ecole);
  await depot(chef, '/api/etablissement/signature', '');
  assert.equal(bulletinData(db, j.ecole, j.eleve, j.periode).chef.signature, null,
    'retirer la signature officielle ne rétablit pas la photo personnelle');
  const sansChef = await appeler(individuel, { cookie: chef });
  assert.match(sansChef.data, /Aucune signature du chef sélectionnée/);
  assert.ok(!sansChef.data.includes(PHOTO_CHEF));

  db.prepare("UPDATE etablissements SET statut = 'suspendu' WHERE id = ?").run(j.ecole);
  const interdit = await appeler('/api/etablissement/signature', {
    method: 'PUT', cookie: chef, body: { signature: PHOTO_CHEF }
  });
  assert.equal(interdit.status, 403);
  assert.equal(interdit.data.code, 'ABONNEMENT_SUSPENDU');
  assert.equal(db.prepare('SELECT chef_signature FROM etablissements WHERE id = ?').get(j.ecole).chef_signature, null);
  assert.equal((await appeler(individuel, { cookie: chef })).status, 200, 'lecture conservée en suspension');
});

test('Rendu local : aucune photo inventée quand une signature est absente', async () => {
  const b = { professeurs: { 1: { nom: 'Prof B', signature: 'https://mega.nz/file/broken#key' } },
    principal: { nom: 'Prof B', signature: 'https://mega.nz/file/broken#key' },
    chef: { nom: 'Chef', signature: null } };
  const [pret] = await preparerSignatures([b]);
  assert.ok(pret.professeurs[1].signature_indisponible);
  assert.ok(pret.principal.signature_indisponible);
  assert.equal(pret.professeurs[1].signature, null);
  assert.equal(b.professeurs[1].signature, 'https://mega.nz/file/broken#key', 'la donnée d’origine reste intacte');
  const eleve = { id: 1, nom: 'TEST', prenom: 'Eleve', matricule: 'A1' };
  const ligne = { eleve, lignes: [{ id: 1, matiere_id: 1, nom: 'SVT',
    detail: { devoir1: null, devoir2: null, composition: null },
    moyenne: null, coefficient: 2, points: null, rang: null, appreciation: 'Non évalué' }],
  moyenne: null, total_coef: 0, total_points: 0, rang: null, mention: '—' };
  const donneesBulletin = { ...pret, eleve, ligne, bulletin: {}, promo: {
    etablissement: { nom: 'École de test', ville: 'Lomé' },
    classe: { nom: '4ème', cycle: 'college' },
    periode: { libelle: '1er Trimestre', annee_scolaire: '2026-2027' },
    stats: { effectif_classe: 1, moyenne: null, max: null, min: null }, resultats: [ligne]
  } };
  const html = renderBulletin(donneesBulletin);
  assert.equal((html.match(/Photo de signature introuvable/g) || []).length, 1);
  assert.match(html, /Photo de signature introuvable : Prof B/);
  assert.match(html, /Aucune signature du chef sélectionnée/);
  assert.doesNotMatch(html, /<img[^>]+src="https:\/\/mega\.nz\//);
  assert.match(html, /class="sig-vide">signature/); // emplacement pour signer à la main
  const lot = renderBulletinBatch([donneesBulletin, donneesBulletin], donneesBulletin.promo.periode);
  assert.equal((lot.match(/Photo de signature introuvable/g) || []).length, 1);
  assert.equal((lot.match(/function imprimerBulletin/g) || []).length, 1);
});
