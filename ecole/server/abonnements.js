'use strict';
/**
 * Corrections d'abonnement : toutes les transitions et leur journal sont
 * atomiques. Une ancienne activation sans journal ne peut pas être reconstituée
 * automatiquement ; la suspension est alors la seule correction sûre.
 */
const { now } = require('./db');
const { tarifPourEcole } = require('./tarifs-effectif');

function erreur(message, status = 409) {
  const e = new Error(message);
  e.status = status;
  throw e;
}

function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultat = action();
    db.exec('COMMIT');
    return resultat;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function derniereOperation(db, ecoleId) {
  return db.prepare(`SELECT * FROM operations_abonnement
    WHERE ecole_id = ? AND annule_le IS NULL ORDER BY id DESC LIMIT 1`).get(ecoleId);
}

// Appelé uniquement dans une transaction, après écriture de l'établissement.
function journaliser(db, avant, apres, { type, paiementId = null, acteur, motif = null }) {
  return Number(db.prepare(`INSERT INTO operations_abonnement
    (ecole_id, paiement_id, type, ancien_statut, ancien_plan, ancienne_date_fin,
     nouveau_statut, nouveau_plan, nouvelle_date_fin, motif, cree_le, cree_par)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    avant.id, paiementId, type, avant.statut, avant.plan, avant.date_fin_abonnement,
    apres.statut, apres.plan, apres.date_fin_abonnement, motif, now(), acteur
  ).lastInsertRowid);
}

function modifierEcole(db, id, changements, acteur) {
  return transaction(db, () => {
    const avant = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(id);
    if (!avant) erreur('Établissement introuvable', 404);
    const apres = {
      statut: changements.statut ?? avant.statut,
      plan: changements.plan ?? avant.plan,
      date_fin_abonnement: changements.date_fin_abonnement ?? avant.date_fin_abonnement
    };
    db.prepare(`UPDATE etablissements SET statut = ?, plan = ?, date_fin_abonnement = ?, nom = ? WHERE id = ?`)
      .run(apres.statut, apres.plan, apres.date_fin_abonnement, changements.nom ?? avant.nom, avant.id);
    if (avant.statut !== apres.statut || avant.plan !== apres.plan ||
        avant.date_fin_abonnement !== apres.date_fin_abonnement) {
      journaliser(db, avant, apres, { type: 'modification', acteur });
    }
    return apres;
  });
}

function enregistrerPaiementManuel(db, { ecoleId, montant, plan, reference, dureeJours, operateur,
  effectifFacture = null, tarifCode = null, transactionRef = null, transactionRefNorm = null }, acteur) {
  return transaction(db, () => {
    const avant = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(ecoleId);
    if (!avant) erreur('Établissement introuvable', 404);
    const echeance = Date.parse(avant.date_fin_abonnement || '');
    const debut = Number.isFinite(echeance) && echeance > Date.now() ? echeance : Date.now();
    const fin = new Date(debut + dureeJours * 864e5).toISOString();
    const date = now();
    const info = db.prepare(`INSERT INTO paiements
      (ecole_id, montant, devise, plan, reference, statut, periode_debut, periode_fin,
       operateur, canal, mois, valide_par, valide_le, cree_le, effectif_facture, tarif_code,
       transaction_ref, transaction_ref_norm)
      VALUES (?,?,?,?,?, 'paye', ?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      avant.id, montant, 'FCFA', plan, reference, new Date(debut).toISOString().slice(0, 10), fin.slice(0, 10),
      operateur || 'manuel', 'manuel', Math.max(1, Math.round(dureeJours / 30)), acteur, date, date,
      effectifFacture, tarifCode, transactionRef, transactionRefNorm
    );
    const apres = { statut: 'actif', plan, date_fin_abonnement: fin };
    db.prepare("UPDATE etablissements SET statut = 'actif', plan = ?, date_fin_abonnement = ? WHERE id = ?")
      .run(plan, fin, avant.id);
    const id = Number(info.lastInsertRowid);
    journaliser(db, avant, apres, { type: 'paiement', paiementId: id, acteur });
    return { id, date_fin_abonnement: fin };
  });
}

