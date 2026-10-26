'use strict';
/**
 * Lit une liste de classe PDF localement, sans l'envoyer à un service externe.
 * Les PDF numériques sont lus avec PDF.js ; si une page n'a pas de texte, on
 * essaie une reconnaissance OCR locale (français) sur son image. Rien n'est
 * inscrit en base à cette étape : chaque ligne doit être vérifiée par la
 * direction avant confirmation.
 */
const path = require('node:path');
// PDF.js, le moteur OCR et le canvas natif ne sont chargés que lorsqu'un PDF
// est reçu : une installation OCR incompatible ne doit jamais arrêter tout
// le site ni désactiver les inscriptions ordinaires.

const MAX_OCTETS = 8 * 1024 * 1024;
const MAX_PAGES = 15;
const MAX_PAGES_OCR = 6;
const MAX_ELEVES = 300;
let ocrEnCours = false;

function nettoyer(s) {
  return String(s ?? '').replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
}
function simplifier(s) {
  return nettoyer(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}
function nomDeClasse(texte) {
  const s = nettoyer(texte);
  const m = s.match(/\b((?:[1-9]|1[0-2])\s*(?:è?me|ième|e|nde|ère|re|de)\s*[A-Z](?:\d)?|T(?:le|erminale)\s*[A-Z](?:\d)?)\b/iu);
  if (!m) return '';
  return nettoyer(m[1]);
}
function dateISO(v) {
  const s = nettoyer(v);
  if (!s) return '';
  let an, mois, jour;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) [, an, mois, jour] = m;
  else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
    if (!m) return '';
    [, jour, mois, an] = m;
  }
  const d = new Date(Date.UTC(+an, +mois - 1, +jour));
  if (d.getUTCFullYear() !== +an || d.getUTCMonth() !== +mois - 1 || d.getUTCDate() !== +jour) return '';
  return `${an}-${mois.padStart(2, '0')}-${jour.padStart(2, '0')}`;
}
function sexeOptionnel(v) {
  const s = simplifier(v);
  if (s === 'F' || s === 'FEMININ' || s === 'FILLE') return 'F';
  if (s === 'M' || s === 'MASCULIN' || s === 'GARCON') return 'M';
  return '';
}
function nomEtPrenom(brut, prenomSepare = '') {
  const s = nettoyer(brut).replace(/^\d{1,3}[.)]?\s+/, '').replace(/\s*[,;]\s*/g, ' ');
  if (prenomSepare) return { nom: s.toUpperCase(), prenom: nettoyer(prenomSepare), incertain: false };
  const mots = s.split(/\s+/).filter(Boolean);
  if (!mots.length) return null;
  if (mots.length === 1) return { nom: mots[0].toUpperCase(), prenom: '', incertain: true };
  const debutPrenom = mots.findIndex((mot, i) => i > 0 && /\p{Ll}/u.test(mot));
  const coupe = debutPrenom === -1 ? 1 : debutPrenom;
  return { nom: mots.slice(0, coupe).join(' ').toUpperCase(),
    prenom: mots.slice(coupe).join(' '), incertain: debutPrenom === -1 || debutPrenom > 1 };
}
function ressembleAMatricule(v) {
  const s = nettoyer(v);
  return /^[A-Z0-9][A-Z0-9/_-]{3,23}$/i.test(s) && /\d/.test(s) && !dateISO(s);
}
function ignorer(s) {
  return /^(?:N[°ºO.]?\s|RANG\b|MATRICULE\b|NOM(?:\s|$)|PRENOM\b|LISTE\b|CLASSE\b|ETABLISSEMENT\b|ECOLE\b|COLLEGE\b|LYCEE\b|COMPLEXE SCOLAIRE\b|ANNEE\b|EXAMEN\b|RELEVE\b|RESULTATS\b|MOYENNE\b|TOTAL\b|PAGE\s+\d|SIGNATURE\b|CHEF\b|DIRECTION\b|MINISTERE\b|NOTES?\b|MEILLEURE\b|MATIERE\b|FAIT A\b|EDUCATION\b|SCIENCES\b|ENSEIGNANT\b)/i.test(simplifier(s));
}

