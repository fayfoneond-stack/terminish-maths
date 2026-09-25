# 🔧 Outils LaTeX → PDF — TERMINISH

Chaîne de compilation **LaTeX → PDF** qui fonctionne dans cet environnement,
sans serveur externe : moteur **XeTeX 3.141592653 (TeX Live 2025)** compilé en
WebAssembly, piloté par Node.js.

## 🚀 Compilation en une commande

```bash
bash outils_latex/compiler.sh Examen/1ereD/Semestre2/modele_saisie_epreuve.tex
# → Examen/1ereD/Semestre2/modele_saisie_epreuve.pdf
```

Options :

| Option | Rôle |
|---|---|
| `-o sortie.pdf` | Nom du PDF produit (par défaut : même nom que le `.tex`) |
| `--passes N` | Nombre de passes XeTeX, 1 à 5 (défaut 2 — tableaux, renvois) |
| `--extra vfs:local` | Injecte un fichier dans le système virtuel (police, image, `.sty`) |

Si le moteur n'est pas encore installé, `compiler.sh` lance automatiquement
`installer_runtime.sh` (télécharge ~27 Mo depuis npm, ajoute les polices).

## 📦 Ce qu'il y a ici

| Fichier | Rôle |
|---|---|
| `xelatex.mjs` | Adaptateur Node.js : shimme `self`/`fetch` et pilote le worker WASM (protocole `compile` → `success` avec PDF en ArrayBuffer) |
| `compiler.sh` | Wrapper CLI convivial |
| `installer_runtime.sh` | Installation/reprise du moteur dans `/home/user/latex-runtime` (hors dépôt Git) + polices complémentaires |
| `polices/` | Famille **Latin Modern OTF complète** (5–17 pt, gras, italique, penché, `sans`, `mono` — licence GUST/OFL, redistribuables) ajoutée au runtime |
| `../Examen/1ereD/Semestre2/modele_saisie_epreuve.tex` | **Modèle de saisie d'épreuve** au format TERMINISH/APC (contexte, consignes, barème Pertinence/Correction/Cohérence/Perfectionnement) |

## 📐 Contraintes du runtime embarqué

- **Paquets disponibles** : `amsmath`, `geometry`, `xcolor`, `fontspec`,
  `hyperref`, `url`, `etoolbox`, `longtable`, classe `article` (10/11/12 pt).
- **Absents** : `babel` (écrire directement le français en UTF-8 — accents OK),
  `colortbl` (pas de `\rowcolor`), `booktabs`, `enumitem`, `fancyhdr`, `tikz`,
  `amssymb` (utiliser `\mathrm{R}` au lieu de `\mathbb{R}` — macro `\R` fournie
  dans le modèle).
- **Polices** : Latin Modern complète ; éviter l'italique dans un titre de
  corps ≥ 15 pt (pas de `lmroman17-italic`).
- Moteur : XeTeX (Unicode natif) + `xdvipdfmx` (sortie PDF) + `bibtex`.

## 🧪 Pourquoi cette approche ?

L'environnement n'autorise que PyPI, npm et github.com (les dépôts Debian/CTAN
sont bloqués). Le paquet npm [`@arnon3339/thtex`](https://www.npmjs.com/package/@arnon3339/thtex)
embarque un système LaTeX complet en WebAssembly : aucune dépendance réseau à
la compilation, résultat identique d'une session à l'autre.
