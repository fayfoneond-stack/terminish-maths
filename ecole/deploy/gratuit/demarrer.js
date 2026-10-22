#!/usr/bin/env node
'use strict';
/**
 * Démarrage « zéro franc » de Terminish École sur votre propre ordinateur,
 * avec un lien HTTPS public optionnel (Cloudflare Tunnel, gratuit, sans compte).
 *
 *   npm run partage          → serveur + lien public aléatoire (https://xxx.trycloudflare.com)
 *   npm run partage:demo     → idem, avec l'école de démonstration
 *   npm run local            → serveur seul (http://localhost:3000, réseau local)
 *
 * Options : --port 3000 · --sans-tunnel · --demo
 */
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
let DatabaseSync = null;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (_) { /* Node < 22.5 */ }

const RACINE = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const valeur = (nom, defaut) => {
  const i = argv.indexOf(nom);
  return i >= 0 ? argv[i + 1] : defaut;
};
const PORT = Number(valeur('--port', process.env.PORT || 3000));
const SANS_TUNNEL = argv.includes('--sans-tunnel');
const DEMO = argv.includes('--demo');
const DATA_DIR = process.env.TERMINISH_DATA_DIR || path.join(RACINE, 'data');

const ligne = '─'.repeat(64);
function cadre(titre) {
  console.log(`\n┌${ligne}┐`);
  if (titre) console.log(`│ ${titre.padEnd(62).slice(0, 62)} │`);
  console.log(`└${ligne}┘`);
}

/* ------------------------------------------------------------------ */
/* 1. Vérifications                                                    */
/* ------------------------------------------------------------------ */
const majeur = Number(process.versions.node.split('.')[0]);
if (majeur < 22) {
  console.error(`\n❌ Node.js ${process.versions.node} détecté : il faut Node.js 22 ou plus.`);
  console.error('   Installez-le depuis https://nodejs.org (version « LTS »), puis relancez.\n');
  process.exit(1);
}