/** Regroupe les fragments de texte d'une page selon leur position verticale. */
function lignesPositionnees(items) {
  const elements = items.filter(x => x.str && nettoyer(x.str)).map(x => ({
    texte: nettoyer(x.str), x: x.transform[4], y: x.transform[5], fin: x.transform[4] + (x.width || 0)
  })).filter(x => Number.isFinite(x.x) && Number.isFinite(x.y))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lignes = [];
  for (const el of elements) {
    const ligne = lignes.find(l => Math.abs(l.y - el.y) <= 2.5);
    if (ligne) ligne.items.push(el);
    else lignes.push({ y: el.y, items: [el] });
  }
  return lignes.sort((a, b) => b.y - a.y).map(l => {
    l.items.sort((a, b) => a.x - b.x);
    let texte = '';
    for (const [i, item] of l.items.entries()) {
      if (i) texte += item.x - l.items[i - 1].fin > 13 ? '\t' : ' ';
      texte += item.texte;
    }
    return { texte: texte.trim(), items: l.items, y: l.y };
  });
}
function typeColonne(t) {
  const s = simplifier(t);
  if (/^(?:N[°ºO.]?|RANG|NUMERO)$/.test(s)) return 'rang';
  if (/^MATRICULE\b/.test(s)) return 'matricule';
  if (/^NOM\b.*PRENOM/.test(s)) return 'complet';
  if (/^NOM\b/.test(s)) return 'nom';
  if (/^PRENOM/.test(s)) return 'prenom';
  if (/^(?:SEXE|GENRE)$/.test(s)) return 'sexe';
  if (/^(?:DATE\s+DE\s+NAISSANCE|NE[E]?\s+LE|NAISSANCE)$/.test(s)) return 'date_naissance';
  if (/^(?:CLASSE|DIVISION)$/.test(s)) return 'classe';
  return '';
}
function enTete(ligne) {
  if (!ligne.items.length) return null;
  const colonnes = ligne.items.map(i => ({ type: typeColonne(i.texte), x: i.x }))
    .filter(c => c.type);
  if (!colonnes.some(c => c.type === 'nom' || c.type === 'complet')) return null;
  if (colonnes.length < 2) return null;
  return colonnes.sort((a, b) => a.x - b.x);
}
function depuisColonnes(ligne, colonnes) {
  const valeurs = {};
  const colonnesUnique = colonnes.filter((c, i) => !colonnes.some((p, j) => j < i && p.type === c.type));
  for (const item of ligne.items) {
    let index = 0;
    for (let i = 0; i < colonnesUnique.length - 1; i++) {
      if (item.x >= (colonnesUnique[i].x + colonnesUnique[i + 1].x) / 2) index = i + 1;
    }
    const key = colonnesUnique[index].type;
    valeurs[key] = nettoyer(`${valeurs[key] || ''} ${item.texte}`);
  }
  if (!valeurs.nom && !valeurs.complet) return null;
  // Un numéro de ligne ou un matricule aide à distinguer un vrai élève d'un
  // titre placé dans la même colonne que le nom.
  if (colonnesUnique.some(c => c.type === 'rang') &&
      !/^(?:\d{1,3}|—|-)$/.test(valeurs.rang || '') && !ressembleAMatricule(valeurs.matricule)) return null;
  const personne = nomEtPrenom(valeurs.nom || valeurs.complet, valeurs.prenom);
  if (!personne) return null;
  return { ...personne, matricule: ressembleAMatricule(valeurs.matricule) ? valeurs.matricule : '',
    sexe: sexeOptionnel(valeurs.sexe), date_naissance: dateISO(valeurs.date_naissance),
    classe: nomDeClasse(valeurs.classe) };
}
function depuisTexte(ligne) {
  let s = nettoyer(ligne.texte).replace(/\t/g, ' ');
  if (!s || ignorer(s)) return null;
  s = s.replace(/^\d{1,3}[.):\-]?\s+/, '');
  let matricule = '';
  const premier = /^(\S+)\s+/.exec(s);
  if (premier && ressembleAMatricule(premier[1])) {
    matricule = premier[1]; s = s.slice(premier[0].length).trim();
  }
  // Sans en-tête exploitable, enlever les notes chiffrées qui terminent la
  // ligne du relevé d'examen (ne jamais les prendre pour une date de naissance).
  let naissance = '';
  const dates = s.match(/(?:^|\s)(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})(?:\s|$)/g);
  if (dates?.length) {
    naissance = dateISO(dates[0].trim());
    s = s.replace(dates[0], ' ');
  }
  let sexe = '';
  const sexeFin = /\s+(F|M|FÉMININ|FEMININ|MASCULIN)\s*$/i.exec(s);
  if (sexeFin) { sexe = sexeOptionnel(sexeFin[1]); s = s.slice(0, sexeFin.index); }
  s = s.replace(/(?:\s+\d{1,2}[,.]\d{1,2})+\s*$/, '');
  const classe = nomDeClasse(s);
  if (classe) s = s.replace(classe, ' ');
  const morceaux = s.split(/\s*[;,]\s*|\s{2,}/).filter(Boolean);
  const personne = morceaux.length >= 2
    ? nomEtPrenom(morceaux[0], morceaux[1]) : nomEtPrenom(s);
  if (!personne || !/\p{L}/u.test(personne.nom) || /\d/.test(personne.nom)) return null;
  return { ...personne, matricule, sexe, date_naissance: naissance, classe };
}

