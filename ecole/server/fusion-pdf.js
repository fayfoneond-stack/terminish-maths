'use strict';
/**
 * Classement fusionné / proclamation d'examen blanc en PDF A4.
 * Produit les pages sur le serveur (PDFKit déjà utilisé pour les reçus),
 * sans réseau, sans logiciel à installer et sans modifier les notes.
 */
const PDFDocument = require('pdfkit');

const VERT = '#0b6b4a';
const FONCE = '#0b3d2e';
const OR = '#f0b429';
const ENCRE = '#10241c';
const GRIS = '#52675d';
const BORD = '#dbe6e0';
const CLAIR = '#f2f7f4';
const L = 44, R = 551, W = R - L, BAS = 783;

const texte = v => String(v ?? '').trim();
const note = v => v == null ? '—' : `${Number(v).toFixed(2).replace('.', ',')}/20`;
const nom = e => e ? `${texte(e.nom)} ${texte(e.prenom)}`.trim() : '—';
const dateFr = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

/** Colonnes alignées par identifiant de matière, jamais par ordre de classe. */
function notesEleveParMatiere(resultat, matieres) {
  const notes = new Map((resultat.lignes || []).map(l => [l.matiere_id, l.moyenne]));
  return matieres.map(m => notes.get(m.id) ?? null);
}

function logoData(logo) {
  if (typeof logo !== 'string' || logo.length > 3_000_000) return null;
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(logo.trim());
  return m ? Buffer.from(m[2], 'base64') : null;
}