if (!fs.existsSync(path.join(RACINE, 'node_modules', 'express'))) {
  console.log('📦 Installation des dépendances (une seule fois)…');
  const installe = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['install', '--omit=dev'], { cwd: RACINE, stdio: 'inherit' });
  if (installe.status !== 0) {
    console.error('\n❌ L’installation a échoué. Vérifiez votre connexion Internet.\n');
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* 2. Compte administrateur (créé une fois, conservé)                  */
/* ------------------------------------------------------------------ */
fs.mkdirSync(DATA_DIR, { recursive: true });
const FICHIER_COMPTE = path.join(DATA_DIR, 'compte-administrateur.txt');
const FICHIER_LIEN = path.join(DATA_DIR, 'lien-public.txt');
let lienPublic = null;

const MOTS_A = ['palmier', 'baobab', 'colibri', 'calebasse', 'harmattan', 'savane',
  'lagune', 'mangrove', 'fromager', 'hibiscus', 'zebu', 'mil'];
const MOTS_B = ['solaire', 'brillant', 'paisible', 'nouveau', 'solide', 'vivant',
  'clair', 'fidele', 'ouvert', 'joyeux'];
const sansAccent = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function nouveauMotDePasse() {
  const a = sansAccent(MOTS_A[crypto.randomInt(MOTS_A.length)]);
  const b = sansAccent(MOTS_B[crypto.randomInt(MOTS_B.length)]);
  return `${a}-${b}-${crypto.randomInt(1000, 9999)}`;
}

const CHEMIN_DB = path.join(DATA_DIR, 'terminish-ecole.db');

/** État de la base avant démarrage : base neuve ? compte admin déjà créé ? */
function etatBase() {
  if (!fs.existsSync(CHEMIN_DB) || !DatabaseSync) return { existe: false, ecoles: 0, admin: null };
  let base = null;
  try {
    base = new DatabaseSync(CHEMIN_DB);
    base.exec('PRAGMA busy_timeout = 3000');
    const ecoles = Number(base.prepare('SELECT COUNT(*) AS n FROM etablissements').get().n);
    const row = base.prepare("SELECT email FROM utilisateurs WHERE role = 'super_admin' ORDER BY id LIMIT 1").get();
    return { existe: true, ecoles, admin: row ? row.email : null };
  } catch (err) {
    return { existe: true, ecoles: 0, admin: null, erreur: err.message };
  } finally {
    try { if (base) base.close(); } catch (_) {}
  }
}

const base = etatBase();

// En mode démonstration, la base installe ses propres comptes : le mot de passe
// affiché doit être celui-là, pas un mot de passe généré qui ne serait jamais appliqué.
const MODE_DEMO = DEMO || (base.existe && base.ecoles > 0 && !base.admin);

const COMPTES_DEMO = [
  ['admin@terminish.tg', 'admin1234', 'console éditeur (écoles, paiements, réglages)'],
  ['directeur@demo.tg', 'demo1234', 'chef d’établissement'],
  ['prof.maths@demo.tg', 'prof1234', 'enseignant'],
  ['eleve@demo.tg', 'eleve1234', 'élève / parent']
];

let compte = { email: process.env.ADMIN_EMAIL || 'admin@terminish.tg', password: process.env.ADMIN_PASSWORD || '' };
let compteAffiche = null;   // null = pas de mot de passe à afficher (déjà existant)

if (MODE_DEMO) {
  compte = { email: 'admin@terminish.tg', password: 'admin1234' };
} else if (base.admin) {
  // Compte déjà en place : son mot de passe n'a pas changé, on ne peut pas le deviner.
  compte = { email: base.admin, password: process.env.ADMIN_PASSWORD || '' };
  compteAffiche = 'existant';
} else {
  if (!compte.password) {
    if (fs.existsSync(FICHIER_COMPTE)) {
      const t = fs.readFileSync(FICHIER_COMPTE, 'utf8');
      const e = /Identifiant\s*:\s*(\S+)/.exec(t);
      const p = /Mot de passe\s*:\s*(\S+)/.exec(t);
      if (e && p) compte = { email: e[1], password: p[1] };
    }
    if (!compte.password) {
      compte.password = nouveauMotDePasse();
      fs.writeFileSync(FICHIER_COMPTE, [
        'Terminish École — compte administrateur de cette installation',
        '',
        `Identifiant  : ${compte.email}`,
        `Mot de passe : ${compte.password}`,
        '',
        'Conservez ce fichier. Il permet de vous connecter sur /app avec le rôle',
        '« super administrateur » (console des écoles, paiements, réglages).',
        'Vous pouvez changer ce mot de passe dans le menu « Mon compte ».',
        ''
      ].join('\n'), { mode: 0o600 });
    }
  }
  compteAffiche = compte.password || null;
}

/** Affiche les identifiants réellement valides. */
function afficherComptes(indent = '  ') {
  if (MODE_DEMO) {
    console.log(`${indent}Comptes de démonstration :`);
    COMPTES_DEMO.forEach(([email, mdp, role]) => {
      console.log(`${indent}  ${email.padEnd(24)} ${mdp.padEnd(12)} ${role}`);
    });
    return;
  }
  console.log(`${indent}Console administrateur : ${compte.email}`);
  if (compteAffiche === 'existant') {
    console.log(`${indent}Mot de passe           : inchangé depuis la première installation`);
    console.log(`${indent}                         (si oublié : npm run motdepasse)`);
  } else if (compteAffiche) {
    console.log(`${indent}Mot de passe           : ${compteAffiche}`);
  } else {
    console.log(`${indent}Mot de passe           : celui fourni dans ADMIN_PASSWORD`);
  }
}

/* ------------------------------------------------------------------ */
/* 3. Serveur                                                          */
/* ------------------------------------------------------------------ */
const env = {
  ...process.env,
  PORT: String(PORT),
  TERMINISH_DATA_DIR: DATA_DIR,
  TERMINISH_SEED: DEMO ? 'demo' : 'prod',
  ADMIN_EMAIL: compte.email,
  ADMIN_PASSWORD: compte.password
};

// Le port est-il libre ? (message clair au lieu d'une trace Node illisible)
const testPort = spawnSync(process.execPath, ['-e',
  `const net=require('net');const s=net.createServer();s.once('error',()=>process.exit(1));` +
  `s.once('listening',()=>{s.close();process.exit(0)});s.listen(${PORT},'0.0.0.0');`], { stdio: 'ignore' });
if (testPort.status !== 0) {
  console.error(`\n❌ Le port ${PORT} est déjà utilisé (une autre instance tourne probablement).`);
  console.error('   Solutions :');
  console.error(`   • fermez l'autre fenêtre/l'ancien processus (Ctrl+C), ou`);
  console.error(`   • lancez sur un autre port : --port ${PORT + 1}`);
  console.error('');
  process.exit(1);
}

console.log('\n🚀 Démarrage de Terminish École…');
const serveur = spawn(process.execPath, [path.join(RACINE, 'server', 'index.js')], {
  cwd: RACINE, env, stdio: 'inherit'
});
serveur.on('exit', code => {
  if (code && code !== 0) console.error(`\n❌ Le serveur s’est arrêté (code ${code}).`);
  process.exit(code || 0);
});

/* ------------------------------------------------------------------ */
/* 4. Tunnel HTTPS gratuit (Cloudflare, sans compte)                    */
/* ------------------------------------------------------------------ */
let tunnel = null;
let arretDemande = false;
let relances = 0;
function arreter(code = 0) {
  arretDemande = true;
  try { if (tunnel) tunnel.kill(); } catch (_) {}
  try { serveur.kill(); } catch (_) {}
  try {
    if (fs.existsSync(FICHIER_LIEN)) fs.unlinkSync(FICHIER_LIEN);
  } catch (_) { /* sans conséquence */ }
  console.log('\n👋 Arrêt. À bientôt !');
  if (lienPublic) console.log(`   Le lien ${lienPublic} ne fonctionne plus (l’adresse est libérée).`);
  console.log('   Pour repartir : npm run partage\n');
  process.exit(code);
}
process.on('SIGINT', () => arreter(0));
process.on('SIGTERM', () => arreter(0));

const local = `http://localhost:${PORT}`;
const ips = Object.values(os.networkInterfaces()).flat()
  .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);

