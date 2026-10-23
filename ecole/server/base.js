#!/usr/bin/env node
'use strict';
/**
 * Terminish École — « sur quelle base tourne mon site ? »
 *
 *   npm run base
 *
 * Affiche, sans rien modifier :
 *   • le dossier de données réellement utilisé ;
 *   • le fichier SQLite, sa taille et sa dernière écriture ;
 *   • le mode (démo ou production) ;
 *   • le contenu réel : établissements, élèves, classes, notes, bulletins… ;
 *   • le port du site en marche et l'adresse publique du tunnel, s'il y en a un.
 *
 * Aucun démarrage du serveur n'est nécessaire : le fichier est lu directement,
 * en lecture seule.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const RACINE = path.join(__dirname, '..');
const DATA_DIR = process.env.TERMINISH_DATA_DIR || path.join(RACINE, 'data');
const FICHIER = path.join(DATA_DIR, 'terminish-ecole.db');

const C = {
  vert: '\x1b[32m', rouge: '\x1b[31m', jaune: '\x1b[33m',
  gris: '\x1b[90m', gras: '\x1b[1m', raz: '\x1b[0m'
};
const ok = m => console.log(`  ${C.vert}✔${C.raz} ${m}`);
const ko = m => console.log(`  ${C.rouge}✘${C.raz} ${m}`);
const info = m => console.log(`  ${C.gris}•${C.raz} ${m}`);
const titre = m => console.log(`\n${C.gras}${m}${C.raz}`);

function octets(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' Mo';
  if (n > 1024) return Math.round(n / 1024) + ' Ko';
  return n + ' o';
}
function quand(d) {
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  TERMINISH ÉCOLE — quelle base de données tourne ?');
console.log('══════════════════════════════════════════════════════════════');

/* ---------------------------------------------------------- 1. le fichier */
titre('1. Le fichier de données');
info(`Projet     : ${RACINE.replace(os.homedir(), '~')}`);
if (process.env.TERMINISH_DATA_DIR) {
  ok(`Dossier imposé par TERMINISH_DATA_DIR : ${DATA_DIR.replace(os.homedir(), '~')}`);
} else {
  info(`Dossier par défaut : ${DATA_DIR.replace(os.homedir(), '~')}`);
}

if (!fs.existsSync(FICHIER)) {
  ko(`Aucune base ici : ${FICHIER.replace(os.homedir(), '~')}`);
  console.log(`
  La base est créée au premier démarrage du site, dans le dossier « data ».
  Si ce n'est pas le bon dossier, c'est que le site tourne depuis un autre
  exemplaire du projet. Vérifiez où il est lancé :

      ps -ef | grep "server/index.js" | grep -v grep

  La ligne affiche le chemin complet du projet utilisé.
`);
  process.exit(1);
}
const st = fs.statSync(FICHIER);
ok(`Fichier : ${FICHIER.replace(os.homedir(), '~')}`);
info(`Taille  : ${octets(st.size)}`);
info(`Modifié : ${quand(st.mtime)}  ← dernière note enregistrée`);
console.log(`\n  ${C.jaune}À retenir : les notes, élèves et bulletins vivent UNIQUEMENT dans ce fichier.${C.raz}`);
console.log(`  ${C.jaune}Sauvegarde = copier ce fichier (ou npm run backup).${C.raz}`);

/* -------------------------------------------------------- 2. le contenu */
let DatabaseSync = null;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (_) { /* Node < 22.5 */ }
if (!DatabaseSync) {
  ko('Node.js 22.5+ est nécessaire pour lire la base (node:sqlite).');
  process.exit(1);
}

let db;
try { db = new DatabaseSync(FICHIER, { readOnly: true }); }
catch (_) { db = new DatabaseSync(FICHIER); }

const compter = (table, ou = '') => {
  try { return db.prepare(`SELECT COUNT(*) AS n FROM ${table} ${ou}`).get().n; } catch { return null; }
};
const existe = (t) => {
  try { return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t); } catch { return false; }
};

titre('2. Ce qu\'elle contient');
const etabs = (() => {
  try { return db.prepare('SELECT id, nom, ville, annee_scolaire FROM etablissements ORDER BY id').all(); } catch { return []; }
})();
const compte = {
  utilisateurs: compter('utilisateurs'),
  eleves: compter('eleves'),
  classes: compter('classes'),
  notes: compter('notes'),
  bulletins: existe('bulletins') ? compter('bulletins') : null,
  examens: existe('examens') ? compter('examens') : null,
  paiements: existe('paiements') ? compter('paiements') : null,
  demandes_mdp: existe('demandes_mdp') ? compter('demandes_mdp') : null
};

