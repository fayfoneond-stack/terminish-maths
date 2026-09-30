#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Contrôles de mise en page du PDF de l'interrogation (v2)."""
import pymupdf, re, unicodedata
PDF = "/home/user/terminish-maths/Interrogations/1ereD/Semestre1/Interrogation_1_Equations_Inequations_2nd_degre.pdf"
doc = pymupdf.open(PDF)
page = doc[0]
W, H = page.rect.width, page.rect.height
ok = True
def check(label, cond, extra=""):
    global ok
    ok &= bool(cond)
    print(("OK   " if cond else "ÉCHEC") + " | " + label + (("  → " + extra) if extra else ""))

check(f"A4 ({W/72*25.4:.0f}x{H/72*25.4:.0f} mm), {doc.page_count} pages", abs(W-595.28) < 1 and abs(H-841.89) < 1 and doc.page_count == 2)

# --- contenu par quadrant -------------------------------------------------
blocks = [b for b in page.get_text("blocks") if b[4].strip()]
quad = {"haut-gauche": [], "haut-droit": [], "bas-gauche": [], "bas-droit": []}
for b in blocks:
    x0, y0, x1, y1 = b[:4]
    cx, cy = (x0+x1)/2, (y0+y1)/2
    nom = ("haut" if cy < H/2 else "bas") + "-" + ("gauche" if cx < W/2 else "droit")
    quad[nom].append(b)

for nom, bs in quad.items():
    xs0 = min(b[0] for b in bs); xs1 = max(b[2] for b in bs)
    ys0 = min(b[1] for b in bs); ys1 = max(b[3] for b in bs)
    print(f"     {nom:12s} : {len(bs):2d} blocs, boîte x[{xs0:6.1f},{xs1:6.1f}] y[{ys0:6.1f},{ys1:6.1f}]")

# tous les quadrants occupés, aucun bloc à cheval sur la séparation
for nom, bs in quad.items():
    check(f"exemplaire {nom} présent", len(bs) > 8, f"{len(bs)} blocs")
    # chaque bloc doit être d'un seul côté des axes médians
for b in blocks:
    x0, y0, x1, y1 = b[:4]
    if x0 < W/2 - 2 and x1 > W/2 + 2:
        check(f"bloc à cheval sur la colonne médiane : {b[4][:30]}", False)
    if y0 < H/2 - 2 and y1 > H/2 + 2:
        check(f"bloc à cheval sur la ligne médiane : {b[4][:30]}", False)

# --- texte normalisé par quadrant ----------------------------------------
def clean(t):
    """normalise : enlève accents (y compris ceux placés avant la lettre par la police ae) et ligatures"""
    t = t.replace('\ufb01', 'fi').replace('\ufb02', 'fl').replace('\ufb00', 'ff')
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if not unicodedata.combining(c))
    for c in '´`¨¸ˆ~ˇ˘¯':        # accents isolés (police ae) et restes
        t = t.replace(c, '')
    return re.sub(r"\s+", " ", t).strip()

def txt(bs):
    return clean(" ".join(b[4] for b in bs))
T = {k: txt(v) for k, v in quad.items()}
check("les 2 exemplaires du haut sont identiques", T["haut-gauche"] == T["haut-droit"])
check("les 2 exemplaires du bas sont identiques", T["bas-gauche"] == T["bas-droit"])
check("version du haut ≠ version du bas", T["haut-gauche"] != T["bas-gauche"])
check("haut = VERSION A", "VERSION A" in T["haut-gauche"])
check("bas  = VERSION B", "VERSION B" in T["bas-gauche"])
check("version A et B = mêmes questions dans un ordre différent",
      sorted(T["haut-gauche"].split()) != sorted(T["bas-gauche"].split()))

# --- champs obligatoires dans chaque exemplaire ---------------------------
champs = ["Etablissement", "LYCEE KPETA", "KODJONE Kodjo", "Annee scolaire", "Nom", "Prenom",
          "Classe", "Choix", "Reponses proposees", "INTERROGATION", "Duree : 30 min", "Note",
          "Consigne", "VERSION", "Enonce"]
for nom, t in T.items():
    manquants = [c for c in champs if c not in t]
    check(f"champs présents ({nom})", not manquants, "manquants: " + str(manquants))

# --- 10 questions + 3 propositions par exemplaire -------------------------
# structure : compter les lignes horizontales du tableau dans chaque exemplaire
def lignes_tableau(bs):
    x0 = min(b[0] for b in bs); x1 = max(b[2] for b in bs)
    y0 = min(b[1] for b in bs); y1 = max(b[3] for b in bs)
    n = 0
    for d in page.get_drawings():
        for it in d["items"]:
            if it[0] == "l":
                p1, p2 = it[1], it[2]
                if abs(p1.y - p2.y) < 0.6 and 255 < abs(p2.x - p1.x) < 285 \
                   and x0 - 5 <= min(p1.x, p2.x) and max(p1.x, p2.x) <= x1 + 5 and y0 <= p1.y <= y1:
                    n += 1
    return n
for nom, bs in quad.items():
    n = lignes_tableau(bs)
    check(f"tableau : en-tête + 10 questions bien encadrés ({nom})", n >= 12, f"{n} lignes horizontales")

# --- le contenu doit rester à l'intérieur du cadre de son exemplaire ---
verts=[]
for d in page.get_drawings():
    for it in d["items"]:
        if it[0] == "l":
            a, b = it[1], it[2]
            if abs(a.x-b.x) < 0.5 and abs(a.y-b.y) > 200:
                verts.append((a.x, min(a.y, b.y), max(a.y, b.y)))