/**
 * Localise cloudflared même s'il n'est pas dans le PATH du terminal courant.
 * L'installateur Linux le pose dans ~/.local/bin, qui n'est pas toujours
 * exporté dans les nouveaux shells : on teste donc les emplacements connus.
 */
function trouverCloudflared() {
  const candidats = [
    process.env.CLOUDFLARED_BIN,
    'cloudflared',
    path.join(os.homedir(), '.local', 'bin', 'cloudflared'),
    '/usr/local/bin/cloudflared',
    '/usr/bin/cloudflared',
    '/snap/bin/cloudflared',
    '/opt/homebrew/bin/cloudflared',
    path.join(process.cwd(), 'cloudflared.exe')
  ].filter(Boolean);

  for (const candidat of candidats) {
    if (candidat !== 'cloudflared' && !fs.existsSync(candidat)) continue;
    const essai = spawnSync(candidat, ['--version'], { encoding: 'utf8' });
    if (essai.status === 0) {
      return { chemin: candidat, version: String(essai.stdout || '').split('\n')[0].trim() };
    }
  }
  return null;
}

function afficherModeLocal(aCloudflared) {
  cadre('TERMINISH ÉCOLE EST DÉMARRÉ');
  console.log(`  Adresse sur cet ordinateur : ${local}`);
  ips.forEach(ip => console.log(`  Adresse sur votre réseau   : http://${ip}:${PORT}`));
  console.log('\n');
  afficherComptes('  ');
  if (!MODE_DEMO && compteAffiche && compteAffiche !== 'existant') {
    const joli = FICHIER_COMPTE.startsWith(os.homedir())
      ? FICHIER_COMPTE.replace(os.homedir(), '~') : FICHIER_COMPTE;
    console.log(`  (également dans ${joli})`);
  }
  if (!SANS_TUNNEL && !aCloudflared) {
    const localBin = path.join(os.homedir(), '.local', 'bin', 'cloudflared');
    console.log('\n  ⓘ Cloudflare Tunnel introuvable : aucun lien public.');
    if (fs.existsSync(localBin)) {
      console.log(`    Il existe pourtant ici : ${localBin}`);
      console.log('    Relancez avec :  CLOUDFLARED_BIN="$HOME/.local/bin/cloudflared" npm run partage');
    } else {
      console.log('    Installation :  bash deploy/gratuit/installer-linux.sh --verifier');
      console.log('    ou :            sudo apt install cloudflared');
      console.log('    (détails : DEPLOIEMENT-GRATUIT.md, section « Installer cloudflared »)');
    }
  }
  console.log('\n  Laissez cette fenêtre ouverte. Ctrl+C pour arrêter.\n');
}

