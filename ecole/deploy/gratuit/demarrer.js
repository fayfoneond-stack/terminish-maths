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

let compte = { email: process.env.ADMIN_EMAIL || 'admin@terminish.tg', password: process.env.ADMIN_PASSWORD || '' };
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
function arreter(code = 0) {
  try { if (tunnel) tunnel.kill(); } catch (_) {}
  try { serveur.kill(); } catch (_) {}
  console.log('\n👋 Arrêt. À bientôt !\n');
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

setTimeout(() => {
  const cloudflare = SANS_TUNNEL ? null : trouverCloudflared();
  const aCloudflared = Boolean(cloudflare);

  if (SANS_TUNNEL || !aCloudflared) {
    cadre('TERMINISH ÉCOLE EST DÉMARRÉ');
    console.log(`  Adresse sur cet ordinateur : ${local}`);
    ips.forEach(ip => console.log(`  Adresse sur votre réseau   : http://${ip}:${PORT}`));
    console.log(`\n  Console administrateur : ${compte.email}`);
    console.log(`  Mot de passe           : ${compte.password}`);
    const joli = FICHIER_COMPTE.startsWith(os.homedir())
      ? FICHIER_COMPTE.replace(os.homedir(), '~') : FICHIER_COMPTE;
    console.log(`  (également dans ${joli})`);
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
  tunnel = spawn(cloudflare.chemin, ['tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate'],
    { stdio: ['ignore', 'pipe', 'pipe'] });

  let affiche = false;
  const analyser = flux => {
    let tampon = '';
    flux.on('data', morceau => {
      tampon += morceau.toString();
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(tampon);
      if (m && !affiche) {
        affiche = true;
        cadre('VOTRE SITE EST EN LIGNE');
        console.log(`  🌍 Lien public  : ${m[0]}`);
        console.log(`  💻 Sur place    : ${local}`);
        console.log(`\n  Console admin   : ${compte.email}`);
        console.log(`  Mot de passe    : ${compte.password}`);
        console.log(`\n  ⚠️  Ce lien change à chaque redémarrage : envoyez-le juste`);
        console.log('      avant une démonstration. Il reste valable tant que cette');
        console.log('      fenêtre est ouverte.');
        console.log('\n  Ctrl+C pour arrêter.\n');
      }
      if (tampon.length > 8000) tampon = tampon.slice(-4000);
    });
  };
  analyser(tunnel.stdout);
  analyser(tunnel.stderr);

  tunnel.on('exit', code => {
    if (!affiche) {
      console.log('⚠️  Le lien public n’a pas pu être ouvert (réseau bloqué ?).');
      console.log(`   Le site reste accessible sur ${local}.`);
    }
    if (code && code !== 0 && !affiche) console.log(`   cloudflared a quitté (code ${code}).`);
  });
}, 2200);
