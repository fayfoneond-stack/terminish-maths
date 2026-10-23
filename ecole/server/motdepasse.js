#!/usr/bin/env node
'use strict';
/**
 * Réinitialise le mot de passe du super administrateur.
 *
 *   npm run motdepasse                          → nouveau mot de passe généré
 *   ADMIN_PASSWORD='MonMotDePasse' npm run motdepasse
 *   npm run motdepasse -- --email autre@ecole.tg
 *
 * Utile quand le mot de passe de la console a été oublié : la base reste intacte,
 * seuls le mot de passe et les sessions ouvertes sont remplacés.
 */
const { DatabaseSync } = require('node:sqlite');
require('./env').chargerEnv();   // mêmes réglages que le site (.env)
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.TERMINISH_DATA_DIR || path.join(__dirname, '..', 'data');
const CHEMIN_DB = path.join(DATA_DIR, 'terminish-ecole.db');

if (!fs.existsSync(CHEMIN_DB)) {
  console.error(`\n❌ Base introuvable : ${CHEMIN_DB}`);
  console.error('   Lancez d’abord l’application (npm run partage) pour la créer.\n');
  process.exit(1);
}

// Même format que hashPassword() de server/db.js : scrypt$sel$empreinte
function hashPassword(motDePasse) {
  const sel = crypto.randomBytes(16).toString('hex');
  const empreinte = crypto.scryptSync(String(motDePasse), sel, 64).toString('hex');
  return `scrypt$${sel}$${empreinte}`;
}

const MOTS_A = ['palmier', 'baobab', 'colibri', 'calebasse', 'harmattan', 'savane',
  'lagune', 'mangrove', 'fromager', 'hibiscus', 'zebu', 'mil'];
const MOTS_B = ['solaire', 'brillant', 'paisible', 'nouveau', 'solide', 'vivant',
  'clair', 'fidele', 'ouvert', 'joyeux'];
const sansAccent = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function generer() {
  return `${sansAccent(MOTS_A[crypto.randomInt(MOTS_A.length)])}-` +
    `${sansAccent(MOTS_B[crypto.randomInt(MOTS_B.length)])}-${crypto.randomInt(1000, 9999)}`;
}

const iEmail = process.argv.indexOf('--email');
const emailVoulu = iEmail > 0 ? String(process.argv[iEmail + 1] || '').trim().toLowerCase() : '';

const base = new DatabaseSync(CHEMIN_DB);
base.exec('PRAGMA busy_timeout = 5000');
const admin = emailVoulu
  ? base.prepare("SELECT id, email FROM utilisateurs WHERE email = ?").get(emailVoulu)
  : base.prepare("SELECT id, email FROM utilisateurs WHERE role = 'super_admin' ORDER BY id LIMIT 1").get();

if (!admin) {
  console.error(emailVoulu
    ? `\n❌ Aucun utilisateur avec l’adresse ${emailVoulu}.`
    : '\n❌ Aucun super administrateur dans cette base.');
  base.close();
  process.exit(1);
}

const motDePasse = process.env.ADMIN_PASSWORD || generer();
base.prepare('UPDATE utilisateurs SET mot_de_passe = ?, actif = 1 WHERE id = ?')
  .run(hashPassword(motDePasse), admin.id);
const sessions = base.prepare('DELETE FROM sessions WHERE user_id = ?').run(admin.id);
base.close();

// Mise à jour du mémo, s'il existe
const fichier = path.join(DATA_DIR, 'compte-administrateur.txt');
try {
  fs.writeFileSync(fichier, [
    'Terminish École — compte administrateur de cette installation',
    '',
    `Identifiant  : ${admin.email}`,
    `Mot de passe : ${motDePasse}`,
    '',
    '(mot de passe réinitialisé le ' + new Date().toLocaleString('fr-FR') + ')',
    ''
  ].join('\n'), { mode: 0o600 });
} catch (_) { /* pas bloquant */ }

const ligne = '─'.repeat(58);
console.log(`\n${ligne}`);
console.log('  Mot de passe réinitialisé');
console.log(`  Identifiant  : ${admin.email}`);
console.log(`  Mot de passe : ${motDePasse}`);
console.log(`  Sessions ouvertes fermées : ${sessions.changes}`);
if (fs.existsSync(fichier)) console.log(`  Également noté dans : ${fichier}`);
console.log(`${ligne}\n`);
