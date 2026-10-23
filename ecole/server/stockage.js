#!/usr/bin/env node
'use strict';
/**
 * Terminish École — diagnostic et test du stockage des fichiers
 *
 *   npm run stockage                 → état des fournisseurs (aucun envoi)
 *   npm run stockage -- --test       → envoie un vrai fichier de test
 *   npm run stockage -- --test mega  → teste un seul fournisseur
 *   npm run stockage -- --rclone     → rclone est-il utilisable ? quota MEGA ?
 *
 * Les fichiers concernés : signatures des professeurs, logos, pièces jointes.
 * Les notes et les bulletins ne sont PAS concernés (ils restent en base).
 *
 * Ordre d'essai défini par STORAGE_PROVIDERS dans .env (ex. mega,local).
 * En cas d'échec d'un fournisseur, le suivant prend le relais ; « local »
 * (dossier data/media) est toujours en dernier recours : l'application ne
 * plante jamais à cause du stockage.
 */
require('./env').chargerEnv();
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const stockage = require('./storage');

const C = { vert: '\x1b[32m', rouge: '\x1b[31m', jaune: '\x1b[33m', gris: '\x1b[90m', gras: '\x1b[1m', raz: '\x1b[0m' };
const ok = m => console.log(`  ${C.vert}✔${C.raz} ${m}`);
const ko = m => console.log(`  ${C.rouge}✘${C.raz} ${m}`);
const info = m => console.log(`  ${C.gris}•${C.raz} ${m}`);
const alerte = m => console.log(`  ${C.jaune}!${C.raz} ${m}`);
const titre = m => console.log(`\n${C.gras}${m}${C.raz}`);

const argv = process.argv.slice(2);
const option = (nom) => {
  const i = argv.indexOf(nom);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : false;
};
const TEST = option('--test');
const RCLONE = option('--rclone');

/* PNG 1×1 transparent : le plus petit fichier valide possible. */
const PNG_TEST = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  TERMINISH ÉCOLE — stockage des fichiers');
console.log('══════════════════════════════════════════════════════════════');

const etat = stockage.etat();
const DATA_DIR = process.env.TERMINISH_DATA_DIR || path.join(__dirname, '..', 'data');

/* ---------------------------------------------------------- 1. l'essentiel */
titre('1. Ce qui est stocké où');
info('Signatures, logos, pièces jointes → fournisseur externe si configuré, sinon disque local.');
info('Notes, élèves, bulletins → base SQLite (jamais envoyés à l’extérieur).');
console.log('');
info(`Ordre d’essai (STORAGE_PROVIDERS) : ${etat.ordre.join(' → ')}`);
if (etat.ordre[0] === 'local') {
  alerte('Aucun fournisseur externe en tête : tout reste sur le disque du serveur.');
  info('Pour envoyer sur MEGA : STORAGE_PROVIDERS=mega,local dans .env');
}

/* ---------------------------------------------------- 2. état par service */
titre('2. État de chaque fournisseur');

ok(`local — toujours disponible : ${etat.local.dossier.replace(process.env.HOME || '~', '~')}`);
try {
  fs.mkdirSync(etat.local.dossier, { recursive: true });
  const fichiers = fs.readdirSync(etat.local.dossier, { recursive: true })
    .filter(f => fs.statSync(path.join(etat.local.dossier, f)).isFile());
  info(`${fichiers.length} fichier(s) sur le disque local`);
} catch (_) { /* dossier vide ou illisible */ }

if (etat.cloudinary.configure) {
  ok(`cloudinary — ${etat.cloudinary.comptes.length} compte(s) : ${etat.cloudinary.comptes.join(', ')}`);
} else {
  alerte('cloudinary — non configuré (CLOUDINARY_ACCOUNTS ou CLOUDINARY_URL)');
}

if (etat.drive.configure) {
  ok('drive — configuré (compte de service + dossier cible)');
  const sa = process.env.GOOGLE_DRIVE_SA_JSON;
  if (sa && !fs.existsSync(sa)) ko(`  le fichier ${sa} est introuvable sur ce serveur`);
} else {
  alerte('drive — non configuré (GOOGLE_DRIVE_SA_JSON + GOOGLE_DRIVE_FOLDER_ID)');
}

if (etat.mega.configure) {
  ok(`mega — dossier distant : ${process.env.MEGA_RCLONE_REMOTE}`);
} else {
  alerte('mega — non configuré (MEGA_RCLONE_REMOTE, ex. mega:Terminish)');
}

/* ------------------------------------------------------------- 3. rclone */
titre('3. rclone (nécessaire pour MEGA)');
const binaire = process.env.RCLONE_BIN || 'rclone';
const trouve = stockage.trouverRclone();
const rclone = trouve ? { chemin: trouve.chemin, version: `rclone ${trouve.version}` } : null;
if (rclone) {
  ok(`rclone trouvé : ${rclone.chemin}`);
  info(rclone.version);
  if (binaire === 'rclone' && rclone.chemin !== 'rclone') {
    info(`Astuce : ajoutez RCLONE_BIN=${rclone.chemin} dans .env`);
  }
  // Quota MEGA (facultatif : tous les fournisseurs ne répondent pas à « about »)
  if (etat.mega.configure) {
    const remote = String(process.env.MEGA_RCLONE_REMOTE).split(':')[0];
    const about = spawnSync(rclone.chemin, ['about', `${remote}:`, '--json'], { encoding: 'utf8', timeout: 20000 });
    if (about.status === 0 && about.stdout) {
      try {
        const q = JSON.parse(about.stdout);
        const go = n => n ? (n / 1073741824).toFixed(2) + ' Go' : '—';
        ok(`quota ${remote} : ${go(q.used)} utilisés sur ${go(q.total)} (libre : ${go(q.free)})`);
      } catch (_) { info('quota : non communiqué (normal avec MEGA)'); }
    } else {
      info('quota : non communiqué (normal avec MEGA)');
    }
  }
} else {
  ko('rclone absent : MEGA ne peut pas fonctionner.');
  info('Installation sans droits administrateur :');
  info('    bash deploy/alwaysdata/rclone.sh --installer   (sur hébergement / VPS)');
  info('Ou téléchargez le binaire : https://rclone.org/downloads/ → ~/bin/rclone');
  info('Puis : RCLONE_BIN=~/bin/rclone dans .env');
}

