'use strict';
/**
 * Terminish École — stockage externe des fichiers (signatures, logos, reçus).
 * -----------------------------------------------------------------------------
 * Principe : l'application ne parle jamais directement à un fournisseur. Elle
 * appelle `enregistrer()` qui essaie les fournisseurs configurés, dans l'ordre.
 * Si aucun n'est configuré (ou si tous échouent), le fichier est écrit sur le
 * disque local et servi sous /media/… : l'application fonctionne toujours.
 *
 * Fournisseurs reconnus
 *   local        toujours disponible (dossier data/media)
 *   cloudinary   images (signatures, logos) — plusieurs comptes possibles
 *   drive        Google Drive (compte de service) — archives, pièces jointes
 *   mega         via rclone (remote « mega: ») — archives
 *
 * Configuration dans .env
 *   STORAGE_PROVIDERS=cloudinary,local       ordre d'essai
 *
 *   # Cloudinary, plusieurs comptes (rotation automatique) :
 *   CLOUDINARY_ACCOUNTS=cloud1|api_key1|secret1;cloud2|api_key2|secret2
 *   # ou un seul compte : CLOUDINARY_URL=cloudinary://key:secret@cloud
 *
 *   # Google Drive (partage de compte de service avec le dossier cible) :
 *   GOOGLE_DRIVE_SA_JSON=/chemin/service-account.json
 *   GOOGLE_DRIVE_FOLDER_ID=1AbC...
 *
 *   # MEGA via rclone (rclone config → remote nommé « mega ») :
 *   MEGA_RCLONE_REMOTE=mega:Terminish
 *
 * Rotation multi-comptes : le compte est choisi par empreinte de la clé de
 * rangement (ex. l'identifiant de l'établissement). Deux établissements
 * peuvent donc atterrir sur deux comptes différents, et un même établissement
 * reste toujours sur le même (les liens ne se cassent pas).
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const RACINE = path.join(__dirname, '..');
const DATA_DIR = process.env.TERMINISH_DATA_DIR || path.join(RACINE, 'data');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const PUBLIC_PREFIX = '/media';
const TAILLE_MAX = 4 * 1024 * 1024;          // 4 Mo : largement assez pour une signature
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

/* --------------------------------------------------------------- utilitaires */
/** Décompose une data URL « data:image/png;base64,…. » */
function lireDataUrl(dataUrl) {
  const m = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(String(dataUrl || '').trim());
  if (!m) return null;
  const type = m[1].toLowerCase();
  const buffer = Buffer.from(m[2], 'base64');
  if (!buffer.length || buffer.length > TAILLE_MAX) return null;
  return { type, buffer, ext: EXT[type] || 'bin' };
}

/** Nom de fichier imprévisible : signature-<uuid>.<ext> */
function nomFichier(categorie, ext) {
  const cat = String(categorie || 'divers').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'divers';
  return `${cat}-${crypto.randomUUID()}.${ext}`;
}

function cleRangement(ecoleId) {
  return String(ecoleId ?? 'global');
}

/** Index stable (0..n-1) dérivé d'une clé : même école → même compte. */
function indexCompte(cle, n) {
  if (n <= 1) return 0;
  const h = crypto.createHash('sha1').update(String(cle)).digest();
  return h.readUInt32BE(0) % n;
}

/* --------------------------------------------------------------- local ------ */
function enregistrerLocal(fichier) {
  const dossier = path.join(MEDIA_DIR, fichier.categorie);
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, fichier.nom), fichier.buffer);
  return { url: `${PUBLIC_PREFIX}/${fichier.categorie}/${fichier.nom}`, provider: 'local', publicId: null };
}

/* ------------------------------------------------------------ cloudinary ---- */
/** Comptes Cloudinary configurés (un ou plusieurs). */
function comptesCloudinary() {
  const comptes = [];
  const liste = String(process.env.CLOUDINARY_ACCOUNTS || '').trim();
  if (liste) {
    liste.split(';').forEach(ligne => {
      const [cloud, key, secret] = ligne.split('|').map(x => (x || '').trim());
      if (cloud && key && secret) comptes.push({ cloud, key, secret });
    });
  }
  if (!comptes.length) {
    let cloud = process.env.CLOUDINARY_CLOUD_NAME || '';
    let key = process.env.CLOUDINARY_API_KEY || '';
    let secret = process.env.CLOUDINARY_API_SECRET || '';
    const url = process.env.CLOUDINARY_URL || '';
    if (url.startsWith('cloudinary://')) {
      try {
        const u = new URL(url);
        cloud = cloud || decodeURIComponent(u.hostname);
        key = key || decodeURIComponent(u.username);
        secret = secret || decodeURIComponent(u.password);
      } catch (_) { /* URL malformée */ }
    }
    if (cloud && key && secret) comptes.push({ cloud, key, secret });
  }
  return comptes;
}