/** @param {object} fusion Résultat de computeFusion, déjà filtré par école et affectation. */
function genererFusionPDF(fusion, { proclamation = false } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const etab = fusion.etablissement;
      const compo = fusion.stats.mode === 'composition' && !!fusion.periode;
      const titre = proclamation ? 'PROCLAMATION — EXAMEN BLANC'
        : fusion.examen ? 'RÉSULTATS — EXAMEN BLANC PROGRAMMÉ'
          : compo ? 'RÉSULTATS DES COMPOSITIONS' : 'RÉSULTATS FUSIONNÉS';
      const source = proclamation
        ? `Examen blanc proclamé à partir des compositions de ${texte(fusion.periode.libelle)}. Ce document n'utilise pas les épreuves d'un examen programmé.`
        : fusion.examen ? `Notes des épreuves de l'examen blanc programmé : ${texte(fusion.examen.nom)}.`
          : compo ? `Notes de composition seules — ${texte(fusion.periode.libelle)}. Devoirs exclus du calcul.`
            : `Toutes les notes de ${texte(fusion.periode?.libelle)} (devoirs et compositions).`;
      const doc = new PDFDocument({ size: 'A4', autoFirstPage: false, bufferPages: true, margin: 0,
        info: { Title: `${titre} — ${texte(etab.nom)}`, Author: texte(etab.nom) || 'Terminish École',
          Subject: source, Keywords: 'classement, fusion, résultats, compositions, examen blanc' } });
      const morceaux = [];
      doc.on('data', part => morceaux.push(part));
      doc.on('end', () => resolve(Buffer.concat(morceaux)));
      doc.on('error', reject);
      let y = 0;
      const logo = logoData(etab.logo);

      function nouvellePage(layout = 'portrait') {
        doc.addPage({ size: 'A4', layout });
        const largeur = doc.page.width;
        doc.rect(0, 0, largeur, 62).fill(FONCE);
        doc.rect(0, 62, largeur, 3).fill(OR);
        let imageOk = false;
        if (logo) {
          try { doc.image(logo, L, 12, { fit: [36, 36] }); imageOk = true; }
          catch { /* Le logo n'est pas au format PNG/JPEG attendu. */ }
        }
        if (!imageOk) {
          doc.roundedRect(L, 12, 36, 36, 7).fill(VERT);
          doc.fillColor(OR).font('Helvetica-Bold').fontSize(16)
            .text((texte(etab.nom) || 'É').charAt(0), L, 20, { width: 36, height: 22, align: 'center' });
        }
        const depart = L + 45;
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14)
          .text(texte(etab.nom) || 'Établissement', depart, 13, { width: largeur - L - depart, height: 21, ellipsis: true });
        doc.fillColor('#cfe5da').font('Helvetica').fontSize(9)
          .text(`Année scolaire ${texte(etab.annee_scolaire) || '—'}  ·  ${texte(etab.ville)}`, depart, 39,
            { width: largeur - L - depart, height: 14, ellipsis: true });
        y = 78;
      }
      function place(hauteur) { if (y + hauteur > BAS) nouvellePage(); }
      function paragraphe(s, { taille = 9.5, gras = false, couleur = ENCRE, espace = 7 } = {}) {
        doc.font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(taille);
        const hauteur = doc.heightOfString(texte(s), { width: W, lineGap: 2 });
        place(hauteur + espace);
        doc.fillColor(couleur).text(texte(s), L, y, { width: W, lineGap: 2 });
        y += hauteur + espace;
      }
      function section(s) {
        place(38);
        y += 7;
        doc.font('Helvetica-Bold').fontSize(12).fillColor(FONCE).text(s, L, y, { width: W });
        y += 20;
        doc.moveTo(L, y).lineTo(R, y).lineWidth(0.8).strokeColor(BORD).stroke();
        y += 8;
      }
      function tableau(entetes, largeurs, lignes) {
        function entete() {
          place(26);
          doc.rect(L, y, W, 23).fill(CLAIR);
          let x = L;
          entetes.forEach((val, i) => {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(FONCE)
              .text(val, x + 5, y + 6, { width: largeurs[i] - 10, height: 13, ellipsis: true });
            x += largeurs[i];
          });
          y += 23;
        }
        entete();
        for (const [index, ligne] of lignes.entries()) {
          const champs = ligne.map(cellule => texte(cellule).slice(0, 240));
          // Mesurer dans la MÊME police que celle qui sera dessinée : une matière
          // en gras peut occuper une ligne de plus qu'en police normale.
          const hauteur = Math.max(22, ...champs.map((cellule, i) => {
            doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
            return doc.heightOfString(cellule || '—', { width: largeurs[i] - 10, lineGap: 1 }) + 10;
          }));
          if (y + hauteur > BAS) { nouvellePage(); entete(); }
          if (index % 2 === 0) doc.rect(L, y, W, hauteur).fill('#f9fbfa');
          doc.moveTo(L, y + hauteur).lineTo(R, y + hauteur).lineWidth(0.4).strokeColor(BORD).stroke();
          let x = L;
          champs.forEach((cellule, i) => {
            doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(ENCRE)
              .text(cellule || '—', x + 5, y + 4, { width: largeurs[i] - 10, height: hauteur - 8, lineGap: 1 });
            x += largeurs[i];
          });
          y += hauteur;
        }
        y += 9;
      }
      /** 0–20, y compris les effectifs nuls. Trois lignes de 7 notes : lisible sur A4. */
      function repartition(libelle, lignes, precisions = '') {
        // Titre + 3 rangées de 7 notes restent ensemble : pas de 14–20 isolés
        // en haut d'une nouvelle page sans rappeler la matière.
        place(195);
        section(libelle);
        if (precisions) paragraphe(precisions, { taille: 8.5, couleur: GRIS, espace: 4 });
        const compte = new Map((lignes || []).map(r => [r.note, r.n]));
        const labelW = 66, caseW = (W - labelW) / 7;
        for (let depart = 0; depart <= 20; depart += 7) {
          place(38);
          doc.rect(L, y, W, 36).fill('#f9fbfa');
          doc.font('Helvetica-Bold').fontSize(8).fillColor(FONCE).text('Note', L + 5, y + 4, { width: labelW - 8 });
          doc.text('Élèves', L + 5, y + 20, { width: labelW - 8 });
          for (let j = 0; j < 7; j++) {
            const n = depart + j, x = L + labelW + j * caseW;
            doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(String(n), x, y + 4, { width: caseW, align: 'center' });
            doc.font('Helvetica-Bold').fontSize(9).fillColor(ENCRE)
              .text(String(compte.get(n) || 0), x, y + 20, { width: caseW, align: 'center' });
          }
          y += 39;
        }
        y += 5;
      }

      /**
       * Le classement imprimé contient désormais les matières DIRECTEMENT
       * sous l'identité de chaque élève. Le même bloc conserve rang, classe,
       * matricule, moyenne et mention ; les non-classés y figurent également.
       */
      function classementAvecMatieres(liste, titreSection) {
        if (!liste.length) return;
        // Réserver le titre, la légende et le premier élève pour éviter un
        // titre de classement isolé en bas de page.
        place(Math.min(600, 115 + Math.ceil(fusion.matieres.length / 2) * 23));
        section(titreSection);
        paragraphe('Sous chaque nom : note ou moyenne par matière (/20) selon la source choisie. — : non notée ou non enseignée.',
          { taille: 8.5, couleur: GRIS, espace: 6 });

        const entetes = ['Rang', 'Élève', 'Classe', 'Matricule', 'Moyenne', 'Mention'];
        const largeurs = [32, 170, 73, 72, 63, 97];
        const margeNotes = 8, separation = 14;
        const largeurNote = (W - 2 * margeNotes - separation) / 2;
        const largeurNomMatiere = largeurNote - 56;
        const grades = v => v == null ? '—' : Number(v).toFixed(2).replace('.', ',');

        function entete() {
          doc.rect(L, y, W, 23).fill(CLAIR);
          let x = L;
          entetes.forEach((val, i) => {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(FONCE)
              .text(val, x + 5, y + 6, { width: largeurs[i] - 10, height: 13 });
            x += largeurs[i];
          });
          y += 23;
        }
        entete();

        liste.forEach((r, index) => {
          const infos = [r.rang ?? '—', nom(r.eleve), texte(r.classe_nom),
            texte(r.eleve.matricule) || '—', note(r.moyenne), texte(r.mention) || '—'];
          // Conserver les noms utilisés dans la classe de l'élève (PCT au collège,
          // Physique-Chimie au lycée), même si une matière a deux noms dans la fusion.
          const nomsEleve = new Map((r.lignes || []).map(l => [l.matiere_id, l.nom]));
          const moyennes = notesEleveParMatiere(r, fusion.matieres);
          const matieres = fusion.matieres.map((m, i) => {
            const libelle = texte(nomsEleve.get(m.id) || m.nom);
            return { nom: /sciences de la vie et de la terre/i.test(libelle) && !/\bSVT\b/i.test(libelle)
              ? `SVT — ${libelle}` : libelle, valeur: grades(moyennes[i]) };
          });
          if (!matieres.length) matieres.push({ nom: 'Aucune matière configurée', valeur: '—' });
          const lignes = [];
          for (let i = 0; i < matieres.length; i += 2) lignes.push(matieres.slice(i, i + 2));
          const hauteurResume = Math.min(65, Math.max(28, ...infos.map((val, i) => {
            doc.font(i < 2 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.3);
            return Math.ceil(doc.heightOfString(val, { width: largeurs[i] - 10, lineGap: 1 }) + 8);
          })));
          const hauteurs = lignes.map(ligne => {
            doc.font('Helvetica').fontSize(8.2);
            return Math.min(48, Math.max(17, ...ligne.map(m =>
              Math.ceil(doc.heightOfString(m.nom, { width: largeurNomMatiere, lineGap: 1 }) + 4))));
          });
          let position = 0;
          while (position < lignes.length) {
            const totalRestant = hauteurResume + 10 + hauteurs.slice(position).reduce((a, v) => a + v, 0);
            // Si le bloc entier tient sur une nouvelle page, ne pas séparer
            // le nom de ses notes par une coupure de page.
            if (y + totalRestant > BAS && totalRestant <= BAS - 102) {
              nouvellePage();
              entete();
            }
            let disponibles = BAS - y - hauteurResume - 10;
            if (disponibles < hauteurs[position]) {
              nouvellePage();
              entete();
              disponibles = BAS - y - hauteurResume - 10;
            }
            let fin = position, hauteurNotes = 0;
            while (fin < lignes.length && hauteurNotes + hauteurs[fin] <= disponibles) {
              hauteurNotes += hauteurs[fin];
              fin++;
            }
            if (fin === position) throw new Error('Les notes d’un élève ne tiennent pas sur une page A4');
            const hauteur = hauteurResume + hauteurNotes + 10;
            if (index % 2 === 0) doc.rect(L, y, W, hauteur).fill('#f9fbfa');
            doc.rect(L, y, W, hauteurResume).fill(CLAIR);
            let x = L;
            infos.forEach((val, i) => {
              doc.font(i < 2 || i === 4 ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(8.3).fillColor(ENCRE)
                .text(val, x + 5, y + 5, { width: largeurs[i] - 10,
                  height: hauteurResume - 9, lineGap: 1, ellipsis: true });
              x += largeurs[i];
            });
            let yNote = y + hauteurResume + 4;
            for (let i = position; i < fin; i++) {
              lignes[i].forEach((m, j) => {
                const xNote = L + margeNotes + j * (largeurNote + separation);
                doc.font('Helvetica').fontSize(8.2).fillColor(ENCRE)
                  .text(m.nom, xNote, yNote + 2, { width: largeurNomMatiere,
                    height: hauteurs[i] - 4, lineGap: 1, ellipsis: true });
                doc.font('Helvetica-Bold').fontSize(8.2).fillColor(FONCE)
                  .text(m.valeur, xNote + largeurNomMatiere + 4, yNote + 2,
                    { width: largeurNote - largeurNomMatiere - 4,
                      height: hauteurs[i] - 4, align: 'right' });
              });
              yNote += hauteurs[i];
            }
            y += hauteur;
            doc.moveTo(L, y).lineTo(R, y).lineWidth(0.4).strokeColor(BORD).stroke();
            position = fin;
            if (position < lignes.length) { nouvellePage(); entete(); }
          }
        });
        y += 9;
      }

      nouvellePage();
      doc.font('Helvetica-Bold').fontSize(15).fillColor(FONCE).text(titre, L, y, { width: W });
      y = doc.y + 8;
      paragraphe(source, { taille: 10, gras: true, couleur: VERT });
      paragraphe(`Classes réunies : ${fusion.classes.map(c => c.nom).join(' · ')}`);
      paragraphe(`Établi le ${dateFr()} · ${fusion.classes.length} classe(s), ${fusion.stats.effectif_total} élève(s).`,
        { taille: 8.5, couleur: GRIS });
      paragraphe('Chaque élève a ses notes par matière directement sous son nom dans le classement ci-dessous.',
        { taille: 8.5, couleur: GRIS, espace: 6 });

      // Cartes récapitulatives : les dénominateurs des moyennes excluent les non-notés.
      place(72);
      const cartes = [
        ['Élèves réunis', fusion.stats.effectif_total],
        ['Élèves classés', fusion.classement.length],
        ['Moyenne du niveau', note(fusion.stats.moyenne)],
        ['Réussite', fusion.stats.taux_reussite == null ? '—' : `${String(fusion.stats.taux_reussite).replace('.', ',')} %`]
      ];
      const largeurCarte = (W - 24) / 4;
      cartes.forEach(([label, valeur], i) => {
        const x = L + i * (largeurCarte + 8);
        doc.roundedRect(x, y, largeurCarte, 60, 5).fill(i === 0 ? FONCE : CLAIR);
        doc.font('Helvetica').fontSize(8).fillColor(i === 0 ? '#d8eee3' : GRIS)
          .text(label, x + 8, y + 8, { width: largeurCarte - 16, height: 13 });
        doc.font('Helvetica-Bold').fontSize(13).fillColor(i === 0 ? '#ffffff' : FONCE)
          .text(String(valeur), x + 8, y + 29, { width: largeurCarte - 16, height: 22, ellipsis: true });
      });
      y += 71;
      const premier = fusion.classement[0];
      if (premier) paragraphe(`Premier de toutes les classes réunies : ${nom(premier.eleve)} (${premier.classe_nom}), ${note(premier.moyenne)}, rang ${premier.rang}/${fusion.classement.length}.`,
        { gras: true, couleur: FONCE });
      const maths = fusion.matieres.find(m => /math/i.test(m.nom));
      if (maths?.plus_faible) paragraphe(`Plus faible note en mathématiques : ${nom(maths.plus_faible)} (${maths.plus_faible.classe_nom}), ${note(maths.plus_faible.valeur)}.`,
        { couleur: GRIS });
      const sansMoyenne = fusion.resultats.filter(r => r.moyenne == null);
      const partiels = fusion.resultats.filter(r => r.moyenne != null && r.matieres_evaluees < r.matieres_total);
      if (sansMoyenne.length || partiels.length) {
        paragraphe(`Attention : ${sansMoyenne.length} élève(s) sans moyenne, ${partiels.length} avec des matières non évaluées. Les résultats incomplets doivent être vérifiés avant la proclamation.`,
          { couleur: '#9a5610', espace: 8 });
      }
      const catalogues = new Set(fusion.resultats.map(r =>
        (r.lignes || []).map(l => l.matiere_id).sort((a, b) => a - b).join(',')));
      if (catalogues.size > 1) paragraphe('Attention : les classes n’ont pas toutes les mêmes matières. Vérifiez que les moyennes sont comparables avant la proclamation.',
        { couleur: '#9a5610', espace: 8 });
      if (proclamation) paragraphe('Présentation comme examen blanc : ces résultats proviennent des compositions ; ce PDF ne crée pas un examen programmé et ne change aucune note.',
        { taille: 8.5, couleur: GRIS });

      classementAvecMatieres(fusion.classement, 'Classement général — rang commun aux classes réunies');
      classementAvecMatieres(sansMoyenne, 'Élèves non classés — aucune moyenne disponible');
      if (fusion.par_classe.length > 1) {
        section('Repères par classe');
        tableau(['Classe', 'Effectif', 'Moyenne', 'Premier de la classe', 'Rang global'],
          [100, 63, 76, 190, 78], fusion.par_classe.map(c => [c.nom, c.effectif,
            note(c.stats.moyenne), c.premier?.nom || '—', c.premier?.rang || '—']));
      }
      section('Meilleure et plus faible note par matière');
      tableau(['Matière', 'Meilleure (élève, classe)', 'Plus faible (élève, classe)'], [133, 187, 187],
        fusion.matieres.map(m => [m.nom,
          m.meilleur ? `${note(m.meilleur.valeur)} — ${nom(m.meilleur)} (${m.meilleur.classe_nom})` : '—',
          m.plus_faible ? `${note(m.plus_faible.valeur)} — ${nom(m.plus_faible)} (${m.plus_faible.classe_nom})` : '—']));

      repartition('Répartition des moyennes générales', fusion.stats.repartition,
        `Moyennes arrondies à l'entier le plus proche ; ${fusion.classement.length} élève(s) classé(s).`);
      // Pour la proclamation, on imprime l'essentiel : classement, bilan par
      // matière et répartition des moyennes + mathématiques. Le PDF ordinaire
      // est le rapport détaillé, avec la répartition de TOUTES les matières.
      (proclamation ? (maths ? [maths] : []) : fusion.matieres).forEach(m =>
        repartition(`Notes sur 20 — ${m.nom}`, m.repartition,
          `${m.notees} note(s) calculée(s), ${m.non_notes} élève(s) non noté(s). Arrondies à l'entier le plus proche.`));

      section('Visa de la direction');
      paragraphe(`Fait à ${texte(etab.ville) || '________________'}, le ${dateFr()}`, { couleur: GRIS });
      place(64);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(FONCE)
        .text(texte(etab.chef_titre) || "Le Chef d'Établissement", L + 274, y, { width: 230, align: 'center' });
      y += 37;
      doc.moveTo(L + 304, y).lineTo(R - 30, y).lineWidth(0.8).strokeColor(BORD).stroke();
      y += 4;
      doc.font('Helvetica').fontSize(9).fillColor(GRIS)
        .text(texte(etab.chef_nom) || 'Signature de la direction', L + 274, y, { width: 230, align: 'center' });

      // Ajouter les numéros de page seulement quand le total est connu.
      const pages = doc.bufferedPageRange();
      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);
        const droite = doc.page.width - L;
        const ligneY = doc.page.height - 37;
        doc.moveTo(L, ligneY).lineTo(droite, ligneY).lineWidth(0.6).strokeColor(BORD).stroke();
        doc.font('Helvetica').fontSize(8).fillColor(GRIS)
          .text(`${texte(etab.nom)} · ${dateFr()} · Calcul sans modification des notes`, L, ligneY + 6,
            { width: droite - L - 80, height: 12 });
        doc.text(`Page ${i - pages.start + 1} / ${pages.count}`, droite - 75, ligneY + 6,
          { width: 75, height: 12, align: 'right' });
      }
      doc.end();
    } catch (err) { reject(err); }
  });
}

module.exports = { genererFusionPDF, notesEleveParMatiere };
