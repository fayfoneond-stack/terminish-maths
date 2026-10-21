'use strict';
/**
 * Génération du reçu de paiement en PDF (A4, gabarit Terminish École).
 * Aucune dépendance à un service externe : le PDF est produit côté serveur.
 */
const PDFDocument = require('pdfkit');

const VERT = '#0b6b4a';
const VERT_FONCE = '#0b3d2e';
const OR = '#f0b429';
const GRIS = '#6b7d74';
const BORD = '#dbe6e0';
const ENCRE = '#10241c';

const money = (n, devise = 'FCFA') => `${Number(n || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} ${devise}`;
const dateFr = (d, avecHeure = false) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  const base = dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return avecHeure ? `${base} à ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : base;
};
const OP_LABEL = {
  mixx: 'Mixx by Yas (ex T-Money)',
  moov: 'Moov Money (Flooz)',
  cinetpay: 'CinetPay — paiement en ligne',
  paydunya: 'PayDunya — paiement en ligne',
  manuel: 'Espèces / virement encaissé par l’éditeur'
};
const PLAN_LABEL = { essai: 'Essai gratuit', essentiel: 'Essentiel', standard: 'Standard', reseau: 'Réseau' };

/** Extrait les dimensions d'un PNG/JPEG data URL (pour insérer le logo dans le PDF). */
function imageBuffer(logo) {
  if (!logo || typeof logo !== 'string') return null;
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(logo.trim());
  if (!m) return null; // SVG non supporté par pdfkit : on ignore proprement
  try {
    return Buffer.from(m[2], 'base64');
  } catch { return null; }
}

function ligne(doc, y, x1, x2, color = BORD) {
  doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.8).strokeColor(color).stroke();
}

/**
 * @param {object} paiement  ligne de la table paiements
 * @param {object} ecole     ligne de la table etablissements
 * @param {object} opts      { editeur: { nom, ville, telephone, email }, baseUrl }
 * @returns {Promise<Buffer>}
 */
function genererRecuPDF(paiement, ecole, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      const editeur = opts.editeur || {};
      const doc = new PDFDocument({ size: 'A4', margin: 48, info: {
        Title: `Reçu ${paiement.reference || ''}`,
        Author: editeur.nom || 'Terminish École',
        Subject: `Abonnement ${PLAN_LABEL[paiement.plan] || paiement.plan || ''}`.trim(),
        Keywords: 'reçu, abonnement, Mobile Money, Terminish École'
      } });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const L = 48, R = 547, W = R - L;

      /* ---------------- En-tête ---------------- */
      doc.rect(0, 0, 595, 96).fill(VERT_FONCE);
      doc.rect(0, 96, 595, 4).fill(OR);

      const logo = imageBuffer(ecole.logo);
      let textX = L;
      if (logo) {
        try {
          doc.image(logo, L, 26, { fit: [44, 44] });
          textX = L + 56;
        } catch { textX = L; }
      } else {
        doc.roundedRect(L, 26, 44, 44, 10).fill(VERT);
        doc.fillColor(OR).font('Helvetica-Bold').fontSize(20).text('T', L, 38, { width: 44, align: 'center' });
        textX = L + 56;
      }
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text(editeur.nom || 'TERMINISH ÉCOLE', textX, 28);
      doc.fillColor('#b7d9cb').font('Helvetica').fontSize(8.5)
        .text(editeur.sous_titre || 'Plateforme de gestion scolaire · Bulletins, notes et statistiques', textX, 48);
      doc.fillColor('#b7d9cb').fontSize(8)
        .text([editeur.ville || 'Lomé, Togo', editeur.telephone, editeur.email].filter(Boolean).join(' · '), textX, 62);

      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
        .text('REÇU DE PAIEMENT', L, 28, { width: W, align: 'right' });
      doc.fillColor(OR).fontSize(11)
        .text(paiement.reference || '—', L, 44, { width: W, align: 'right' });
      doc.fillColor('#b7d9cb').font('Helvetica').fontSize(8)
        .text(`Émis le ${dateFr(paiement.valide_le || paiement.cree_le)}`, L, 62, { width: W, align: 'right' });

      /* ---------------- Montant ---------------- */
      let y = 128;
      doc.fillColor(GRIS).font('Helvetica').fontSize(9).text('MONTANT RÉGLÉ', L, y);
      doc.fillColor(VERT_FONCE).font('Helvetica-Bold').fontSize(30)
        .text(money(paiement.montant, paiement.devise), L, y + 12);
      doc.fillColor(GRIS).font('Helvetica').fontSize(9)
        .text(`Formule ${PLAN_LABEL[paiement.plan] || paiement.plan || '—'} · ${paiement.mois || 1} mois`, L, y + 50);

      const badge = (paiement.statut === 'paye') ? 'PAYÉ' : (paiement.statut || '').toUpperCase();
      const badgeColor = paiement.statut === 'paye' ? VERT : '#b45309';
      doc.roundedRect(R - 128, y + 6, 128, 30, 8).fill(badgeColor);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
        .text(badge, R - 128, y + 15, { width: 128, align: 'center' });
      doc.fillColor(GRIS).font('Helvetica').fontSize(8)
        .text(OP_LABEL[paiement.operateur] || OP_LABEL[paiement.canal] || '—', R - 190, y + 44, { width: 190, align: 'right' });

      /* ---------------- Établissement ---------------- */
      y = 206;
      doc.roundedRect(L, y, W, 74, 10).fillAndStroke('#f7faf8', BORD);
      doc.fillColor(GRIS).font('Helvetica').fontSize(8).text('ÉTABLISSEMENT BÉNÉFICIAIRE', L + 14, y + 12);
      doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(13).text(ecole.nom || '—', L + 14, y + 24, { width: W - 28 });
      doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(
        [ecole.ville, ecole.telephone, ecole.email].filter(Boolean).join(' · ') || '—',
        L + 14, y + 46, { width: W - 28 });
      doc.fillColor(GRIS).fontSize(8.5).text(
        `${ecole.type === 'lycee' ? 'Lycée' : ecole.type === 'college' ? 'Collège' : 'Collège & Lycée'} · Année scolaire ${ecole.annee_scolaire || '—'}`,
        L + 14, y + 58, { width: W - 28 });

      /* ---------------- Détails ---------------- */
      y = 294;
      doc.fillColor(VERT_FONCE).font('Helvetica-Bold').fontSize(11).text('Détails de la transaction', L, y);
      y += 8;
      ligne(doc, y, L, R, VERT);
      y += 9;

      const details = [
        ['Formule souscrite', `${PLAN_LABEL[paiement.plan] || paiement.plan || '—'} (${paiement.mois || 1} mois)`],
        ['Moyen de paiement', OP_LABEL[paiement.operateur] || OP_LABEL[paiement.canal] || '—'],
        ['Numéro payeur', paiement.telephone_payeur || '—'],
        ['Référence opérateur', paiement.transaction_ref || '—'],
        ['Référence interne', paiement.reference || '—'],
        ['Déclaré le', dateFr(paiement.cree_le, true)],
        ['Validé le', paiement.valide_le ? dateFr(paiement.valide_le, true) : '—'],
        ['Période couverte', `${dateFr(paiement.periode_debut)} au ${dateFr(paiement.periode_fin)}`],
        ['Canal', paiement.canal === 'cinetpay' ? 'Paiement en ligne (CinetPay)'
          : paiement.canal === 'paydunya' ? 'Paiement en ligne (PayDunya)'
            : 'Mobile Money / encaissement vérifié']
      ];

      const LIGNE_H = 19;
      details.forEach(([label, value], i) => {
        const rowY = y + i * LIGNE_H;
        if (i % 2 === 0) doc.rect(L, rowY - 3, W, LIGNE_H).fill('#fbfdfc');
        doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(label, L + 8, rowY, { width: 170 });
        doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(9.5).text(String(value), L + 190, rowY, { width: W - 200 });
      });
      y += details.length * LIGNE_H + 10;
      ligne(doc, y, L, R);

      /* ---------------- Total ---------------- */
      y += 8;
      doc.fillColor(GRIS).font('Helvetica').fontSize(10).text('TOTAL RÉGLÉ', L, y + 4);
      doc.fillColor(VERT_FONCE).font('Helvetica-Bold').fontSize(15)
        .text(money(paiement.montant, paiement.devise), L, y, { width: W, align: 'right' });

      /* ---------------- Mentions ---------------- */
      y += 40;
      doc.roundedRect(L, y, W, 66, 8).fillAndStroke('#fffdf6', '#f3e3bb');
      doc.fillColor('#8a5a05').font('Helvetica-Bold').fontSize(8.5).text('MENTION', L + 12, y + 10);
      doc.fillColor('#5c4a1e').font('Helvetica').fontSize(8.2).text(
        "Ce reçu atteste du règlement de l'abonnement à la plateforme Terminish École pour la période indiquée. "
        + "Il est généré automatiquement après vérification du paiement Mobile Money par l'éditeur. "
        + "Aucun remboursement n'est possible après activation, sauf erreur de notre part. "
        + "Conservez ce document : il vaut justificatif comptable.",
        L + 12, y + 22, { width: W - 24, align: 'justify', lineGap: 1.5 });

      /* ---------------- Pied de page ---------------- */
      const footY = 726;
      ligne(doc, footY, L, R, BORD);
      doc.fillColor(GRIS).font('Helvetica').fontSize(7.6).text(
        `${editeur.nom || 'Terminish École'} · ${editeur.ville || 'Lomé, Togo'}${editeur.telephone ? ' · ' + editeur.telephone : ''}`,
        L, footY + 7, { width: 330 });
      doc.fillColor(GRIS).fontSize(7.6).text(
        'Document généré électroniquement',
        L, footY + 19, { width: 330 });
      doc.fillColor(VERT).font('Helvetica-Bold').fontSize(7.6).text(
        `Vérification : ${paiement.reference || ''}`,
        L, footY + 31, { width: 330 });
      doc.fillColor(GRIS).font('Helvetica').fontSize(7.6).text(
        pageFooter(paiement), L, footY + 7, { width: W, align: 'right' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function pageFooter(p) {
  // Empreinte courte et stable, utile pour un contrôle manuel du document.
  const crypto = require('node:crypto');
  const base = `${p.reference}|${p.ecole_id}|${p.montant}|${p.plan}|${p.mois}|${p.cree_le}`;
  return 'Empreinte ' + crypto.createHash('sha256').update(base).digest('hex').slice(0, 16).toUpperCase();
}

module.exports = { genererRecuPDF };
