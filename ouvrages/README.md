# Ouvrages TERMINISH

Recueils d'exercices de mathématiques — **by KODJONE Kodjo — LYKPETA KPALIME**.

Chaque sous-dossier contient un ouvrage complet : les pages sources en HTML,
le script de fabrication et le PDF livré.

```
ouvrages/
├── style/terminish.css                 ← charte graphique commune (couleurs, gabarits)
└── TERMINISH-3eme-Tome1/
    ├── 00-couverture.html              ← couverture (ordre = préfixe numérique)
    ├── 10-introduction.html
    ├── 20-arithmetique.html            ← un fichier par chapitre
    ├── 21-calcul-algebrique.html
    ├── …
    ├── 90-conclusion.html              ← conclusion + table des réponses
    ├── build.py                        ← assemblage, pagination, PDF
    ├── sortie/                         ← fichiers intermédiaires (HTML assemblé)
    └── TERMINISH-3eme-Tome1.pdf        ← ← ← LE LIVRE
```

## Écrire le contenu

Les pages sont du HTML simple. Les mathématiques s'écrivent en **LaTeX** entre
`\( … \)` (dans le texte) ou `\[ … \]` (centré) ; elles sont rendues par KaTeX.

```html
<p>Soit \(x\) un réel. Le discriminant vaut \(\Delta = b^2 - 4ac\).</p>
\[ x_1 = \frac{-b - \sqrt{\Delta}}{2a} \]
```

Encadrés disponibles : `<div class="a-retenir">` (résultat à retenir),
`<div class="encadre">` (exemple rédigé), `<table class="bareme">` (barème),
`<table class="donnees">` (tableau de données).

## Fabriquer le PDF

Prérequis (une seule fois) :

```bash
sudo apt-get install -y nodejs python3-pip fonts-dejavu
pip install pymupdf pyelftools
cd outils/pdf && npm install && bash setup_nss.sh
```

Puis, à chaque modification :

```bash
cd ouvrages/TERMINISH-3eme-Tome1
python3 build.py
```

Le script enchaîne automatiquement :

1. l'assemblage des pages HTML dans l'ordre des préfixes numériques ;
2. un **premier rendu PDF** pour mesurer la position réelle de chaque titre ;
3. la génération de la **table des matières** avec les bons numéros de page ;
4. l'ajout de l'**en-tête** (KODJONE Kodjo · LYKPETA KPALIME · titre de l'ouvrage),
   du **pied de page numéroté** et des **signets PDF** (navigation par chapitres) ;
5. une **vérification** : chaque numéro imprimé dans la table des matières est
   contrôlé par rapport à la page réelle du titre.

`python3 build.py --sans-pdf` assemble seulement le HTML (pratique pour relire
le contenu dans un navigateur).

## Créer un nouvel ouvrage (Tome 2, autre classe…)

```bash
cp -r ouvrages/TERMINISH-3eme-Tome1 ouvrages/TERMINISH-3eme-Tome2
# adapter : la classe sur la couverture, les chapitres, la constante SORTIE…
cd ouvrages/TERMINISH-3eme-Tome2 && python3 build.py
```

La chaîne de production (`outils/pdf/`) est partagée : aucun réglage à refaire.

## Chaîne technique

`HTML + KaTeX` → **Chromium sans interface** (moteur d'impression identique à
celui de Google Chrome/Edge) → `PDF A4` → finition par **PyMuPDF**.
Les bibliothèques nécessaires et l'adaptation du binaire Chromium sont
automatisées par `outils/pdf/render.mjs` et `outils/pdf/patch_chromium_nss.py`.
