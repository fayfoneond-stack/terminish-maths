'use strict';
/**
 * Images des signatures dans les bulletins : une URL MEGA est une page de
 * partage, pas une image. Une URL /media peut aussi être inaccessible depuis
 * le navigateur (ou le fichier avoir disparu). Préparer les images côté serveur
 * et les incorporer au HTML évite les liens cassés et la course avec l'impression.
 * Ne jamais solliciter une URL arbitraire présente dans la base (SSRF).
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const stockage = require('./storage');

const MAX = stockage.TAILLE_MAX;
const CHEMIN_LOCAL = /^\/media\/signatures\/(signatures-[0-9a-f-]{36}\.(?:png|jpe?g|webp))$/i;

function mimeImage(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

function encoderImage(buffer) {
  const mime = buffer.length <= MAX && mimeImage(buffer);
  return mime ? `data:${mime};base64,${buffer.toString('base64')}` : null;
}

function urlImageAutorisee(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    return (u.hostname === 'res.cloudinary.com' && /^\/[^/]+\/(?:image|auto)\/upload\//.test(u.pathname)) ||
      (u.hostname === 'drive.google.com' && u.pathname === '/thumbnail') ||
      (u.hostname.endsWith('.googleusercontent.com') && u.hostname.length > '.googleusercontent.com'.length);
  } catch { return false; }
}

async function lireImageDistante(url) {
  if (!urlImageAutorisee(url)) return null;
  // Refuser les redirections vers un autre fournisseur, vers HTTP ou vers une
  // adresse privée ; les fournisseurs ci-dessus n'ont pas besoin de cookies.
  const signal = AbortSignal.timeout(6000);
  for (let redirections = 0; redirections <= 3; redirections++) {
    const reponse = await fetch(url, { redirect: 'manual', signal });
    if (reponse.status >= 300 && reponse.status < 400) {
      if (redirections === 3) return null;
      url = new URL(reponse.headers.get('location') || '', url).href;
      if (!urlImageAutorisee(url)) return null;
      continue;
    }
    if (!reponse.ok || Number(reponse.headers.get('content-length') || 0) > MAX || !reponse.body) return null;
    const morceaux = [];
    let total = 0;
    const lecteur = reponse.body.getReader();
    try {
      while (true) {
        const { value, done } = await lecteur.read();
        if (done) break;
        total += value.length;
        if (total > MAX) { await lecteur.cancel(); return null; }
        morceaux.push(value);
      }
    } finally { lecteur.releaseLock(); }
    return encoderImage(Buffer.concat(morceaux, total));
  }
  return null;
}

async function imagePourBulletin(signature) {
  if (!signature || typeof signature !== 'string') return null;
  const src = signature.trim();
  try {
    const locale = CHEMIN_LOCAL.exec(src);
    if (locale) {
      const fichier = path.join(stockage.MEDIA_DIR, 'signatures', locale[1]);
      const info = await fs.lstat(fichier);
      if (!info.isFile() || info.size > MAX) return null;
      return encoderImage(await fs.readFile(fichier));
    }
    if (src.startsWith('data:') && src.length < MAX * 2) {
      const image = stockage.lireDataUrl(src);
      return image && mimeImage(image.buffer) === image.type ? encoderImage(image.buffer) : null;
    }
    return await lireImageDistante(src);
  } catch { return null; } // fichier supprimé / fournisseur indisponible
}

/** Cache limité à une requête : la même photo sert à plusieurs matières/élèves. */
async function preparerSignatures(bulletins) {
  const cache = new Map();
  const preparer = (url) => {
    if (!url) return Promise.resolve(null);
    if (!cache.has(url)) cache.set(url, imagePourBulletin(url));
    return cache.get(url);
  };
  return Promise.all(bulletins.map(async b => {
    const professeurs = Object.fromEntries(await Promise.all(Object.entries(b.professeurs || {}).map(async ([id, prof]) => {
      const image = await preparer(prof.signature);
      return [id, { ...prof, signature: image, signature_indisponible: !!prof.signature && !image }];
    })));
    const principalImage = await preparer(b.principal?.signature);
    const chefImage = await preparer(b.chef?.signature);
    return {
      ...b, professeurs,
      principal: b.principal && { ...b.principal, signature: principalImage,
        signature_indisponible: !!b.principal.signature && !principalImage },
      chef: b.chef && { ...b.chef, signature: chefImage,
        signature_indisponible: !!b.chef.signature && !chefImage }
    };
  }));
}

module.exports = { imagePourBulletin, preparerSignatures, mimeImage, urlImageAutorisee };