/** Lance un tunnel : chaque tentative produit un nouveau lien public. */
function demarrerTunnel(cheminBinaire) {
  let affiche = false;

  tunnel = spawn(cheminBinaire, ['tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate'],
    { stdio: ['ignore', 'pipe', 'pipe'] });

  const analyser = flux => {
    let tampon = '';
    flux.on('data', morceau => {
      tampon += morceau.toString();
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(tampon);
      if (m && !affiche) {
        affiche = true;
        lienPublic = m[0];
        try {
          fs.writeFileSync(FICHIER_LIEN, [
            lienPublic, '',
            `ouvert le ${new Date().toLocaleString('fr-FR')}`,
            `serveur local : ${local}`, '',
            'Tant que la commande « npm run partage » tourne, ce lien fonctionne.',
            'Après un arrêt ou une mise en veille, un NOUVEAU lien est créé.',
            'Pour le retrouver : npm run lien', ''
          ].join('\n'));
        } catch (_) { /* disque en lecture seule : sans conséquence */ }

        cadre('VOTRE SITE EST EN LIGNE');
        console.log(`  🌍 Lien public  : ${lienPublic}`);
        console.log(`  💻 Sur place    : ${local}`);
        console.log('');
        afficherComptes('  ');
        console.log('\n  ⚠️  Ce lien change à chaque redémarrage : envoyez-le juste');
        console.log('      avant une démonstration. Il reste valable tant que cette');
        console.log('      fenêtre est ouverte.');
        console.log(`\n  Le lien est aussi noté dans ${FICHIER_LIEN.replace(os.homedir(), '~')}`);
        console.log('  (à retrouver plus tard : npm run lien)');
        console.log('\n  Ctrl+C pour arrêter.\n');
      }
      if (tampon.length > 8000) tampon = tampon.slice(-4000);
    });
  };
  analyser(tunnel.stdout);
  analyser(tunnel.stderr);

  tunnel.on('exit', code => {
    if (arretDemande) return;
    if (!affiche) {
      console.log('⚠️  Le lien public n’a pas pu être ouvert (réseau bloqué ?).');
      console.log(`   Le site reste accessible sur ${local}.`);
      return;
    }
    if (relances < 5) {
      relances += 1;
      console.log(`\n⚠️  Le tunnel public s’est arrêté (code ${code}). Nouvelle tentative ${relances}/5…`);
      console.log('   Un NOUVEAU lien va être créé.');
      setTimeout(() => demarrerTunnel(cheminBinaire), 3000);
    } else {
      console.log('\n❌ Le tunnel public n’a pas pu être rétabli.');
      console.log(`   Le site reste accessible sur ${local}. Relancez npm run partage.`);
    }
  });
}

setTimeout(() => {
  const cloudflare = SANS_TUNNEL ? null : trouverCloudflared();
  const aCloudflared = Boolean(cloudflare);

  if (SANS_TUNNEL || !aCloudflared) {
    afficherModeLocal(aCloudflared);
    return;
  }

  console.log('🌍 Ouverture d’un lien public (gratuit)…');
  if (cloudflare.chemin !== 'cloudflared') {
    console.log(`   (utilise ${cloudflare.chemin})`);
    if (!String(process.env.PATH || '').split(path.delimiter).includes(path.dirname(cloudflare.chemin))) {
      console.log('   Astuce : ajoutez ce dossier au PATH pour taper « cloudflared » directement :');
      console.log(`     echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc`);
    }
  }
  demarrerTunnel(cloudflare.chemin);
}, 2200);
