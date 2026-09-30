#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vérification indépendante de l'interrogation n°1 (1ère D) :
   - recalcule chaque question avec sympy,
   - retrouve la colonne (a/b/c) correcte,
   - la compare à celle annoncée dans le corrigé,
   - contrôle l'unicité des propositions et la validité des distracteurs.
"""
import re, sys
from sympy import (symbols, sqrt, S, solveset, Interval, Union, FiniteSet,
                   discriminant, Poly, factor, oo, simplify, sympify, expand, Eq, Le)

x = symbols('x', real=True)
TEX = "/home/user/terminish-maths/Interrogations/1ereD/Semestre1/Interrogation_1_Equations_Inequations_2nd_degre.tex"
src = open(TEX, encoding='utf-8').read()

# ---------------------------------------------------------------- parsing
def block(name):
    start = src.index('\\newcommand{\\' + name + '}')
    i = src.index('{%', start) + 2
    depth, j = 1, i
    while depth:
        if src[j] == '{': depth += 1
        elif src[j] == '}': depth -= 1
        j += 1
    return src[i:j-1]

def parse_rows(name):
    rows = []
    for line in block(name).split('\n'):
        line = line.strip()
        if not line or line in ('}',) or not re.match(r'^\d+\s*&', line):
            continue
        parts = [p.strip() for p in line.split(' & ')]
        num = int(parts[0])
        opt = parts[2:5]
        stmt = parts[1]
        rows.append((num, stmt, opt))
    return rows

rowsA, rowsB = parse_rows('lignesA'), parse_rows('lignesB')

# corrigé : lignes "N & \textbf{L} & \textbf{L} & ..."
corr = {}
for line in src.split('\n'):
    m = re.match(r'^(\d+) & \\textbf\{([abc])\} & \\textbf\{([abc])\} &', line.strip())
    if m:
        corr[int(m.group(1))] = (m.group(2), m.group(3))
assert len(corr) == 10, corr

# ------------------------------------------------- normalisation des options
def norm(s):
    s = s.replace('\\,', ' ').replace('\\;', ' ')
    s = s.replace('\\leqslant', '<=').replace('\\geqslant', '>=')
    s = s.replace('\\infty', 'oo').replace('\\pm', '±')
    s = s.replace('{', '').replace('}', '').replace('$', '')
    s = s.replace('−', '-').replace('–', '-')
    s = re.sub(r'\s+', ' ', s).strip()
    return s

INT = r'([+-]?(?:\d+|oo))'
def parse_option(s):
    """→ objet comparable : int, frozenset, ('I',lo,hi,lc,hc), ('U',...), ('SP',a,b), expr"""
    s = norm(s)
    # sommes/produits  S=2 ; P=-3
    if 'S=' in s:
        m = re.findall(r'([SP])\s*=\s*(-?\d+)', s)
        d = {k: int(v) for k, v in m}
        return ('SP', d['S'], d['P'])
    # intervalle  [a ; b]
    m = re.fullmatch(r'([\[\]])\s*' + INT + r'\s*;\s*' + INT + r'\s*([\[\]])', s)
    if m:
        def num(v):
            if v in ('oo', '+oo'): return oo
            if v == '-oo': return -oo
            return int(v)
        lo, hi = num(m.group(2)), num(m.group(3))
        return ('I', lo, hi, m.group(1) == '[', m.group(4) == ']')
    # réunion de demi-droites écrites "x<1 ou x>3"
    m = re.fullmatch(r'x\s*([<>])\s*(-?\d+)\s*ou\s*x\s*([<>])\s*(-?\d+)', s)
    if m:
        return ('R', m.group(1), int(m.group(2)), m.group(3), int(m.group(4)))
    # ensemble fini "2 et 3", "±1 et ±2", "0", "-1"
    if re.fullmatch(r'(-?\d+(\s*(et|,)\s*)?|±\d+(\s*(et|,)\s*)*)+', s):
        vals = []
        for tok in re.split(r'\s*et\s*|\s*,\s*', s):
            tok = tok.strip()
            if tok.startswith('±'):
                v = int(tok[1:]); vals += [v, -v]
            elif tok:
                vals.append(int(tok))
        return frozenset(vals)
    # polynôme (factorisation)
    if '(' in s and 'x' in s:
        e = sympify(s.replace(')(', ')*('), locals={'x': x})
        return Poly(expand(e), x)
    # nombre seul (discriminant)
    if re.fullmatch(r'-?\d+', s):
        return int(s)
    return ('RAW', s)

# ------------------------------------------------------- vérité (sympy)
def roots_of(poly_const):
    return solveset(poly_const, x, S.Reals)

def canon_set(sol):
    """FiniteSet → frozenset d'entiers ; Interval/Union → forme normalisée"""
    if isinstance(sol, FiniteSet):
        vals = set()
        for v in sol:
            v = simplify(v)
            vals.add(int(v))
        return frozenset(vals)
    if isinstance(sol, Interval):
        return ('I', sol.start, sol.end, sol.left_open is False, sol.right_open is False)
    if isinstance(sol, Union):
        return ('RAW', str(sol))
    return ('RAW', str(sol))

def irr_eq(f, g, radical_is_rhs_direct=False):
    """résout sqrt(f) = g (g pouvant contenir sqrt) par élévation au carré + vérification"""
    from sympy import Symbol
    cand = solveset(Eq(f, g**2), x, S.Reals)
    if not isinstance(cand, FiniteSet):
        return ('RAW', str(cand))
    ok = []
    for c in cand:
        try:
            l = float(sqrt(f.subs(x, c)).evalf())
            r = float(g.subs(x, c).evalf())
        except Exception:
            continue
        if abs(l - r) < 1e-9 and l >= -1e-12:
            ok.append(int(simplify(c)))
    return frozenset(sorted(ok))