function signerCloudinary(params, secret) {
  const exclus = new Set(['file', 'api_key', 'cloud_name', 'resource_type', 'signature']);
  const aSigner = Object.keys(params)
    .filter(k => !exclus.has(k) && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(aSigner + secret).digest('hex');
}

async function enregistrerCloudinary(fichier) {
  const comptes = comptesCloudinary();
  if (!comptes.length) throw new Error('Cloudinary non configuré');
  const compte = comptes[indexCompte(fichier.cle, comptes.length)];
  const apiBase = (process.env.CLOUDINARY_API_BASE || 'https://api.cloudinary.com').replace(/\/+$/, '');
  const dossier = String(process.env.CLOUDINARY_FOLDER || 'terminish');
  const publicId = `${dossier}/${fichier.categorie}/${fichier.nom.replace(/\.[^.]+$/, '')}`;
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000), overwrite: 'true' };
  params.signature = signerCloudinary(params, compte.secret);

  const corps = new URLSearchParams();
  corps.set('file', `data:${fichier.type};base64,${fichier.buffer.toString('base64')}`);
  corps.set('api_key', compte.key);
  Object.entries(params).forEach(([k, v]) => corps.set(k, String(v)));

  const reponse = await fetch(`${apiBase}/v1_1/${encodeURIComponent(compte.cloud)}/auto/upload`, {
    method: 'POST',
    body: corps,
    signal: AbortSignal.timeout(20000)
  });
  const data = await reponse.json().catch(() => null);
  if (!reponse.ok || !data || !data.secure_url) {
    throw new Error(`Cloudinary (${compte.cloud}) : ${(data && data.error && data.error.message) || `HTTP ${reponse.status}`}`);
  }
  return { url: data.secure_url, provider: `cloudinary:${compte.cloud}`, publicId: data.public_id || publicId };
}

/* ----------------------------------------------------------------- drive ---- */
/** Jeton OAuth2 Google depuis un compte de service (JWT RS256). */
async function jetonDrive() {
  const chemin = process.env.GOOGLE_DRIVE_SA_JSON || '';
  if (!chemin || !fs.existsSync(chemin)) throw new Error('GOOGLE_DRIVE_SA_JSON absent');
  const sa = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  if (!sa.client_email || !sa.private_key) throw new Error('compte de service invalide');
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const charge = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: maintenant + 3600,
    iat: maintenant
  })).toString('base64url');
  const signature = crypto.createSign('RSA-SHA256').update(`${entete}.${charge}`).sign(sa.private_key, 'base64url');
  const corps = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${entete}.${charge}.${signature}`
  });
  const reponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', body: corps, signal: AbortSignal.timeout(15000)
  });
  const data = await reponse.json().catch(() => null);
  if (!reponse.ok || !data || !data.access_token) throw new Error('jeton Google refusé');
  return data.access_token;
}

async function enregistrerDrive(fichier) {
  const dossier = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  if (!dossier) throw new Error('GOOGLE_DRIVE_FOLDER_ID absent');
  const jeton = await jetonDrive();
  const limite = '----terminish' + crypto.randomBytes(8).toString('hex');
  const debut = JSON.stringify({ name: fichier.nom, parents: [dossier] });
  const corps = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${debut}\r\n`),
    Buffer.from(`--${limite}\r\nContent-Type: ${fichier.type}\r\n\r\n`),
    fichier.buffer,
    Buffer.from(`\r\n--${limite}--\r\n`)
  ]);
  const reponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': `multipart/related; boundary=${limite}` },
    body: corps,
    signal: AbortSignal.timeout(25000)
  });
  const data = await reponse.json().catch(() => null);
  if (!reponse.ok || !data || !data.id) throw new Error(`Drive : HTTP ${reponse.status}`);
  // Les signatures doivent être lisibles dans le bulletin : on ouvre la lecture.
  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    signal: AbortSignal.timeout(15000)
  }).catch(() => null);
  return {
    url: `https://drive.google.com/thumbnail?id=${data.id}&sz=w600`,
    provider: 'drive', publicId: data.id
  };
}

/* ------------------------------------------------------------------ mega ---- */
/**
 * Où est rclone ? Sur un hébergement mutualisé (alwaysdata), le binaire est
 * souvent installé dans ~/bin sans être dans le PATH du service : on essaie
 * donc RCLONE_BIN (avec ~ développé), puis les emplacements usuels.
 */
let rcloneMemorise = null;
function trouverRclone() {
  if (rcloneMemorise) return rcloneMemorise;
  const maison = process.env.HOME || os.homedir();
  const dev = (p) => (p && p.startsWith('~/') ? path.join(maison, p.slice(2)) : p);
  const candidats = [
    dev(process.env.RCLONE_BIN || ''),
    path.join(maison, 'bin', 'rclone'),
    path.join(maison, '.local', 'bin', 'rclone'),
    '/usr/local/bin/rclone',
    '/usr/bin/rclone',
    'rclone'
  ].filter(Boolean);
  for (const c of candidats) {
    const r = spawnSync(c, ['version'], { encoding: 'utf8', timeout: 8000 });
    if (r.status === 0) {
      const lignes = String(r.stdout || '').split('\n');
      rcloneMemorise = { chemin: c, version: (lignes[0] || '').replace('rclone ', '') };
      return rcloneMemorise;
    }
  }
  return null;
}