// Un webhook peut être traité plusieurs fois ou arriver après une annulation.
// On relit le statut SOUS verrou avant tout changement : jamais de réactivation.
function validerPaiement(db, paiementId, acteur) {
  return transaction(db, () => {
    const p = db.prepare('SELECT * FROM paiements WHERE id = ?').get(paiementId);
    if (!p) erreur('Paiement introuvable', 404);
    if (p.statut !== 'en_attente') return { statut: p.statut, deja: true };
    const avant = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(p.ecole_id);
    if (!avant) erreur('Établissement introuvable', 404);
    if (p.canal === 'manuel' && p.plan === 'effectif' &&
        tarifPourEcole(db, p.ecole_id).montant > Number(p.montant)) {
      erreur('L’effectif a augmenté depuis la déclaration : le montant reçu ne couvre plus la nouvelle tranche. Contactez l’établissement.', 409);
    }
    const echeance = Date.parse(avant.date_fin_abonnement || '');
    const base = Number.isFinite(echeance) && echeance > Date.now() ? echeance : Date.now();
    const mois = Number(p.mois) || 1;
    if (!Number.isSafeInteger(mois) || mois < 1 || mois > 60 || (p.plan === 'effectif' && mois !== 1))
      erreur('La durée du paiement doit être d’un mois.', 400);
    const fin = new Date(base + mois * 30 * 864e5).toISOString();
    const date = now();
    db.prepare(`UPDATE paiements SET statut = 'paye', valide_par = ?, valide_le = ?,
      periode_debut = ?, periode_fin = ? WHERE id = ?`)
      .run(acteur, date, new Date(base).toISOString().slice(0, 10), fin.slice(0, 10), p.id);
    db.prepare("UPDATE etablissements SET statut = 'actif', plan = ?, date_fin_abonnement = ? WHERE id = ?")
      .run(p.plan, fin, avant.id);
    journaliser(db, avant, { statut: 'actif', plan: p.plan, date_fin_abonnement: fin },
      { type: 'paiement', paiementId: p.id, acteur });
    return { statut: 'paye', date_fin_abonnement: fin };
  });
}

function motifValide(motif) {
  const texte = String(motif || '').trim();
  if (texte.length < 5 || texte.length > 300) erreur('Indiquez un motif de 5 à 300 caractères.', 400);
  return texte;
}

function annulerDerniereOperation(db, ecoleId, operationId, acteur, motif) {
  const raison = motifValide(motif);
  return transaction(db, () => {
    const op = derniereOperation(db, ecoleId);
    if (!op) erreur('Cette ancienne activation ne peut pas être annulée automatiquement : son état précédent est inconnu. Vous pouvez suspendre l’abonnement.');
    if (operationId != null && Number(operationId) !== op.id) {
      erreur('Une modification plus récente existe. Annulez-la d’abord pour préserver les abonnements légitimes.');
    }
    const e = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(ecoleId);
    if (!e) erreur('Établissement introuvable', 404);
    if (e.statut !== op.nouveau_statut || e.plan !== op.nouveau_plan ||
        e.date_fin_abonnement !== op.nouvelle_date_fin) {
      erreur('L’abonnement a changé depuis cette activation. Rechargez la page avant de réessayer.');
    }
    if (op.paiement_id != null) {
      const p = db.prepare('SELECT statut, canal FROM paiements WHERE id = ?').get(op.paiement_id);
      if (!p || p.statut !== 'paye') erreur('Le paiement a changé depuis cette activation.');
      if (p.canal !== 'manuel') {
        erreur('Un paiement en ligne ne peut pas être annulé ici : suspendez l’abonnement et vérifiez le remboursement auprès du prestataire.');
      }
      // « annule » = validation corrigée, PAS remboursement de la transaction.
      db.prepare("UPDATE paiements SET statut = 'annule' WHERE id = ?").run(op.paiement_id);
    }
    db.prepare('UPDATE etablissements SET statut = ?, plan = ?, date_fin_abonnement = ? WHERE id = ?')
      .run(op.ancien_statut, op.ancien_plan, op.ancienne_date_fin, e.id);
    db.prepare('UPDATE operations_abonnement SET annule_le = ?, annule_par = ?, motif_annulation = ? WHERE id = ?')
      .run(now(), acteur, raison, op.id);
    return { statut: op.ancien_statut, plan: op.ancien_plan,
      date_fin_abonnement: op.ancienne_date_fin, paiement_id: op.paiement_id };
  });
}

function suspendreAbonnement(db, ecoleId, acteur, motif) {
  const raison = motifValide(motif);
  return transaction(db, () => {
    const avant = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(ecoleId);
    if (!avant) erreur('Établissement introuvable', 404);
    if (avant.statut === 'suspendu') erreur('Cet abonnement est déjà suspendu.');
    const apres = { statut: 'suspendu', plan: avant.plan,
      date_fin_abonnement: avant.date_fin_abonnement };
    db.prepare("UPDATE etablissements SET statut = 'suspendu' WHERE id = ?").run(avant.id);
    journaliser(db, avant, apres, { type: 'suspension', acteur, motif: raison });
    return apres;
  });
}

module.exports = {
  modifierEcole, enregistrerPaiementManuel, validerPaiement,
  annulerDerniereOperation, suspendreAbonnement
};