def irr_le_sqrt(f, g):
    """sqrt(f) <= g  (g réel)"""
    return solveset(Le(sqrt(f), g), x, S.Reals)

def interval_str(iv):
    def s(v):
        if v in (oo,): return '+oo'
        if v in (-oo,): return '-oo'
        return str(v)
    if isinstance(iv, Interval):
        return '%s%s ; %s%s' % ('[' if not iv.left_open else ']', s(iv.start), s(iv.end),
                                ']' if not iv.right_open else '[')
    if isinstance(iv, Union):
        return ' U '.join(interval_str(a) for a in iv.args)
    return str(iv)

# --------------------------------------------- définition des 20 questions
Q = {}
# ---- VERSION A
Q[('A', 1)] = ("Δ", int(discriminant(2*x**2 - 3*x + 1, x)))
Q[('A', 2)] = ("sols", canon_set(roots_of(x**2 - 5*x + 6)))
Q[('A', 3)] = ("SP", int(-4/2), int(-6/2))
Q[('A', 4)] = ("sols", canon_set(roots_of(x**2 - 5*x + 6)))
Q[('A', 5)] = ("poly", Poly(x**2 - 5*x + 4, x))
Q[('A', 6)] = ("ineq", solveset(x**2 - 4*x + 3 <= 0, x, S.Reals))
Q[('A', 7)] = ("sols", canon_set(roots_of(x**4 - 5*x**2 + 4)))
Q[('A', 8)] = ("dom", Interval(2, 6))
Q[('A', 9)] = ("sols", irr_eq(x + 1, x - 1))
Q[('A', 10)] = ("ineq", irr_le_sqrt(x, x - 2))
# ---- VERSION B
Q[('B', 1)] = ("Δ", int(discriminant(x**2 - 4*x + 3, x)))
Q[('B', 2)] = ("sols", canon_set(roots_of(x**2 - 7*x + 12)))
Q[('B', 3)] = ("SP", int(6), int(5))
Q[('B', 4)] = ("sols", canon_set(roots_of(x**2 - 8*x + 15)))
Q[('B', 5)] = ("poly", Poly(x**2 - 7*x + 6, x))
Q[('B', 6)] = ("ineq", solveset(x**2 - 5*x + 6 < 0, x, S.Reals))
Q[('B', 7)] = ("sols", canon_set(roots_of(x**4 - 10*x**2 + 9)))
Q[('B', 8)] = ("dom", Interval(2, 10))
Q[('B', 9)] = ("sols", irr_eq(2*x + 3, x))
Q[('B', 10)] = ("ineq", solveset(Le(sqrt(x + 3), sqrt(5 - x)), x, S.Reals))

# ------------------------------------------------------------- comparaison
def match(truth, opt):
    kind = truth[0]
    val = truth[1:] if len(truth) > 2 else truth[1]
    p = parse_option(opt)
    if kind == 'Δ':
        if isinstance(p, frozenset) and len(p) == 1:
            p = next(iter(p))
        return p == val
    if kind == 'sols':
        return p == val
    if kind == 'SP':
        return isinstance(p, tuple) and p and p[0] == 'SP' and (p[1], p[2]) == val
    if kind == 'poly':
        try:
            return isinstance(p, Poly) and expand(p.as_expr() - val.as_expr()) == 0
        except Exception:
            return False
    if kind == 'ineq' or kind == 'dom':
        t = val if kind == 'ineq' else val
        if isinstance(t, Interval):
            tv = ('I', t.start, t.end, not t.left_open, not t.right_open)
        else:
            tv = ('RAW', interval_str(t))
        # option écrite "x<1 ou x>3"  → réunion de deux demi-droites ouvertes
        if isinstance(p, tuple) and p and p[0] == 'R':
            _, o1, v1, o2, v2 = p
            s1 = Interval(-oo, v1, True, True) if o1 == '<' else Interval(v1, oo, True, True)
            s2 = Interval(-oo, v2, True, True) if o2 == '<' else Interval(v2, oo, True, True)
            u = Union(s1, s2)
            if isinstance(t, Union):
                return t == u
            if isinstance(t, Interval):
                return u == t
            return False
        return p == tv
    return False

def synth(label, rows, key):
    print('=' * 78)
    print('  VERSION', label)
    print('=' * 78)
    ok = True
    for (num, stmt, opts) in rows:
        truth = Q[(label, num)]
        solved = [i for i, o in enumerate(opts) if match(truth, o)]
        letters = 'abc'
        found = ''.join(letters[i] for i in solved)
        expected = corr[num][0 if label == 'A' else 1]
        # unicité des propositions
        parsed = [parse_option(o) for o in opts]
        dup = len(set(map(str, parsed))) != 3
        verdict = 'OK ' if found == expected and not dup else 'ERREUR'
        if verdict != 'OK ':
            ok = False
        print(f'{verdict} Q{num:2d} | corrigé={expected} | calcul={found or "AUCUNE"} | énoncé: {norm(stmt)[:46]}')
        print(f'          propositions: {[norm(o) for o in opts]}  (trouvées: {solved})')
        if dup:
            print('          !! propositions non distinctes')
    return ok

allok = synth('A', rowsA, None)
allok &= synth('B', rowsB, None)

print()
print('Corrigé lu dans le .tex :', corr)
print()
print('RÉSULTAT GLOBAL :', 'AUCUNE ERREUR DE FOND' if allok else 'ERREURS DÉTECTÉES')
sys.exit(0 if allok else 1)