/** MEGA passe par rclone (aucune bibliothèque Node fiable côté serveur). */
async function enregistrerMega(fichier) {
  const remote = process.env.MEGA_RCLONE_REMOTE || '';
  if (!remote) throw new Error('MEGA_RCLONE_REMOTE absent');
  const trouve = trouverRclone();
  if (!trouve) throw new Error('rclone introuvable (RCLONE_BIN=~/bin/rclone)');
  const binaire = trouve.chemin;
  const dossier = path.join(os.tmpdir(), `terminish-mega-${crypto.randomUUID()}`);
  fs.mkdirSync(dossier, { recursive: true });
  const local = path.join(dossier, fichier.nom);
  fs.writeFileSync(local, fichier.buffer);
  const cible = `${remote.replace(/\/+$/, '')}/${fichier.categorie}`;
  const envoi = spawnSync(binaire, ['copy', local, cible, '--quiet'], { encoding: 'utf8', timeout: 60000 });
  if (envoi.status !== 0) {
    fs.rmSync(dossier, { recursive: true, force: true });
    throw new Error(`rclone : ${(envoi.stderr || '').split('\n')[0] || 'échec'}`);
  }
  const lien = spawnSync(binaire, ['link', `${cible}/${fichier.nom}`], { encoding: 'utf8', timeout: 30000 });
  fs.rmSync(dossier, { recursive: true, force: true });
  const url = String(lien.stdout || '').trim().split('\n').pop();
  if (lien.status !== 0 || !url) throw new Error('rclone link : aucun lien') ;
  return { url, provider: 'mega', publicId: `${cible}/${fichier.nom}` };
}

/* --------------------------------------------------------------- fabrique --- */
const FOURNISSEURS = {
  local: enregistrerLocal,
  cloudinary: enregistrerCloudinary,
  drive: enregistrerDrive,
  mega: enregistrerMega
};

/**
 * Ordre d'essai des fournisseurs.
 * @param {string[]|null} seulement  liste imposée (test isolé) : pas de repli local
 */
function ordre(seulement) {
  if (Array.isArray(seulement) && seulement.length) {
    return seulement.map(x => String(x).toLowerCase().trim()).filter(x => FOURNISSEURS[x]);
  }
  const brut = String(process.env.STORAGE_PROVIDERS || 'cloudinary,local').toLowerCase();
  const liste = brut.split(',').map(x => x.trim()).filter(x => FOURNISSEURS[x]);
  if (!liste.includes('local')) liste.push('local');   // filet de sécurité
  return liste;
}

/**
 * Enregistre un fichier (data URL) et renvoie { url, provider, publicId }.
 * N'échoue jamais : en dernier recours, le disque local prend le relais.
 */
async function enregistrer(dataUrl, { categorie = 'divers', ecoleId = 'global', seulement = null } = {}) {
  const lu = lireDataUrl(dataUrl);
  if (!lu) throw new Error('Image illisible (formats acceptés : PNG, JPEG, WebP)');
  const fichier = {
    ...lu,
    nom: nomFichier(categorie, lu.ext),
    categorie: String(categorie).replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'divers',
    cle: cleRangement(ecoleId),
    ecoleId
  };

  const erreurs = [];
  for (const nom of ordre(seulement)) {
    try {
      const resultat = await FOURNISSEURS[nom](fichier);
      if (resultat && resultat.url) return { ...resultat, essais: erreurs };
    } catch (err) {
      erreurs.push(`${nom} : ${err.message}`);
    }
  }
  // enregistrerLocal ne lève pas ; si on arrive ici, c'est une panne disque
  throw new Error(erreurs.length ? erreurs.join(' ; ') : 'disque inaccessible');
}

/** Pour le diagnostic : quels fournisseurs sont utilisables ? */
function etat() {
  const comptes = comptesCloudinary();
  return {
    ordre: ordre(),
    local: { dossier: MEDIA_DIR, url: PUBLIC_PREFIX },
    cloudinary: { configure: comptes.length > 0, comptes: comptes.map(c => c.cloud) },
    drive: { configure: Boolean(process.env.GOOGLE_DRIVE_SA_JSON && process.env.GOOGLE_DRIVE_FOLDER_ID) },
    mega: {
      configure: Boolean(process.env.MEGA_RCLONE_REMOTE),
      via: 'rclone',
      dossier: process.env.MEGA_RCLONE_REMOTE || null,
      rclone: (() => {
        const t = trouverRclone();
        return t ? { present: true, chemin: t.chemin, version: t.version } : { present: false, chemin: null };
      })()
    }
  };
}

module.exports = {
  enregistrer, etat, lireDataUrl, comptesCloudinary, indexCompte,
  trouverRclone, MEDIA_DIR, PUBLIC_PREFIX, TAILLE_MAX
};
