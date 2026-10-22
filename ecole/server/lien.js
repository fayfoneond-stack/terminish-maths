#!/usr/bin/env node
'use strict';
/**
 * Affiche le lien public actuel et l'état du site.
 *
 *   npm run lien
 *
 * Le lanceur (npm run partage) écrit le lien dans data/lien-public.txt tant que
 * le tunnel fonctionne, et supprime le fichier à l'arrêt. Cette commande dit donc
 * immédiatement si le site est en ligne et à quelle adresse.
 */
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.TERMINISH_DATA_DIR || path.join(__dirname, '..', 'data');
const FICHIER_LIEN = path.join(DATA_DIR, 'lien-public.txt');
const PORT = Number(process.env.PORT || 3000);
const ligne = '─'.repeat(62);

function lireLien() {
  try {
    const t = fs.readFileSync(FICHIER_LIEN, 'utf8');
    const url = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(t);
    const date = /ouvert le (.+)/.exec(t);
    return { url: url ? url[0] : null, date: date ? date[1].trim() : null };
  } catch (_) {
    return { url: null, date: null };
  }
}

async function etatLocal() {
  if (typeof fetch !== 'function') return null;
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

(async () => {
  const { url, date } = lireLien();
  const local = await etatLocal();

  console.log(`\n${ligne}`);
  if (url && local) {
    console.log('  🟢 Le site est en ligne');
    console.log(`  🌍 Lien public  : ${url}`);
    if (date) console.log(`  ⏱  Ouvert le    : ${date}`);
    console.log(`  💻 Sur place    : http://localhost:${PORT}`);
    console.log(`\n  Ce lien ne fonctionne que tant que la commande npm run partage tourne.`);
  } else if (local) {
    console.log('  🟡 Le serveur tourne, mais aucun lien public actif');
    console.log(`  💻 Sur place    : http://localhost:${PORT}`);
    console.log('\n  Pour obtenir un lien public : npm run partage');
    console.log('  (un ancien lien trycloudflare ne fonctionne plus : ERR_NAME_NOT_RESOLVED)');
  } else if (url) {
    console.log('  🔴 Le site n’est pas en ligne');
    console.log(`  Dernier lien connu : ${url}${date ? ` (ouvert le ${date})` : ''}`);
    console.log('\n  Ce lien est expiré : un tunnel rapide est supprimé dès qu’il s’arrête.');
    console.log('  Pour repartir : npm run partage   (un NOUVEAU lien sera créé)');
  } else {
    console.log('  🔴 Aucun site en cours d’exécution');
    console.log('\n  Démarrage :');
    console.log('    npm run partage        site + lien public');
    console.log('    npm run partage:demo   avec l’école de démonstration');
  }
  console.log(`${ligne}\n`);
})();
