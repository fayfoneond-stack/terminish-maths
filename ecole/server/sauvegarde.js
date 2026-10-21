'use strict';
/**
 * Sauvegarde à chaud de la base SQLite.
 *
 *   npm run backup                     → sauvegarde dans <données>/sauvegardes/
 *   TERMINISH_DATA_DIR=/data npm run backup
 *
 * La commande peut tourner pendant que l'application est en service : SQLite
 * produit une copie cohérente (VACUUM INTO) sans bloquer les utilisateurs.
 * Les 14 dernières sauvegardes sont conservées (CONSERVER pour changer).
 *
 * Exemple de tâche quotidienne (cron, 2 h du matin) :
 *   0 2 * * * cd /var/www/terminish-ecole && TERMINISH_SEED=prod npm run backup >> /var/log/terminish-backup.log 2>&1
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.TERMINISH_DATA_DIR || path.join(__dirname, '..', 'data');
const SOURCE = path.join(DATA_DIR, 'terminish-ecole.db');
const DEST_DIR = process.env.SAUVEGARDE_DIR || path.join(DATA_DIR, 'sauvegardes');
const CONSERVER = Math.max(1, Number(process.env.CONSERVER || 14));

if (!fs.existsSync(SOURCE)) {
  console.error(`Base introuvable : ${SOURCE}`);
  process.exit(1);
}

fs.mkdirSync(DEST_DIR, { recursive: true });
const horodatage = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const DEST = path.join(DEST_DIR, `terminish-ecole-${horodatage}.db`);

const db = new DatabaseSync(SOURCE);
try {
  db.exec(`VACUUM INTO '${DEST.replace(/'/g, "''")}'`);
} finally {
  db.close();
}

const taille = (fs.statSync(DEST).size / 1024).toFixed(0);
console.log(`Sauvegarde créée : ${DEST} (${taille} Ko)`);

// Rotation : on ne garde que les N plus récentes
const anciennes = fs.readdirSync(DEST_DIR)
  .filter(f => /^terminish-ecole-.*\.db$/.test(f))
  .sort()
  .reverse()
  .slice(CONSERVER);
anciennes.forEach(f => fs.unlinkSync(path.join(DEST_DIR, f)));
if (anciennes.length) console.log(`${anciennes.length} ancienne(s) sauvegarde(s) supprimée(s)`);
