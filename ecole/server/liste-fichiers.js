'use strict';
/**
 * Lecture locale des listes PDF, Word .docx, Excel .xlsx et CSV.
 * Aucun fichier n'est enregistré ; toutes les lignes passent par l'aperçu et
 * la validation serveur déjà utilisés pour les PDF avant insertion.
 */
const path = require('node:path');
const { ouvrirZip } = require('./zip-limite');
const { analyserListePDF, lireLignes, dateISO, nomEtPrenom, MAX_OCTETS, MAX_ELEVES } = require('./liste-pdf');

const nettoyer = s => String(s ?? '').replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
const simplifier = s => nettoyer(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
function decoder(s) {
  return String(s ?? '').replace(/&#(?:x([0-9a-f]+)|(\d+));|&(amp|lt|gt|quot|apos);/gi,
    (original, hexa, decimal, nom) => {
      if (nom) return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[nom.toLowerCase()];
      const cp = parseInt(hexa || decimal, hexa ? 16 : 10);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)
        ? String.fromCodePoint(cp) : original;
    });
}
function attributs(chaine, nom) {
  const m = new RegExp(`(?:^|\\s)${nom.replace(':', '\\:')}="([^"]*)"`).exec(chaine);
  return m ? decoder(m[1]) : '';
}
function blocs(xml, nom) {
  return [...String(xml || '').matchAll(new RegExp(`<${nom}\\b[^>]*>([\\s\\S]*?)<\\/${nom}>`, 'g'))].map(m => m[1]);
}
function extraitsTextes(xml, balise = 't') {
  return blocs(xml, balise).map(decoder).join('');
}
function nomClasse(texte) {
  const s = nettoyer(texte);
  const m = s.match(/\b((?:[1-9]|1[0-2])\s*(?:è?me|ième|e|nde|ère|re|de)\s*[A-Z](?:\d)?|T(?:le|erminale)\s*[A-Z](?:\d)?)\b/iu);
  return m ? nettoyer(m[1]) : '';
}
function sexeOptionnel(v) {
  const s = simplifier(v);
  return ['F', 'FILLE', 'FEMININ'].includes(s) ? 'F' : ['M', 'GARCON', 'MASCULIN'].includes(s) ? 'M' : '';
}
function ancienneteFichier(v) {
  const s = simplifier(v);
  // Une liste de classe peut contenir des élèves déjà présents depuis des années.
  // Ne jamais déduire « nouveau » de l'absence de cette colonne ou d'une case vide.
  if (!s) return { valeur: '' };
  if (s === 'A PRECISER' || s === 'INCONNU' || s === 'NON RENSEIGNE') return { valeur: '' };
  if (/^NOUVE(?:AU|LLE)(?:\b|$)/.test(s)) return { valeur: 'nouveau' };
  if (/^ANCIEN(?:NE)?(?:\b|$)/.test(s)) return { valeur: 'ancien' };
  return { valeur: '', incertain: true };
}
function statutScolaireFichier(v) {
  const s = simplifier(v);
  if (!s || ['A PRECISER', 'INCONNU', 'NON RENSEIGNE'].includes(s)) return { valeur: '' };
  if (/^NOUVE(?:AU|LLE)(?:\b|$)/.test(s)) return { valeur: 'nouveau' };
  for (const code of ['doublant', 'triplant', 'quatriplant']) {
    if (new RegExp(`^${code.toUpperCase()}E?(?:\\b|$)`).test(s)) return { valeur: code };
  }
  return { valeur: '', incertain: true };
}
function typeColonne(texte) {
  const s = simplifier(texte).replace(/[^A-Z0-9]+/g, ' ').trim();
  if (/^(?:N|NO|NUMERO|RANG|ORDRE)$/.test(s)) return 'numero';
  if (/^(?:MATRICULE|IDENTIFIANT|ID ELEVE)$/.test(s)) return 'matricule';
  if (/^NOM(?:S)? (?:ET )?PRENOM/.test(s) || /^NOM COMPLET/.test(s)) return 'complet';
  if (/^NOM(?:S)?$/.test(s) || /^NOM DE FAMILLE/.test(s)) return 'nom';
  if (/^PRENOM/.test(s)) return 'prenom';
  if (/^(?:SEXE|GENRE)$/.test(s)) return 'sexe';
  if (/^(?:DATE DE NAISSANCE|DATE NAISSANCE|NAISSANCE|NE LE|NEE LE|DATE DE NAIS)$/.test(s)) return 'date_naissance';
  if (/^(?:CLASSE|DIVISION|NIVEAU)$/.test(s)) return 'classe';
  if (/^(?:STATUT SCOLAIRE|SITUATION SCOLAIRE|SITUATION DANS LE NIVEAU|REDOUBLEMENT)$/.test(s)) return 'statut_scolaire';
  if (/^(?:ANCIENNETE|ANCIENNETE ETABLISSEMENT|ARRIVEE DANS L ETABLISSEMENT|NOUVEAU ANCIEN|ORIGINE ETABLISSEMENT|STATUT D ENTREE)$/.test(s)) return 'anciennete';
  return '';
}
function enTete(ligne) {
  const types = ligne.map(typeColonne);
  return (types.includes('nom') || types.includes('complet')) && types.filter(Boolean).length >= 2 ? types : null;
}
function colonnesSansEntete(ligne) {
  let depart = 0;
  if (/^\d{1,3}[.)]?$/.test(ligne[0] || '')) depart++;
  const types = Array(ligne.length).fill('');
  const val = ligne[depart] || '';
  if (/^(?=.*\d)[A-Z0-9/_-]{4,24}$/i.test(val) && ligne.length > depart + 1) {
    types[depart++] = 'matricule';
  }
  types[depart] = ligne.length - depart === 1 ? 'complet' : 'nom';
  if (nomClasse(ligne[depart + 1])) types[depart + 1] = 'classe';
  else {
    types[depart + 1] = 'prenom';
    types[depart + 2] = 'sexe';
    types[depart + 3] = 'date_naissance';
    types[depart + 4] = 'classe';
  }
  return types;
}
function estTitre(s) {
  return /^(?:LISTE|CLASSE|ETABLISSEMENT|ECOLE|COLLEGE|LYCEE|COMPLEXE|TOTAL|MOYENNE|PAGE|DIRECTION|SIGNATURE|EFFECTIF|ANNEE|NOM|PRENOM|MATRICULE|SEXE|DATE)\b/.test(simplifier(s));
}
function dateExcel(v, depuis1904 = false) {
  const n = Number(v);
  if (!Number.isFinite(n) || (n < 61 && !depuis1904) || n < 0 || n > 100000) return '';
  const base = depuis1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(base + Math.floor(n) * 86400000).toISOString().slice(0, 10);
}
function analyserTableau(lignes, { classe = '', page = 1, depuis1904 = false } = {}) {
  const eleves = [], avertissements = [];
  let colonnes = null, classeActive = nomClasse(classe);
  for (const brut of lignes) {
    if (!Array.isArray(brut)) continue;
    const cellules = brut.map(nettoyer);
    const contenu = cellules.filter(Boolean);
    if (!contenu.length) continue;
    if (contenu.length <= 2 && /\b(?:LISTE|CLASSE|DIVISION)\b/i.test(contenu.join(' '))) {
      classeActive = nomClasse(contenu.join(' ')) || classeActive;
      continue;
    }
    const entete = enTete(cellules);
    if (entete) { colonnes = entete; continue; } // en-têtes répétés sur plusieurs pages/onglets
    if (!colonnes) {
      // Tableaux sans en-tête : aperçu marqué incertain, jamais enregistrés directement.
      colonnes = colonnesSansEntete(cellules);
      avertissements.push(`Section ${page} : colonnes sans en-tête ; vérifiez nom et prénom avant de confirmer.`);
    }
    const val = {};
    colonnes.forEach((type, i) => { if (type) val[type] = cellules[i] || ''; });
    const brutNom = val.nom || val.complet || '';
    if (!brutNom || estTitre(brutNom) || /^\d+$/.test(brutNom)) continue;
    if (val.numero && !/^\d{1,4}[.)]?$/.test(val.numero)) continue;
    const personne = nomEtPrenom(brutNom, val.prenom);
    if (!personne || !/[\p{L}]/u.test(personne.nom) || /\d/.test(personne.nom)) continue;
    let naissance = dateISO(val.date_naissance);
    if (!naissance && /^\d{4,5}(?:\.\d+)?$/.test(val.date_naissance || ''))
      naissance = dateExcel(val.date_naissance, depuis1904);
    const anciennete = ancienneteFichier(val.anciennete);
    const statutScolaire = statutScolaireFichier(val.statut_scolaire);
    const incertain = personne.incertain || anciennete.incertain || statutScolaire.incertain ||
      Boolean(val.date_naissance && !naissance);
    if (val.anciennete && anciennete.incertain)
      avertissements.push(`Section ${page} : ancienneté « ${val.anciennete.slice(0, 32)} » à préciser dans l’aperçu.`);
    if (val.statut_scolaire && statutScolaire.incertain)
      avertissements.push(`Section ${page} : statut scolaire « ${val.statut_scolaire.slice(0, 32)} » à corriger dans l’aperçu.`);
    if (val.date_naissance && !naissance)
      avertissements.push(`Section ${page} : date « ${val.date_naissance.slice(0, 32)} » à corriger dans l’aperçu.`);
    eleves.push({ ...personne, nom: personne.nom.toUpperCase(),
      prenom: personne.prenom, matricule: val.matricule || '', sexe: sexeOptionnel(val.sexe),
      date_naissance: naissance, classe: nomClasse(val.classe) || classeActive,
      anciennete_etablissement: anciennete.valeur, statut_scolaire: statutScolaire.valeur,
      incertain: Boolean(incertain), page });
    if (eleves.length > MAX_ELEVES) throw new Error('Plus de 300 élèves reconnus : importez une classe à la fois.');
  }
  return { eleves, avertissements };
}
function texteWord(xml) {
  // Joindre les fragments d'un même mot réparti en plusieurs « runs » Word.
  const morceaux = [];
  for (const m of String(xml || '').matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:(?:tab|br)\b[^>]*\/>/g))
    morceaux.push(m[1] === undefined ? ' ' : decoder(m[1]));
  return nettoyer(morceaux.join(''));
}
function analyserWord(zip) {
  const xml = zip.lire('word/document.xml');
  if (!xml || !/<w:document\b/.test(xml)) throw new Error('Document Word .docx invalide ou protégé.');
  const paragraphes = [], eleves = [], avertissements = [];
  let classe = '', tables = 0;
  // Respecter l'ordre des titres et des tableaux : un document peut contenir
  // une liste de 6ème, puis une autre de 5ème dans un deuxième tableau.
  for (const bloc of xml.match(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || []) {
    if (bloc.startsWith('<w:p')) {
      const texte = texteWord(bloc);
      if (texte) paragraphes.push(texte);
      if (/\b(?:LISTE|CLASSE|DIVISION)\b/i.test(texte)) classe = nomClasse(texte) || classe;
    } else {
      tables++;
      if (tables > 15) throw new Error('Word de plus de 15 tableaux : découpez les listes par classe.');
      const rangees = blocs(bloc, 'w:tr').map(tr => blocs(tr, 'w:tc').map(texteWord));
      const r = analyserTableau(rangees, { classe, page: tables });
      eleves.push(...r.eleves); avertissements.push(...r.avertissements);
      if (eleves.length > MAX_ELEVES) throw new Error('Plus de 300 élèves reconnus : importez une classe à la fois.');
    }
  }
  if (!eleves.length) {
    const r = lireLignes(paragraphes.map(texte => ({ texte, items: [] })), 1);
    eleves.push(...r.eleves.map(e => ({ ...e, anciennete_etablissement: '', statut_scolaire: '' })));
    avertissements.push(...r.avertissements);
  }
  if (!eleves.length) throw new Error('Aucun élève trouvé dans le Word. Utilisez un tableau avec Nom et Prénom, ou une liste numérotée.');
  return { pages: Math.max(1, tables), ocr: false, format: 'Word', eleves, avertissements };
}
function stylesExcel(xml) {
  const section = blocs(xml, 'cellXfs')[0] || '';
  const dates = new Set();
  const formats = new Map();
  for (const m of String(xml || '').matchAll(/<numFmt\b([^>]*?)\/?\s*>/g)) {
    formats.set(Number(attributs(m[1], 'numFmtId')), attributs(m[1], 'formatCode'));
  }
  let index = 0;
  for (const m of section.matchAll(/<xf\b([^>]*?)\/?\s*>/g)) {
    const code = Number(attributs(m[1], 'numFmtId'));
    const format = (formats.get(code) || '').replace(/"[^"]*"|\\./g, '').toLowerCase();
    if ((code >= 14 && code <= 22) || (code >= 164 && /[dy]/.test(format))) dates.add(index);
    index++;
  }
  return dates;
}
function colExcel(ref) {
  const lettres = /^([A-Z]{1,3})\d+$/i.exec(ref)?.[1]?.toUpperCase();
  if (!lettres) return -1;
  let n = 0;
  for (const c of lettres) n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}
function lignesExcel(xml, partages, dates, depuis1904) {
  const lignes = [];
  for (const m of String(xml).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    if (lignes.length > 2000) throw new Error('Excel de plus de 2 000 lignes : découpez les listes par classe.');
    const colonnes = [];
    for (const c of m[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const index = colExcel(attributs(c[1], 'r'));
      if (index < 0 || index >= 80) continue;
      const t = attributs(c[1], 't');
      const brut = blocs(c[2], 'v')[0] || '';
      let valeur = t === 's' ? partages[Number(brut)] || ''
        : t === 'inlineStr' ? extraitsTextes(c[2], 't')
          : t === 'd' ? decoder(brut).slice(0, 10) : decoder(brut);
      if (!t && dates.has(Number(attributs(c[1], 's'))) && /^\d+(?:\.\d+)?$/.test(valeur))
        valeur = dateExcel(valeur, depuis1904) || valeur;
      colonnes[index] = valeur;
    }
    if (colonnes.some(v => nettoyer(v))) lignes.push(colonnes);
  }
  return lignes;
}
function feuillesExcel(zip, workbook) {
  const liens = new Map();
  const rels = zip.lire('xl/_rels/workbook.xml.rels') || '';
  for (const m of rels.matchAll(/<Relationship\b([^>]+)\/>/g)) {
    const cible = attributs(m[1], 'Target');
    const nom = path.posix.normalize(cible.startsWith('/') ? cible.slice(1) : path.posix.join('xl', cible));
    if (nom.startsWith('xl/worksheets/') && zip.noms().includes(nom)) liens.set(attributs(m[1], 'Id'), nom);
  }
  const feuilles = [];
  for (const m of workbook.matchAll(/<sheet\b([^>]*?)\/>/g)) {
    const fichier = liens.get(attributs(m[1], 'r:id'));
    if (fichier) feuilles.push({ fichier, nom: attributs(m[1], 'name') });
  }
  if (!feuilles.length) {
    for (const nom of zip.noms().filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort())
      feuilles.push({ fichier: nom, nom });
  }
  if (!feuilles.length || feuilles.length > 15) throw new Error('Excel illisible ou de plus de 15 onglets : découpez les listes par classe.');
  return feuilles;
}
function analyserExcel(zip) {
  const workbook = zip.lire('xl/workbook.xml');
  if (!workbook || !/<workbook\b/.test(workbook)) throw new Error('Fichier Excel .xlsx invalide ou protégé.');
  const partages = blocs(zip.lire('xl/sharedStrings.xml'), 'si').map(si => extraitsTextes(si, 't'));
  if (partages.length > 25000) throw new Error('Excel trop volumineux : découpez les listes par classe.');
  const dates = stylesExcel(zip.lire('xl/styles.xml'));
  const depuis1904 = /<workbookPr\b[^>]*date1904="(?:1|true)"/.test(workbook);
  const eleves = [], avertissements = [];
  const feuilles = feuillesExcel(zip, workbook);
  for (const [i, feuille] of feuilles.entries()) {
    const xml = zip.lire(feuille.fichier);
    if (!xml) continue;
    const r = analyserTableau(lignesExcel(xml, partages, dates, depuis1904),
      { classe: feuille.nom, page: i + 1, depuis1904 });
    eleves.push(...r.eleves); avertissements.push(...r.avertissements);
    if (eleves.length > MAX_ELEVES) throw new Error('Plus de 300 élèves reconnus : importez une classe à la fois.');
  }
  if (!eleves.length) throw new Error('Aucun élève trouvé dans l’Excel. Ajoutez les colonnes Nom et Prénom.');
  return { pages: feuilles.length, ocr: false, format: 'Excel', eleves, avertissements };
}
function lireCsv(texte, separateur) {
  const lignes = [], cellules = [];
  let valeur = '', dansGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === '"') {
      if (dansGuillemets && texte[i + 1] === '"') { valeur += '"'; i++; }
      else if (!valeur || dansGuillemets) dansGuillemets = !dansGuillemets;
      else valeur += c;
    } else if (c === separateur && !dansGuillemets) {
      cellules.push(valeur); valeur = '';
    } else if ((c === '\n' || c === '\r') && !dansGuillemets) {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      cellules.push(valeur); valeur = '';
      if (cellules.some(v => v.trim())) lignes.push(cellules.splice(0));
      else cellules.length = 0;
      if (lignes.length > 2000) throw new Error('CSV de plus de 2 000 lignes : découpez les listes par classe.');
    } else valeur += c;
  }
  if (dansGuillemets) throw new Error('CSV invalide : guillemets non fermés.');
  cellules.push(valeur);
  if (cellules.some(v => v.trim())) lignes.push(cellules);
  return lignes;
}
function analyserCsv(buffer) {
  if (buffer.includes(0)) throw new Error('CSV invalide : fichier binaire.');
  let texte, encodage = '';
  try { texte = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { texte = new TextDecoder('windows-1252').decode(buffer); encodage = 'CSV en Windows-1252 : vérifiez les accents.'; }
  texte = texte.replace(/^\ufeff/, '');
  const annonce = /^sep=([;\t,])\r?\n/i.exec(texte); // directive optionnelle d'Excel
  const propre = annonce ? texte.slice(annonce[0].length) : texte;
  const comptes = new Map([[';', 0], ['\t', 0], [',', 0]]);
  let entreGuillemets = false, lignesObservees = 0;
  // Les délimiteurs à l'intérieur de "Prénom, deuxième prénom" ne comptent pas.
  for (let i = 0; i < propre.length && lignesObservees < 4; i++) {
    const c = propre[i];
    if (c === '"') {
      if (entreGuillemets && propre[i + 1] === '"') i++;
      else entreGuillemets = !entreGuillemets;
    } else if (!entreGuillemets) {
      if (comptes.has(c)) comptes.set(c, comptes.get(c) + 1);
      if (c === '\n' || (c === '\r' && propre[i + 1] !== '\n')) lignesObservees++;
    }
  }
  const sep = annonce?.[1] || [...comptes].sort((a, b) => b[1] - a[1])[0][0];
  const rangees = lireCsv(propre, sep);
  if (rangees.length < 2 && (rangees[0]?.length || 0) < 2)
    throw new Error('CSV illisible : indiquez au moins Nom et Prénom, ou plusieurs élèves.');
  const r = analyserTableau(rangees);
  if (!r.eleves.length) throw new Error('Aucun élève trouvé dans le CSV. Ajoutez les colonnes Nom et Prénom.');
  return { pages: 1, ocr: false, format: 'CSV', eleves: r.eleves,
    avertissements: encodage ? [encodage, ...r.avertissements] : r.avertissements };
}
async function analyserListeFichier(buffer, nom) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer.length > MAX_OCTETS)
    throw new Error('Fichier invalide ou trop volumineux (8 Mo maximum).');
  const extension = path.extname(String(nom || '').slice(0, 180)).toLowerCase();
  if (extension === '.doc' || extension === '.xls')
    throw new Error('Ancien format non pris en charge : dans Word/Excel, enregistrez ce fichier en .docx ou .xlsx.');
  if (!['.pdf', '.docx', '.xlsx', '.csv'].includes(extension))
    throw new Error('Choisissez un fichier PDF, Word .docx, Excel .xlsx ou CSV.');
  if (extension === '.pdf') {
    const resultat = await analyserListePDF(buffer);
    return { ...resultat, format: 'PDF', eleves: resultat.eleves.map(e =>
      ({ ...e, anciennete_etablissement: '', statut_scolaire: '' })) };
  }
  if (extension === '.csv') return analyserCsv(buffer);
  const zip = ouvrirZip(buffer);
  return extension === '.docx' ? analyserWord(zip) : analyserExcel(zip);
}

module.exports = { analyserListeFichier, analyserTableau, dateExcel, lireCsv };
