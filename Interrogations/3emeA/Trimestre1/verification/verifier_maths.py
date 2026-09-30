#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vérification indépendante — Interrogation n°1 de 3ème A
   (Monômes – Polynômes – Fractions rationnelles).

   Pour chacune des 20 questions (2 versions x 10) :
     - recalcule le résultat avec sympy (calcul formel),
     - retrouve dans quelle proposition (a, b ou c) se trouve ce résultat,
     - compare avec la lettre annoncée dans le corrigé,
     - vérifie que les trois propositions sont distinctes et qu'une seule est juste.
"""
import re, sys
from sympy import (symbols, Poly, expand, factor, simplify, S, solveset,
                   Interval, FiniteSet, sympify, together, cancel, Rational, degree)
from sympy.parsing.sympy_parser import (parse_expr, standard_transformations,
                                        implicit_multiplication_application, convert_xor)

x = symbols('x', real=True)
CHEMIN = sys.argv[1] if len(sys.argv) > 1 else (
    "/home/user/terminish-maths/Interrogations/3emeA/Trimestre1/"
    "Interrogation_1_Monomes_Polynomes_Fractions_rationnelles.tex")
src = open(CHEMIN, encoding='utf-8').read()

# ----------------------------------------------------------- lecture du .tex
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

lignesA, lignesB = lignes('lignesA'), lignes('lignesB')

corrige = {}
for l in src.split('\n'):
    m = re.match(r'^(\d+) & \\textbf\{([abc])\} & \\textbf\{([abc])\} &', l.strip())
    if m:
        corrige[int(m.group(1))] = (m.group(2), m.group(3))

# ------------------------------------------------- conversion des écritures
TRANSFO = standard_transformations + (convert_xor, implicit_multiplication_application)

def vers_sympy(t):
    """traduit l'écriture LaTeX de l'interrogation en expression sympy"""
    t = t.replace('\\neq', '!=').replace('$', '').replace('\\,', '')
    t = t.replace('\\left', '').replace('\\right', '')
    # \\frac{a}{b}  ->  ((a)/(b))
    while '\\frac{' in t:
        i = t.index('\\frac{')
        def arg(s, k):
            prof, j = 1, k + 1
            while prof:
                if s[j] == '{': prof += 1
                elif s[j] == '}': prof -= 1
                j += 1
            return s[k+1:j-1], j
        num, j = arg(t, i + len('\\frac{') - 1)
        den, k = arg(t, j)
        t = t[:i] + '((' + num + ')/(' + den + '))' + t[k:]
    t = t.replace('{', '').replace('}', '')
    return t

def expr(t):
    return parse_expr(vers_sympy(t), local_dict={'x': x}, transformations=TRANSFO)

def poly(t):
    return expand(expr(t))

def frac(t):
    return cancel(expr(t))

def ens_nondefini(t):
    """« x != a », « x != a et x != b » → ensemble des valeurs interdites"""
    t = t.replace('\\neq', '!=')
    vals = re.findall(r'x\s*!=\s*(-?\d+)', t)
    return frozenset(int(v) for v in vals)

# ------------------------------------------------------------- vérité (A)
P_A = lambda e: poly(e)
verites = {
 ('A', 1): ('degre', 4),
 ('A', 2): ('poly',  poly('$3x^2+5x-7x^2+2x$')),
 ('A', 3): ('poly',  poly('$(2x-3)^2$')),
 ('A', 4): ('poly',  poly('$(3x-5)(3x+5)$')),
 ('A', 5): ('poly',  poly('$(x-4)^2$')),
 ('A', 6): ('poly',  poly('$(x+1)(3x+2)$')),
 ('A', 7): ('nombre', Rational(2, 1)),
 ('A', 8): ('exclu', frozenset([-2])),
 ('A', 9): ('frac',  frac('(x**2-4)/(x**2+4x+4)')),
 ('A', 10): ('nombre', Rational(1, 5)),
 ('B', 1): ('degre', 5),
 ('B', 2): ('poly',  poly('$4x^2+7x-6x^2+2x$')),
 ('B', 3): ('poly',  poly('$(x-5)^2$')),
 ('B', 4): ('poly',  poly('$(2x-7)(2x+7)$')),
 ('B', 5): ('poly',  poly('$(x+3)^2$')),
 ('B', 6): ('poly',  poly('$(x-2)(2x+6)$')),
 ('B', 7): ('nombre', Rational(10, 1)),
 ('B', 8): ('exclu', frozenset([3])),
 ('B', 9): ('frac',  frac('(x**2-9)/(x**2-6x+9)')),
 ('B', 10): ('nombre', Rational(-2, 1)),
}

def _nettoyer_verites():
    pass

def correspond(kind, attendu, option):
    try:
        if kind == 'degre':
            return int(option) == attendu
        if kind == 'poly':
            return expand(poly(option) - attendu) == 0
        if kind == 'nombre':
            return Rational(expr(option)) == attendu
        if kind == 'exclu':
            return ens_nondefini(option) == attendu
        if kind == 'frac':
            return simplify(frac(option) - attendu) == 0
    except Exception as e:
        return None
    return None

# --------------------------------------------------------------- traitement
total, faux = 0, []
for version, jeu in (('A', lignesA), ('B', lignesB)):
    print('=' * 78)
    print('  VERSION', version)
    print('=' * 78)
    for (num, enonce, options) in jeu:
        kind, attendu = verites[(version, num)]
        bonnes = [i for i, o in enumerate(options) if correspond(kind, attendu, o) is True]
        lettre = ''.join('abc'[i] for i in bonnes)
        attendue = corrige[num][0 if version == 'A' else 1]
        distinctes = len(set(options)) == 3
        total += 1
        ok = (lettre == attendue and distinctes)
        if not ok:
            faux.append((version, num, attendue, lettre, options))
        etat = 'OK   ' if ok else 'ERREUR'
        print(f'{etat} Q{num:2d} | corrigé = {attendue} | calcul = {lettre or "aucune"}'
              f' | {re.sub(chr(92)+"s+", " ", enonce)[:40]}')
        print(f'          propositions : {options}')
    print()

print('-' * 78)
print(f'{total} questions contrôlées, {len(faux)} anomalie(s)')
print('RÉSULTAT :', 'AUCUNE ERREUR DE FOND' if not faux else 'ERREURS DÉTECTÉES')
for f in faux:
    print('   !!', f)
sys.exit(0 if not faux else 1)
