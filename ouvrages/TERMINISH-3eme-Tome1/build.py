#!/usr/bin/env python3
"""Fabrication d'un ouvrage TERMINISH : assemble les pages HTML, calcule la
table des matières, produit le PDF final (en-tete, pied de page, signets).

Usage :
    python3 build.py                 # construit l'ouvrage du dossier courant
    python3 build.py --sans-pdf      # assemble seulement le HTML
"""
from __future__ import annotations

import html
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import pymupdf

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent.parent                      # dépôt /terminish-maths
OUTILS = RACINE / 'outils' / 'pdf'
SORTIE = ICI / 'sortie'
KATEX = '../../../outils/pdf/node_modules/katex/dist'

TAILLE_PAGE = (595.276, 841.89)                 # A4 en points PDF
SEUIL_TITRE = 10.75                             # taille minimale d'un titre (pt)
COULEUR_BLEU = (0.12, 0.23, 0.37)

# --------------------------------------------------------------------------- #
# 1. Assemblage du document                                                    #
# --------------------------------------------------------------------------- #

def lire_contenu(fichier: Path) -> str:
    """Retourne le contenu utile (inner <body>) d'une page source."""
    texte = fichier.read_text(encoding='utf-8')
    corps = re.search(r'<body[^>]*>(.*)</body>', texte, re.S).group(1)
    corps = re.sub(r'<div class="filigrane">.*?</div>', '', corps, flags=re.S)
    return corps.strip()


def nettoyer_titre(balise: str) -> str:
    """Texte lisible d'un titre HTML (sans balises ni formules)."""
    texte = re.sub(r'<[^>]+>', '', balise)
    texte = html.unescape(texte)
    return re.sub(r'\s+', ' ', texte).strip()


def collecter(entrees: list[tuple[str, str, int]]) -> tuple[str, list[dict]]:
    """entrees : liste (fichier, contenu, niveau). Ajoute des ancres aux titres
    et renvoie le corps complet + la liste ordonnee des titres."""
    morceaux, titres = [], []
    for nom, contenu, _ in entrees:
        def remplacer(m: re.Match) -> str:
            niveau = {'chapitre': 1, 'sans-numero': 1, 'section': 2, 'exercice': 3}[m.group('classe')]
            titre = nettoyer_titre(m.group('titre'))
            ancre = 'titre-%03d' % len(titres)
            titres.append({'ancre': ancre, 'niveau': niveau, 'titre': titre,
                           'fichier': nom, 'toc': niveau == 1 or ' : ' in titre})
            return '<%s class="%s" id="%s"%s>%s</%s>' % (
                m.group('balise'), m.group('classe'), ancre, m.group('reste'),
                m.group('titre'), m.group('balise'))
        contenu = re.sub(
            r'<(?P<balise>h1|h2|h3) class="(?P<classe>chapitre|sans-numero|section|exercice)"'
            r'(?P<reste>[^>]*)>(?P<titre>.*?)</(?P=balise)>',
            remplacer, contenu, flags=re.S)
        morceaux.append(contenu)
    return '\n\n'.join(morceaux), titres


def bloc_table_matiere(titres: list[dict], numeros: dict[str, int] | None) -> str:
    lignes = []
    for t in titres:
        if not t.get('toc'):
            continue
        numero = ''
        if numeros and t['ancre'] in numeros:
            numero = str(numeros[t['ancre']])
        classe = {1: 'niveau-1', 3: 'niveau-3'}[t['niveau']]
        lignes.append(
            '<div class="ligne %s"><span class="nom">%s</span>'
            '<span class="pointilles"></span>'
            '<span class="page" data-ancre="%s">%s</span></div>'
            % (classe, html.escape(t['titre']), t['ancre'], numero))
    return '<div class="table-matiere" id="table-matiere">%s</div>' % '\n'.join(lignes)


