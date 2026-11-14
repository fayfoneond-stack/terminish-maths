'use strict';
/**
 * Lecteur ZIP borné pour DOCX/XLSX. Ne décompresse que les fichiers XML utiles,
 * en mémoire, sans extraire de chemin sur le disque ni charger de dépendance.
 */
const zlib = require('node:zlib');
const path = require('node:path');
const MAX_ENTREE = 8 * 1024 * 1024;
const MAX_TOTAL = 24 * 1024 * 1024;
const MAX_FICHIERS = 600;

function invalide() { throw new Error('Fichier Word/Excel endommagé ou non pris en charge.'); }
function verifie(buffer, debut, longueur) {
  if (!Number.isSafeInteger(debut) || !Number.isSafeInteger(longueur) || debut < 0 || longueur < 0 ||
      debut + longueur > buffer.length) invalide();
}

function ouvrirZip(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) invalide();
  const limite = Math.max(0, buffer.length - 22 - 65535);
  let fin = -1;
  for (let p = buffer.length - 22; p >= limite; p--) {
    if (buffer.readUInt32LE(p) === 0x06054b50 && p + 22 + buffer.readUInt16LE(p + 20) === buffer.length) {
      fin = p; break;
    }
  }
  if (fin < 0 || buffer.readUInt16LE(fin + 4) || buffer.readUInt16LE(fin + 6)) invalide(); // pas de multi-disque
  const nombre = buffer.readUInt16LE(fin + 10);
  const taille = buffer.readUInt32LE(fin + 12);
  const position = buffer.readUInt32LE(fin + 16);
  if (nombre > MAX_FICHIERS || nombre === 0xffff || position === 0xffffffff ||
      taille === 0xffffffff || position + taille !== fin) invalide();
  const fichiers = new Map();
  let curseur = position;
  for (let i = 0; i < nombre; i++) {
    verifie(buffer, curseur, 46);
    if (buffer.readUInt32LE(curseur) !== 0x02014b50) invalide();
    const drapeaux = buffer.readUInt16LE(curseur + 8);
    const methode = buffer.readUInt16LE(curseur + 10);
    const compresse = buffer.readUInt32LE(curseur + 20);
    const decompresse = buffer.readUInt32LE(curseur + 24);
    const nomLong = buffer.readUInt16LE(curseur + 28);
    const extra = buffer.readUInt16LE(curseur + 30);
    const commentaire = buffer.readUInt16LE(curseur + 32);
    const local = buffer.readUInt32LE(curseur + 42);
    verifie(buffer, curseur, 46 + nomLong + extra + commentaire);
    const nom = buffer.toString('utf8', curseur + 46, curseur + 46 + nomLong);
    if (!nom || nom.includes('\\') || nom.includes('\0') || nom.startsWith('/') ||
        nom.split('/').includes('..') || path.posix.normalize(nom) !== nom || fichiers.has(nom) ||
        (drapeaux & 1) || ![0, 8].includes(methode)) invalide();
    fichiers.set(nom, { local, compresse, decompresse, methode });
    curseur += 46 + nomLong + extra + commentaire;
  }
  if (curseur !== fin) invalide();
  let totalLu = 0;
  return {
    noms: () => [...fichiers.keys()],
    lire(nom) {
      const e = fichiers.get(nom);
      if (!e) return null;
      if (e.decompresse > MAX_ENTREE || totalLu + e.decompresse > MAX_TOTAL) {
        throw new Error('Fichier Word/Excel trop volumineux une fois ouvert. Découpez la liste.');
      }
      verifie(buffer, e.local, 30);
      if (buffer.readUInt32LE(e.local) !== 0x04034b50) invalide();
      const debut = e.local + 30 + buffer.readUInt16LE(e.local + 26) + buffer.readUInt16LE(e.local + 28);
      verifie(buffer, debut, e.compresse);
      if (debut + e.compresse > position) invalide();
      let contenu;
      try {
        contenu = e.methode === 8
          ? zlib.inflateRawSync(buffer.subarray(debut, debut + e.compresse), { maxOutputLength: MAX_ENTREE })
          : buffer.subarray(debut, debut + e.compresse);
      } catch { invalide(); }
      if (contenu.length !== e.decompresse) invalide();
      totalLu += contenu.length;
      return contenu.toString('utf8');
    }
  };
}

module.exports = { ouvrirZip };
