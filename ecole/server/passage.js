'use strict';
/**
 * Décision de fin d'année et passage en classe supérieure.
 * La moyenne annuelle = moyenne simple des 3 trimestres (collège) ou des
 * 2 semestres (lycée). Une période sans moyenne => aucun passage automatique.
 * Les notes et bulletins de l'année terminée ne sont jamais modifiés.
 */
const crypto = require('node:crypto');
const { computeClasse } = require('./stats');

const SUIVANT = { '6': '5', '5': '4', '4': '3', '2': '1' };
function erreur(message, status = 400) {
  const e = new Error(message); e.status = status; return e;
}
function anneeSuivante(annee) {
  const m = /^(\d{4})-(\d{4})$/.exec(String(annee || ''));
  if (!m || Number(m[2]) !== Number(m[1]) + 1 || Number(m[1]) < 2000 || Number(m[2]) > 2100)
    throw erreur('Année scolaire invalide : utilisez le format 2026-2027 dans Paramètres.');
  return `${m[2]}-${Number(m[2]) + 1}`;
}
function niveauDe(classe) {
  for (const texte of [classe.niveau, classe.nom]) {
    const v = String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/\s+/g, '');
    for (const n of ['6', '5', '4', '3', '2', '1']) {
      if (new RegExp(`^${n}(?:EME|ERE|NDE|ER|RE|DE|E)?(?:[A-Z0-9-]|$)`).test(v)) return n;
    }
  }
  return '';
}
function classesPassage(db, ecoleId) {
  const classes = db.prepare('SELECT * FROM classes WHERE ecole_id = ? ORDER BY cycle, niveau, nom').all(ecoleId);
  return classes.filter(c => SUIVANT[niveauDe(c)] &&
    (niveauDe(c) !== '2' || c.cycle === 'lycee') &&
    (niveauDe(c) === '2' || c.cycle === 'college'))
    .map(c => ({ ...c, cibles: classes.filter(dest => dest.cycle === c.cycle &&
      niveauDe(dest) === SUIVANT[niveauDe(c)]).map(dest => ({ id: dest.id, nom: dest.nom })) }));
}
function anneeCourante(db, ecoleId) {
  const ecole = db.prepare('SELECT id, annee_scolaire FROM etablissements WHERE id = ?').get(ecoleId);
  if (!ecole) throw erreur('Établissement introuvable', 404);
  anneeSuivante(ecole.annee_scolaire);
  return ecole.annee_scolaire;
}
function periodesAnnee(db, ecoleId, annee, cycle) {
  const periodes = db.prepare(`SELECT * FROM periodes
    WHERE ecole_id = ? AND annee_scolaire = ? AND cycle = ? ORDER BY ordre`).all(ecoleId, annee, cycle);
  const attendues = cycle === 'college' ? 3 : 2;
  if (periodes.length !== attendues || periodes.some((p, i) => Number(p.ordre) !== i + 1)) {
    throw erreur(`Pour calculer la moyenne annuelle, il faut ${attendues} ${cycle === 'college' ? 'trimestres' : 'semestres'} pour ${annee}.`);
  }
  return periodes;
}
function dejaArchives(db, ecoleId, annee) {
  return !!db.prepare(`SELECT 1 FROM inscriptions_historiques
    WHERE ecole_id = ? AND annee_scolaire = ? LIMIT 1`).get(ecoleId, annee);
}
function photographierClasse(db, ecoleId, annee, classeId = null) {
  db.prepare(`INSERT OR IGNORE INTO classes_historiques(ecole_id, annee_scolaire, classe_id,
    nom, niveau, cycle, serie, titulaire, titulaire_id, formule_moyenne)
    SELECT c.ecole_id, ?, c.id, c.nom, c.niveau, c.cycle, c.serie,
      c.titulaire, c.titulaire_id, COALESCE(e.formule_moyenne, 'co2')
    FROM classes c JOIN etablissements e ON e.id = c.ecole_id
    WHERE c.ecole_id = ? AND (? IS NULL OR c.id = ?)`).run(annee, ecoleId, classeId, classeId);
  db.prepare(`INSERT OR IGNORE INTO matieres_historiques(ecole_id, annee_scolaire, classe_id,
    matiere_id, nom, nom_college, code, groupe, coefficient)
    SELECT c.ecole_id, ?, c.id, m.id, m.nom, m.nom_college, m.code, m.groupe, cm.coefficient
    FROM classes c JOIN classe_matieres cm ON cm.classe_id = c.id
    JOIN matieres m ON m.id = cm.matiere_id
    WHERE c.ecole_id = ? AND (? IS NULL OR c.id = ?)`).run(annee, ecoleId, classeId, classeId);
}
function photographierEffectifs(db, ecoleId, annee) {
  if (dejaArchives(db, ecoleId, annee)) return;
  db.prepare(`INSERT INTO inscriptions_historiques(ecole_id, annee_scolaire, eleve_id, classe_id)
    SELECT el.ecole_id, ?, el.id, el.classe_id FROM eleves el
    WHERE el.ecole_id = ? AND el.classe_id IS NOT NULL AND (
      el.statut = 'actif' OR EXISTS (
        SELECT 1 FROM notes n JOIN evaluations ev ON ev.id = n.evaluation_id
        LEFT JOIN periodes p ON p.id = ev.periode_id
        LEFT JOIN epreuves ep ON ep.id = ev.epreuve_id
        LEFT JOIN examens ex ON ex.id = ep.examen_id
        WHERE n.eleve_id = el.id AND ev.ecole_id = el.ecole_id
          AND (p.annee_scolaire = ? OR ex.annee_scolaire = ?)))`)
    .run(annee, ecoleId, annee, annee);
  photographierClasse(db, ecoleId, annee);
}
/** Un nouvel inscrit après la première décision ne doit pas disparaître des
 * aperçus des autres classes. S'il n'y a pas encore de photo, aucun effet. */
