# 📋 SUIVI DES FICHES PÉDAGOGIQUES — TERMINISH MATHS

_Mis à jour le 06/10/2026 — branche de travail : `arena/01a0d8b6-terminish-maths` — PR #2 ouverte vers `main`_

---

## 1️⃣ Fiches réalisées

| # | Fiche | Fichier | Séances | Commit | État |
|---|-------|---------|---------|--------|------|
| 1 | **4ème A** — Calcul sur les expressions algébriques | `Fiches_pedagogiques/4emeA/Fiche_01_Calcul_sur_les_expressions_algebriques.tex` + `.pdf` | 5 × 55 min | `24fb16a` → `6806df9` | ✅ Finale (8 p.) |
| 2 | **1ère D** — Systèmes d'équations linéaires dans IR² et IR³ | `Fiches_pedagogiques/1ereD/Fiche_02_Systemes_lineaires_IR2_IR3.tex` + `.pdf` | 2 × 110 min | `553dc3c` | ✅ Finale (7 p.) |
| 3 | **2nde A** — Dénombrement (Thème 3 : Organisation des données, Leçon 1) | `Fiches_pedagogiques/2ndeA/Fiche_01_Denombrement.tex` + `.pdf` | 6 × 55 min | `52fa812` | ✅ Finale (10 p.) |
| 4 | **3ème** — Propriété de Thalès (Thème 2 : Configurations du plan, Leçon 2) | `Fiches_pedagogiques/3eme/Fiche_02_Propriete_de_Thales.tex` + `.pdf` | 8 × 55 min | `516ee0c` + `33ae5e6` | ✅ Finale v5 (17 p.) — moments = 9 étapes APC, formulations humaines |
| 5 | **2nde S** — Positions relatives de droites et de plans de l'espace (Thème 5 : Géométrie de l'espace, Leçon 1) | `Fiches_pedagogiques/2ndeS/Fiche_01_Positions_relatives_droites_plans_espace.tex` + `.pdf` | 2 × 55 min | `1210dda` | ✅ Finale (8 p.) — SA « casier du club scientifique » en 2 Synthèses |
| — | 3ème — SA manuscrite Thalès (copie élève, police Patrick Hand) | `Fiches_pedagogiques/3eme/SA_manuscrite_Propriete_de_Thales.tex` + `.pdf` | — | `957d98c` | ✅ Finale (3 p.) |

**Dernier commit distant : `1210dda`** (branche `arena/01a0d8b6-terminish-maths`, PR #2 : v4 + restauration des 89 fichiers écrasés par l'upload `af4c907` ; les 3 modèles PDF uploadés restent à la racine).

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
| Moments didactiques (v4, 9 étapes officielles APC — identiques pour CHAQUE séance de 55 min) | 1) Remobilisation des prérequis ou évaluation diagnostique (10 min) → 2) Présentation de la situation (5 min) → 3) Appropriation de la situation, compréhension de la tâche et de l'organisation du travail (5 min) → 4) Résolution du problème : individuellement (5 min) puis en groupes (10 min) → 5) Synthèse et bilan du travail (3 min) → 6) Institutionnalisation : trace écrite de la leçon par le professeur (7 min) → 7) Réinvestissement / travaux dirigés (5 min) → 8) Remédiation éventuelle (3 min) → 9) Évaluation (formative) (2 min) |
| SA en 8 « Synthèses » | Chaque question de la situation d'apprentissage est une « Synthèse » (Synthèse 1 à 8), résolue à l'étape 4 de la séance correspondante ; la correction de l'exercice de maison est absorbée par l'étape 1 (à partir de la S2) |
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
| Publication | TOUJOURS : `git fetch origin` → examiner ce qui a changé → `git reset --hard <base>` **AVANT** d'éditer (arbre propre, jamais de stash) → éditer/compiller → `git status --short` **AVANT** chaque commit → add ciblé → commit → `git push origin arena/01a0d8b6-terminish-maths` (si rejet non-fast-forward : vérifier `git ls-remote`, puis `--force-with-lease=<ref>:<sha vérifiée>`) → PR `gh pr create --base main` |
| Incidents connus | Upload web de l'utilisateur = commit qui REMPLACE tout l'arbre de `main` (`af4c907` : 92 fichiers supprimés) → réparer par un commit de restauration construit sur SA base, sans toucher à ses fichiers ; `reset --soft` sur index désynchronisé = pertes (`509aa4a`) |

---

## 5️⃣ Prochaines étapes possibles

| Option | État |
|--------|------|
| Nouvelle fiche (autre classe / autre leçon) | ⏳ En attente des captures du programme (tableaux capacités / contenus / stratégies / consignes / évaluation) |
| Correction sur une fiche existante | ⏳ Indiquer la page / le passage |
