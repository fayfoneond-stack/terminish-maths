# 📋 SUIVI DES FICHES PÉDAGOGIQUES — TERMINISH MATHS

_Mis à jour le 01/10/2026 — branche de travail : `arena/01a0d8b6-terminish-maths`_

---

## 1️⃣ Fiches réalisées

| # | Fiche | Fichier | Séances | Commit | État |
|---|-------|---------|---------|--------|------|
| 1 | **4ème A** — Calcul sur les expressions algébriques | `Fiches_pedagogiques/4emeA/Fiche_01_Calcul_sur_les_expressions_algebriques.tex` + `.pdf` | 5 × 55 min | `24fb16a` → `6806df9` | ✅ Finale (8 p.) |
| 2 | **1ère D** — Systèmes d'équations linéaires dans IR² et IR³ | `Fiches_pedagogiques/1ereD/Fiche_02_Systemes_lineaires_IR2_IR3.tex` + `.pdf` | 2 × 110 min | `553dc3c` | ✅ Finale (7 p.) |
| 3 | **2nde A** — Dénombrement (Thème 3 : Organisation des données, Leçon 1) | `Fiches_pedagogiques/2ndeA/Fiche_01_Denombrement.tex` + `.pdf` | 6 × 55 min | `52fa812` | ✅ Finale (10 p.) |

**Dernier commit distant : `52fa812`** (tout est poussé, rien en attente).

---

## 2️⃣ Signature à répliquer sur TOUTE nouvelle fiche

| Élément | Valeur |
|---------|--------|
| Filigrane diagonal | « **KODJONE Kodjo** » (rotatebox 30°, scalebox 3, gris) |
| Cartouche | NOM/PRÉNOM : KODJONE Kodjo • DRE : **PLO** • IESG : **KPALIME** • ÉTABLISSEMENT : **LYCEE KPETA** • CONTACT : **93 150 178** |
| Pied de page | « **M.KODJONE Kodjo Prof de Maths** » (bleu) + numéro de page encadré vert |
| Interdit | Bloc « TERMINISH » en fin de fiche ❌ |

---

## 3️⃣ Modèle de fiche (structure & couleurs)

| Règle | Détail |
|-------|--------|
| Format | A4 **paysage**, tableau à 4 colonnes : Moment didactique / Activité de l'enseignant / Activité de l'élève / Trace écrite |
| Couleurs | Trace écrite + titres : **rouge souligné** • Exercice de maison : **rouge foncé** • N° de séance : **cadre bleu** • En-têtes de colonnes : **fond vert pâle** • Mots-clés : **surlignés jaune** |
| Séance 1 (lancement APC) | Prérequis → Présentation de la situation-problème → Appropriation → Recherche (travail individuel + travail en groupe) → Présentation des productions → Synthèse → **Trace écrite** → Exercice de maison |
| Séances suivantes (55 min) | Petite activité (2 min) + Correction de l'exercice de maison (5 min) + Leçon du jour / Trace écrite (23 min) + Exercice d'application (20 min) + Exercice de maison (5 min) |
| Entre les séances | Bandeau rouge centré : « Institutionalisation : (trace écrite de la leçon par le professeur) » |

---

## 4️⃣ Technique

| Sujet | Règle |
|-------|-------|
| Compilation | `bash outils_latex/compiler.sh fiche.tex --passes 2` — runtime XeTeX WASM dans `/home/user/latex-runtime/thtex/` (réinstaller via `bash outils_latex/installer_runtime.sh` si la sandbox est réinitialisée) |
| Contrôle visuel | `pip install --break-system-packages pypdfium2 pillow` puis rendu PNG de chaque page avec pypdfium2 **avant** de publier |
| Figures compatibles | `picture` + `\framebox` / `\rule` / `\put` ; lignes obliques : `\rotatebox[origin=l]{angle}{\rule{longueur}{0.35mm}}` ; **cercles : 40 cordes** en rotatebox+rule (script python — voir fiche 2nde A) |
| Figures INTERDITES | `\oval` et `\line` oblique (polices `lcircle10`/`line10` absentes → échec de conversion PDF) • `\qbezier` (rend des losanges avec ce moteur) |
| Pièges LaTeX | Pas de `\par` ni d'apostrophe en mode math dans `\textit{...}` (utiliser `{\itshape ...}` pour les grands blocs) • Pas de `\mathbb` (utiliser `\mathrm`) • `\dotfill` pour les champs à remplir |
| Publication | `git fetch origin arena/01a0d8b6-terminish-maths` + `git reset --soft FETCH_HEAD` → `git add fiche.tex fiche.pdf` (delta seulement) → commit → `git push origin arena/01a0d8b6-terminish-maths` |

---

## 5️⃣ Prochaines étapes possibles

| Option | État |
|--------|------|
| Nouvelle fiche (autre classe / autre leçon) | ⏳ En attente des captures du programme (tableaux capacités / contenus / stratégies / consignes / évaluation) |
| Correction sur une fiche existante | ⏳ Indiquer la page / le passage |
