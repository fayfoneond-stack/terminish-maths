#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vérification STRICTE — Interrogation n°1 de 3ème A.

Contrôles :
  1. chaque proposition est analysable (aucun échec silencieux) ;
  2. pour chaque question, exactement UNE proposition est juste ;
  3. cette proposition correspond bien à la lettre du corrigé ;
  4. les 3 propositions sont distinctes deux à deux (comparaison formelle, pas
     seulement textuelle) ;
  5. le texte imprimé dans le PDF correspond exactement au corrigé du .tex.
"""
import re, sys, unicodedata
from sympy import (symbols, expand, cancel, simplify, Rational, sympify,
                   together)
from sympy.parsing.sympy_parser import (parse_expr, standard_transformations,
                                        implicit_multiplication_application, convert_xor)

x = symbols('x', real=True)
TRANSFO = standard_transformations + (convert_xor, implicit_multiplication_application)

TEX = ("/home/user/terminish-maths/Interrogations/3emeA/Trimestre1/"
       "Interrogation_1_Monomes_Polynomes_Fractions_rationnelles.tex")
PDF = TEX.replace('.tex', '.pdf')
src = open(TEX, encoding='utf-8').read()

# ---------------------------------------------------------------- lecture
def bloc(nom):
    d = src.index('\\newcommand{\\' + nom + '}')
    i = src.index('{%', d) + 2
    prof, j = 1, i
    while prof:
        if src[j] == '{': prof += 1
        elif src[j] == '}': prof -= 1
        j += 1
    return src[i:j-1]

def lignes(nom):
    out = []
    for l in bloc(nom).split('\n'):
        l = l.strip()
        if re.match(r'^\d+\s*&', l):
            p = [q.strip() for q in l.split(' & ')]
            out.append((int(p[0]), p[1], p[2:5]))
    return out

A, B = lignes('lignesA'), lignes('lignesB')
corrige = {}
for l in src.split('\n'):
    m = re.match(r'^(\d+) & \\textbf\{([abc])\} & \\textbf\{([abc])\} &', l.strip())
    if m:
        corrige[int(m.group(1))] = (m.group(2), m.group(3))
assert len(corrige) == 10, 'corrigé incomplet'

# ------------------------------------------------------------- analyse
def vers_python(t):
    t = t.replace('\\neq', '!=').replace('$', '').replace('\\,', '')
    while '\\frac{' in t:
        i = t.index('\\frac{')
        def arg(s, k):
            prof, j = 1, k + 1
            while prof:
                if s[j] == '{': prof += 1
                elif s[j] == '}': prof -= 1
                j += 1
            return s[k+1:j-1], j
        num, j = arg(t, i + 5)
        den, k = arg(t, j)
        t = t[:i] + '((' + num + ')/(' + den + '))' + t[k:]
    t = t.replace('\\mbox', '').replace('\\left', '').replace('\\right', '')
    t = t.replace('{', '').replace('}', '')
    return t

def valeur(t):
    """→ expression sympy (polynôme ou fraction)"""
    return cancel(parse_expr(vers_python(t), local_dict={'x': x}, transformations=TRANSFO))

def nb(t):
    return Rational(sympify(vers_python(t)))

def exclus(t):
    t = vers_python(t)                      # \neq -> !=
    return frozenset(int(v) for v in re.findall(r'x\s*!=\s*(-?\d+)', t))

# --------------------------------------------------------- vérité (recalcul)
verites = {
 ('A',1): ('nombre', 4),                                 # degré de -5x^4
 ('A',2): ('expr',   expand(3*x**2 + 5*x - 7*x**2 + 2*x)),
 ('A',3): ('expr',   expand((2*x - 3)**2)),
 ('A',4): ('expr',   expand((3*x - 5)*(3*x + 5))),
 ('A',5): ('expr',   expand((x - 4)**2)),
 ('A',6): ('expr',   expand((x + 1)*(3*x + 2))),
 ('A',7): ('nombre', 2*(-1)**3 - 3*(-1) + 1),            # P(-1)
 ('A',8): ('exclus', frozenset([-2])),                   # x^2+4x+4=(x+2)^2
 ('A',9): ('expr',   cancel((x**2 - 4)/(x**2 + 4*x + 4))),
 ('A',10):('nombre', Rational(1, 5)),                    # B(3)
 ('B',1): ('nombre', 5),                                 # degré de 6x^5
 ('B',2): ('expr',   expand(4*x**2 + 7*x - 6*x**2 + 2*x)),
 ('B',3): ('expr',   expand((x - 5)**2)),
 ('B',4): ('expr',   expand((2*x - 7)*(2*x + 7))),
 ('B',5): ('expr',   expand((x + 3)**2)),
 ('B',6): ('expr',   expand((x - 2)*(2*x + 6))),
 ('B',7): ('nombre', 3*(-1)**2 - 2*(-1) + 5),            # Q(-1)
 ('B',8): ('exclus', frozenset([3])),                    # x^2-6x+9=(x-3)^2
 ('B',9): ('expr',   cancel((x**2 - 9)/(x**2 - 6*x + 9))),
 ('B',10):('nombre', Rational(-2, 1)),                   # C(1)
}

def verdict(kind, attendu, option):
    """True = proposition juste, False = fausse, 'ILLISIBLE' = non analysable"""
    try:
        if kind == 'nombre':
            v = nb(option)
            return bool(v == attendu), v
        if kind == 'expr':
            v = valeur(option)
            return bool(simplify(v - attendu) == 0), v
        if kind == 'exclus':
            v = exclus(option)
            return bool(v == attendu), v
    except Exception as e:
        return 'ILLISIBLE', repr(e)[:40]
    return 'ILLISIBLE', 'type inconnu'

# ---------------------------------------------------------------- contrôle
anomalies, illisibles = [], []
print('=' * 92)
for version, jeu in (('A', A), ('B', B)):
    print(f'  VERSION {version}   (corrigé .tex : ' +
          ', '.join(f'{i}{corrige[i][0 if version=="A" else 1]}' for i in range(1, 11)) + ')')
    print('=' * 92)
    for (num, enonce, options) in jeu:
        kind, attendu = verites[(version, num)]
        res = [verdict(kind, attendu, o) for o in options]
        justes = [i for i, (ok, _) in enumerate(res) if ok is True]
        lettre = ''.join('abc'[i] for i in justes)
        attendue = corrige[num][0 if version == 'A' else 1]
        if any(ok == 'ILLISIBLE' for ok, _ in res):
            illisibles.append((version, num, options))
        # propositions formellement distinctes ?
        formes = [r[1] for r in res]
        distinctes = len({str(f) for f in formes}) == 3
        ok_global = (lettre == attendue) and distinctes and not any(ok == 'ILLISIBLE' for ok, _ in res)
        detail = ' | '.join(
            f"{'abc'[i]}:{'JUSTE' if res[i][0] is True else ('FAUSSE' if res[i][0] is False else 'ILLISIBLE')}"
            for i in range(3))
        print(f"{'OK   ' if ok_global else 'ERREUR'} Q{num:2d} corrigé={attendue} calcul={lettre or '—'} "
              f"distinctes={'oui' if distinctes else 'NON'} | {detail}")
        if not ok_global:
            anomalies.append((version, num, attendue, lettre, options, [r[0] for r in res]))

print()
print('-' * 92)
print(f'20 questions contrôlées | anomalies : {len(anomalies)} | propositions illisibles : {len(illisibles)}')

# ------------------------- contrôle PDF : le corrigé imprimé correspond-il ?
import pymupdf
def clean(t):
    t = t.replace('\ufb01', 'fi').replace('\ufb02', 'fl')
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if not unicodedata.combining(c))
    for c in '´`¨¸ˆ~ˇ˘¯':
        t = t.replace(c, '')
    return re.sub(r'\s+', ' ', t)

doc = pymupdf.open(PDF)
p1 = clean(" ".join(p.get_text() for p in [doc[0]]))
p2 = clean(doc[1].get_text())

# a) chaque énoncé et chaque proposition sont-ils réellement imprimés ?
def norm_tex(t):
    """normalise une cellule LaTeX pour la comparer au texte extrait du PDF"""
    t = t.replace('\\mbox', '').replace('\\,', '').replace('$', '').replace('\u2019', "'")
    t = t.replace('\\neq', '')                      # « ≠ » imprimé comme un « = » barré
    t = t.replace('\\leqslant', '<=').replace('\\geqslant', '>=')
    while '\\frac{' in t:                            # numérateur puis dénominateur
        i = t.index('\\frac{')
        def arg(s, k):
            prof, j = 1, k + 1
            while prof:
                if s[j] == '{': prof += 1
                elif s[j] == '}': prof -= 1
                j += 1
            return s[k+1:j-1], j
        num, j = arg(t, i + 5)
        den, k = arg(t, j)
        t = t[:i] + num + den + t[k:]
    t = t.replace('{', '').replace('}', '').replace('^', '')
    return t

def norm_pdf(t):
    """normalise le texte extrait du PDF (police ae : accents avant la lettre)"""
    t = t.replace('\ufb01', 'fi').replace('\ufb02', 'fl')
    t = t.replace('\u2019', "'")                     # apostrophe typographique
    t = re.sub(r'\u0338\s*=\s*', '', t)            # « ≠ » (barre + =) avant tout le reste
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if not unicodedata.combining(c))
    for c in '´`¨¸ˆ~ˇ˘¯':
        t = t.replace(c, '')
    t = t.replace('\u2212', '-').replace('\u2013', '-')
    t = re.sub(r'\s+', '', t)
    return t

pdf_norm = norm_pdf(" ".join(p.get_text() for p in [doc[0]]))
manquants = []
for version, jeu in (('A', A), ('B', B)):
    for (num, enonce, options) in jeu:
        for elem in [enonce] + list(options):
            n = norm_pdf(norm_tex(elem))
            if n and n not in pdf_norm:
                manquants.append((version, num, elem, n))

# b) le tableau du corrigé imprimé donne les mêmes lettres que le .tex
lettres_pdf = []
for l in doc[1].get_text().split('\n'):
    l = l.strip()
    m = re.match(r'^(\d+)\s*$', l)
lignes_pdf = [l.strip() for l in doc[1].get_text().split('\n') if l.strip()]
attendu_pdf = {i: (corrige[i][0], corrige[i][1]) for i in range(1, 11)}
paires = []
for k, l in enumerate(lignes_pdf):
    if re.fullmatch(r'[abc]', l) and k + 1 < len(lignes_pdf) and re.fullmatch(r'[abc]', lignes_pdf[k+1]):
        paires.append((l, lignes_pdf[k+1]))
mauvaises = [(i+1, p, attendu_pdf[i+1]) for i, p in enumerate(paires) if p != attendu_pdf[i+1]]

print()
print('contrôle du PDF (texte réellement imprimé) :')
print(f"   cellules (énoncés + propositions) contrôlées : {20*4} | introuvables : {len(manquants)}")
for m in manquants: print('      !!', m)
print(f"   paires de lettres lues dans le corrigé page 2 : {len(paires)}")
print(f"   paires différentes du .tex : {len(mauvaises)}")
for m in mauvaises: print('      !!', m)

total_ok = not anomalies and not illisibles and not manquants and not mauvaises and len(paires) == 10
print()
print('RÉSULTAT GLOBAL :', 'AUCUNE ERREUR' if total_ok else 'ERREURS DÉTECTÉES')
sys.exit(0 if total_ok else 1)
