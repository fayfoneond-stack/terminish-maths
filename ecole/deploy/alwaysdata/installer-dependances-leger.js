#!/usr/bin/env node
'use strict';
/**
 * Installer les dépendances de production sans lancer npm sur un petit hébergement.
 *
 * npm ci retire node_modules AVANT l'installation et peut être tué par la limite
 * mémoire d'alwaysdata Free. Ce script lit le package-lock.json exact, télécharge
 * les archives une par une depuis registry.npmjs.org, vérifie leur SHA-512, puis
 * les décompresse avec tar. Aucune résolution de versions et aucun script de
 * paquet n'est exécuté. En cas d'interruption, la reprise saute les archives
 * déjà extraites avec succès. Aucun fichier data/ ou .env n'est touché.
 *
 *   cd ~/app && NODE_OPTIONS=--max-old-space-size=64 node deploy/alwaysdata/installer-dependances-leger.js
 *   TERMINISH_APP_DIR=/chemin/test node deploy/alwaysdata/installer-dependances-leger.js
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const app = path.resolve(process.env.TERMINISH_APP_DIR || path.join(__dirname, '..', '..'));
const modules = path.join(app, 'node_modules');
const fichierLock = path.join(app, 'package-lock.json');
const fichierEtat = path.join(modules, '.terminish-dependances-installees.json');
const fichierTemp = path.join(os.tmpdir(), `terminish-paquet-${process.pid}.tgz`);

function etape(programme, arguments_) {
  const resultat = spawnSync(programme, arguments_, { stdio: 'inherit', timeout: 180_000 });
  if (resultat.error || resultat.status !== 0) {
    throw new Error(`${programme} a échoué (${resultat.signal || resultat.status || resultat.error?.message}).`);
  }
}

function verifierArchive(integrite) {
  const empreinte = crypto.createHash('sha512');
  const fd = fs.openSync(fichierTemp, 'r');
  try {
    const bloc = Buffer.allocUnsafe(64 * 1024);
    let lus;
    while ((lus = fs.readSync(fd, bloc, 0, bloc.length, null)) > 0) empreinte.update(bloc.subarray(0, lus));
  } finally { fs.closeSync(fd); }
  if (`sha512-${empreinte.digest('base64')}` !== integrite) {
    throw new Error('Empreinte SHA-512 incorrecte : archive refusée.');
  }
}

function versionInstallee(dossier, version) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dossier, 'package.json'), 'utf8')).version === version;
  } catch (_) { return false; }
}

function installer() {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error('Ce script de secours est réservé au serveur Linux x64 vérifié.');
  }
  const brut = fs.readFileSync(fichierLock);
  const lock = JSON.parse(brut);
  if (lock.packages?.['']?.name !== 'terminish-ecole') throw new Error('package-lock.json inattendu.');
  const somme = crypto.createHash('sha256').update(brut).digest('hex');
  fs.mkdirSync(modules, { recursive: true });
  let etat;
  try { etat = JSON.parse(fs.readFileSync(fichierEtat, 'utf8')); } catch (_) { /* première utilisation */ }
  if (etat?.lock !== somme || !etat?.ok || typeof etat.ok !== 'object') etat = { lock: somme, ok: {} };

  const paquets = Object.entries(lock.packages).filter(([nom, p]) => nom.startsWith('node_modules/') && !p.dev
    && (!p.os || p.os.includes(process.platform)) && (!p.cpu || p.cpu.includes(process.arch)));
  let deja = 0;
  for (const [i, [nom, p]] of paquets.entries()) {
    // Le lockfile est signé indirectement par Git, mais ne jamais laisser un
    // chemin de paquet ou une URL imprévue écrire ailleurs que node_modules.
    const segments = nom.split('/');
    if (segments.some(s => !s || s === '.' || s === '..' || s.includes('\\')) ||
        !nom.startsWith('node_modules/') ||
        !/^https:\/\/registry\.npmjs\.org\//.test(p.resolved || '') ||
        !/^sha512-[A-Za-z0-9+/=]+$/.test(p.integrity || '')) {
      throw new Error(`Entrée non autorisée dans package-lock.json : ${nom}`);
    }
    const cible = path.resolve(app, nom);
    if (!cible.startsWith(modules + path.sep)) throw new Error('Chemin de paquet non sûr.');
    if (etat.ok[nom] === p.integrity && versionInstallee(cible, p.version)) { deja++; continue; }

    console.log(`[${i + 1}/${paquets.length}] ${nom} (${p.version})`);
    etape('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2',
      '--max-time', '150', '--output', fichierTemp, p.resolved]);
    verifierArchive(p.integrity);
    fs.rmSync(cible, { recursive: true, force: true }); // uniquement ce paquet, pas la base ni les autres
    fs.mkdirSync(cible, { recursive: true });
    etape('tar', ['-xzf', fichierTemp, '--strip-components=1', '-C', cible]);
    if (!versionInstallee(cible, p.version)) throw new Error(`Extraction incomplète : ${nom}`);
    etat.ok[nom] = p.integrity;
    fs.writeFileSync(fichierEtat + '.tmp', JSON.stringify(etat), { mode: 0o600 });
    fs.renameSync(fichierEtat + '.tmp', fichierEtat);
    fs.rmSync(fichierTemp, { force: true });
  }

  const charger = createRequire(path.join(app, 'package.json'));
  for (const nom of Object.keys(lock.packages[''].dependencies || {})) {
    const cible = path.join(modules, nom);
    const attendu = lock.packages[`node_modules/${nom}`]?.version;
    if (!attendu || !versionInstallee(cible, attendu)) throw new Error(`Dépendance manquante : ${nom}`);
  }
  // Vérifier réellement le chargement du serveur, dont le module natif Canvas.
  for (const nom of ['express', 'nodemailer', 'pdfkit', '@napi-rs/canvas', 'tesseract.js']) charger(nom);
  console.log(`DÉPENDANCES PRÊTES : ${paquets.length} paquets (${deja} déjà présents).`);
}

try { installer(); }
catch (erreur) {
  console.error(`INSTALLATION INCOMPLÈTE : ${erreur.message}`);
  process.exitCode = 1;
} finally { fs.rmSync(fichierTemp, { force: true }); }
