'use strict';
/**
 * Lecture locale d'un justificatif : OCR = AIDE À LA SAISIE, jamais preuve de
 * transfert réel. L'image, normalisée sans métadonnées, reste dans data/ et
 * n'est jamais servie par express.static ni envoyée à WhatsApp.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_DIR = process.env.TERMINISH_DATA_DIR || path.join(__dirname, '..', 'data');
const DOSSIER = path.join(DATA_DIR, 'preuves-paiement');
const MAX_OCTETS = 2_500_000;
const MAX_PIXELS = 7_000_000;
const NOM_FICHIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

function erreur(message) {
  const e = new Error(message);
  e.status = 400;
  throw e;
}

function dimensionsJPEG(b) {
  let pos = 2;
  while (pos + 4 <= b.length) {
    if (b[pos] !== 0xff) erreur('Image JPEG invalide.');
    while (b[pos] === 0xff) pos++;
    const marker = b[pos++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (pos + 2 > b.length) break;
    const taille = b.readUInt16BE(pos);
    if (taille < 2 || pos + taille > b.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb].includes(marker)) {
      if (taille < 7) break;
      return { largeur: b.readUInt16BE(pos + 5), hauteur: b.readUInt16BE(pos + 3) };
    }
    pos += taille;
  }
  erreur('Dimensions JPEG illisibles.');
}

function lireCapture(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > Math.ceil(MAX_OCTETS * 4 / 3) + 100) {
    erreur('Capture trop volumineuse (2,5 Mo maximum).');
  }
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUrl);
  if (!m) erreur('Choisissez une capture PNG ou JPEG, pas un document exécutable.');
  const octets = Buffer.from(m[2], 'base64');
  if (octets.length < 100 || octets.length > MAX_OCTETS ||
      octets.toString('base64') !== m[2]) erreur('Capture corrompue ou trop volumineuse (2,5 Mo maximum).');
  let dimensions;
  if (m[1].toLowerCase() === 'png') {
    if (octets.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        octets.subarray(12, 16).toString('ascii') !== 'IHDR' || octets.length < 24)
      erreur('Ce fichier n’est pas une image PNG valide.');
    dimensions = { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
  } else {
    if (octets[0] !== 0xff || octets[1] !== 0xd8) erreur('Ce fichier n’est pas une image JPEG valide.');
    dimensions = dimensionsJPEG(octets);
  }
  if (dimensions.largeur < 100 || dimensions.hauteur < 100 ||
      dimensions.largeur > 3200 || dimensions.hauteur > 3200 ||
      dimensions.largeur * dimensions.hauteur > MAX_PIXELS) {
    erreur('Dimensions de la capture invalides (7 mégapixels maximum).');
  }
  return octets;
}

async function normaliserCapture(dataUrl) {
  const octets = lireCapture(dataUrl);
  let image;
  try {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const original = await loadImage(octets);
    const ratio = Math.min(1, 1600 / Math.max(original.width, original.height));
    const canvas = createCanvas(Math.max(1, Math.round(original.width * ratio)),
      Math.max(1, Math.round(original.height * ratio)));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
    image = await canvas.encode('jpeg'); // Recompose : pas d'EXIF ni de données cachées.
  } catch (e) {
    erreur('Impossible de lire cette capture. Essayez un autre PNG ou JPEG.');
  }
  if (image.length > MAX_OCTETS) erreur('Capture recomposée trop volumineuse. Réduisez sa taille.');
  return { image, empreinte: crypto.createHash('sha256').update(image).digest('hex') };
}

function extraire(texte, montantAttendu) {
  const brut = String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const montants = [...brut.matchAll(/(?:^|[^\d])(\d{1,3}(?:[ .\u00a0,]\d{3})+|\d{4,7})\s*(?:FCFA|XOF|F\b)/g)]
    .map(m => Number(m[1].replace(/\D/g, '')))
    .filter(n => n >= 100 && n <= 10000000);
  const references = [...brut.matchAll(/\b(?:REF(?:ERENCE)?|RFF|TRANSACTION|ID(?:ENTIFIANT)?)\b(?:\s+(?:DE\s+)?TRANSACTION)?\s*[:#N°.-]?\s*([A-Z0-9][A-Z0-9.\/_-]{3,39})/g)]
    .map(m => m[1].replace(/[^A-Z0-9.\/_-]/g, ''))
    .filter(s => /\d/.test(s) && !['228'].includes(s));
  const numeros = [...brut.matchAll(/(?:\+?228[ .-]?)?[79][0-9](?:[ .-]?[0-9]){6}/g)]
    .map(m => m[0].replace(/\D/g, ''))
    .filter(n => n.length === 8 || (n.length === 11 && n.startsWith('228')));
  const uniques = a => [...new Set(a)].slice(0, 5);
  const resultat = { montants: uniques(montants), references: uniques(references),
    numeros: uniques(numeros), alertes: [] };
  if (montants.length && !montants.includes(montantAttendu)) {
    resultat.alertes.push('Le montant lu sur la capture ne correspond pas au tarif attendu. Vérifiez le relevé avant d’autoriser le reçu.');
  }
  if (!montants.length) resultat.alertes.push('Montant illisible sur la capture. Vérification manuelle obligatoire.');
  return resultat;
}

let ocrEnCours = false;
async function analyserCapture(image, montantAttendu) {
  if (ocrEnCours) return { montants: [], references: [], numeros: [], alertes: [
    'Reconnaissance occupée : vérifier manuellement la capture et le relevé Mobile Money.'
  ], confiance: null };
  ocrEnCours = true;
  let worker;
  try {
    const { createWorker } = require('tesseract.js');
    const { langPath } = require('@tesseract.js-data/fra');
    worker = await createWorker('fra', 1, { langPath, cacheMethod: 'none' });
    const lu = await worker.recognize(image);
    const extrait = extraire(lu.data.text, montantAttendu);
    extrait.confiance = Math.round(lu.data.confidence || 0);
    if (extrait.confiance < 60) extrait.alertes.push('Reconnaissance incertaine : ne validez pas sans votre relevé.');
    return extrait;
  } catch (e) {
    console.warn('OCR justificatif indisponible :', e.message);
    return { montants: [], references: [], numeros: [], confiance: null,
      alertes: ['Lecture automatique indisponible. Vérifier la capture et le relevé manuellement.'] };
  } finally {
    if (worker) await worker.terminate().catch(() => {});
    ocrEnCours = false;
  }
}

function enregistrerCapture(image) {
  fs.mkdirSync(DOSSIER, { recursive: true, mode: 0o700 });
  const nom = `${crypto.randomUUID()}.jpg`;
  fs.writeFileSync(path.join(DOSSIER, nom), image, { flag: 'wx', mode: 0o600 });
  return nom;
}
function lireFichier(nom) {
  if (!NOM_FICHIER.test(String(nom || ''))) return null;
  try { return fs.readFileSync(path.join(DOSSIER, nom)); } catch { return null; }
}
function supprimerCapture(nom) {
  if (NOM_FICHIER.test(String(nom || ''))) {
    try { fs.unlinkSync(path.join(DOSSIER, nom)); } catch (_) { /* nettoyage best effort */ }
  }
}

module.exports = { MAX_OCTETS, lireCapture, normaliserCapture, analyserCapture, extraire,
  enregistrerCapture, lireFichier, supprimerCapture, DOSSIER };