def construire_html(titres: list[dict], corps: str, couverture: str,
                    numeros: dict[str, int] | None) -> str:
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>TERMINISH — Tome 1 — Classe de 3ème</title>
<link rel="stylesheet" href="../../style/terminish.css">
<link rel="stylesheet" href="{KATEX}/katex.min.css">
<script src="{KATEX}/katex.min.js"></script>
<script src="{KATEX}/contrib/auto-render.min.js"></script>
<style>
  .table-matiere {{ font-size: 9pt; }}
  .table-matiere .ligne {{ margin-bottom: 0.9mm; line-height: 1.15; }}
  .table-matiere .niveau-1 .nom {{ font-weight: bold; color: #1f3a5f; }}
  .table-matiere .niveau-3 {{ margin-left: 6mm; color: #374151; }}
  .table-matiere .ligne.niveau-1 {{ margin-top: 2.2mm; }}
  .page-toc {{ break-after: page; }}
  h1, h2, h3 {{ hyphens: none; -webkit-hyphens: none; }}
</style>
</head>
<body>

<div class="filigrane">KODJONE Kodjo — TERMINISH</div>

{couverture}

<section class="page-toc">
  <h1 class="sans-numero" id="titre-toc">Table des matières</h1>
  {bloc_table_matiere(titres, numeros)}
</section>

{corps}

<script>
  document.addEventListener('DOMContentLoaded', () => {{
    renderMathInElement(document.body, {{
      delimiters: [{{left: '$$', right: '$$', display: true}},
                   {{left: '\\\\[', right: '\\\\]', display: true}},
                   {{left: '\\\\(', right: '\\\\)', display: false}}],
      throwOnError: false
    }});
  }});
</script>
</body>
</html>
"""


# --------------------------------------------------------------------------- #
# 2. Rendu PDF et lecture des pages                                            #
# --------------------------------------------------------------------------- #

def rendre(source_html: Path, pdf: Path) -> None:
    """Appelle la chaine de rendu Chromium -> PDF."""
    env = dict(os.environ)
    env.setdefault('TERMINISH_PYTHON', sys.executable)
    sous = subprocess.run(
        ['node', 'render.mjs', str(source_html), str(pdf), '--sans-entete'],
        cwd=OUTILS, env=env, capture_output=True, text=True)
    if sous.returncode != 0:
        raise SystemExit('Échec du rendu PDF :\n%s\n%s' % (sous.stdout, sous.stderr))
    print('   ', sous.stdout.strip().splitlines()[-1])


def texte_titres(chemin: Path) -> list[str]:
    """Pour chaque page, le texte des fragments de taille >= SEUIL_TITRE."""
    document = pymupdf.open(chemin)
    pages = []
    for page in document:
        morceaux = []
        for bloc in page.get_text('dict')['blocks']:
            for ligne in bloc.get('lines', []):
                for span in ligne['spans']:
                    if span['size'] >= SEUIL_TITRE:
                        morceaux.append(span['text'])
                morceaux.append('\n')
        pages.append(re.sub(r'\s+', ' ', ' '.join(morceaux)))
    document.close()
    return pages


def normaliser(texte: str) -> str:
    texte = unicodedata.normalize('NFC', texte)
    return re.sub(r'\s+', ' ', texte).strip()


def reperer_pages(pages: list[str], titres: list[dict]) -> dict[str, int]:
    """Page (1 = couverture) de chaque titre, par recherche dans le texte."""
    positions: dict[str, int] = {}
    pages_norm = [normaliser(p) for p in pages]
    depart = 0
    for titre in titres:
        cible = normaliser(titre['titre'])
        trouve = None
        for indice in range(depart, len(pages_norm)):
            if cible and cible in pages_norm[indice]:
                trouve = indice
                break
        if trouve is None:                        # recherche souple (debut du titre)
            court = cible[:24]
            for indice in range(depart, len(pages_norm)):
                if court and court in pages_norm[indice]:
                    trouve = indice
                    break
        if trouve is None:
            print('   ! titre introuvable : %s' % titre['titre'])
            trouve = depart
        positions[titre['ancre']] = trouve + 1
        depart = trouve
    return positions


# --------------------------------------------------------------------------- #
# 3. Finition : en-tete, pied de page, signets                                 #
# --------------------------------------------------------------------------- #

_POLICE = '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'


def _chemin_police() -> str:
    return _POLICE if Path(_POLICE).exists() else ''


def finaliser(pdf: Path, titres: list[dict], numeros: dict[str, int], sous_titre: str) -> int:
    """Ajoute l'en-tete, le pied de page, les metadonnees et les signets."""
    document = pymupdf.open(pdf)
    police = _chemin_police()

    def ecrire(page, x, y, texte, taille, gras=False):
        page.insert_text((x, y), texte, fontname='F0', fontfile=police,
                         fontsize=taille, color=COULEUR_BLEU)

    for indice, page in enumerate(document):
        if indice == 0:                       # pas d'en-tete sur la couverture
            continue
        largeur, hauteur = page.rect.width, page.rect.height
        ecrire(page, 51, 34, 'KODJONE Kodjo', 7.5)
        ecrire(page, largeur / 2 - 55, 34, 'LYKPETA KPALIME', 7.5)
        ecrire(page, largeur - 152, 34, sous_titre, 7.5)
        ecrire(page, largeur / 2 - 3, hauteur - 40, str(indice + 1), 8.5)

    document.set_toc([[t['niveau'], t['titre'], numeros.get(t['ancre'], 1)] for t in titres])
    document.set_metadata({
        'title': 'TERMINISH — Tome 1 — Recueil d’Exercices de Mathématiques — Classe de 3ème',
        'author': 'KODJONE Kodjo — LYKPETA KPALIME',
        'subject': 'Mathématiques — classe de 3ème — recueil d’exercices (APC, BEPC)',
        'keywords': 'mathématiques, 3ème, BEPC, Togo, exercices, TERMINISH, KODJONE',
        'creator': 'TERMINISH — chaîne de production PDF',
    })
    temporaire = pdf.with_suffix('.tmp.pdf')
    document.save(temporaire, garbage=3, deflate=True)
    total = document.page_count
    document.close()
    temporaire.replace(pdf)
    return total


# --------------------------------------------------------------------------- #
# 4. Enchainement                                                              #
# --------------------------------------------------------------------------- #

def main() -> None:
    sans_pdf = '--sans-pdf' in sys.argv
    SORTIE.mkdir(exist_ok=True)

    fichiers = sorted(p for p in ICI.glob('*.html') if re.match(r'^\d\d-', p.name))
    entrees = [(p.name, lire_contenu(p), 0) for p in fichiers]
    couverture = lire_contenu(ICI / '00-couverture.html')
    corps_entrees = [e for e in entrees if not e[0].startswith('00-')]
    corps, titres = collecter(corps_entrees)
    print('· %d pages sources, %d titres repérés' % (len(entrees), len(titres)))

    provisoire = SORTIE / 'assemblage-provisoire.html'
    provisoire.write_text(construire_html(titres, corps, couverture, None), encoding='utf-8')

    if sans_pdf:
        print('· HTML assemblé :', provisoire)
        return

    print('· premier rendu (calcul de la pagination)…')
    pdf_provisoire = SORTIE / '_passage1.pdf'
    rendre(provisoire, pdf_provisoire)
    pages = texte_titres(pdf_provisoire)
    numeros = reperer_pages(pages, titres)

    print('· assemblage définitif…')
    final_html = SORTIE / 'TERMINISH-3eme-Tome1.html'
    final_html.write_text(construire_html(titres, corps, couverture, numeros), encoding='utf-8')

    pdf_final = ICI / 'TERMINISH-3eme-Tome1.pdf'
    rendre(final_html, pdf_final)

    print('· en-tête, pied de page et signets…')
    total = finaliser(pdf_final, titres, numeros, 'TERMINISH — Tome 1 · 3ème')

    # vérification : les numéros imprimés correspondent-ils aux pages réelles ?
    pages_verif = texte_titres(pdf_final)
    vraies = reperer_pages(pages_verif, titres)
    erreurs = {a: (numeros[a], vraies[a]) for a in numeros if numeros[a] != vraies[a]}
    print('· %d pages, %d titres' % (total, len(titres)))
    if erreurs:
        print('  ! écarts détectés :', json.dumps(erreurs, ensure_ascii=False))
    else:
        print('  ✓ table des matières vérifiée')
    (SORTIE / 'pagination.json').write_text(
        json.dumps({'pages': total, 'titres': titres, 'numeros': numeros},
                   ensure_ascii=False, indent=1), encoding='utf-8')
    pdf_provisoire.unlink(missing_ok=True)
    print('· PDF :', pdf_final, '(%.0f Ko)' % (pdf_final.stat().st_size / 1024))


if __name__ == '__main__':
    main()