if (!etabs.length) {
  ko('Aucun établissement : la base est vide (premier démarrage, ou mode production sans inscription).');
} else {
  etabs.forEach(e => ok(`« ${e.nom} » — ${e.ville || 'ville non renseignée'} · année ${e.annee_scolaire || '—'}`));
}
console.log('');
Object.entries(compte).forEach(([k, v]) => {
  if (v === null) return;
  const libelle = {
    utilisateurs: 'comptes (direction, professeurs, élèves)',
    eleves: 'élèves inscrits',
    classes: 'classes',
    notes: 'notes saisies',
    bulletins: 'bulletins enregistrés',
    examens: 'examens blancs',
    paiements: 'paiements',
    demandes_mdp: 'demandes de mot de passe'
  }[k];
  info(`${String(v).padStart(6)}  ${libelle}`);
});

/* ------------------------------------------------------- 3. démo ou prod */
titre('3. Mode : démonstration ou production ?');
const demo = etabs.some(e => /demo|palmiers|exemple/i.test(e.nom || '')) ||
  (() => {
    try { return !!db.prepare("SELECT 1 FROM utilisateurs WHERE email LIKE '%@demo.tg' LIMIT 1").get(); } catch { return false; }
  })();
if (demo) {
  console.log(`  ${C.jaune}!${C.raz} Base de DÉMONSTRATION : elle contient une école fictive et des notes inventées.`);
  info('Comptes de démo : directeur@demo.tg / demo1234 · prof.maths@demo.tg / prof1234');
  info('Pour une base réelle : TERMINISH_SEED=prod au démarrage (aucune école fictive).');
} else {
  ok('Base de PRODUCTION (pas de jeu de démonstration détecté).');
}
try {
  const admin = db.prepare("SELECT email FROM utilisateurs WHERE role='super_admin' ORDER BY id LIMIT 1").get();
  if (admin) info(`Compte éditeur : ${admin.email}`);
} catch (_) { /* sans conséquence */ }

/* ---------------------------------------- 4. est-ce bien celle qui tourne ? */
titre('4. Est-ce bien la base du site en marche ?');
function portEcout(p) {
  const r = spawnSync('curl', ['-fsS', '--max-time', '2', `http://127.0.0.1:${p}/api/health`], { encoding: 'utf8' });
  return r.status === 0;
}

/** Liste les serveurs Terminish réellement en marche, avec leur dossier et leur base. */
function serveursEnMarche() {
  const resultat = [];
  let pids = [];
  try {
    pids = fs.readdirSync('/proc').filter(d => /^\d+$/.test(d));
  } catch (_) { return resultat; }
  const monPid = String(process.pid);
  pids.forEach(pid => {
    if (pid === monPid) return;
    try {
      const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' ').trim();
      // On ne garde que de vrais processus Node (pas un shell dont la ligne
      // de commande contiendrait « server/index.js » par hasard).
      if (!/^(\S*\/)?node(js)?\s/.test(cmd)) return;
      if (cmd.includes('grep')) return;
      if (!/server\/index\.js|deploy\/gratuit\/demarrer\.js/.test(cmd)) return;
      let cwd = '';
      try { cwd = fs.readlinkSync(`/proc/${pid}/cwd`); } catch (_) { /* processus disparu */ }
      let env = {};
      try {
        fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').forEach(kv => {
          const i = kv.indexOf('=');
          if (i > 0) env[kv.slice(0, i)] = kv.slice(i + 1);
        });
      } catch (_) { /* droits */ }
      resultat.push({ pid, cmd, cwd, env });
    } catch (_) { /* processus disparu entre-temps */ }
  });
  return resultat;
}
function portQuiRepond() {
  for (const p of [3000, 3001, 3002, 3003, 3004, 3005, 3080, 3800, 3900]) {
    const r = spawnSync('curl', ['-fsS', '--max-time', '2', `http://127.0.0.1:${p}/api/health`], { encoding: 'utf8' });
    if (r.status === 0) return p;
  }
  return null;
}
function tunnel() {
  for (const [cmd, args] of [['tailscale', ['funnel', 'status']], ['sudo', ['-n', 'tailscale', 'funnel', 'status']]]) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 5000 });
    if (r.status === 0 && r.stdout) {
      const url = /https:\/\/[a-z0-9.-]+\.ts\.net/i.exec(r.stdout);
      const proxy = /proxy http:\/\/127\.0\.0\.1:(\d+)/.exec(r.stdout);
      if (url || proxy) return { url: url && url[0], port: proxy && proxy[1] };
    }
  }
  return null;
}

