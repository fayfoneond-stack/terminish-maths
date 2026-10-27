'use strict';
/** Récupération par lien à usage unique, réservée à la direction et au super-admin. */
const crypto = require('node:crypto');

const DUREE_MINUTES = 30;
const ATTENTE_MINUTES = 10; // évite le harcèlement d'une boîte mail
const ROLES = "('directeur','super_admin')";

function normaliserEmail(email) {
  if (typeof email !== 'string') return '';
  const valeur = email.trim().toLowerCase();
  // Adresse simple sans séparateur MIME, commentaire ou retour à la ligne :
  // ne jamais laisser le parseur SMTP interpréter plusieurs destinataires.
  return valeur.length <= 254 && valeur.split('@')[0].length <= 64 &&
    /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(valeur) ? valeur : '';
}

function empreinte(jeton) {
  if (typeof jeton !== 'string' || !/^[a-f0-9]{64}$/.test(jeton)) return null;
  return crypto.createHash('sha256').update(jeton).digest('hex');
}

function lienValide(db, jeton, instant = Date.now()) {
  const hash = empreinte(jeton);
  if (!hash) return null;
  return db.prepare(`SELECT u.id FROM reinitialisations_mdp r
    JOIN utilisateurs u ON u.id = r.user_id
    WHERE r.jeton_hash = ? AND r.utilise_le IS NULL AND r.expire_le > ?
      AND u.actif = 1 AND u.role IN ${ROLES}`).get(hash, new Date(instant).toISOString()) || null;
}

/** Envoyer est injecté pour tester sans jamais envoyer de vrai message. */
async function demanderLien(db, email, { publicUrl, envoyer, instant = Date.now() }) {
  const adresse = normaliserEmail(email);
  if (!adresse || !publicUrl || typeof envoyer !== 'function') return { envoye: false };
  const utilisateur = db.prepare(`SELECT id, email FROM utilisateurs
    WHERE lower(email) = ? AND actif = 1 AND role IN ${ROLES}`).get(adresse);
  if (!utilisateur) return { envoye: false };

  const maintenant = new Date(instant).toISOString();
  const delai = new Date(instant - ATTENTE_MINUTES * 60_000).toISOString();
  const recent = db.prepare(`SELECT 1 FROM reinitialisations_mdp
    WHERE user_id = ? AND utilise_le IS NULL AND expire_le > ? AND cree_le > ? LIMIT 1`)
    .get(utilisateur.id, maintenant, delai);
  if (recent) return { envoye: false, attente: true };

  // Nettoyage opportuniste : ni jetons expirés ni historique inutile ne s'accumulent.
  db.prepare('DELETE FROM reinitialisations_mdp WHERE expire_le < ?')
    .run(new Date(instant - 7 * 86_400_000).toISOString());
  const jeton = crypto.randomBytes(32).toString('hex');
  const hash = empreinte(jeton);
  db.prepare(`INSERT INTO reinitialisations_mdp (jeton_hash, user_id, cree_le, expire_le)
    VALUES (?,?,?,?)`).run(hash, utilisateur.id, maintenant,
    new Date(instant + DUREE_MINUTES * 60_000).toISOString());
  try {
    // Le fragment # n'est jamais envoyé au serveur par le navigateur ni dans le Referer.
    await envoyer({
      email: utilisateur.email,
      lien: `${publicUrl}/app#/reinitialiser/${jeton}`,
      minutes: DUREE_MINUTES
    });
    // On ne révoque les anciens liens qu'APRÈS un envoi accepté par Gmail.
    db.prepare(`UPDATE reinitialisations_mdp SET utilise_le = ?
      WHERE user_id = ? AND jeton_hash != ? AND utilise_le IS NULL`)
      .run(maintenant, utilisateur.id, hash);
    return { envoye: true };
  } catch (erreur) {
    db.prepare('DELETE FROM reinitialisations_mdp WHERE jeton_hash = ?').run(hash);
    throw erreur;
  }
}

function terminerLien(db, jeton, motDePasse, hashPassword, instant = Date.now()) {
  if (typeof motDePasse !== 'string' || motDePasse.length < 12 || motDePasse.length > 128 || !motDePasse.trim()) {
    return { ok: false, erreur: 'Choisissez un mot de passe de 12 à 128 caractères.' };
  }
  if (!empreinte(jeton)) return { ok: false, erreur: 'Lien expiré ou déjà utilisé. Demandez-en un nouveau.' };
  const motDePasseHache = hashPassword(motDePasse);
  db.exec('BEGIN IMMEDIATE');
  try {
    const utilisateur = lienValide(db, jeton, instant);
    if (!utilisateur) {
      db.exec('ROLLBACK');
      return { ok: false, erreur: 'Lien expiré ou déjà utilisé. Demandez-en un nouveau.' };
    }
    db.prepare('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?').run(motDePasseHache, utilisateur.id);
    db.prepare('UPDATE reinitialisations_mdp SET utilise_le = ? WHERE user_id = ? AND utilise_le IS NULL')
      .run(new Date(instant).toISOString(), utilisateur.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(utilisateur.id);
    db.exec('COMMIT');
    return { ok: true };
  } catch (erreur) {
    db.exec('ROLLBACK');
    throw erreur;
  }
}

module.exports = { normaliserEmail, lienValide, demanderLien, terminerLien, DUREE_MINUTES };
