'use strict';

const round2 = (n) => Math.round(n * 100) / 100;

function mention(moy) {
  if (moy == null) return '—';
  if (moy < 10) return 'Insuffisant';
  if (moy < 12) return 'Passable';
  if (moy < 14) return 'Assez bien';
  if (moy < 16) return 'Bien';
  if (moy < 18) return 'Très bien';
  return 'Excellent';
}
function appreciation(moy) {
  if (moy == null) return 'Non évalué';
  if (moy < 6) return 'Très faible';
  if (moy < 8) return 'Faible';
  if (moy < 10) return 'Insuffisant';
  if (moy < 12) return 'Passable';
  if (moy < 14) return 'Assez bien';
  if (moy < 16) return 'Bien';
  return 'Très bien';
}
function mentionColor(moy) {
  if (moy == null) return '#94a3b8';
  if (moy < 10) return '#dc2626';
  if (moy < 12) return '#d97706';
  if (moy < 14) return '#0891b2';
  if (moy < 16) return '#1f9d6b';
  return '#0b6b4a';
}

/** Rang "compétition" : 1, 1, 3 …  Les valeurs nulles ne sont pas classées. */
function ranks(values) {
  const valid = values.filter(v => v != null).sort((a, b) => b - a);
  const map = new Map();
  values.forEach((v, i) => {
    if (v == null) { map.set(i, null); return; }
    map.set(i, valid.indexOf(v) + 1);
  });
  return map;
}

function moyenneMatiere(notes, formule) {
  const devoirs = notes.filter(n => n.type === 'devoir1' || n.type === 'devoir2').map(n => n.valeur);
  const comp = notes.find(n => n.type === 'composition');
  const dev = devoirs.length ? devoirs.reduce((a, b) => a + b, 0) / devoirs.length : null;
  const co = comp && comp.valeur != null ? comp.valeur : null;
  if (dev == null && co == null) return null;
  if (formule === 'moy_co') {
    if (dev != null && co != null) return (dev + co) / 2;
    return dev != null ? dev : co;
  }
  if (formule === 'tiers') {
    if (dev != null && co != null) return (dev + co) / 2; // moyenne des devoirs ramenée à 1 valeur
    return dev != null ? dev : co;
  }
  // formule par défaut : (moyenne des devoirs + 2 × composition) / 3
  if (dev != null && co != null) return (dev + 2 * co) / 3;
  return dev != null ? dev : co;
}

function statsOf(arr) {
  const vals = arr.filter(v => v != null);
  if (!vals.length) return { effectif: 0, moyenne: null, min: null, max: null, ecart_type: null, mediane: null, taux_reussite: null, taux_bien: null };
  const sorted = [...vals].sort((a, b) => a - b);
  const somme = vals.reduce((a, b) => a + b, 0);
  const moyenne = somme / vals.length;
  const variance = vals.reduce((a, b) => a + (b - moyenne) ** 2, 0) / vals.length;
  const mid = Math.floor(sorted.length / 2);
  return {
    effectif: vals.length,
    moyenne: round2(moyenne),
    min: round2(sorted[0]),
    max: round2(sorted[sorted.length - 1]),
    ecart_type: round2(Math.sqrt(variance)),
    mediane: round2(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2),
    taux_reussite: round2((vals.filter(v => v >= 10).length / vals.length) * 100),
    taux_bien: round2((vals.filter(v => v >= 14).length / vals.length) * 100)
  };
}

/**
 * Calcule une promotion complète pour une classe et un scope donné.
 * scope = { classe_id, periode_id }  ou  { classe_id, examen_id }
 */