/* ---------------------------------------------------------- 4. test réel */
async function tester(nom) {
  const fournisseur = nom && nom !== true ? nom : null;
  let resultat = null;
  let erreur = null;
  try {
    // « seulement » : test isolé, sans repli sur le disque local
    resultat = await stockage.enregistrer(PNG_TEST, {
      categorie: 'test', ecoleId: 'diagnostic',
      seulement: fournisseur ? [fournisseur] : null
    });
  } catch (e) { erreur = e.message; }

  const cible = fournisseur || 'ordre configuré';
  if (resultat) {
    ok(`${cible} → ${resultat.provider}`);
    info(`URL : ${resultat.url}`);
    if (resultat.essais && resultat.essais.length) {
      alerte('fournisseur(s) écarté(s) avant celui-ci :');
      resultat.essais.forEach(e => info(`   ${e}`));
    }
    return true;
  }
  ko(`${cible} → échec : ${erreur}`);
  return false;
}

if (RCLONE) {
  titre('4. Configuration du compte MEGA');
  if (!rclone) {
    ko('Installez rclone d’abord (voir ci-dessus).');
  } else {
    const liste = spawnSync(rclone.chemin, ['listremotes'], { encoding: 'utf8', timeout: 15000 });
    const remotes = String(liste.stdout || '').trim().split('\n').filter(Boolean);
    if (!remotes.length) {
      alerte('aucun compte distant configuré dans rclone.');
      info('Créer le remote MEGA (une seule fois, questions/réponses) :');
      info(`    ${rclone.chemin} config`);
      info('    → n) New remote → nom : mega → type : mega → email + mot de passe MEGA');
      info('Puis ajouter dans .env :  MEGA_RCLONE_REMOTE=mega:Terminish');
      info('Et faciliter l’accès :    bash deploy/alwaysdata/rclone.sh --configurer');
    } else {
      ok(`compte(s) distant(s) : ${remotes.join(', ')}`);
      const cible = process.env.MEGA_RCLONE_REMOTE;
      if (cible) {
        const dossier = String(cible).replace(/:.*$/, ':');
        const t = spawnSync(rclone.chemin, ['lsd', dossier], { encoding: 'utf8', timeout: 25000 });
        if (t.status === 0) ok(`connexion à ${dossier} : OK`);
        else ko(`connexion à ${dossier} : ${String(t.stderr || '').split('\n')[0]}`);
      }
    }
  }
}

async function principal() {
if (TEST) {
  titre('4. Envoi réel d’un fichier de test');
  const ciblé = TEST === true ? null : String(TEST).toLowerCase();
  const possibles = {
    local: true,
    cloudinary: etat.cloudinary.configure,
    drive: etat.drive.configure,
    mega: etat.mega.configure && Boolean(rclone)
  };
  if (ciblé) {
    if (!(ciblé in possibles)) { ko(`fournisseur inconnu : ${ciblé} (local, cloudinary, drive, mega)`); process.exit(1); }
    if (!possibles[ciblé]) { ko(`${ciblé} n’est pas configuré.`); process.exit(1); }
    const bon = await tester(ciblé);
    console.log('');
    process.exit(bon ? 0 : 1);
  }
  let auMoinsUn = false;
  for (const nom of ['local', 'cloudinary', 'drive', 'mega']) {
    if (!possibles[nom]) { info(`${nom} — ignoré (non configuré)`); continue; }
    if (await tester(nom)) auMoinsUn = true;
  }
  console.log('');
  if (!auMoinsUn) { ko('Aucun fournisseur n’a fonctionné.'); process.exit(1); }
}

}

/* ------------------------------------------------------------ 5. rappels */
titre('5. À retenir');
console.log(`  Les fichiers locaux sont dans : ${etat.local.dossier.replace(process.env.HOME || '~', '~')}`);
console.log(`  Ils sont servis sous          : ${etat.local.url}/…`);
console.log(`  Taille maximale par fichier   : ${(stockage.TAILLE_MAX / 1048576).toFixed(0)} Mo`);
console.log(`
  Configurer MEGA (25 Go déjà disponibles) :
      bash deploy/alwaysdata/rclone.sh --installer --configurer
      puis dans .env :  STORAGE_PROVIDERS=mega,local
      puis :            npm run stockage -- --test mega

  Configurer Cloudinary (images) :
      CLOUDINARY_URL=cloudinary://CLE:SECRET@NOM_DU_CLOUD
      STORAGE_PROVIDERS=cloudinary,mega,local

  Configurer Google Drive :
      GOOGLE_DRIVE_SA_JSON=/home/COMPTE/app/cle-drive.json
      GOOGLE_DRIVE_FOLDER_ID=1AbC…
      STORAGE_PROVIDERS=drive,local
`);

principal().catch(err => { console.error(err); process.exit(1); });