const serveurs = serveursEnMarche();
const port = portQuiRepond();
const url = tunnel();

if (!serveurs.length) {
  info('Aucun serveur en marche pour l\'instant (la base est simplement sur le disque).');
} else {
  serveurs.forEach(sv => {
    const dossier = (sv.cwd || '?').replace(os.homedir(), '~');
    const base = sv.env.TERMINISH_DATA_DIR
      ? path.join(sv.env.TERMINISH_DATA_DIR, 'terminish-ecole.db')
      : path.join(sv.cwd || '', 'data', 'terminish-ecole.db');
    const memeBase = path.resolve(base) === path.resolve(FICHIER);
    console.log('');
    info(`Processus ${sv.pid} — dossier ${dossier}`);
    if (sv.env.TERMINISH_SEED) info(`  mode : ${sv.env.TERMINISH_SEED}`);
    if (memeBase) ok(`  il utilise CETTE base : ${base.replace(os.homedir(), '~')}`);
    else {
      console.log(`  ${C.rouge}✘${C.raz} il utilise une AUTRE base : ${base.replace(os.homedir(), '~')}`);
      if (!fs.existsSync(base)) info('  (ce fichier n\'existe pas encore : il sera créé au démarrage)');
    }
    if (sv.env.PORT && portEcout(sv.env.PORT)) info(`  il écoute sur le port ${sv.env.PORT} → http://localhost:${sv.env.PORT}`);
  });
}
// Port du site qui utilise la base décrite ci-dessus (pour le contrôle du tunnel).
const portAffiche = (() => {
  for (const sv of serveurs) {
    const base = sv.env.TERMINISH_DATA_DIR
      ? path.join(sv.env.TERMINISH_DATA_DIR, 'terminish-ecole.db')
      : path.join(sv.cwd || '', 'data', 'terminish-ecole.db');
    if (path.resolve(base) === path.resolve(FICHIER) && sv.env.PORT) return sv.env.PORT;
  }
  return port;
})();
if (url && url.url) {
  ok(`Adresse publique fixe : ${url.url}`);
  if (url.port && portAffiche && String(url.port) !== String(portAffiche)) {
    console.log(`  ${C.rouge}✘${C.raz} Le tunnel pointe sur le port ${url.port} mais le site écoute sur ${portAffiche} → erreur 502.`);
    info('Correction : sudo tailscale funnel --bg ' + portAffiche);
  }
} else {
  info('Aucune adresse publique Tailscale ouverte (sudo tailscale funnel --bg <port>).');
}

/* ------------------------------------------------- 5. les autres bases */
titre('5. Autres bases présentes sur cette machine');
const candidates = [
  path.join(os.homedir(), 'TERMINISH ECOLE', 'data'),
  path.join(os.homedir(), 'TERMINISH ECOLE 1', 'data'),
  path.join(os.homedir(), 'TERMINISH ECOLE 2', 'data'),
  DATA_DIR
];
let trouvees = 0;
[...new Set(candidates)].forEach(d => {
  const f = path.join(d, 'terminish-ecole.db');
  if (!fs.existsSync(f)) return;
  const s = fs.statSync(f);
  const marque = f === FICHIER ? ' ← celle décrite ci-dessus' : '';
  info(`${f.replace(os.homedir(), '~')}  (${octets(s.size)}, ${quand(s.mtime)})${marque}`);
  trouvees += 1;
});
if (trouvees <= 1) info('Une seule base trouvée : aucun risque de confusion.');
else console.log(`\n  ${C.jaune}!${C.raz} Plusieurs bases existent : c'est le dossier de LANCEMENT qui décide laquelle est utilisée.`);

console.log(`\n  ${C.gris}Sauvegarde : npm run backup — copie ce fichier dans data/sauvegardes/${C.raz}\n`);