function computeClasse(db, ecoleId, scope) {
  const classe = db.prepare('SELECT * FROM classes WHERE id = ? AND ecole_id = ?').get(scope.classe_id, ecoleId);
  if (!classe) return null;

  const etab = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(ecoleId);
  const formule = etab.formule_moyenne || 'co2';
  // mode « composition » : la moyenne de chaque matière ne retient QUE la
  // composition (les devoirs sont ignorés). Sert au bulletin de composition
  // et aux statistiques de fin de trimestre.
  const compositionSeule = scope.mode === 'composition';

  const matieres = db.prepare(`
    SELECT m.id, m.nom, m.code, m.groupe, cm.coefficient
    FROM classe_matieres cm JOIN matieres m ON m.id = cm.matiere_id
    WHERE cm.classe_id = ? ORDER BY m.groupe, m.nom`).all(classe.id);

  const eleves = db.prepare(`
    SELECT id, matricule, nom, prenom, sexe, date_naissance, lieu_naissance, tuteur_nom, tuteur_tel
    FROM eleves WHERE classe_id = ? AND statut = 'actif' ORDER BY nom, prenom`).all(classe.id);

  let evaluations, epreuveCoef = null;
  if (scope.examen_id) {
    evaluations = db.prepare(`
      SELECT e.id, e.matiere_id, e.type, ev.coefficient AS epreuve_coef, ev.bareme
      FROM evaluations e JOIN epreuves ev ON ev.id = e.epreuve_id
      WHERE e.ecole_id = ? AND e.classe_id = ? AND ev.examen_id = ?`).all(ecoleId, classe.id, scope.examen_id);
    epreuveCoef = new Map(evaluations.map(e => [e.id, e.epreuve_coef]));
  } else {
    evaluations = db.prepare(`
      SELECT id, matiere_id, type, bareme FROM evaluations
      WHERE ecole_id = ? AND classe_id = ? AND periode_id = ? AND epreuve_id IS NULL`).all(ecoleId, classe.id, scope.periode_id);
  }

  const coefParMatiere = new Map();
  if (scope.examen_id) evaluations.forEach(e => coefParMatiere.set(e.matiere_id, Number(e.epreuve_coef) || 1));

  const notesByEval = new Map();
  if (evaluations.length) {
    const ids = evaluations.map(e => e.id);
    const ph = ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT evaluation_id, eleve_id, valeur, absent FROM notes WHERE evaluation_id IN (${ph})`).all(...ids);
    rows.forEach(r => {
      if (!notesByEval.has(r.evaluation_id)) notesByEval.set(r.evaluation_id, new Map());
      notesByEval.get(r.evaluation_id).set(r.eleve_id, r);
    });
  }

  // Pour chaque élève × matière
  const resultats = eleves.map(el => {
    const lignes = matieres.map(m => {
      const evals = evaluations.filter(e => e.matiere_id === m.id);
      const coefficient = scope.examen_id ? (coefParMatiere.get(m.id) ?? m.coefficient) : m.coefficient;
      let moyenne = null;
      const detail = {};
      if (scope.examen_id) {
        let somme = 0, coefTotal = 0;
        evals.forEach(ev => {
          const n = notesByEval.get(ev.id)?.get(el.id);
          const coef = epreuveCoef.get(ev.id) || 1;
          detail[ev.id] = n && !n.absent ? n.valeur : null;
          if (n && !n.absent && n.valeur != null) { somme += n.valeur * coef; coefTotal += coef; }
        });
        if (coefTotal > 0) moyenne = somme / coefTotal;
        return {
          matiere_id: m.id, nom: m.nom, groupe: m.groupe, coefficient,
          moyenne: moyenne == null ? null : round2(moyenne),
          points: moyenne == null ? null : round2(moyenne * coefficient),
          detail, appreciation: appreciation(moyenne)
        };
      }
      const notes = evals.map(ev => {
        const n = notesByEval.get(ev.id)?.get(el.id);
        if (!n || n.absent || n.valeur == null) return null;
        return { type: ev.type, valeur: n.valeur };
      }).filter(Boolean);
      evals.forEach(ev => {
        const n = notesByEval.get(ev.id)?.get(el.id);
        detail[ev.type] = n && !n.absent ? n.valeur : null;
      });
      const noteComposition = detail.composition != null ? detail.composition : null;
      moyenne = compositionSeule ? noteComposition : moyenneMatiere(notes, formule);
      return {
        matiere_id: m.id, nom: m.nom, groupe: m.groupe, coefficient,
        moyenne: moyenne == null ? null : round2(moyenne),
        points: moyenne == null ? null : round2(moyenne * coefficient),
        detail, composition: noteComposition,
        appreciation: appreciation(moyenne)
      };
    });

    const evaluees = lignes.filter(l => l.moyenne != null);
    const totalCoef = evaluees.reduce((a, l) => a + l.coefficient, 0);
    const totalPoints = evaluees.reduce((a, l) => a + l.points, 0);
    const moyenne = totalCoef > 0 ? round2(totalPoints / totalCoef) : null;

    // Moyenne « composition seule » de l'élève, coefficients compris.
    const lignesComp = lignes.filter(l => l.composition != null);
    const coefComp = lignesComp.reduce((a, l) => a + l.coefficient, 0);
    const moyenneComposition = coefComp > 0
      ? round2(lignesComp.reduce((a, l) => a + l.composition * l.coefficient, 0) / coefComp)
      : null;

    return {
      eleve: el,
      lignes,
      total_coef: round2(totalCoef),
      total_points: round2(totalPoints),
      moyenne,
      moyenne_composition: moyenneComposition,
      matieres_composition: lignesComp.length,
      matieres_evaluees: evaluees.length,
      matieres_total: matieres.length,
      mention: mention(moyenne),
      appreciation: appreciation(moyenne)
    };
  });

  // Rangs généraux
  const rangsGen = ranks(resultats.map(r => r.moyenne));
  resultats.forEach((r, i) => { r.rang = rangsGen.get(i); });

  // Rangs par matière
  matieres.forEach((m, mi) => {
    const rk = ranks(resultats.map(r => r.lignes[mi].moyenne));
    resultats.forEach((r, ri) => { r.lignes[mi].rang = rk.get(ri); });
  });

  // Statistiques par matière
  const matieresStats = matieres.map((m, mi) => {
    const vals = resultats.map(r => r.lignes[mi].moyenne);
    return {
      id: m.id, nom: m.nom, groupe: m.groupe, coefficient: resultats[0] ? resultats[0].lignes[mi].coefficient : m.coefficient,
      ...statsOf(vals),
      notes_saisies: resultats.reduce((a, r) => a + (r.lignes[mi].moyenne != null ? 1 : 0), 0)
    };
  });

  const moyennes = resultats.map(r => r.moyenne);
  const stats = statsOf(moyennes);
  const buckets = [
    { label: '0 – 5', min: 0, max: 5, n: 0 },
    { label: '5 – 8', min: 5, max: 8, n: 0 },
    { label: '8 – 10', min: 8, max: 10, n: 0 },
    { label: '10 – 12', min: 10, max: 12, n: 0 },
    { label: '12 – 14', min: 12, max: 14, n: 0 },
    { label: '14 – 16', min: 14, max: 16, n: 0 },
    { label: '16 – 20', min: 16, max: 20.01, n: 0 }
  ];
  moyennes.forEach(v => {
    if (v == null) return;
    const b = buckets.find(b => v >= b.min && v < b.max);
    if (b) b.n++;
  });
  const mentions = {};
  resultats.forEach(r => { mentions[r.mention] = (mentions[r.mention] || 0) + 1; });

  /* --- Composition : combien ont la moyenne, combien ne l'ont pas -------- */
  const moyComp = resultats.map(r => r.moyenne_composition);
  const compValides = moyComp.filter(v => v != null);
  const reussiteComp = compValides.filter(v => v >= 10).length;
  const echecComp = compValides.filter(v => v < 10).length;
  const composition = {
    effectif: compValides.length,                       // élèves ayant au moins une composition
    non_notes: resultats.length - compValides.length,    // aucune composition saisie
    moyenne: compValides.length ? round2(compValides.reduce((a, b) => a + b, 0) / compValides.length) : null,
    reussite: reussiteComp,                             // moyenne ≥ 10
    echec: echecComp,                                   // moyenne < 10
    taux_reussite: compValides.length ? round2((reussiteComp / compValides.length) * 100) : null,
    min: compValides.length ? round2(Math.min(...compValides)) : null,
    max: compValides.length ? round2(Math.max(...compValides)) : null
  };

  // « Qui a 1, qui a 2, qui a 3… » : effectif par note entière de 0 à 20,
  // calculé sur la moyenne de composition de chaque élève (arrondie au plus
  // proche, 20 inclus).
  const repartitionComposition = [];
  for (let n = 0; n <= 20; n++) {
    const combien = compValides.filter(v => Math.min(20, Math.max(0, Math.round(v))) === n).length;
    repartitionComposition.push({ note: n, n: combien });
  }

  // Même chose par matière : combien d'élèves au-dessus / en dessous de 10
  const compositionParMatiere = matieres.map((m, mi) => {
    const vals = resultats.map(r => r.lignes[mi].composition).filter(v => v != null);
    return {
      id: m.id, nom: m.nom,
      saisies: vals.length,
      moyenne: vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      reussite: vals.filter(v => v >= 10).length,
      echec: vals.filter(v => v < 10).length
    };
  });

  const classement = [...resultats].filter(r => r.moyenne != null).sort((a, b) => b.moyenne - a.moyenne);

  return {
    classe,
    etablissement: etab,
    periode: scope.periode_id ? db.prepare('SELECT * FROM periodes WHERE id = ?').get(scope.periode_id) : null,
    examen: scope.examen_id ? db.prepare('SELECT * FROM examens WHERE id = ?').get(scope.examen_id) : null,
    matieres, resultats, classement, matieres_stats: matieresStats,
    stats: {
      ...stats, mentions, buckets, effectif_classe: eleves.length,
      composition, repartition_composition: repartitionComposition,
      composition_par_matiere: compositionParMatiere,
      mode: compositionSeule ? 'composition' : 'complete'
    },
    scope
  };
}

function bulletinData(db, ecoleId, eleveId, periodeId, options = {}) {
  const eleve = db.prepare('SELECT * FROM eleves WHERE id = ? AND ecole_id = ?').get(eleveId, ecoleId);
  if (!eleve || !eleve.classe_id) return null;
  const promo = computeClasse(db, ecoleId, {
    classe_id: eleve.classe_id, periode_id: periodeId,
    ...(options.mode ? { mode: options.mode } : {})
  });
  const ligne = promo.resultats.find(r => r.eleve.id === eleveId);
  const bulletin = db.prepare('SELECT * FROM bulletins WHERE eleve_id = ? AND periode_id = ?').get(eleveId, periodeId) || null;

  /* --- Qui enseigne quoi : nom + signature de chaque professeur --------- */
  const profs = db.prepare(`
    SELECT a.matiere_id, u.id, u.nom, u.signature
    FROM affectations a JOIN utilisateurs u ON u.id = a.enseignant_id
    WHERE a.classe_id = ? AND u.actif = 1
    ORDER BY u.nom`).all(eleve.classe_id);
  const professeurs = {};
  profs.forEach(p => {
    if (!professeurs[p.matiere_id]) professeurs[p.matiere_id] = { id: p.id, nom: p.nom, signature: p.signature || null };
  });

  /* --- Professeur titulaire : celui qui signe le bulletin --------------- */
  const classe = db.prepare('SELECT * FROM classes WHERE id = ?').get(eleve.classe_id);
  let principal = classe && classe.titulaire_id
    ? db.prepare("SELECT id, nom, signature FROM utilisateurs WHERE id = ? AND ecole_id = ?").get(classe.titulaire_id, ecoleId)
    : null;
  if (!principal && profs.length) {
    // à défaut : le premier professeur affecté à la classe, par ordre alphabétique
    principal = { id: profs[0].id, nom: profs[0].nom, signature: profs[0].signature };
  }
  if (!principal && classe && classe.titulaire) principal = { id: null, nom: classe.titulaire, signature: null };

  /* --- Chef d'établissement : nom affiché + sa signature ---------------- */
  const chefUser = db.prepare("SELECT nom, signature FROM utilisateurs WHERE ecole_id = ? AND role = 'directeur' ORDER BY id LIMIT 1").get(ecoleId);
  const chef = {
    nom: (promo.etablissement && promo.etablissement.chef_nom) || (chefUser && chefUser.nom) || '',
    titre: (promo.etablissement && promo.etablissement.chef_titre) || "Le Chef d'Établissement",
    signature: (chefUser && chefUser.signature) || null
  };

  return { promo, ligne, bulletin, eleve, professeurs, principal: principal || null, chef };
}

module.exports = { computeClasse, bulletinData, mention, appreciation, mentionColor, statsOf, round2 };
