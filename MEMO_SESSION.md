# 📌 MÉMO DE LA SESSION — à lire pour reprendre le travail sans perte

_Ce fichier résume la discussion du 04–07/10/2026. Si la conversation Arena est perdue,
tout ce qui compte s'y trouve, ainsi que dans `SUIVI_FICHES.md`._

---

## 1️⃣ Fiches produites pendant cette session (toutes poussées sur `arena/01a0d8b6-terminish-maths`)

| Fiche | État | Commits clés |
|-------|------|--------------|
| **3ème** — Thalès (Leçon 2, 8 × 55 min) | ✅ v5 finale (17 p.) : 9 moments APC, formulations humaines | `516ee0c` → `33ae5e6` |
| **3ème** — SA manuscrite (copie élève, 3 p., police Patrick Hand) | ✅ finale | `957d98c` |
| **2nde S** — Positions relatives de droites et de plans de l'espace (Thème 5, Leçon 1, **2 × 110 min**) | ✅ finale (9 p.), relue et corrigée mathématiquement | `1210dda`, `3eacf1a`, `4cefc6c`, `3444eb1` |

**PR ouverte qui rassemble tout (fiches + restauration du dépôt) : https://github.com/fayfoneond-stack/terminish-maths/pull/2**

## 2️⃣ Les règles de fabrication (à ne pas redemander)

- **Moments didactiques = les 9 étapes officielles APC**, dans l'ordre, pour CHAQUE séance :
  1) Remobilisation des prérequis / évaluation diagnostique → 2) Présentation de la situation →
  3) Appropriation, compréhension de la tâche, organisation → 4) Résolution (individuel puis groupes) →
  5) Synthèse et bilan → 6) Institutionnalisation (trace écrite) → 7) Réinvestissement/TD →
  8) Remédiation éventuelle → 9) Évaluation formative.
  Durées à proportion de la durée de séance (55 min : 10/5/5/5+10/3/7/5/3/2 ; 110 min : tout ×2).
- **SA en « Synthèses »** : chaque question de la situation est une Synthèse (S1, S2, …), résolue à l'étape 4 ;
  la correction de la maison est absorbée par l'étape 1 ; cartouche « SYNTHESES 1 à n ».
- **Français exigé** : phrases complètes avec sujet (« Le professeur… », « Les élèves… ») ;
  réponses des exercices d'application expliquées pas à pas (« Réponses (méthode expliquée) »),
  méthode visible (①…②… Conclusion :), niveau de langue accessible aux élèves.
- **Signature** : filigrane diagonal « KODJONE Kodjo » ; cartouche DRE PLO / IESG KPALIMÉ / LYCÉE KPETA /
  93 150 178 ; pied « M.KODJONE Kodjo Prof de Maths » + n° page encadré vert ; pas de bloc TERMINISH.
- **Couleurs** : trace écrite rouge souligné ; maison rouge foncé ; cadres bleus de séance ; en-têtes verts ;
  surlignage jaune.
- **Figures** : `\oval`, `\line` oblique, `\qbezier` INTERDITS → `\rotatebox[origin=l]{angle aigu}{\rule{L}{0.35mm}}`
  depuis un sommet ; arêtes cachées en pointillés ; pas de page quasi vide.

## 3️⃣ Erreurs corrigées en fin de session (relecture mathématique) — leçons à retenir

- $(AB)$ et $(GH)$, $(AD)$ et $(FG)$ : mêmes directions ⇒ **parallèles** (donc coplanaires) —
  ne jamais les donner comme « non coplanaires » ; sur un pavé, vérifier avec les coordonnées 3D.
- Section d'un pavé par $(ACG)$ = **rectangle $ACGE$** (pas un triangle).
- Cohérence énoncé/figure : si la figure est un pavé 90×50×60, ne pas écrire « cube ».

## 4️⃣ Incidents de dépôt (déjà réglés — réflexes à garder)

- Un **upload web de l'utilisateur écrase tout l'arbre de `main`** (commit `af4c907`) →
  réparer par un commit de restauration construit SUR sa base, sans toucher à ses fichiers.
- La sandbox peut décrocher (HEAD revenu à `1680249`) → `git fetch origin arena/…` + `git reset FETCH_HEAD`
  (jamais `--hard` avec des éditions non enregistrées ailleurs), puis recompiler si besoin.
- Toujours : `git status --short` AVANT chaque commit ; add ciblé ; push vers
  `arena/01a0d8b6-terminish-maths` uniquement (lease si non-fast-forward).

## 5️⃣ Pour une NOUVELLE fiche

Envoyer les **captures d'écran du programme** (tableaux capacités/contenus/stratégies/consignes/évaluation)
de LA leçon demandée uniquement + classe, année, nombre de séances et durée d'une séance.
Ne jamais deviner le programme.
