'use strict';
/**
 * Lecture d'un fichier .env, sans dépendance externe.
 *
 * Pourquoi : sur un hébergeur (alwaysdata, Render, VPS…) les variables sont
 * souvent posées dans un fichier plutôt que dans le shell. Les scripts de
 * lancement (tout.sh, systemd, panneau de l'hébergeur) ne transmettent pas
 * toujours l'environnement du terminal : un fichier .env est la seule façon
 * fiable de retrouver les mêmes réglages après un redémarrage.
 *
 * Règles :
 *   • les variables déjà définies dans l'environnement ont la PRIORITÉ ;
 *   • les lignes vides et les commentaires (#) sont ignorés ;
 *   • les guillemets simples ou doubles autour de la valeur sont retirés ;
 *   • TERMINISH_ENV_FILE=/chemin/autre.env permet d'imposer un autre fichier.
 */
const fs = require('node:fs');
const path = require('node:path');

function chargerEnv(fichierImpose) {
  const fichier = fichierImpose || process.env.TERMINISH_ENV_FILE || path.join(__dirname, '..', '.env');
  let texte = '';
  try { texte = fs.readFileSync(fichier, 'utf8'); } catch { return {}; }

  const chargees = {};
  texte.split(/\r?\n/).forEach(ligne => {
    const l = ligne.trim();
    if (!l || l.startsWith('#')) return;
    const i = l.indexOf('=');
    if (i < 1) return;
    const cle = l.slice(0, i).trim();
    let valeur = l.slice(i + 1).trim();
    if ((valeur.startsWith('"') && valeur.endsWith('"')) ||
        (valeur.startsWith("'") && valeur.endsWith("'"))) {
      valeur = valeur.slice(1, -1);
    }
    if (!(cle in process.env)) {
      process.env[cle] = valeur;
      chargees[cle] = valeur;
    }
  });
  return chargees;
}

module.exports = { chargerEnv };