function memoriserInscription(db, ecoleId, eleveId, classeId) {
  if (!classeId || !db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'inscriptions_historiques' AND type = 'table'").get()) return;
  const annee = anneeCourante(db, ecoleId);
  if (dejaArchives(db, ecoleId, annee)) {
    if (!db.prepare(`SELECT 1 FROM classes_historiques WHERE ecole_id = ?
      AND annee_scolaire = ? AND classe_id = ?`).get(ecoleId, annee, classeId)) {
      photographierClasse(db, ecoleId, annee, classeId);
    }
    db.prepare(`INSERT OR IGNORE INTO inscriptions_historiques(ecole_id, annee_scolaire, eleve_id, classe_id)
      VALUES (?,?,?,?)`).run(ecoleId, annee, eleveId, classeId);
  }
}
function effectifOrigine(db, ecoleId, annee, classeId) {
  if (dejaArchives(db, ecoleId, annee)) {
    return db.prepare(`SELECT COUNT(*) AS n FROM inscriptions_historiques h
      JOIN eleves e ON e.id = h.eleve_id AND e.statut = 'actif'
      WHERE h.ecole_id = ? AND h.annee_scolaire = ? AND h.classe_id = ?`)
      .get(ecoleId, annee, classeId).n;
  }
  return db.prepare("SELECT COUNT(*) AS n FROM eleves WHERE ecole_id = ? AND classe_id = ? AND statut = 'actif'")
    .get(ecoleId, classeId).n;
}
function optionsPassage(db, ecoleId) {
  const annee = anneeCourante(db, ecoleId);
  const sources = classesPassage(db, ecoleId).map(c => {
    const validation = db.prepare(`SELECT COUNT(*) AS n, MAX(d.seuil) AS seuil, MAX(d.valide_le) AS valide_le,
      SUM(CASE WHEN d.decision = 'admis' THEN 1 ELSE 0 END) AS admis
      FROM decisions_finales d JOIN eleves el ON el.id = d.eleve_id AND el.statut = 'actif'
      WHERE d.ecole_id = ? AND d.annee_scolaire = ? AND d.classe_origine_id = ?`)
      .get(ecoleId, annee, c.id);
    return { id: c.id, nom: c.nom, cycle: c.cycle, niveau: c.niveau, cibles: c.cibles,
      effectif: effectifOrigine(db, ecoleId, annee, c.id),
      valides: validation.n, admis: validation.admis || 0,
      seuil_valide: validation.seuil, valide_le: validation.valide_le };
  });
  return { annee_scolaire: annee, prochaine_annee: anneeSuivante(annee), sources,
    annees_archivees: db.prepare(`SELECT DISTINCT annee_scolaire FROM decisions_finales
      WHERE ecole_id = ? ORDER BY annee_scolaire DESC`).all(ecoleId).map(r => r.annee_scolaire),
    periodes_ouvertes: db.prepare(`SELECT libelle FROM periodes WHERE ecole_id = ?
      AND annee_scolaire = ? AND statut <> 'fermee'`).all(ecoleId, annee).map(p => p.libelle) };
}
function seuilValide(valeur) {
  if (valeur === undefined || valeur === null || String(valeur).trim() === '')
    throw erreur('Saisissez la moyenne minimale de passage (sur 20).');
  const n = Number(String(valeur).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 20 || Math.round(n * 100) / 100 !== n)
    throw erreur('Choisissez un seuil de passage entre 0 et 20, avec deux décimales au maximum.');
  return n;
}
function preparerPassage(db, ecoleId, { classe_id, cible_id, seuil, affectations = {} }) {
  const annee = anneeCourante(db, ecoleId);
  if (!affectations || typeof affectations !== 'object' || Array.isArray(affectations) ||
      Object.keys(affectations).length > 500) throw erreur('Choix des divisions invalide.');
  const classeId = Number(classe_id), cibleId = Number(cible_id);
  const source = classesPassage(db, ecoleId).find(c => c.id === classeId);
  if (!source) throw erreur('Seules les classes de 6ème, 5ème, 4ème et 2nde peuvent passer automatiquement.');
  const cible = source.cibles.find(c => c.id === cibleId);
  if (!cible) throw erreur('Choisissez une classe supérieure du même établissement (5ème, 4ème, 3ème ou 1ère).');
  const seuilNombre = seuilValide(seuil);
  const valide = db.prepare(`SELECT 1 FROM decisions_finales
    WHERE ecole_id = ? AND annee_scolaire = ? AND classe_origine_id = ? LIMIT 1`)
    .get(ecoleId, annee, classeId);
  if (valide) throw erreur('La décision finale de cette classe est déjà validée. Annulez-la avant de recommencer.', 409);
  const periodes = periodesAnnee(db, ecoleId, annee, source.cycle);
  const moyennes = periodes.map(p => {
    const d = computeClasse(db, ecoleId, { classe_id: classeId, periode_id: p.id });
    return new Map(d.resultats.map(r => [r.eleve.id, r]));
  });
  // Toutes les périodes doivent porter sur les MÊMES élèves, même si une autre
  // classe a déjà été promue. computeClasse utilise l'effectif photographié.
  const premier = moyennes[0];
  // Les anciens bulletins conservent aussi les élèves archivés ; seules les
  // inscriptions encore actives sont concernées par une nouvelle décision.
  const lignes = [...premier.values()].filter(r => r.eleve.statut === 'actif').map(r => {
    const notes = moyennes.map(m => m.get(r.eleve.id)?.moyenne ?? null);
    const complete = notes.every(v => v !== null);
    const moyenne = complete ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length * 100) / 100 : null;
    const decision = !complete ? 'incomplet' : moyenne >= seuilNombre ? 'admis' : 'maintenu';
    const choix = affectations[String(r.eleve.id)];
    if (choix !== undefined && decision !== 'admis') throw erreur('Seuls les élèves admis peuvent changer de destination.');
    const destination = decision === 'admis'
      ? source.cibles.find(c => c.id === (choix === undefined ? cibleId : Number(choix))) : null;
    if (decision === 'admis' && !destination) throw erreur('La division choisie pour un élève ne fait pas partie des classes supérieures.');
    return { eleve_id: r.eleve.id, matricule: r.eleve.matricule,
      nom: r.eleve.nom, prenom: r.eleve.prenom, moyennes: notes,
      moyenne_annuelle: moyenne, decision,
      cible_id: destination?.id || null, cible_nom: destination?.nom || null };
  });
  const connus = new Set(lignes.map(l => String(l.eleve_id)));
  if (Object.keys(affectations).some(id => !connus.has(id))) throw erreur('Un élève choisi ne fait pas partie de cette classe.');
  const destinations = Object.fromEntries(lignes.filter(l => l.decision === 'admis')
    .map(l => [l.eleve_id, l.cible_id]));
  const empreinte = crypto.createHash('sha256').update(JSON.stringify({
    ecoleId, annee, classeId, cibleId, seuilNombre, periodes: periodes.map(p => p.id), lignes
  })).digest('hex');
  return { annee_scolaire: annee, classe: { id: source.id, nom: source.nom }, cible,
    cibles: source.cibles, affectations: destinations,
    seuil: seuilNombre, periodes: periodes.map(p => ({ id: p.id, libelle: p.libelle, statut: p.statut })),
    lignes, empreinte, stats: {
      admis: lignes.filter(l => l.decision === 'admis').length,
      maintenus: lignes.filter(l => l.decision === 'maintenu').length,
      incomplets: lignes.filter(l => l.decision === 'incomplet').length
    } };
}
function validerPassage(db, ecoleId, demande, utilisateurId, maintenant) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultat = preparerPassage(db, ecoleId, demande);
    if (!resultat.lignes.length) throw erreur('Aucun élève actif dans cette classe.');
    if (!/^[a-f0-9]{64}$/.test(String(demande.empreinte || '')) ||
        demande.empreinte !== resultat.empreinte) {
      throw erreur('Les notes ou l’effectif ont changé depuis l’aperçu. Actualisez avant de confirmer.', 409);
    }
    if (resultat.periodes.some(p => p.statut !== 'fermee')) {
      throw erreur('Fermez d’abord tous les trimestres/semestres de cette année dans Paramètres.', 409);
    }
    // Photo intégrale de l'école une seule fois, avant le premier mouvement.
    photographierEffectifs(db, ecoleId, resultat.annee_scolaire);
    const recontrole = preparerPassage(db, ecoleId, demande);
    if (recontrole.empreinte !== resultat.empreinte) throw erreur('La classe a changé : actualisez l’aperçu.', 409);
    const horodatage = maintenant();
    const inserer = db.prepare(`INSERT INTO decisions_finales
      (ecole_id, annee_scolaire, eleve_id, classe_origine_id, classe_cible_id,
       moyenne_annuelle, seuil, detail_periodes, decision, valide_par, valide_le)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const deplacer = db.prepare(`UPDATE eleves SET classe_id = ? WHERE id = ? AND ecole_id = ?
      AND classe_id = ? AND statut = 'actif'`);
    for (const l of recontrole.lignes) {
      const destination = l.cible_id;
      inserer.run(ecoleId, recontrole.annee_scolaire, l.eleve_id, recontrole.classe.id,
        destination, l.moyenne_annuelle, recontrole.seuil, JSON.stringify(l.moyennes),
        l.decision, utilisateurId, horodatage);
      if (destination && deplacer.run(destination, l.eleve_id, ecoleId, recontrole.classe.id).changes !== 1)
        throw erreur(`La classe de ${l.nom} ${l.prenom} a changé : passage annulé.`, 409);
    }
    db.exec('COMMIT');
    return { ok: true, annee_scolaire: recontrole.annee_scolaire, classe: recontrole.classe,
      cible: recontrole.cible, ...recontrole.stats };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function annulerPassage(db, ecoleId, classeIdBrut, maintenant) {
  const annee = anneeCourante(db, ecoleId), classeId = Number(classeIdBrut);
  const lignes = db.prepare(`SELECT * FROM decisions_finales WHERE ecole_id = ?
    AND annee_scolaire = ? AND classe_origine_id = ?`).all(ecoleId, annee, classeId);
  if (!lignes.length) throw erreur('Aucun passage à annuler pour cette classe.', 404);
  db.exec('BEGIN IMMEDIATE');
  try {
    const retour = db.prepare(`UPDATE eleves SET classe_id = ? WHERE id = ? AND ecole_id = ? AND classe_id = ?`);
    const nouvellesNotes = db.prepare(`SELECT 1 FROM notes n JOIN evaluations ev ON ev.id = n.evaluation_id
      WHERE n.eleve_id = ? AND ev.ecole_id = ? AND ev.classe_id = ? AND n.modifie_le >= ? LIMIT 1`);
    for (const l of lignes.filter(x => x.decision === 'admis')) {
      if (nouvellesNotes.get(l.eleve_id, ecoleId, l.classe_cible_id, l.valide_le))
        throw erreur('Impossible d’annuler : des notes ont déjà été saisies dans la classe supérieure.', 409);
      if (retour.run(classeId, l.eleve_id, ecoleId, l.classe_cible_id).changes !== 1)
        throw erreur('Impossible d’annuler : la classe d’un élève a été modifiée depuis la validation.', 409);
    }
    db.prepare(`DELETE FROM decisions_finales WHERE ecole_id = ? AND annee_scolaire = ?
      AND classe_origine_id = ?`).run(ecoleId, annee, classeId);
    if (!db.prepare(`SELECT 1 FROM decisions_finales WHERE ecole_id = ?
      AND annee_scolaire = ? LIMIT 1`).get(ecoleId, annee)) {
      // Dernière annulation : la photo n'est plus nécessaire et le travail
      // courant peut reprendre sans effectif figé.
      db.prepare('DELETE FROM inscriptions_historiques WHERE ecole_id = ? AND annee_scolaire = ?')
        .run(ecoleId, annee);
      db.prepare('DELETE FROM matieres_historiques WHERE ecole_id = ? AND annee_scolaire = ?')
        .run(ecoleId, annee);
      db.prepare('DELETE FROM classes_historiques WHERE ecole_id = ? AND annee_scolaire = ?')
        .run(ecoleId, annee);
    }
    db.exec('COMMIT');
    return { ok: true, annules: lignes.length };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function ouvrirAnneeSuivante(db, ecoleId, anneeConfirmee) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const options = optionsPassage(db, ecoleId);
    if (anneeConfirmee !== options.prochaine_annee) throw erreur('Année suivante incorrecte : actualisez la page.', 409);
    const aTraiter = options.sources.filter(c => c.effectif > 0 && c.valides !== c.effectif);
    if (aTraiter.length) throw erreur(`Décisions manquantes pour ${aTraiter.map(c => c.nom).join(', ')}.`, 409);
    if (options.periodes_ouvertes.length) throw erreur('Fermez toutes les périodes de cette année avant d’ouvrir la suivante.', 409);
    const periodes = db.prepare('SELECT * FROM periodes WHERE ecole_id = ? AND annee_scolaire = ? ORDER BY id')
      .all(ecoleId, options.annee_scolaire);
    if (!periodes.length) throw erreur('Aucune période à reprendre pour la nouvelle année.');
    if (db.prepare('SELECT 1 FROM periodes WHERE ecole_id = ? AND annee_scolaire = ?').get(ecoleId, anneeConfirmee))
      throw erreur('Les périodes de la nouvelle année existent déjà.', 409);
    photographierEffectifs(db, ecoleId, options.annee_scolaire);
    const inserer = db.prepare(`INSERT INTO periodes
      (ecole_id, code, libelle, cycle, ordre, statut, date_debut, date_fin, annee_scolaire)
      VALUES (?, ?, ?, ?, ?, 'ouverte', NULL, NULL, ?)`);
    for (const p of periodes) {
      const base = String(p.code).split('@')[0];
      inserer.run(ecoleId, `${base}@${anneeConfirmee}`, p.libelle, p.cycle, p.ordre, anneeConfirmee);
    }
    db.prepare('UPDATE etablissements SET annee_scolaire = ? WHERE id = ?').run(anneeConfirmee, ecoleId);
    db.prepare('UPDATE classes SET annee = ? WHERE ecole_id = ?').run(anneeConfirmee, ecoleId);
    db.exec('COMMIT');
    return { ok: true, annee_scolaire: anneeConfirmee, periodes_creees: periodes.length };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
module.exports = { niveauDe, classesPassage, optionsPassage, preparerPassage,
  validerPassage, annulerPassage, ouvrirAnneeSuivante, anneeSuivante, memoriserInscription };
