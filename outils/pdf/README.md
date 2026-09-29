# outils/pdf — chaîne de production PDF TERMINISH

Transforme les pages HTML d'un ouvrage (avec formules LaTeX/KaTeX) en PDF A4
imprimable, avec en-tête, pied de page numéroté et signets.

## Mise en place (une seule fois)

```bash
npm install                 # puppeteer-core, Chromium « serverless », KaTeX
bash setup_nss.sh           # bibliothèques NSS précompilées (paquet @achingbrain/nss)
pip install pyelftools pymupdf
```

## Utilisation

```bash
node render.mjs source.html sortie.pdf [--sans-entete] [--titre "..."]
```

En pratique, on n'appelle pas ce script directement : `ouvrages/*/build.py`
s'en charge et ajoute la table des matières, la pagination et les signets.

## Comment ça marche

1. `@sparticuz/chromium` fournit un binaire Chromium compatible serveur sans
   interface graphique.
2. Il exige une bibliothèque **NSS** récente, absente de certains systèmes.
   `patch_chromium_nss.py` adapte le binaire pour qu'il accepte la version
   fournie par le paquet npm `@achingbrain/nss` : seul le symbole
   `PK11_HasAttributeSet@NSS_3.30` est redirigé et la version `NSS_3.30` est
   ramenée à `NSS_3.2` — aucune conséquence pour un rendu local.
3. KaTeX rend les formules dans la page, puis Chromium imprime le document en
   PDF (A4, marges de la charte : 24/18/20/18 mm).

Les fichiers `nss/`, `node_modules/` et le binaire adapté ne sont pas versionnés :
`setup_nss.sh` et `render.mjs` les régénèrent automatiquement.
