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
          .text(`Année scolaire ${texte((fusion.periode || fusion.examen)?.annee_scolaire || etab.annee_scolaire) || '—'}  ·  ${texte(etab.ville)}`, depart, 39,
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
       * Tableau principal comme le relevé d'examen : une ligne par élève,
       * matières en COLONNES, rang commun et moyenne dans la même ligne.
       * Chaque groupe de 8 matières répète les élèves si le niveau en a plus.
       */
      function tableauClassementPaysage() {
        const matieres = fusion.matieres;
        const idsClasses = new Set(fusion.classement.map(r => r.eleve.id));
        const nonClasses = fusion.resultats.filter(r => !idsClasses.has(r.eleve.id))
          .sort((a, b) => nom(a.eleve).localeCompare(nom(b.eleve), 'fr'));
        const eleves = [...fusion.classement, ...nonClasses];
        const codesUtilises = new Set();
        const codes = matieres.map((m, i) => {
          let code = texte(m.code).toUpperCase().slice(0, 7) || `M${i + 1}`;
          if (codesUtilises.has(code)) {
            const base = `M${i + 1}`;
            code = base;
            let suffixe = 2;
            while (codesUtilises.has(code)) code = `${base}-${suffixe++}`;
          }
          codesUtilises.add(code);
          return code;
        });
        const format = v => v == null ? '—' : Number(v).toFixed(2).replace('.', ',');
        const marge = 28, parGroupe = 8;
        const totalGroupes = Math.max(1, Math.ceil(matieres.length / parGroupe));

        for (let groupe = 0; groupe < totalGroupes; groupe++) {
          const debut = groupe * parGroupe;
          const selection = matieres.slice(debut, debut + parGroupe);
          let position = 0;
          do {
            nouvellePage('landscape');
            const largeur = doc.page.width - 2 * marge;
            const bas = doc.page.height - 54;
            const largeurFixe = 28 + 61 + 138 + 58 + 44 + 52 + 54 + 73;
            const largeurMatiere = selection.length
              ? Math.min(50, (largeur - largeurFixe) / selection.length) : 0;
            const largeurNom = 138 + largeur - largeurFixe - selection.length * largeurMatiere;
            const colonnes = [28, 61, largeurNom, 58, ...selection.map(() => largeurMatiere), 44, 52, 54, 73];
            let basDeLigne = 78;

            doc.font('Helvetica-Bold').fontSize(14).fillColor(FONCE)
              .text(`${titre} — CLASSEMENT PAR MATIÈRE`, marge, basDeLigne,
                { width: largeur, height: 19, ellipsis: true });
            basDeLigne += 23;
            doc.font('Helvetica').fontSize(8.5).fillColor(GRIS);
            const sourceH = doc.heightOfString(source, { width: largeur, lineGap: 1 });
            doc.text(source, marge, basDeLigne, { width: largeur, lineGap: 1 });
            basDeLigne += sourceH + 5;
            const classes = `Classes réunies : ${fusion.classes.map(c => c.nom).join(' · ')}  ·  ${fusion.stats.effectif_total} élève(s)  ·  ${fusion.classement.length} classé(s)`;
            doc.font('Helvetica').fontSize(8.5).fillColor(ENCRE);
            const classesH = doc.heightOfString(classes, { width: largeur });
            doc.text(classes, marge, basDeLigne, { width: largeur });
            basDeLigne += classesH + 8;
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(VERT)
              .text(`Notes /20 · ${matieres.length
                ? `matières ${debut + 1} à ${debut + selection.length} sur ${matieres.length}`
                : 'aucune matière configurée'}`
                + (totalGroupes > 1 ? ` · groupe ${groupe + 1}/${totalGroupes} (élèves répétés)` : '')
                + ' · rang commun aux classes réunies', marge, basDeLigne, { width: largeur });
            basDeLigne += 17;

            // Codes en en-tête, noms complets ici : Math, SVT, etc. ne peuvent
            // jamais être confondus avec une autre matière lors de l'impression.
            const legendeW = (largeur - 16) / 2;
            for (let i = 0; i < selection.length; i += 2) {
              const noms = [0, 1].map(j => selection[i + j]
                ? `${codes[debut + i + j]} : ${selection[i + j].nom}`
                  + (selection[i + j].coefficients?.length
                    ? ` (coef. ${selection[i + j].coefficients.join('/')})` : '') : '');
              doc.font('Helvetica').fontSize(7.8).fillColor(ENCRE);
              const hauteur = Math.max(11, ...noms.map(v => v
                ? doc.heightOfString(v, { width: legendeW, lineGap: 1 }) : 0));
              noms.forEach((label, j) => {
                if (label) doc.text(label, marge + j * (legendeW + 16), basDeLigne,
                  { width: legendeW, height: hauteur, lineGap: 1 });
              });
              basDeLigne += hauteur + 3;
            }
            basDeLigne += 7;

            const hauteurEntete = 30;
            doc.rect(marge, basDeLigne, largeur, hauteurEntete).fill(FONCE);
            const entetes = ['Rang', 'Matricule', 'Nom et prénom(s)', 'Classe',
              ...selection.map((_, i) => codes[debut + i]), 'Total coef.', 'Points', 'Moyenne', 'Mention'];
            let x = marge;
            entetes.forEach((libelle, i) => {
              doc.font('Helvetica-Bold').fontSize(7.3).fillColor('#ffffff')
                .text(libelle, x + 2, basDeLigne + 6, { width: colonnes[i] - 4, height: 19,
                  align: i === 2 || i === 3 ? 'left' : 'center', ellipsis: true });
              if (i >= 4 && i < 4 + selection.length) {
                const coefficients = selection[i - 4].coefficients || [];
                if (coefficients.length) doc.font('Helvetica').fontSize(6.3).fillColor('#cfe5da')
                  .text(`×${coefficients.join('/')}`, x + 2, basDeLigne + 18,
                    { width: colonnes[i] - 4, height: 10, align: 'center', ellipsis: true });
              }
              x += colonnes[i];
            });
            basDeLigne += hauteurEntete;
            const premier = position;
            while (position < eleves.length) {
              const r = eleves[position];
              doc.font('Helvetica').fontSize(8);
              const hauteur = Math.min(45, Math.max(21,
                doc.heightOfString(nom(r.eleve), { width: largeurNom - 6, lineGap: 1 }) + 6,
                doc.heightOfString(texte(r.classe_nom), { width: 52, lineGap: 1 }) + 6));
              const separationNonClasses = position === fusion.classement.length && nonClasses.length ? 19 : 0;
              if (basDeLigne + separationNonClasses + hauteur > bas) break;
              if (separationNonClasses) {
                doc.rect(marge, basDeLigne, largeur, separationNonClasses).fill(CLAIR);
                doc.font('Helvetica-Bold').fontSize(8).fillColor(FONCE)
                  .text('ÉLÈVES NON CLASSÉS — AUCUNE MOYENNE DISPONIBLE', marge + 6,
                    basDeLigne + 5, { width: largeur - 12 });
                basDeLigne += separationNonClasses;
              }
              if (position % 2 === 0) doc.rect(marge, basDeLigne, largeur, hauteur).fill('#f9fbfa');
              doc.moveTo(marge, basDeLigne + hauteur).lineTo(marge + largeur, basDeLigne + hauteur)
                .lineWidth(0.4).strokeColor(BORD).stroke();
              const chiffres = notesEleveParMatiere(r, selection);
              const cellules = [r.rang ?? '—', r.eleve.matricule || '—', nom(r.eleve),
                texte(r.classe_nom), ...chiffres.map(format),
                r.moyenne == null ? '—' : format(r.total_coef),
                r.moyenne == null ? '—' : format(r.total_points),
                format(r.moyenne), r.mention || '—'];
              x = marge;
              cellules.forEach((val, i) => {
                const noteMatiere = i >= 4 && i < 4 + selection.length;
                const color = noteMatiere && chiffres[i - 4] != null
                  ? (chiffres[i - 4] < 10 ? '#b42318' : VERT) : ENCRE;
                doc.font(i === 0 || i === 2 || i >= 4 + selection.length ? 'Helvetica-Bold' : 'Helvetica')
                  .fontSize(7.8).fillColor(color)
                  .text(texte(val), x + 3, basDeLigne + 4,
                    { width: colonnes[i] - 6, height: hauteur - 7,
                      align: i === 2 || i === 3 ? 'left' : 'center', lineGap: 1, ellipsis: true });
                x += colonnes[i];
              });
              basDeLigne += hauteur;
              position++;
            }
            if (eleves.length && position === premier) throw new Error('Aucune ligne élève ne tient sur la page A4 paysage');
            if (!eleves.length) doc.font('Helvetica').fontSize(9).fillColor(GRIS)
              .text('Aucun élève inscrit dans les classes choisies.', marge, basDeLigne + 12,
                { width: largeur, align: 'center' });
            if (basDeLigne + 14 < bas) doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
              .text('— : note absente ou matière non enseignée. Les moyennes et rangs ne sont pas modifiés.',
                marge, basDeLigne + 5, { width: largeur, height: 11 });
          } while (position < eleves.length);
        }
      }

      tableauClassementPaysage();
      nouvellePage();
      doc.font('Helvetica-Bold').fontSize(15).fillColor(FONCE).text(titre, L, y, { width: W });
      y = doc.y + 8;
      paragraphe(source, { taille: 10, gras: true, couleur: VERT });
      paragraphe(`Classes réunies : ${fusion.classes.map(c => c.nom).join(' · ')}`);
      paragraphe(`Établi le ${dateFr()} · ${fusion.classes.length} classe(s), ${fusion.stats.effectif_total} élève(s).`,
        { taille: 8.5, couleur: GRIS });
      paragraphe('Le classement et les notes de chaque élève figurent en colonnes sur les premières pages A4 paysage.',
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
