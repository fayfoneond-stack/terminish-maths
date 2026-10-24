'use strict';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
const dateFr = (d) => {
  if (!d) return new Date().toLocaleDateString('fr-FR');
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const CSS = `
@page { size: A4; margin: 8mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #10241c; margin: 0; background: #eef2f0; font-size: 10.5px; }
.page { width: 194mm; min-height: 281mm; margin: 0 auto 6mm; background: #fff; padding: 7mm 8mm; position: relative; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.head { display: flex; align-items: center; gap: 10px; border-bottom: 2.5px solid #0b6b4a; padding-bottom: 7px; }
.head .logo { width: 62px; height: 62px; object-fit: contain; flex: 0 0 62px; }
.head .logo-ph { width: 62px; height: 62px; border-radius: 50%; border: 2px dashed #0b6b4a; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #0b6b4a; font-size: 18px; }
.head .ecole { flex: 1; }
.head h1 { margin: 0; font-size: 15px; color: #0b3d2e; letter-spacing: .2px; text-transform: uppercase; }
.head .meta { font-size: 9px; color: #4b6459; margin-top: 2px; line-height: 1.35; }
.head .ministry { font-size: 8.5px; color: #6b7d74; text-transform: uppercase; letter-spacing: .6px; }
.badge-annee { text-align: right; font-size: 9px; color: #0b3d2e; }
.badge-annee strong { display: block; font-size: 12px; }
.title { text-align: center; margin: 9px 0 7px; }
.title h2 { margin: 0; display: inline-block; background: linear-gradient(90deg, #0b6b4a, #1f9d6b); color: #fff; padding: 5px 26px; border-radius: 999px; font-size: 12.5px; letter-spacing: 1.6px; text-transform: uppercase; }
.title .sub { font-size: 9px; color: #6b7d74; margin-top: 4px; letter-spacing: .6px; }
.ident { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 14px; border: 1px solid #d5e2dc; border-radius: 6px; padding: 7px 10px; background: #f7faf8; margin-bottom: 8px; font-size: 9.8px; }
.ident span.k { color: #6b7d74; }
.ident span.v { font-weight: 700; color: #10241c; }
table.notes { width: 100%; border-collapse: collapse; font-size: 9.2px; }
table.notes th { background: #0b3d2e; color: #fff; font-weight: 600; padding: 4px 3px; font-size: 8.4px; text-transform: uppercase; letter-spacing: .3px; border: 1px solid #0b3d2e; }
table.notes td { border: 1px solid #d5e2dc; padding: 3px 4px; text-align: center; }
table.notes td.mat { text-align: left; font-weight: 600; }
table.notes tbody tr:nth-child(even) td { background: #f7faf8; }
table.notes tfoot td { background: #0b3d2e; color: #fff; font-weight: 700; padding: 4px; border-color: #0b3d2e; }
.moy { font-weight: 800; }
.ok { color: #0b6b4a; } .warn { color: #b45309; } .bad { color: #b91c1c; }
.grid-bas { display: grid; grid-template-columns: 1.15fr 1fr; gap: 8px; margin-top: 8px; }
.card { border: 1px solid #d5e2dc; border-radius: 6px; padding: 7px 9px; }
.card h3 { margin: 0 0 5px; font-size: 9px; text-transform: uppercase; letter-spacing: .7px; color: #0b3d2e; border-bottom: 1px solid #e3ece8; padding-bottom: 3px; }
.kv { display: flex; justify-content: space-between; font-size: 9.3px; padding: 1.6px 0; }
.kv strong { color: #10241c; }
.rang-big { display: flex; align-items: center; gap: 10px; }
.rang-big .n { font-size: 26px; font-weight: 800; color: #0b6b4a; line-height: 1; }
.rang-big .n small { font-size: 10px; color: #6b7d74; font-weight: 600; }
.mention { display: inline-block; padding: 2px 10px; border-radius: 999px; background: #e8f5ef; color: #0b6b4a; font-weight: 700; font-size: 10px; border: 1px solid #bfe0d1; }
.appr { background: #f7faf8; border-left: 3px solid #f0b429; padding: 5px 8px; font-style: italic; color: #334b41; font-size: 9.4px; border-radius: 0 4px 4px 0; min-height: 30px; }
table.notes td .prof { font-size: 7.4px; font-weight: 500; color: #6b7d74; font-style: italic; line-height: 1.15; }
.sign { display: flex; justify-content: space-around; align-items: flex-end; margin-top: 10px; font-size: 9px; color: #4b6459; }
.sign .sign-b { width: 40%; text-align: center; }
.sign .role { font-size: 8.4px; text-transform: uppercase; letter-spacing: .4px; color: #0b3d2e; font-weight: 700; }
.sign .sig { display: block; margin: 2px auto 0; max-height: 34px; max-width: 130px; object-fit: contain; }
.sign .sig-vide { height: 34px; border-bottom: 1px dotted #b9c9c2; margin: 2px 12px 0; }
.sign .nom { border-top: 1px solid #b9c9c2; margin-top: 2px; padding-top: 2px; font-weight: 700; color: #10241c; font-size: 8.6px; }
.foot { position: absolute; bottom: 6mm; left: 8mm; right: 8mm; border-top: 1px solid #e3ece8; padding-top: 3px; display: flex; justify-content: space-between; font-size: 7.6px; color: #8a9c94; }
.watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; opacity: .045; font-size: 70px; font-weight: 900; transform: rotate(-28deg); color: #0b3d2e; letter-spacing: 4px; }
.noprint { text-align: center; padding: 8px; }
.noprint button { background: #0b6b4a; color: #fff; border: 0; padding: 9px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; }
@media print { body { background: #fff; } .noprint { display: none; } .page { margin: 0; width: auto; min-height: auto; padding: 0; } }
`;

function noteCell(v) {
  if (v == null) return '<td>—</td>';
  const cls = v < 10 ? 'bad' : v < 12 ? 'warn' : 'ok';
  return `<td class="moy ${cls}">${fmt(v)}</td>`;
}

function renderBulletin({ promo, ligne, bulletin, eleve, professeurs = {}, principal = null, chef = null }) {
  const etab = promo.etablissement;
  const periode = promo.periode;
  const classe = promo.classe;
  const stat = promo.stats;
  const evals = promo.resultats[0] && promo.resultats[0].lignes[0] ? Object.keys(promo.resultats[0].lignes[0].detail || {}) : [];
  const hasDevoir2 = evals.includes('devoir2');
  // Bulletin « composition seule » : on n'imprime que la composition.
  const modeComposition = promo.scope && promo.scope.mode === 'composition';

  const rows = ligne.lignes.map(l => {
    const prof = professeurs[l.matiere_id] || professeurs[l.id] || null;
    return `
    <tr>
      <td class="mat">${esc(l.nom)}${prof ? `<div class="prof">${esc(prof.nom)}</div>` : ''}</td>
      ${modeComposition ? '' : noteCell(l.detail.devoir1)}
      ${modeComposition ? '' : (hasDevoir2 ? noteCell(l.detail.devoir2) : '<td>—</td>')}
      ${noteCell(l.detail.composition)}
      ${noteCell(l.moyenne)}
      <td>${l.coefficient}</td>
      <td>${fmt(l.points)}</td>
      <td>${l.rang ?? '—'}</td>
      <td style="text-align:left;font-size:8.4px">${esc(l.appreciation)}</td>
    </tr>`;
  }).join('');

  // En-tête officiel (ministère, tutelle, région, devise de l'école…) :
  // chaque établissement écrit ce qu'il veut dans Réglages → Identité.
  //   valeur saisie → affichée telle quelle
  //   champ vidé    → aucune ligne
  //   jamais touché → phrase par défaut ci-dessous
  const tutelle = etab.tutelle == null
    ? 'République Togolaise · Ministère des Enseignements'
    : String(etab.tutelle).trim();

  const rangTxt = ligne.rang ? `${ligne.rang}<small>/${promo.resultats.length}</small>` : '—';
  const decision = (bulletin && bulletin.decision) || (ligne.moyenne != null && ligne.moyenne >= 10 ? 'Admis(e)' : ligne.moyenne != null ? 'Doit se rattraper' : '');

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>Bulletin ${esc(eleve.nom)} ${esc(eleve.prenom)} — ${esc(periode.libelle)}</title>
<style>${CSS}</style></head>
<body>
<div class="noprint"><button onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button></div>
<div class="page">
  <div class="watermark">${esc(etab.nom)}</div>
  <div class="head">
    ${(etab.logo_url || etab.logo) ? `<img class="logo" src="${etab.logo_url || etab.logo}" alt="logo">` : `<div class="logo-ph">${esc((etab.nom || 'E').slice(0, 1))}</div>`}
    <div class="ecole">
      ${tutelle ? `<div class="ministry">${esc(tutelle)}</div>` : ''}
      <h1>${esc(etab.nom)}</h1>
      <div class="meta">
        ${etab.adresse ? esc(etab.adresse) + ' — ' : ''}${etab.ville ? esc(etab.ville) : ''}${etab.bp ? ' · ' + esc(etab.bp) : ''}<br>
        ${etab.telephone ? 'Tél. ' + esc(etab.telephone) : ''}${etab.email ? ' · ' + esc(etab.email) : ''}
      </div>
    </div>
    <div class="badge-annee">Année scolaire<strong>${esc(etab.annee_scolaire)}</strong></div>
  </div>

  <div class="title">
    <h2>${modeComposition ? 'Bulletin de composition' : 'Bulletin de notes'} — ${esc(periode.libelle)}</h2>
    <div class="sub">${classe.cycle === 'college' ? 'Enseignement secondaire général — Collège' : 'Enseignement secondaire général — Lycée'} · Série ${esc(classe.serie || '—')}${modeComposition ? ' · <b>Moyennes calculées sur la composition</b>' : ''}</div>
  </div>

  <div class="ident">
    <div><span class="k">Nom &amp; prénom(s) :</span> <span class="v">${esc(eleve.nom)} ${esc(eleve.prenom)}</span></div>
    <div><span class="k">Matricule :</span> <span class="v">${esc(eleve.matricule)}</span></div>
    <div><span class="k">Classe :</span> <span class="v">${esc(classe.nom)}</span></div>
    <div><span class="k">Sexe :</span> <span class="v">${eleve.sexe === 'F' ? 'Féminin' : 'Masculin'}</span></div>
    <div><span class="k">Né(e) le :</span> <span class="v">${esc(dateFr(eleve.date_naissance))}</span></div>
    <div><span class="k">À :</span> <span class="v">${esc(eleve.lieu_naissance || '—')}</span></div>
    <div><span class="k">Effectif de la classe :</span> <span class="v">${stat.effectif_classe}</span></div>
    <div><span class="k">Professeur titulaire :</span> <span class="v">${esc((principal && principal.nom) || '—')}</span></div>
  </div>

  <table class="notes">
    <thead>
      <tr>
        <th style="width:27%">Matières</th>
        ${modeComposition ? '' : '<th>Devoir 1</th><th>Devoir 2</th>'}
        <th>Composition</th>
        <th>Moyenne</th><th>Coef.</th><th>Moy. × Coef.</th><th>Rang</th>
        <th style="width:17%">Appréciation</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="${modeComposition ? 2 : 4}" style="text-align:right">TOTAUX</td>
        <td>${fmt(ligne.moyenne)}</td>
        <td>${fmt(ligne.total_coef)}</td>
        <td>${fmt(ligne.total_points)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  <div class="grid-bas">
    <div class="card">
      <h3>Résultats et positionnement</h3>
      <div class="rang-big">
        <div class="n">${rangTxt}</div>
        <div>
          <div style="font-size:9px;color:#6b7d74">Rang dans la classe${modeComposition ? ' (composition)' : ''}</div>
          <div class="mention">Mention : ${esc(ligne.mention)}</div>
        </div>
      </div>
      <div class="kv" style="margin-top:5px"><span>Moyenne générale de l'élève</span><strong>${fmt(ligne.moyenne)} / 20</strong></div>
      ${!modeComposition && ligne.moyenne_composition != null ? `<div class="kv"><span>Moyenne de composition</span><strong>${fmt(ligne.moyenne_composition)} / 20</strong></div>` : ''}
      <div class="kv"><span>Moyenne de la classe</span><strong>${fmt(stat.moyenne)} / 20</strong></div>
      <div class="kv"><span>Plus forte moyenne</span><strong>${fmt(stat.max)} / 20</strong></div>
      <div class="kv"><span>Plus faible moyenne</span><strong>${fmt(stat.min)} / 20</strong></div>
      <div class="kv"><span>Élèves ayant la moyenne (≥ 10)</span><strong>${stat.taux_reussite ?? 0} %</strong></div>
      <div class="kv"><span>Décision du conseil</span><strong>${esc(decision)}</strong></div>
    </div>
    <div class="card">
      <h3>Appréciation générale du conseil de classe</h3>
      <div class="appr">${esc((bulletin && bulletin.appreciation) || defaultAppreciation(ligne.moyenne, ligne.rang, promo.resultats.length))}</div>
      <div style="margin-top:7px;font-size:8.6px;color:#6b7d74;line-height:1.5">
        Moyenne de la classe : <strong>${fmt(stat.moyenne)}</strong> · Écart-type : <strong>${fmt(stat.ecart_type)}</strong><br>
        Médiane : <strong>${fmt(stat.mediane)}</strong> · Taux de réussite : <strong>${stat.taux_reussite ?? 0} %</strong>
      </div>
    </div>
  </div>

  <div class="sign">
    <div class="sign-b">
      <div class="role">Le Professeur titulaire</div>
      ${principal && principal.signature
        ? `<img class="sig" src="${esc(principal.signature)}" alt="signature">`
        : '<div class="sig-vide">signature</div>'}
      <div class="nom">${esc((principal && principal.nom) || '____________________')}</div>
    </div>
    <div class="sign-b">
      <div class="role">${esc((chef && chef.titre) || "Le Chef d'Établissement")}</div>
      ${chef && chef.signature
        ? `<img class="sig" src="${esc(chef.signature)}" alt="signature">`
        : '<div class="sig-vide">signature</div>'}
      <div class="nom">${esc((chef && chef.nom) || '____________________')}</div>
    </div>
  </div>

  <div class="foot">
    <span>${esc(etab.nom)} · ${esc(etab.ville || '')} · Bulletin généré le ${dateFr(new Date())}</span>
    <span>Terminish École — Plateforme de gestion scolaire</span>
  </div>
</div>
</body></html>`;
}

function defaultAppreciation(moy, rang, effectif) {
  if (moy == null) return "Élève non évalué pour cette période : aucune note n'a été enregistrée.";
  const position = rang && effectif ? `Il/elle occupe la ${rang}ᵉ place sur ${effectif} élèves. ` : '';
  if (moy >= 16) return `Excellent trimestre, travail remarquable et régulier. ${position}Continuez ainsi !`;
  if (moy >= 14) return `Bon ensemble, résultats solides. ${position}Un effort supplémentaire dans les matières faibles permettra de viser l'excellence.`;
  if (moy >= 12) return `Trimestre satisfaisant. ${position}Le travail est régulier mais doit être approfondi.`;
  if (moy >= 10) return `Résultats passables. ${position}Des efforts plus soutenus sont attendus, notamment dans les matières à fort coefficient.`;
  return `Résultats insuffisants ce trimestre. ${position}Un travail sérieux et un suivi rapproché sont indispensables.`;
}

function renderBulletinBatch(list, periode) {
  if (!list.length) return '<p style="font-family:sans-serif;padding:20px">Aucun élève dans cette classe.</p>';
  const pages = list.map((b, i) => {
    const html = renderBulletin(b);
    const body = html.split('<body>')[1].split('</body>')[0].replace(/<div class="noprint">[\s\S]*?<\/div>/, '');
    return body.replace('<div class="page">', `<div class="page" style="${i > 0 ? 'page-break-before:always;' : ''}">`);
  }).join('\n');
  const etab = list[0].promo.etablissement;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Bulletins ${esc(periode.libelle)} — ${esc(etab.nom)}</title><style>${CSS}</style></head>
<body><div class="noprint"><button onclick="window.print()">🖨️ Imprimer toute la classe (${list.length} bulletins)</button></div>
${pages}</body></html>`;
}

const CSS_EXAM = `
@page { size: A4 landscape; margin: 8mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #10241c; margin: 0; background: #eef2f0; font-size: 9.5px; }
.page { width: 281mm; min-height: 194mm; margin: 0 auto; background: #fff; padding: 6mm 7mm; position: relative; }
.head { display: flex; align-items: center; gap: 10px; border-bottom: 2.5px solid #0b6b4a; padding-bottom: 6px; }
.head img { width: 52px; height: 52px; object-fit: contain; }
.head .ph { width: 52px; height: 52px; border-radius: 50%; background: #0b6b4a; color: #f0b429; display: grid; place-items: center; font-weight: 800; font-size: 18px; }
.head h1 { margin: 0; font-size: 14px; color: #0b3d2e; text-transform: uppercase; }
.head .meta { font-size: 8.5px; color: #4b6459; }
.head .right { margin-left: auto; text-align: right; font-size: 8.5px; color: #4b6459; }
.title { text-align: center; margin: 8px 0 8px; }
.title h2 { display: inline-block; margin: 0; background: #0b6b4a; color: #fff; border-radius: 999px; padding: 4px 22px; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; }
.title .sub { font-size: 8.5px; color: #6b7d74; margin-top: 3px; }
table { width: 100%; border-collapse: collapse; font-size: 8.2px; }
th { background: #0b3d2e; color: #fff; padding: 4px 3px; border: 1px solid #0b3d2e; font-size: 7.6px; text-transform: uppercase; letter-spacing: .2px; }
td { border: 1px solid #d5e2dc; padding: 3px; text-align: center; }
td.nom { text-align: left; font-weight: 600; white-space: nowrap; }
tbody tr:nth-child(even) td { background: #f7faf8; }
tfoot td { background: #0b3d2e; color: #fff; font-weight: 700; border-color: #0b3d2e; }
.bad { color: #b91c1c; } .ok { color: #0b6b4a; font-weight: 700; }
.foot { display: flex; justify-content: space-between; margin-top: 8px; font-size: 7.6px; color: #8a9c94; }
.noprint { text-align: center; padding: 8px; }
.noprint button { background: #0b6b4a; color: #fff; border: 0; padding: 9px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; }
@media print { body { background: #fff; } .noprint { display: none; } .page { width: auto; min-height: auto; margin: 0; padding: 0; } }
`;

function renderExamen(promo) {
  const etab = promo.etablissement;
  const classe = promo.classe;
  const examen = promo.examen;
  const matieres = promo.matieres;
  const coefs = promo.resultats[0] ? promo.resultats[0].lignes.map(l => l.coefficient) : matieres.map(m => m.coefficient);
  const eleves = promo.resultats.slice().sort((a, b) => (a.rang || 999) - (b.rang || 999));
  const entete = matieres.map((m, i) => `<th title="${esc(m.nom)}">${esc((m.code || m.nom).slice(0, 7))}<br><span style="font-weight:400">×${coefs[i]}</span></th>`).join('');
  const lignes = eleves.map(r => `
    <tr>
      <td><b>${r.rang ?? '—'}</b></td>
      <td>${esc(r.eleve.matricule)}</td>
      <td class="nom">${esc(r.eleve.nom)} ${esc(r.eleve.prenom)}</td>
      ${r.lignes.map(l => `<td class="${l.moyenne != null && l.moyenne < 10 ? 'bad' : 'ok'}">${fmt(l.moyenne)}</td>`).join('')}
      <td><b>${fmt(r.total_coef, 0)}</b></td>
      <td><b>${fmt(r.total_points)}</b></td>
      <td><b>${fmt(r.moyenne)}</b></td>
      <td>${esc(r.mention)}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
  <title>Relevé ${esc(examen.nom)} — ${esc(classe.nom)}</title><style>${CSS_EXAM}</style></head><body>
  <div class="noprint"><button onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button></div>
  <div class="page">
    <div class="head">
      ${(etab.logo_url || etab.logo) ? `<img src="${etab.logo_url || etab.logo}" alt="logo">` : `<div class="ph">${esc((etab.nom || 'E').slice(0, 1))}</div>`}
      <div><h1>${esc(etab.nom)}</h1>
        <div class="meta">${esc(etab.ville || '')}${etab.telephone ? ' · Tél. ' + esc(etab.telephone) : ''} · Année ${esc(etab.annee_scolaire)}</div></div>
      <div class="right">Classe : <b>${esc(classe.nom)}</b><br>Effectif : <b>${promo.resultats.length}</b><br>Moyenne de classe : <b>${fmt(promo.stats.moyenne)}</b></div>
    </div>
    <div class="title"><h2>Relevé de résultats — ${esc(examen.nom)}</h2>
      <div class="sub">${examen.date_debut ? 'Épreuves du ' + dateFr(examen.date_debut) : ''}${examen.date_fin && examen.date_fin !== examen.date_debut ? ' au ' + dateFr(examen.date_fin) : ''} · ${examen.statut === 'termine' ? 'Résultats définitifs' : 'Résultats provisoires'}</div></div>
    <table>
      <thead><tr><th>Rang</th><th>Matricule</th><th style="width:150px">Nom &amp; prénom(s)</th>${entete}<th>Total coef.</th><th>Total points</th><th>Moyenne</th><th>Mention</th></tr></thead>
      <tbody>${lignes}</tbody>
      <tfoot><tr><td colspan="3" style="text-align:right">MOYENNE DE LA CLASSE</td><td colspan="${matieres.length}"></td><td colspan="2"></td><td>${fmt(promo.stats.moyenne)}</td><td>${promo.stats.taux_reussite ?? 0} % ≥ 10</td></tr></tfoot>
    </table>
    <div class="foot"><span>Relevé généré le ${dateFr(new Date())} · ${esc(etab.nom)}</span><span>Terminish École — Plateforme de gestion scolaire</span></div>
  </div>
  </body></html>`;
}

module.exports = { renderBulletin, renderBulletinBatch, renderExamen };
