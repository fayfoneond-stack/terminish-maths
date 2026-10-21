'use strict';
/**
 * Cloudinary — miroir optionnel des logos d'établissement.
 *
 * Les logos restent TOUJOURS enregistrés en data URL dans la base (source de
 * vérité, disponible hors ligne, imprimée sur le bulletin). Quand Cloudinary
 * est configuré, une copie optimisée est en plus envoyée sur le CDN et
 * l'URL `secure_url` est stockée dans `etablissements.logo_url`.
 *
 * Configuration (au choix) :
 *   CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 *   ou CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
 *
 * Aucune clé → la fonction `actif()` renvoie false et rien n'est envoyé :
 * l'application se comporte exactement comme avant.
 */
const crypto = require('node:crypto');

const TYPES_ACCEPTES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp'
};
const DOSSIER = 'terminish/logos';
const TIMEOUT_MS = 10000;

function config() {
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
    } catch (_) { /* URL malformée : on garde les variables séparées */ }
  }
  return {
    actif: Boolean(cloud && key && secret),
    cloud, key, secret,
    source: process.env.CLOUDINARY_URL ? 'CLOUDINARY_URL'
      : (process.env.CLOUDINARY_CLOUD_NAME ? 'variables CLOUDINARY_*' : 'non configuré'),
    apiBase: (process.env.CLOUDINARY_API_BASE || 'https://api.cloudinary.com').replace(/\/+$/, '')
  };
}

/** Signature Cloudinary : sha1(params triés + api_secret), paramètres exclus. */
function signature(params, secret) {
  const exclus = new Set(['file', 'api_key', 'cloud_name', 'resource_type', 'signature']);
  const aSigner = Object.keys(params)
    .filter(k => !exclus.has(k) && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(aSigner + secret).digest('hex');
}

/**
 * Envoie un logo (data URL PNG/JPEG/WebP) sur Cloudinary.
 * @returns {Promise<{url:string, publicId:string}|null>} null si non configuré
 *          ou si le format n'est pas pris en charge (SVG : on garde la data URL).
 */
async function envoyerLogo(dataUrl, publicId) {
  const cfg = config();
  if (!cfg.actif) return null;

  const m = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!m) return null;
  const format = TYPES_ACCEPTES[m[1].toLowerCase()];
  if (!format) return null; // SVG, GIF… : reste en local, c'est déjà léger

  const params = {
    public_id: publicId,
    folder: DOSSIER,
    overwrite: 'true',
    invalidate: 'true',
    timestamp: String(Math.floor(Date.now() / 1000)),
    transformation: 'c_limit,w_400,h_400',
    tags: 'terminish,logo'
  };

  const corps = new FormData();
  Object.entries(params).forEach(([k, v]) => corps.append(k, v));
  corps.append('api_key', cfg.key);
  corps.append('file', `data:${m[1]};base64,${m[2]}`);
  corps.append('signature', signature(params, cfg.secret));

  const reponse = await fetch(`${cfg.apiBase}/v1_1/${encodeURIComponent(cfg.cloud)}/image/upload`, {
    method: 'POST',
    body: corps,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  const json = await reponse.json().catch(() => ({}));
  if (!reponse.ok || !json.secure_url) {
    const msg = (json.error && json.error.message) || `HTTP ${reponse.status}`;
    throw new Error(`Cloudinary : ${msg}`);
  }
  return { url: json.secure_url, publicId: json.public_id };
}

module.exports = { config, signature, envoyerLogo, TYPES_ACCEPTES, DOSSIER };