/** Reconnaît les lignes, sans aucun accès aux données de l'établissement. */
function lireLignes(lignes, page, classeInitiale = '') {
  let classeActive = classeInitiale, colonnes = null, dansListe = false;
  const eleves = [], avertissements = [];
  for (const ligne of lignes) {
    const texte = nettoyer(ligne.texte);
    if (!texte) continue;
    const header = enTete(ligne);
    if (header) { colonnes = header; dansListe = true; continue; }
    if (ignorer(texte)) {
      if (/\b(?:LISTE|CLASSE|DIVISION)\b/i.test(texte)) {
        classeActive = nomDeClasse(texte) || classeActive;
        if (/^LISTE\b.*\b(?:ELEVE|INSCRIT)/.test(simplifier(texte))) dansListe = true;
      }
      continue;
    }
    // Ne pas transformer les en-têtes de l'école, statistiques ou signatures
    // en faux élèves : hors d'un tableau, il faut un numéro/matricule explicite
    // ou un titre « Liste des élèves » déjà rencontré.
    if (!dansListe &&
        !/^(?:\d{1,3}[.):\-]?\s+)?(?:\d{4,12}|[A-Z]{1,4}[-/]?\d{3,10})\s+[\p{Lu}]{2,}[\p{L}'-]*\s+[\p{L}]/u.test(texte) &&
        !/^\d{1,3}[.):\-]?\s+[\p{Lu}]{2,}[\p{L}'-]*\s+[\p{L}]/u.test(texte)) continue;
    let r = colonnes && ligne.items.length ? depuisColonnes(ligne, colonnes) : depuisTexte(ligne);
    // Certains générateurs de PDF mettent toute une rangée dans un seul bloc
    // de texte : les colonnes géométriques deviennent inutilisables.
    if (!r && colonnes && /^(?:\d{1,3}[.):\-]?\s+|[A-Z]{1,4}[-/]?\d{3,10}\s+)/u.test(texte)) {
      r = depuisTexte(ligne);
    }
    if (!r) continue;
    if (r.nom.length > 110 || r.prenom.length > 110 || r.matricule.length > 40) {
      avertissements.push(`Page ${page} : ligne trop longue, à vérifier manuellement.`);
      continue;
    }
    r.classe = r.classe || classeActive;
    r.page = page;
    eleves.push(r);
    if (eleves.length > MAX_ELEVES) throw new Error('Plus de 300 élèves reconnus : importez une classe à la fois.');
  }
  return { eleves, avertissements, classeActive };
}

// Un PDF scanné peut contenir un en-tête textuel (voire un logo). Si aucune
// ligne n'est trouvée, n'essayer l'OCR que si une image occupe réellement une
// partie importante de la page : un petit logo ne doit pas OCRiser les pages
// de statistiques qui suivent une liste textuelle.
async function grandeImageSurPage(page, OPS) {
  const ops = await page.getOperatorList();
  const aire = Math.abs((page.view[2] - page.view[0]) * (page.view[3] - page.view[1]));
  let m = [1, 0, 0, 1, 0, 0];
  const pile = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const type = ops.fnArray[i];
    if (type === OPS.save) pile.push([...m]);
    else if (type === OPS.restore) m = pile.pop() || m;
    else if (type === OPS.transform) {
      const [a, b, c, d, e, f] = ops.argsArray[i];
      const [u, v, w, z, x, y] = m;
      m = [u * a + w * b, v * a + z * b, u * c + w * d, v * c + z * d,
        u * e + w * f + x, v * e + z * f + y];
    } else if (type === OPS.paintImageXObject || type === OPS.paintInlineImageXObject) {
      if (Math.abs(m[0] * m[3] - m[1] * m[2]) / aire >= 0.28) return true;
    }
  }
  return false;
}