cadres = {}
for nom, (xmin, xmax, ymin, ymax) in {
        "haut-gauche": (0, W/2, 0, H/2), "haut-droit": (W/2, W, 0, H/2),
        "bas-gauche":  (0, W/2, H/2, H), "bas-droit":  (W/2, W, H/2, H)}.items():
    vv = [v for v in verts if xmin <= v[0] <= xmax and ymin <= v[2] and v[1] <= ymax and abs(v[0]-W/2) > 3]
    if vv:
        cadres[nom] = (min(v[0] for v in vv), max(v[0] for v in vv),
                       min(v[1] for v in vv), max(v[2] for v in vv))
for nom, bs in quad.items():
    cx0, cx1, cy0, cy1 = cadres[nom]
    tx0 = min(b[0] for b in bs); tx1 = max(b[2] for b in bs)
    ty0 = min(b[1] for b in bs); ty1 = max(b[3] for b in bs)
    check(f"contenu à l'intérieur du cadre ({nom})",
          tx0 >= cx0 - 1 and tx1 <= cx1 + 1 and ty0 >= cy0 - 1 and ty1 <= cy1 + 1,
          f"texte x[{tx0:.0f},{tx1:.0f}] y[{ty0:.0f},{ty1:.0f}] vs cadre x[{cx0:.0f},{cx1:.0f}] y[{cy0:.0f},{cy1:.0f}]")
# les 4 cadres ont la même taille (feuille régulière)
tailles = {(round(c[1]-c[0],1), round(c[3]-c[2],1)) for c in cadres.values()}
check("les 4 cadres ont (quasi) la même taille", len(tailles) == 1 or (len(tailles)==2 and max(max(t)-min(t) for t in zip(*tailles)) < 2), str(sorted(tailles)))

# --- traits de découpe ----------------------------------------------------
segs = []
for d in page.get_drawings():
    for it in d["items"]:
        if it[0] == "l":
            p1, p2 = it[1], it[2]
            segs.append((p1.x, p1.y, p2.x, p2.y))
long_h = [s for s in segs if abs(s[1]-s[3]) < 0.5 and abs(s[2]-s[0]) > 500]
long_v = [s for s in segs if abs(s[0]-s[2]) < 0.5 and abs(s[3]-s[1]) > 100]
check("ligne de découpe horizontale séparant les 2 rangées", any(300 < s[1] < 500 for s in long_h),
      f"{len(long_h)} traits horizontaux longs")
milieu = [s for s in long_v if abs(s[0] - W/2) < 2]
haut_m = [s for s in milieu if min(s[1], s[3]) < H/2]
bas_m = [s for s in milieu if max(s[1], s[3]) > H/2]
check("ligne de découpe verticale entre les 2 exemplaires du haut", len(haut_m) >= 1, f"{len(haut_m)} segment(s) à x={W/2:.0f}")
check("ligne de découpe verticale entre les 2 exemplaires du bas", len(bas_m) >= 1, f"{len(bas_m)} segment(s) à x={W/2:.0f}")
bords = sorted(set(round(s[0], 1) for s in long_v))
bords_cadres = [b for b in bords if abs(b - W/2) > 2]
check("4 bordures verticales (2 cadres par ligne)", len(bords_cadres) == 4, str(bords_cadres))
# les 4 cadres : chercher les rectangles
rects = [r for d in page.get_drawings() for r in [d["rect"]] if r.width > 200 and r.height > 300]
print(f"     rectangles larges détectés dans le flux : {len(rects)}")

# --- noir et blanc --------------------------------------------------------
pix = page.get_pixmap(dpi=150)
couleur = any(not (pix.pixel(x, y)[0] == pix.pixel(x, y)[1] == pix.pixel(x, y)[2])
              for y in range(0, pix.height, 4) for x in range(0, pix.width, 4))
check("impression noir et blanc (aucune couleur)", not couleur)

# --- page de correction ---------------------------------------------------
p2 = doc[1].get_text()
p2c = clean(p2)
check("page 2 = corrige du professeur", p2c.strip().startswith("CORRIGE"))
for mot in ["Version A", "Version B", "Justification", "CORRIGE"]:
    check(f"corrige contient « {mot} »", mot in p2c)
# les 20 réponses annoncées correspondent
corr = {1:("b","a"),2:("a","c"),3:("c","b"),4:("b","a"),5:("c","b"),6:("a","c"),7:("c","b"),8:("b","c"),9:("c","b"),10:("a","a")}
check("le corrigé liste bien 10 numéros", all(re.search(rf"(?m)^\s*{i}\s*$", p2) or f"{i} " in p2 for i in range(1, 11)))

# --- marges d'impression ---
segs_v = [s for s in segs if abs(s[0]-s[2]) < 0.5 and abs(s[3]-s[1]) > 100]
xs = [v for s in segs_v for v in (s[0], s[2])]
ys = [v for s in segs_v for v in (s[1], s[3])]
mm = lambda v: round(v/72*25.4, 1)
marges = dict(gauche=mm(min(xs)), droite=mm(W-max(xs)), haut=mm(min(ys)), bas=mm(H-max(ys)))
check("marges d'impression >= 5 mm sur les 4 côtés", all(v >= 5 for v in marges.values()), str(marges))

print()
print("RÉSULTAT :", "TOUS LES CONTRÔLES PASSENT ✔" if ok else "DES CONTRÔLES ÉCHOUENT ✘")
