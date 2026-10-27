'use strict';
/** Vérification et inscription des élèves issus d'un aperçu PDF corrigé. */
const { dateISO, MAX_ELEVES } = require('./liste-pdf');

function erreur(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}
function identite(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ').trim();
}
function champ(v, max, label, obligatoire = false) {
  if (v != null && typeof v !== 'string') throw erreur(`${label} invalide.`);
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  if (s.length > max || (obligatoire && !s)) throw erreur(`${label} ${obligatoire ? 'manquant ou trop long' : 'trop long'}.`);
  return s;
}
function verifierListe(db, ecoleId, lignes) {
  if (!Array.isArray(lignes) || lignes.length < 1 || lignes.length > MAX_ELEVES)
    throw erreur('Sélectionnez entre 1 et 300 élèves pour cet import.');
  const classes = new Map(db.prepare('SELECT id, nom FROM classes WHERE ecole_id = ?').all(ecoleId)
    .map(c => [c.id, c.nom]));
  const existants = db.prepare('SELECT nom, prenom, matricule, classe_id, statut FROM eleves WHERE ecole_id = ?').all(ecoleId);
  const matricules = new Set(existants.map(e => identite(e.matricule)));
  const personnes = new Map(existants.map(e => [identite(`${e.nom} ${e.prenom}`),
    e.statut === 'inactif' ? 'élève archivé(e) : réactivez son dossier'
      : classes.get(e.classe_id) || 'une autre classe']));
  const annee = String(db.prepare('SELECT annee_scolaire FROM etablissements WHERE id = ?').get(ecoleId)?.annee_scolaire || new Date().getFullYear()).slice(0, 4);
  let numero = 0;
  for (const e of existants) {
    const mat = String(e.matricule || '');
    if (mat.startsWith(annee) && /^\d+$/.test(mat.slice(4))) {
      numero = Math.max(numero, Number(mat.slice(4)));
    }
  }
  const prets = [], statuts = [];
  for (const [i, l] of lignes.entries()) {
    const ligne = i + 1;
    try {
      if (!l || typeof l !== 'object' || Array.isArray(l)) throw erreur('Ligne invalide.');
      const nom = champ(l.nom, 110, 'Nom', true).toUpperCase();
      const prenom = champ(l.prenom, 110, 'Prénom(s)');
      if (!/[\p{L}]/u.test(nom) || /\d/.test(nom)) throw erreur('Nom invalide.');
      const classeId = Number(l.classe_id);
      if (!Number.isSafeInteger(classeId) || !classes.has(classeId)) throw erreur('Choisissez une classe existante pour cet élève.');
      const sexe = champ(l.sexe, 8, 'Sexe').toUpperCase();
      if (sexe && sexe !== 'M' && sexe !== 'F') throw erreur('Sexe : laissez vide ou indiquez M/F.');
      const naissanceSaisie = champ(l.date_naissance, 10, 'Date de naissance');
      const naissance = dateISO(naissanceSaisie);
      if (naissanceSaisie && !naissance) throw erreur('Date de naissance invalide (AAAA-MM-JJ).');
      let matricule = champ(l.matricule, 24, 'Matricule');
      if (matricule && !/^[\p{L}\p{N}_/.-]+$/u.test(matricule)) throw erreur('Matricule invalide.');
      const cle = identite(`${nom} ${prenom}`);
      if (matricule && matricules.has(identite(matricule))) {
        statuts.push({ ligne, etat: 'doublon', message: `Matricule ${matricule} déjà utilisé.` });
        continue;
      }
      if (personnes.has(cle)) {
        statuts.push({ ligne, etat: 'doublon', message: `${nom} ${prenom} est déjà inscrit(e) (${personnes.get(cle)}).` });
        continue;
      }
      if (!matricule) {
        do { numero++; matricule = `${annee}${String(numero).padStart(4, '0')}`; }
        while (matricules.has(identite(matricule)));
      }
      personnes.set(cle, classes.get(classeId));
      matricules.add(identite(matricule));
      prets.push({ nom, prenom, sexe, date_naissance: naissance, matricule, classe_id: classeId });
      statuts.push({ ligne, etat: 'pret', message: '' });
    } catch (e) {
      statuts.push({ ligne, etat: 'erreur', message: e.message });
    }
  }
  return { statuts, prets };
}
function importerListe(db, ecoleId, lignes, maintenant, apresInsertion = () => {}) {
  const { statuts, prets } = verifierListe(db, ecoleId, lignes);
  const eleves = [];
  if (prets.length) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const stmt = db.prepare(`INSERT INTO eleves (ecole_id, matricule, nom, prenom, sexe, date_naissance,
        lieu_naissance, classe_id, tuteur_nom, tuteur_tel, statut, cree_le)
        VALUES (?, ?, ?, ?, ?, ?, '', ?, '', '', 'actif', ?)`);
      const creeLe = maintenant();
      for (const p of prets) {
        const info = stmt.run(ecoleId, p.matricule, p.nom, p.prenom, p.sexe,
          p.date_naissance, p.classe_id, creeLe);
        apresInsertion(Number(info.lastInsertRowid), p.classe_id);
        eleves.push({ id: Number(info.lastInsertRowid), matricule: p.matricule,
          nom: p.nom, prenom: p.prenom, classe_id: p.classe_id });
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw erreur('Import annulé : un matricule est déjà utilisé ou la base est momentanément indisponible.', 409);
    }
  }
  return { ok: true, crees: eleves.length, ignores: statuts.filter(s => s.etat !== 'pret'), eleves };
}
module.exports = { verifierListe, importerListe, identite };