async function analyserListePDF(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_OCTETS || buffer.length < 30 ||
      !buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
    throw new Error('Fichier PDF invalide ou trop volumineux (8 Mo maximum).');
  }
  let pdfjs, task, doc, worker, reservationOcr = false;
  const eleves = [], avertissements = [];
  let pagesOcr = 0, classeCourante = '';
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false,
      useSystemFonts: true, disableFontFace: false,
      standardFontDataUrl: path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path.sep });
    doc = await task.promise;
    if (doc.numPages > MAX_PAGES) throw new Error(`PDF de ${doc.numPages} pages : découpez-le en fichiers de 15 pages maximum.`);
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const contenu = await page.getTextContent();
      let lignes = lignesPositionnees(contenu.items);
      let resultat = lireLignes(lignes, n, classeCourante);
      let ocr = false;
      const caracteres = lignes.reduce((sum, l) => sum + l.texte.length, 0);
      if (!resultat.eleves.length && (caracteres < 35 || await grandeImageSurPage(page, pdfjs.OPS))) {
        if (++pagesOcr > MAX_PAGES_OCR) throw new Error('PDF scanné de plus de 6 pages : divisez-le en fichiers plus courts.');
        let createCanvas;
        try { ({ createCanvas } = require('@napi-rs/canvas')); }
        catch { throw new Error('OCR indisponible sur cet hébergement. Essayez un PDF textuel.'); }
        if (!worker) {
          if (ocrEnCours) throw new Error('Une reconnaissance de PDF scanné est déjà en cours. Réessayez dans un instant.');
          ocrEnCours = true;
          reservationOcr = true;
          try {
            const { createWorker } = require('tesseract.js');
            const { langPath } = require('@tesseract.js-data/fra');
            worker = await createWorker('fra', 1, { langPath, cacheMethod: 'none' });
          } catch { throw new Error('OCR indisponible sur cet hébergement. Essayez un PDF textuel.'); }
        }
        const viewport = page.getViewport({ scale: Math.min(1.8, 2000 / Math.max(page.view[2], page.view[3])) });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const lu = await worker.recognize(await canvas.encode('png'));
        lignes = lu.data.text.split(/\r?\n/).map(texte => ({ texte, items: [] }));
        resultat = lireLignes(lignes, n, classeCourante);
        ocr = true;
        avertissements.push(`Page ${n} : lecture d'une image par OCR (${Math.round(lu.data.confidence)} % de confiance). Vérifiez les noms.`);
      }
      classeCourante = resultat.classeActive;
      eleves.push(...resultat.eleves);
      avertissements.push(...resultat.avertissements);
      if (!resultat.eleves.length) avertissements.push(`Page ${n} : aucun élève identifié${ocr ? ' par OCR' : ''}.`);
      page.cleanup();
      if (eleves.length > MAX_ELEVES) throw new Error('Plus de 300 élèves reconnus : importez une classe à la fois.');
    }
    if (!eleves.length) throw new Error('Aucun nom trouvé. Vérifiez le PDF ou essayez une liste avec une ligne par élève.');
    return { pages: doc.numPages, ocr: pagesOcr > 0, eleves, avertissements };
  } catch (e) {
    if (e?.message?.startsWith('PDF') || e?.message?.startsWith('OCR indisponible') ||
        e?.message?.startsWith('Une reconnaissance') || e?.message?.startsWith('Plus de') ||
        e?.message?.startsWith('Aucun nom')) throw e;
    if (!pdfjs) throw new Error('Lecture des PDF indisponible sur cet hébergement : installez les dépendances.');
    throw new Error('Lecture impossible : PDF protégé, illisible ou endommagé.');
  } finally {
    try {
      if (worker) await worker.terminate();
    } finally {
      if (reservationOcr) ocrEnCours = false;
      if (doc) await doc.destroy();
      else if (task) await task.destroy();
    }
  }
}
module.exports = { analyserListePDF, lireLignes, lignesPositionnees, dateISO, nomEtPrenom,
  MAX_OCTETS, MAX_ELEVES };
