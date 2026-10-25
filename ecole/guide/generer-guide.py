#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Terminish École — génération du guide PDF de prise en main.

    python3 -m venv /tmp/venvpdf && /tmp/venvpdf/bin/pip install reportlab
    /tmp/venvpdf/bin/python ecole/guide/generer-guide.py \
        documents/GUIDE-TERMINISH-ECOLE.pdf

Le guide est volontairement autonome : il ne lit rien d'autre que ce fichier.
Les captures d'écran n'y figurent pas (elles vieillissent mal) : les chemins de
menu sont donnés entre guillemets, avec le bouton exact à cliquer.
"""

import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (BaseDocTemplate, CondPageBreak, Frame,
                                KeepTogether, NextPageTemplate, PageBreak,
                                PageTemplate, Paragraph, Spacer, Table,
                                TableStyle)
from reportlab.platypus.tableofcontents import TableOfContents

# --------------------------------------------------------------------------- #
# Identité du document
# --------------------------------------------------------------------------- #
TITRE = "Terminish École"
SOUS_TITRE = "Guide de prise en main"
VERSION = "Version 1.1 — octobre 2026"
ETABLISSEMENT = "CEG BOROME — HIHEATRO (Togo)"
SITE = "https://kodjone.alwaysdata.net"

# Palette
VERT = colors.HexColor("#0b6b4a")
VERT_CLAIR = colors.HexColor("#e8f5ef")
VERT_MOYEN = colors.HexColor("#1f9d6b")
OR = colors.HexColor("#b07a10")
OR_CLAIR = colors.HexColor("#fdf6e3")
ROUGE = colors.HexColor("#b3261e")
ROUGE_CLAIR = colors.HexColor("#fdeceb")
BLEU_CLAIR = colors.HexColor("#eef4fb")
BLEU = colors.HexColor("#1d4e89")
GRIS = colors.HexColor("#5b6b66")
GRIS_CLAIR = colors.HexColor("#f4f6f5")
BORD = colors.HexColor("#d7e0dc")
ENCRE = colors.HexColor("#16241f")

# --------------------------------------------------------------------------- #
# Polices
# --------------------------------------------------------------------------- #
POLICE = "DejaVu"
POLICE_MONO = "DejaVuMono"

def enregistrer_polices():
    base = "/usr/share/fonts/truetype/dejavu"
    fichiers = {
        "DejaVu": "DejaVuSans.ttf",
        "DejaVu-Bold": "DejaVuSans-Bold.ttf",
        "DejaVuSerif": "DejaVuSerif.ttf",
        "DejaVuSerif-Bold": "DejaVuSerif-Bold.ttf",
        "DejaVuMono": "DejaVuSansMono.ttf",
        "DejaVuMono-Bold": "DejaVuSansMono-Bold.ttf",
    }
    for nom, fichier in fichiers.items():
        chemin = os.path.join(base, fichier)
        if not os.path.exists(chemin):
            sys.exit(f"Police absente : {chemin}\nInstallez fonts-dejavu-core.")
        pdfmetrics.registerFont(TTFont(nom, chemin))
    for famille, normal, gras in (
        ("DejaVu", "DejaVu", "DejaVu-Bold"),
        ("DejaVuSerif", "DejaVuSerif", "DejaVuSerif-Bold"),
        ("DejaVuMono", "DejaVuMono", "DejaVuMono-Bold"),
    ):
        pdfmetrics.registerFontFamily(famille, normal=normal, bold=gras,
                                      italic=normal, boldItalic=gras)


# --------------------------------------------------------------------------- #
# Styles
# --------------------------------------------------------------------------- #
def styles():
    ss = getSampleStyleSheet()
    s = {}
    s["corps"] = ParagraphStyle(
        "corps", parent=ss["BodyText"], fontName=POLICE, fontSize=9.9,
        leading=15.2, textColor=ENCRE, alignment=TA_JUSTIFY, spaceAfter=7)
    s["corps_gauche"] = ParagraphStyle("corps_gauche", parent=s["corps"],
                                       alignment=TA_LEFT)
    s["intro"] = ParagraphStyle(
        "intro", parent=s["corps"], fontSize=10.8, leading=16.4,
        textColor=colors.HexColor("#2c3f38"), spaceAfter=12)
    s["h1"] = ParagraphStyle(
        "h1", parent=ss["Heading1"], fontName="DejaVu-Bold", fontSize=19,
        leading=23, textColor=VERT, spaceBefore=2, spaceAfter=3,
        keepWithNext=1)
    s["h1_num"] = ParagraphStyle(
        "h1_num", parent=s["h1"], fontSize=30, leading=32,
        textColor=colors.HexColor("#c8ded4"), spaceAfter=0)
    s["h1_sous"] = ParagraphStyle(
        "h1_sous", parent=s["corps"], fontSize=9.6, textColor=GRIS,
        spaceAfter=14, alignment=TA_LEFT)
    s["h1_annexe"] = ParagraphStyle(
        "h1_annexe", parent=s["h1"], spaceBefore=16)
    s["h2"] = ParagraphStyle(
        "h2", parent=ss["Heading2"], fontName="DejaVu-Bold", fontSize=12.6,
        leading=16.4, textColor=ENCRE, spaceBefore=15, spaceAfter=5,
        keepWithNext=1)
    s["h3"] = ParagraphStyle(
        "h3", parent=s["h2"], fontSize=10.6, leading=14,
        textColor=colors.HexColor("#2f4a41"), spaceBefore=11, spaceAfter=3)
    s["puce"] = ParagraphStyle(
        "puce", parent=s["corps"], leftIndent=13, bulletIndent=3,
        spaceAfter=3.4)
    s["puce_num"] = ParagraphStyle(
        "puce_num", parent=s["puce"], leftIndent=19, bulletIndent=2)
    s["code"] = ParagraphStyle(
        "code", parent=s["corps"], fontName=POLICE_MONO, fontSize=8.3,
        leading=12.2, alignment=TA_LEFT, spaceAfter=0, textColor=ENCRE)
    s["cell"] = ParagraphStyle(
        "cell", parent=s["corps"], fontSize=8.7, leading=12.2,
        alignment=TA_LEFT, spaceAfter=0)
    s["cell_b"] = ParagraphStyle("cell_b", parent=s["cell"],
                                 fontName="DejaVu-Bold")
    s["cell_c"] = ParagraphStyle("cell_c", parent=s["cell"], alignment=TA_CENTER)
    s["th"] = ParagraphStyle("th", parent=s["cell"], fontName="DejaVu-Bold",
                             fontSize=8.5, textColor=colors.white)
    s["note"] = ParagraphStyle("note", parent=s["corps"], fontSize=9.2,
                               leading=13.6, spaceAfter=0)
    s["couverture_titre"] = ParagraphStyle(
        "ct", parent=s["corps"], fontName="DejaVu-Bold", fontSize=40,
        leading=44, textColor=colors.white, alignment=TA_LEFT, spaceAfter=2)
    s["couverture_sous"] = ParagraphStyle(
        "cs", parent=s["corps"], fontSize=17, leading=23,
        textColor=colors.HexColor("#d8efe5"), alignment=TA_LEFT, spaceAfter=0)
    s["couverture_meta"] = ParagraphStyle(
        "cm", parent=s["corps"], fontSize=9.6, leading=15,
        textColor=colors.HexColor("#cfe6dd"), alignment=TA_LEFT, spaceAfter=0)
    s["kpi_nombre"] = ParagraphStyle("kn", parent=s["corps"],
                                     fontName="DejaVu-Bold", fontSize=19,
                                     leading=22, textColor=VERT,
                                     alignment=TA_CENTER, spaceAfter=1)
    s["kpi_texte"] = ParagraphStyle("kt", parent=s["corps"], fontSize=8.1,
                                    leading=11.4, textColor=GRIS,
                                    alignment=TA_CENTER, spaceAfter=0)
    s["toc1"] = ParagraphStyle(
        "toc1", parent=s["corps"], fontName="DejaVu-Bold", fontSize=10.3,
        leading=20, textColor=ENCRE, alignment=TA_LEFT, spaceAfter=0)
    s["toc2"] = ParagraphStyle(
        "toc2", parent=s["corps"], fontSize=9, leading=15, textColor=GRIS,
        leftIndent=14, alignment=TA_LEFT, spaceAfter=0)
    return s


S = styles()
LARGEUR = A4[0] - 40 * mm        # largeur utile


# --------------------------------------------------------------------------- #
# Petits fabriques de blocs
# --------------------------------------------------------------------------- #
def para(texte, style="corps"):
    return Paragraph(texte, S[style])


def puces(items, style="puce", symbole="•"):
    return [Paragraph(t, S[style], bulletText=symbole) for t in items]


def numeros(items):
    return [Paragraph(t, S["puce_num"], bulletText=f"{i}.")
            for i, t in enumerate(items, 1)]


def tableau(donnees, largeurs=None, entete=True, zebre=True, centre=(),
            style_extra=None):
    """donnees : liste de listes ; les chaînes deviennent des Paragraph."""
    corps = []
    for i, ligne in enumerate(donnees):
        cellules = []
        for j, cellule in enumerate(ligne):
            if isinstance(cellule, str):
                if entete and i == 0:
                    st = S["th"]
                elif j in centre:
                    st = S["cell_c"]
                else:
                    st = S["cell"]
                cellules.append(Paragraph(cellule, st))
            else:
                cellules.append(cellule)
        corps.append(cellules)
    if largeurs:
        t = Table(corps, colWidths=largeurs, repeatRows=1 if entete else 0)
    else:
        t = Table(corps, repeatRows=1 if entete else 0)
    commandes = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, BORD),
    ]
    if entete:
        commandes += [
            ("BACKGROUND", (0, 0), (-1, 0), VERT),
            ("LINEBELOW", (0, 0), (-1, 0), 0.8, VERT),
        ]
    if zebre:
        for i in range(1 if entete else 0, len(corps)):
            if (i % 2 == 0):
                commandes.append(("BACKGROUND", (0, i), (-1, i), GRIS_CLAIR))
    if style_extra:
        commandes += style_extra
    t.setStyle(TableStyle(commandes))
    return t


def encadre(type_, titre, texte, style="corps"):
    """type_ : info | astuce | attention | erreur | cle"""
    palette = {
        "info": (BLEU_CLAIR, BLEU, "ℹ"),
        "astuce": (VERT_CLAIR, VERT, "★"),
        "attention": (OR_CLAIR, OR, "!"),
        "erreur": (ROUGE_CLAIR, ROUGE, "✕"),
        "cle": (VERT_CLAIR, VERT, "✓"),
    }[type_]
    fond, bord, glyphe = palette
    contenu = []
    if titre:
        contenu.append(Paragraph(f"<b>{glyphe}&nbsp;&nbsp;{titre}</b>",
                                 ParagraphStyle("et", parent=S[style],
                                                textColor=bord,
                                                spaceAfter=3)))
    contenu.append(Paragraph(texte, S[style]))
    t = Table([[contenu]], colWidths=[LARGEUR])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fond),
        ("LINEBEFORE", (0, 0), (0, -1), 2.6, bord),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.Color(
            bord.red, bord.green, bord.blue, alpha=0.35)),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return [Spacer(1, 3), t, Spacer(1, 9)]


def bloc_code(lignes, legende=None):
    contenu = [[Paragraph(l.replace(" ", "&nbsp;") or "&nbsp;", S["code"])]
               for l in lignes]
    if legende:
        contenu.insert(0, [Paragraph(f"<b>{legende}</b>",
                                     ParagraphStyle("cl", parent=S["code"],
                                                    textColor=VERT))])
    t = Table(contenu, colWidths=[LARGEUR])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f7f9f8")),
        ("LINEBEFORE", (0, 0), (0, -1), 2.4, GRIS),
        ("BOX", (0, 0), (-1, -1), 0.4, BORD),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    return [Spacer(1, 3), t, Spacer(1, 9)]


def kpis(triplets):
    cellules = []
    for nombre, texte in triplets:
        cellules.append([Paragraph(nombre, S["kpi_nombre"]),
                         Paragraph(texte, S["kpi_texte"])])
    t = Table([cellules], colWidths=[LARGEUR / len(triplets)] * len(triplets))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), VERT_CLAIR),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#cfe3d8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cfe3d8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return [t, Spacer(1, 10)]


PREFIXES_TOC = {}


def titre_chapitre(numero, titre, sous_titre):
    if numero:
        PREFIXES_TOC[titre] = (f"{numero}. " if numero.isdigit()
                               else f"Annexe {numero} — ")
    return [
        CondPageBreak(112 * mm),
        Paragraph(f"CHAPITRE {numero}", ParagraphStyle(
            "sur", parent=S["corps"], fontName="DejaVu-Bold", fontSize=8.2,
            textColor=VERT_MOYEN, spaceAfter=1)),
        Paragraph(titre, S["h1"]),
        Paragraph(sous_titre, S["h1_sous"]),
    ]


def checklist(items):
    lignes = [[Paragraph("☐", ParagraphStyle("c", parent=S["cell"],
                                             fontSize=11, alignment=TA_CENTER)),
               Paragraph(t, S["cell"])] for t in items]
    t = Table(lignes, colWidths=[10 * mm, LARGEUR - 10 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, BORD),
    ]))
    return t


# --------------------------------------------------------------------------- #
# Gabarit : couverture, en-tête, pied de page
# --------------------------------------------------------------------------- #
class Gabarit(BaseDocTemplate):
    def __init__(self, chemin, **kw):
        BaseDocTemplate.__init__(self, chemin, pagesize=A4,
                                 leftMargin=20 * mm, rightMargin=20 * mm,
                                 topMargin=22 * mm, bottomMargin=18 * mm,
                                 title=f"{TITRE} — {SOUS_TITRE}",
                                 author="Terminish École",
                                 subject="Guide d'utilisation",
                                 creator="Terminish École", **kw)
        cadre = Frame(self.leftMargin, self.bottomMargin,
                      self.width, self.height, id="corps",
                      leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0)
        self.addPageTemplates([
            PageTemplate(id="couverture", frames=[cadre],
                         onPage=self.fond_couverture),
            PageTemplate(id="corps", frames=[cadre], onPage=self.decor_corps),
        ])
        self._chapitre = ""

    # -- décoration -------------------------------------------------------
    def fond_couverture(self, c, doc):
        c.saveState()
        c.setFillColor(VERT)
        c.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
        c.setFillColor(colors.HexColor("#0a5c40"))
        c.rect(0, A4[1] - 105 * mm, A4[0], 105 * mm, stroke=0, fill=1)
        c.setFillColor(OR)
        c.rect(0, 0, A4[0], 9 * mm, stroke=0, fill=1)
        # emblème : toque de graduation dans un carré arrondi
        x0, y0, cote = 20 * mm, A4[1] - 44 * mm - 15 * mm, 15 * mm
        c.setStrokeColor(colors.HexColor("#a9d8c6"))
        c.setLineWidth(1.1)
        c.roundRect(x0, y0, cote, cote, 3.4 * mm, stroke=1, fill=0)
        c.setFillColor(colors.HexColor("#eaf7f1"))
        cx, cy = x0 + cote / 2, y0 + cote * 0.60
        d = cote * 0.30
        p = c.beginPath()
        p.moveTo(cx, cy + d * 0.75)
        p.lineTo(cx + d, cy)
        p.lineTo(cx, cy - d * 0.75)
        p.lineTo(cx - d, cy)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
        p2 = c.beginPath()
        p2.moveTo(cx - d * 0.62, cy - d * 0.20)
        p2.lineTo(cx + d * 0.62, cy - d * 0.20)
        p2.lineTo(cx + d * 0.44, cy - d * 0.62)
        p2.lineTo(cx - d * 0.44, cy - d * 0.62)
        p2.close()
        c.drawPath(p2, stroke=0, fill=1)
        c.setStrokeColor(colors.HexColor("#eaf7f1"))
        c.setLineWidth(0.9)
        c.line(cx + d * 0.96, cy, cx + d * 0.96, cy - d * 0.78)
        c.setFillColor(colors.HexColor("#eaf7f1"))
        c.circle(cx + d * 0.96, cy - d * 0.86, 0.8 * mm, stroke=0, fill=1)
        c.setFillColor(colors.HexColor("#0a5c40"))
        c.setStrokeColor(colors.HexColor("#2e8a6b"))
        c.setLineWidth(0.6)
        c.line(20 * mm, 40 * mm, A4[0] - 20 * mm, 40 * mm)
        c.restoreState()

    def decor_corps(self, c, doc):
        c.saveState()
        # filet supérieur
        c.setStrokeColor(colors.HexColor("#dfe8e4"))
        c.setLineWidth(0.7)
        c.line(20 * mm, A4[1] - 14 * mm, A4[0] - 20 * mm, A4[1] - 14 * mm)
        c.setFont("DejaVu", 7.6)
        c.setFillColor(GRIS)
        c.drawString(20 * mm, A4[1] - 12 * mm,
                     f"{TITRE} · {SOUS_TITRE}")
        c.drawRightString(A4[0] - 20 * mm, A4[1] - 12 * mm, ETABLISSEMENT)
        # pied
        c.setStrokeColor(colors.HexColor("#dfe8e4"))
        c.line(20 * mm, 13 * mm, A4[0] - 20 * mm, 13 * mm)
        c.setFont("DejaVu", 7.6)
        c.drawString(20 * mm, 8.6 * mm, VERSION)
        c.setFillColor(VERT)
        c.setFont("DejaVu-Bold", 8.2)
        c.drawRightString(A4[0] - 20 * mm, 8.6 * mm, str(doc.page))
        c.restoreState()

    # -- table des matières ----------------------------------------------
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            if style == "h1":
                texte = flowable.getPlainText()
                prefixe = PREFIXES_TOC.get(texte, "")
                if prefixe.startswith("Annexe"):
                    prefixe = ""
                self.notify("TOCEntry", (0, prefixe + texte, self.page))
            elif style == "h2":
                texte = flowable.getPlainText()
                self.notify("TOCEntry", (1, texte, self.page))


# --------------------------------------------------------------------------- #
# Contenu
# --------------------------------------------------------------------------- #
def contenu():
    h = []          # histoire

    # ---------------------------------------------------------------- couverture
    h.append(Spacer(1, 44 * mm))
    h.append(Spacer(1, 15 * mm))       # emplacement de l'emblème (dessiné sur la page)
    h.append(Spacer(1, 3 * mm))
    h.append(Paragraph(TITRE, S["couverture_titre"]))
    h.append(Spacer(1, 2 * mm))
    h.append(Paragraph(SOUS_TITRE, S["couverture_sous"]))
    h.append(Spacer(1, 5 * mm))
    h.append(Paragraph("Notes · Bulletins · Statistiques · Examens blancs", S["couverture_meta"]))
    h.append(Spacer(1, 46 * mm))
    h.append(Paragraph(f"<b>{ETABLISSEMENT}</b>", S["couverture_meta"]))
    h.append(Spacer(1, 1.5 * mm))
    h.append(Paragraph(SITE, S["couverture_meta"]))
    h.append(Spacer(1, 1.5 * mm))
    h.append(Paragraph(VERSION, S["couverture_meta"]))
    h.append(NextPageTemplate("corps"))
    h.append(PageBreak())

    # ------------------------------------------------------- mode d'emploi
    h += titre_chapitre("", "Comment utiliser ce guide",
                        "Trois minutes de lecture, puis vous saurez où cliquer.")
    h.append(para(
        "Ce guide suit l'ordre réel d'une année scolaire : on règle l'identité de "
        "l'établissement, on crée les classes, on inscrit les élèves, on saisit "
        "les notes, puis on imprime les bulletins. Chaque chapitre est autonome : "
        "vous pouvez le reprendre sur le seul sujet qui vous intéresse."))
    h += encadre("astuce", "Le principe à retenir",
                 "Tout se fait dans le menu de gauche, et chaque écran commence par "
                 "un filtre : <b>choisissez la classe, puis la période</b>. "
                 "C'est le geste que vous répéterez le plus souvent.")
    h.append(para("Les encadrés du guide", "h2"))
    h += encadre("cle", "À faire",
                 "Une action concrète, à réaliser dans l'application.")
    h += encadre("astuce", "Astuce de terrain",
                 "Un raccourci ou une habitude qui fait gagner du temps.")
    h += encadre("attention", "Attention",
                 "Un piège fréquent, ou une donnée qu'il ne faut pas perdre.")
    h += encadre("erreur", "Si ça ne marche pas",
                 "La cause probable et la solution, sans jargon.")
    h.append(para("Les conventions", "h2"))
    h += puces([
        "Les noms de menus et de boutons sont entre guillemets : "
        "<b>« Paramètres »</b>, <b>« Enregistrer les notes »</b>.",
        "Un chemin de menu s'écrit avec des flèches : "
        "<b>Paramètres → Identité</b>.",
        "Les commandes à taper dans le terminal apparaissent dans un cadre gris.",
    ])
    h.append(PageBreak())

    # ---------------------------------------------------------------- sommaire
    h.append(Paragraph("Sommaire", S["h1"]))
    h.append(Paragraph("Cliquez sur un titre pour y aller directement.", S["h1_sous"]))
    toc = TableOfContents()
    toc.levelStyles = [S["toc1"], S["toc2"]]
    toc.dotsMinLevel = 0
    h.append(toc)
    h.append(PageBreak())

    # ================================================================= 1
    h += titre_chapitre("1", "L'année scolaire en huit étapes",
                        "La vue d'ensemble, avant d'entrer dans le détail.")
    h.append(para(
        "Un établissement se met en route une seule fois, puis vit au rythme des "
        "trimestres. Voici la chaîne complète : chaque étape n'est faite qu'une "
        "fois par an, sauf la saisie des notes et l'impression des bulletins."))
    h.append(tableau([
        ["#", "Étape", "Où", "Quand"],
        ["1", "<b>Régler l'identité</b> : nom, ville, téléphone, logo, en-tête "
              "officiel, chef d'établissement", "Paramètres → Identité",
         "Une fois, à l'ouverture"],
        ["2", "<b>Ouvrir les périodes</b> : 3 trimestres (collège) ou "
              "2 semestres (lycée)", "Paramètres → Périodes",
         "Une fois par an"],
        ["3", "<b>Créer les classes</b> et leur professeur titulaire",
         "Classes", "Septembre"],
        ["4", "<b>Affecter les matières et les coefficients</b>",
         "Classes → crayon (✏)", "Septembre"],
        ["5", "<b>Inscrire les élèves</b> (un par un ou par import)",
         "Élèves", "Septembre, puis à tout moment"],
        ["6", "<b>Créer les comptes des enseignants</b>", "Enseignants",
         "Septembre"],
        ["7", "<b>Saisir les notes</b> : devoirs puis composition",
         "Saisie des notes", "Toute l'année"],
        ["8", "<b>Apprécier, publier, imprimer</b> les bulletins",
         "Bulletins", "Fin de chaque période"],
    ], largeurs=[9 * mm, 74 * mm, 42 * mm, 35 * mm], centre=(0,)))
    h.append(Spacer(1, 6))
    h.append(para("Qui fait quoi", "h2"))
    h.append(para(
        "Quatre rôles existent. Ils ne voient pas les mêmes écrans : c'est ce qui "
        "protège les notes et les identifiants."))
    h.append(tableau([
        ["Rôle", "Voit", "Peut"],
        ["<b>Chef d'établissement</b><br/>(directeur)",
         "Tous les écrans, toutes les classes",
         "Tout : réglages, classes, élèves, comptes des enseignants, "
         "publication des bulletins, abonnement"],
        ["<b>Enseignant</b>",
         "Ses classes et ses matières uniquement",
         "Saisir et corriger les notes de ses matières, imprimer les bulletins "
         "de ses classes ; ne gère aucun identifiant"],
        ["<b>Élève</b>",
         "Ses résultats publiés",
         "Consulter ses bulletins, une fois que la direction les a publiés"],
        ["<b>Éditeur</b><br/>(super administrateur)",
         "La console de la plateforme",
         "Créer les établissements clients, suivre les paiements ; n'accède pas "
         "aux notes"],
    ], largeurs=[38 * mm, 52 * mm, 70 * mm]))
    h += encadre("attention", "Une règle simple",
                 "Seul le chef d'établissement crée, modifie et supprime les "
                 "comptes des enseignants. Un professeur ne peut pas s'inscrire "
                 "lui-même : c'est volontaire, pour qu'aucun compte fantôme ne "
                 "puisse saisir des notes.")
    h.append(para("Ce qu'il faut avoir sous la main le premier jour", "h2"))
    h.append(checklist([
        "La liste des classes avec leurs effectifs",
        "La liste des matières et leurs coefficients, par niveau",
        "Le fichier des élèves (Excel, ou une liste papier à recopier)",
        "Le logo de l'établissement (fichier image)",
        "Le nom du chef d'établissement et son titre exact",
        "Le texte de l'en-tête officiel (ministère, direction régionale)",
        "Une photo de la signature du chef et celle du professeur titulaire",
    ]))

    # ================================================================= 2
    h += titre_chapitre("2", "Se connecter et gérer les comptes",
                        "L'adresse, les rôles, les mots de passe.")
    h.append(para("L'adresse du site", "h2"))
    h.append(para(
        "Une seule adresse, qui ne change jamais, à enregistrer dans les favoris "
        "du Chromebook comme des téléphones :"))
    h += bloc_code([SITE], "Adresse de l'application")
    h.append(para(
        "La page d'accueil publique présente l'établissement ; le bouton "
        "<b>« Se connecter »</b> ouvre l'espace de travail. La même adresse sert "
        "aux enseignants et aux élèves."))
    h += encadre("astuce", "Sur un téléphone",
                 "Ouvrez le site dans Chrome, puis menu ⋮ → <b>« Ajouter à l'écran "
                 "d'accueil »</b>. L'icône se comporte comme une application : "
                 "plein écran, et l'adresse n'a plus à être retapée.")
    h.append(para("Se connecter", "h2"))
    h += numeros([
        "Ouvrez l'adresse ci-dessus.",
        "Saisissez votre <b>adresse email</b> et votre <b>mot de passe</b>.",
        "Cliquez sur <b>« Se connecter »</b>.",
    ])
    h.append(para(
        "Le menu de gauche s'adapte automatiquement au rôle : un enseignant ne "
        "verra jamais « Enseignants » ni « Abonnement »."))
    h.append(para("Le mot de passe a été perdu", "h2"))
    h.append(para(
        "Sur l'écran de connexion, le lien <b>« Mot de passe oublié ? »</b> envoie "
        "une demande. Le chef d'établissement la voit sur son <b>tableau de bord</b>, "
        "dans le bloc <b>« Demandes de mot de passe »</b>, et la traite d'un clic. "
        "Aucun email automatique n'est nécessaire : c'est le chef qui délivre le "
        "nouveau mot de passe, en main propre."))
    h += encadre("attention", "Si plus personne ne peut entrer",
                 "Le mot de passe du chef d'établissement se réinitialise depuis le "
                 "serveur, en une commande, sans perdre aucune donnée :")
    h += bloc_code(["cd ~/app",
                    "ADMIN_PASSWORD=VotreNouveauMotDePasse npm run motdepasse"],
                   "À taper sur le serveur (connexion SSH)")
    h.append(para("Créer le compte d'un enseignant", "h2"))
    h += numeros([
        "Menu <b>« Enseignants »</b> → bouton <b>« + Nouvel enseignant »</b>.",
        "Renseignez le nom, l'adresse email et le téléphone.",
        "Notez le mot de passe provisoire affiché, et remettez-le en main propre "
        "à l'intéressé.",
        "Ouvrez ensuite <b>« Classes »</b> → crayon sur chaque classe concernée, et "
        "cochez les matières que cet enseignant assure.",
    ])
    h += encadre("cle", "Un enseignant sans affectation ne voit rien",
                 "Créer le compte ne suffit pas : tant qu'aucune classe ne lui est "
                 "affectée, sa saisie reste vide. L'affectation se fait classe par "
                 "classe, matière par matière.")
    h.append(para("Les bonnes habitudes", "h2"))
    h += puces([
        "Un compte par personne, jamais un compte partagé : le journal de saisie "
        "garde le nom de celui qui a entré la note.",
        "Un mot de passe d'au moins 10 caractères ; le chef le change à la "
        "première connexion de l'enseignant.",
        "Le bouton de déconnexion, en haut à droite, ferme vraiment la session : "
        "à utiliser systématiquement sur un ordinateur partagé.",
        "Aucun identifiant ne circule par WhatsApp : remise en main propre, ou "
        "réinitialisation par le chef.",
    ])

    # ================================================================= 3
    h += titre_chapitre("3", "Les réglages de départ",
                        "Trente minutes, une seule fois — et tout le reste en dépend.")
    h.append(para(
        "Ces réglages déterminent ce qui sera imprimé sur <b>chaque</b> bulletin. "
        "Faites-les avant la première saisie de notes, sinon il faudra tout "
        "réimprimer."))
    h.append(para("3.1 L'identité de l'établissement", "h2"))
    h.append(para("Chemin : <b>Paramètres → Identité</b>."))
    h.append(tableau([
        ["Champ", "Ce qu'il faut saisir", "Où ça apparaît"],
        ["Nom de l'établissement", "Le nom officiel, en majuscules",
         "En-tête du bulletin, menu de gauche, site public"],
        ["Type", "Collège, lycée ou mixte",
         "Détermine trimestres ou semestres"],
        ["Ville, adresse, BP", "Localisation exacte", "En-tête du bulletin"],
        ["Téléphone, email", "Ceux de l'établissement", "Pied du bulletin, site public"],
        ["Année scolaire", "Par exemple 2026-2027",
         "En-tête du bulletin et matricules"],
        ["Devise", "FCFA", "Montants des paiements"],
        ["Logo", "Fichier image carré, 200 × 200 pixels suffit",
         "En haut à gauche du bulletin"],
        ["En-tête officiel", "Ministère, région, préfecture, inspection",
         "Bandeau supérieur du bulletin"],
        ["Chef d'établissement", "Nom + titre (par exemple « Le Chef "
                                 "d'Établissement »)", "Bloc de signature à droite"],
    ], largeurs=[36 * mm, 70 * mm, 54 * mm]))
    h += encadre("astuce", "Le logo",
                 "Importez une image <b>carrée</b> et pas trop lourde (moins de "
                 "300 Ko). Le site la réduit automatiquement, et elle est envoyée "
                 "sur le stockage externe : elle ne sera donc jamais perdue.")
    h += encadre("attention", "L'en-tête officiel",
                 "C'est un champ <b>libre</b> : recopiez exactement les mentions de "
                 "vos bulletins papier habituels (République Togolaise, Ministère…). "
                 "Chaque ligne saisie sera imprimée telle quelle.")
    h.append(para("3.2 Ouvrir les périodes", "h2"))
    h.append(para("Chemin : <b>Paramètres → Périodes & verrouillage</b>."))
    h.append(para(
        "Un établissement de type <b>collège</b> travaille par trimestres "
        "(T1, T2, T3) ; un <b>lycée</b> par semestres (S1, S2). Les périodes sont "
        "créées automatiquement : il ne reste qu'à vérifier leurs dates."))
    h.append(tableau([
        ["Statut", "Effet"],
        ["<b>Ouverte</b>", "Les enseignants peuvent saisir et corriger les notes."],
        ["<b>Clôturée</b>", "La saisie est verrouillée pour les enseignants. Le chef "
                           "d'établissement, lui, garde toujours la main."],
    ], largeurs=[30 * mm, 130 * mm]))
    h += encadre("cle", "Le bon réflexe de fin de trimestre",
                 "Après le conseil de classe et l'impression des bulletins, passez "
                 "la période en <b>« Clôturée »</b>. Plus aucune note ne pourra "
                 "bouger par erreur, et les moyennes resteront conformes au bulletin "
                 "distribué aux familles.")
    h.append(para("3.3 La formule de la moyenne", "h2"))
    h.append(para("Chemin : <b>Paramètres → Calcul des moyennes</b>."))
    h.append(para(
        "Deux formules sont proposées. Le choix vaut pour tout l'établissement et "
        "s'applique à chaque matière, avant la pondération par les coefficients."))
    h.append(tableau([
        ["Formule", "Calcul d'une matière", "Quand la choisir"],
        ["<b>Devoirs + 2 × Composition</b><br/>(co2, par défaut)",
         "(Devoir 1 + Devoir 2) ÷ 2, puis "
         "(moyenne des devoirs + 2 × Composition) ÷ 3",
         "Le usage le plus répandu au collège : la composition pèse la moitié."],
        ["<b>Moyenne + Composition</b><br/>(moy_co)",
         "(moyenne des devoirs + Composition) ÷ 2",
         "Quand l'établissement veut un partage strictement égalitaire."],
    ], largeurs=[40 * mm, 66 * mm, 54 * mm]))
    h.append(para("<b>Exemple chiffré.</b> Un élève a 12 et 14 en devoirs, 9 en "
                  "composition.", "h3"))
    h.append(tableau([
        ["Formule", "Détail", "Moyenne de la matière"],
        ["Devoirs + 2 × Composition", "((12 + 14) ÷ 2 + 2 × 9) ÷ 3 = (13 + 18) ÷ 3",
         "<b>10,33</b>"],
        ["Moyenne + Composition", "(13 + 9) ÷ 2", "<b>11,00</b>"],
    ], largeurs=[52 * mm, 76 * mm, 32 * mm], centre=(2,)))
    h += encadre("attention", "Ne changez pas de formule en cours d'année",
                 "La formule s'applique à tous les calculs affichés, y compris les "
                 "bulletins déjà imprimés si vous les rééditez. Choisissez-la en "
                 "septembre et ne la touchez plus jusqu'en juin.")
    h.append(para("3.4 Les matières et leur nom par cycle", "h2"))
    h.append(para("Chemin : <b>Matières</b> → crayon (✏) sur une matière."))
    h.append(para(
        "Une même discipline peut porter deux noms : l'un au collège, l'autre au "
        "lycée. Le site imprime automatiquement le bon, selon le cycle de la classe."))
    h.append(tableau([
        ["Champ", "Collège", "Lycée"],
        ["Nom de la matière", "Physique-Chimie et Technologie (PCT)", "Physique-Chimie"],
    ], largeurs=[50 * mm, 58 * mm, 52 * mm]))
    h += encadre("astuce", "Le champ « Nom au collège (facultatif) »",
                 "Saisissez-y « Physique-Chimie et Technologie (PCT) » : les classes "
                 "de collège afficheront ce libellé, les classes de lycée garderont "
                 "« Physique-Chimie ». Un seul champ à remplir, deux bulletins "
                 "corrects.")
    h += encadre("cle", "Vérification avant d'aller plus loin",
                 "Ouvrez <b>Paramètres → Identité</b> et relisez chaque champ à voix "
                 "haute. Une faute de frappe ici se retrouvera sur les 143 bulletins "
                 "de l'établissement.")

    # ================================================================= 4
    h += titre_chapitre("4", "Classes, matières et coefficients",
                        "L'ossature pédagogique de l'année.")
    h.append(para("Créer une classe", "h2"))
    h.append(para("Chemin : <b>Classes</b> → bouton <b>« + Nouvelle classe »</b>."))
    h.append(tableau([
        ["Champ", "Exemple", "Remarque"],
        ["Nom", "6ème A", "Le nom imprimé sur le bulletin"],
        ["Niveau", "6e", "Sert aux statistiques par niveau"],
        ["Cycle", "Collège ou lycée", "Détermine trimestres ou semestres"],
        ["Série", "A, C, D… (lycée uniquement)", "Laissez vide au collège"],
        ["Professeur titulaire", "M. ADJOVI", "Il signe le bulletin de la classe"],
    ], largeurs=[36 * mm, 52 * mm, 72 * mm]))
    h += encadre("astuce", "Deux façons de désigner le titulaire",
                 "Si le professeur a un compte sur le site, choisissez-le dans la "
                 "liste : son nom viendra automatiquement. Sinon, utilisez le champ "
                 "libre <b>« Nom affiché (si aucun compte) »</b>.")
    h.append(para("Affecter les matières et les coefficients", "h2"))
    h += numeros([
        "Dans <b>« Classes »</b>, cliquez sur le crayon (✏) à droite de la classe.",
        "Cochez chaque matière enseignée dans cette classe.",
        "Saisissez le coefficient de chaque matière (1 par défaut ; 2, 3 ou 4 "
        "selon votre règlement).",
        "Enregistrez.",
    ])
    h.append(para("À quoi sert le coefficient", "h2"))
    h.append(para(
        "La moyenne générale n'est pas la moyenne simple des matières : chaque "
        "matière pèse selon son coefficient."))
    h += bloc_code(["Moyenne générale = Σ (moyenne de la matière × coefficient)",
                    "                  ÷ Σ des coefficients"])
    h.append(para("<b>Exemple.</b> Maths (coefficient 4) : 12. Français "
                  "(coefficient 3) : 15. Anglais (coefficient 2) : 9. Histoire "
                  "(coefficient 2) : 10.", "h3"))
    h += bloc_code(["(12×4 + 15×3 + 9×2 + 10×2) ÷ (4 + 3 + 2 + 2)",
                    "= (48 + 45 + 18 + 20) ÷ 11 = 131 ÷ 11 ≈ 11,91"])
    h += encadre("attention", "Une matière oubliée fausse tout",
                 "Si une matière enseignée n'est pas cochée dans la classe, elle "
                 "n'apparaîtra pas sur le bulletin et sa note ne comptera pas. "
                 "Vérifiez la liste une fois, classe par classe, en septembre.")
    h.append(para("Le rang et la mention", "h2"))
    h.append(para(
        "Rang et mention sont calculés automatiquement, à l'intérieur de la classe, "
        "pour la période choisie. Aucun calcul à faire à la main."))
    h.append(tableau([
        ["Moyenne générale", "Mention"],
        ["Moins de 10", "Insuffisant"],
        ["10 à 11,99", "Passable"],
        ["12 à 13,99", "Assez bien"],
        ["14 à 15,99", "Bien"],
        ["16 à 17,99", "Très bien"],
        ["18 et plus", "Excellent"],
    ], largeurs=[60 * mm, 100 * mm], centre=(1,)))

    # ================================================================= 5
    h += titre_chapitre("5", "Les élèves",
                        "Inscrire vite, sans se tromper de classe.")
    h.append(para("Inscrire un élève", "h2"))
    h.append(para("Chemin : <b>Élèves</b> → bouton <b>« + Nouvel élève »</b>."))
    h.append(tableau([
        ["Champ", "Obligatoire ?", "Remarque"],
        ["Nom et prénom", "Oui", "Le nom est mis en majuscules automatiquement"],
        ["Sexe", "Oui", "Sert aux statistiques filles / garçons"],
        ["Date de naissance", "Recommandé", "Format année-mois-jour : 2013-03-14"],
        ["Lieu de naissance", "Facultatif", "Utile pour les documents officiels"],
        ["Classe", "Oui", "L'élève apparaît aussitôt dans la saisie des notes"],
        ["Tuteur et téléphone", "Recommandé", "Sert au suivi des familles"],
        ["Matricule", "Automatique", "Généré à partir de l'année scolaire"],
    ], largeurs=[36 * mm, 26 * mm, 98 * mm]))
    h += encadre("attention", "Le tuteur n'apparaît pas sur le bulletin",
                 "Le nom et le téléphone du tuteur sont des informations "
                 "administratives, conservées dans le dossier de l'élève. Elles ne "
                 "sont jamais imprimées sur le bulletin : celui-ci est remis à la "
                 "famille, il ne contient pas ces coordonnées.")
    h.append(para("Importer toute une liste d'un coup", "h2"))
    h.append(para(
        "C'est la méthode à utiliser pour les 143 élèves d'un établissement : "
        "deux minutes au lieu d'une soirée."))
    h += numeros([
        "Menu <b>« Élèves »</b> → bouton <b>« Importer »</b>.",
        "Collez les lignes depuis Excel, ou tapez-les dans la zone de texte.",
        "Choisissez éventuellement une <b>classe par défaut</b>.",
        "Cliquez sur <b>« Importer les élèves »</b>.",
    ])
    h.append(para("Le format attendu, une ligne par élève :", "h3"))
    h += bloc_code(["NOM ; PRÉNOM ; SEXE ; DATE DE NAISSANCE ; CLASSE ; TUTEUR ; TÉLÉPHONE",
                    "",
                    "ADJOVI;Ama;F;2012-03-14;6ème A;ADJOVI Kossi;+228 90 00 00 00",
                    "KOUASSI;Elom;M;2011-11-02;5ème A;;"])
    h += puces([
        "Le séparateur peut être <b>;</b>, <b>,</b> ou une tabulation "
        "(copier-coller direct depuis Excel).",
        "Les <b>matricules sont générés automatiquement</b> : ne les inventez pas.",
        "Le nom de classe doit correspondre <b>exactement</b> à une classe déjà "
        "créée (6ème A et 6eme A sont deux classes différentes).",
        "Un bilan s'affiche à la fin : nombre d'élèves créés, et les lignes "
        "refusées avec leur numéro.",
    ])
    h += encadre("astuce", "Créer les classes d'abord",
                 "L'import se fait toujours <b>après</b> la création des classes. "
                 "Si une classe manque, laissez la colonne vide et choisissez une "
                 "classe par défaut : vous déplacerez les élèves ensuite.")
    h.append(para("Retrouver et exporter la liste", "h2"))
    h += puces([
        "La barre de recherche filtre par nom, prénom ou matricule.",
        "Le filtre de classe n'affiche qu'une division.",
        "<b>« Export CSV »</b> télécharge la liste complète : c'est votre "
        "sauvegarde de secours des inscriptions, ouvrable dans Excel.",
    ])
    h.append(para("Un élève quitte l'établissement", "h2"))
    h.append(para(
        "Le bouton <b>corbeille</b> de la ligne de l'élève ne supprime rien : il "
        "<b>archive</b>. L'élève disparaît des listes actives, de la saisie des "
        "notes et des bulletins imprimés, mais son dossier et ses notes restent "
        "conservés. Pour le réintégrer, repassez son statut sur <b>« actif »</b>."))

    # ================================================================= 6
    h += titre_chapitre("6", "La saisie des notes",
                        "Le geste quotidien des enseignants — et la saisie à distance.")
    h.append(para("Ouvrir la grille", "h2"))
    h.append(para("Chemin : <b>Saisie des notes</b>."))
    h += numeros([
        "Choisissez la <b>classe</b>.",
        "Choisissez la <b>matière</b>.",
        "Choisissez la <b>période</b> (trimestre ou semestre).",
        "Saisissez les notes, puis cliquez sur <b>« Enregistrer les notes »</b>.",
    ])
    h.append(para(
        "La grille présente une ligne par élève et trois colonnes : "
        "<b>Devoir 1</b>, <b>Devoir 2</b>, <b>Composition</b>. La moyenne de la "
        "matière se calcule et s'affiche au fur et à mesure."))
    h.append(para("Les raccourcis qui changent tout", "h2"))
    h.append(tableau([
        ["Touche", "Effet"],
        ["<b>Entrée</b>", "Descend à l'élève suivant (le champ est présélectionné : "
                          "on tape directement la note suivante)"],
        ["<b>Ctrl + S</b>", "Enregistre toute la grille, sans cliquer"],
        ["<b>Maj + Tab</b>", "Revient au champ précédent"],
        ["<b>Échap</b>", "Ferme une fenêtre ouverte"],
    ], largeurs=[34 * mm, 126 * mm]))
    h += encadre("astuce", "Saisir 40 notes en deux minutes",
                 "Cliquez dans la première case, tapez la note, appuyez sur "
                 "<b>Entrée</b>, tapez la suivante… À la fin, <b>Ctrl + S</b>. "
                 "La main ne quitte jamais le clavier.")
    h.append(para("Les élèves absents", "h2"))
    h.append(para(
        "Sous chaque colonne, une case <b>« abs. »</b> marque l'absence à un devoir "
        "ou à la composition. Une absence n'est pas un zéro : la note est ignorée "
        "dans le calcul, ce qui évite de pénaliser un élève malade."))
    h += encadre("attention", "Absent ≠ 0",
                 "Si vous saisissez 0 pour un absent, sa moyenne s'effondre et son "
                 "rang devient injuste. Cochez <b>« abs. »</b> : la mention apparaît "
                 "sur le bulletin, et la moyenne est calculée sur les notes réelles.")
    h.append(para("Qui peut modifier quoi", "h2"))
    h.append(tableau([
        ["Situation", "Enseignant", "Chef d'établissement"],
        ["Période ouverte", "Saisit et corrige ses matières", "Saisit et corrige tout"],
        ["Période clôturée", "Grille en lecture seule", "Peut encore corriger"],
        ["Matière d'un collègue", "Ne la voit pas", "La voit"],
    ], largeurs=[52 * mm, 54 * mm, 54 * mm]))
    h.append(para("La saisie à distance", "h2"))
    h.append(para(
        "L'enseignant n'a pas besoin d'être dans l'établissement : depuis son "
        "téléphone, il ouvre le site, se connecte, et saisit la grille comme sur un "
        "ordinateur. Aucune installation, aucun logiciel. Les notes arrivent "
        "directement dans la base du serveur, et le chef les voit immédiatement."))
    h += encadre("astuce", "Sur téléphone",
                 "Le tableau défile horizontalement : faites glisser avec le doigt. "
                 "Les champs de saisie sont volontairement grands, pour éviter les "
                 "fautes de frappe. Le menu se referme dès qu'on touche la page à côté.")
    h.append(para("Se relire avant de valider", "h2"))
    h.append(checklist([
        "Toutes les notes sont comprises entre 0 et 20",
        "Aucune case vide par oubli (les vrais absents sont cochés « abs. »)",
        "La bonne période est sélectionnée en haut de l'écran",
        "La moyenne affichée en bas de la grille paraît plausible",
        "La grille a bien été enregistrée (message de confirmation)",
    ]))

    # ================================================================= 7
    h += titre_chapitre("7", "Les bulletins",
                        "Le cœur du métier : calculer, apprécier, publier, imprimer.")
    h.append(para("Comment le bulletin est calculé", "h2"))
    h.append(para(
        "Rien n'est saisi à la main : tout découle des notes. L'ordre de calcul est "
        "toujours le même."))
    h += numeros([
        "<b>Moyenne de la matière</b> : selon la formule choisie dans les "
        "paramètres (devoirs + 2 × composition, ou moyenne + composition).",
        "<b>Moyenne générale</b> : somme des (moyenne × coefficient) divisée par la "
        "somme des coefficients.",
        "<b>Rang</b> : classement des élèves de la classe, du meilleur au moins bon.",
        "<b>Mention</b> : déduite de la moyenne générale.",
        "<b>Appréciation</b> : proposée automatiquement, puis modifiable par la "
        "direction.",
    ])
    h.append(para("L'écran Bulletins", "h2"))
    h.append(para("Chemin : <b>Bulletins</b>."))
    h += puces([
        "Choisissez la <b>classe</b>, puis la <b>source</b> : une période "
        "(trimestre ou semestre) ou un examen blanc.",
        "Le tableau affiche le rang, l'élève, la moyenne, la moyenne de composition, "
        "la mention, le nombre de matières évaluées et l'appréciation.",
        "La colonne <b>« Publication »</b> indique <b>Brouillon</b> ou "
        "<b>Publié</b>.",
    ])
    h.append(para("Apprécier un élève", "h2"))
    h.append(para(
        "Cliquez sur le crayon à côté de l'appréciation. Le site propose une phrase "
        "cohérente avec la moyenne et le rang ; vous pouvez la réécrire librement "
        "(« Élève sérieux, doit participer davantage à l'oral »). Cette "
        "appréciation apparaît dans le bloc du professeur titulaire."))
    h.append(para("Publier — et ce que voit l'élève", "h2"))
    h.append(tableau([
        ["État", "L'élève voit", "Le bulletin papier"],
        ["<b>Brouillon</b>", "Rien, ou un message « non encore publié »", "Peut être imprimé"],
        ["<b>Publié</b>", "Sa moyenne, son rang, sa mention, son bulletin", "Imprimable"],
    ], largeurs=[30 * mm, 70 * mm, 60 * mm]))
    h.append(para(
        "Le bouton <b>« Publier »</b> publie toute la classe d'un coup ; un second "
        "clic dépublie. Publiez au moment de la distribution des bulletins : avant, "
        "les familles n'ont pas encore été reçues."))
    h += encadre("attention", "Dépublier après distribution",
                 "Dépublier retire immédiatement l'accès aux élèves et aux parents. "
                 "Ne le faites pas « pour corriger » : corrigez d'abord la note, "
                 "puis republiez.")
    h.append(para("Imprimer", "h2"))
    h.append(tableau([
        ["Bouton", "Ce qu'il produit", "Quand l'utiliser"],
        ["<b>« Imprimer la classe »</b>",
         "Tous les bulletins de la classe, un par page",
         "Distribution de fin de trimestre"],
        ["<b>Imprimer</b> sur une ligne", "Le bulletin d'un seul élève",
         "Un élève absent le jour de la distribution"],
        ["<b>« Bulletins de composition »</b>",
         "Bulletins dont la moyenne est calculée sur la composition seule",
         "Conseil de classe, ou bulletin intermédiaire"],
    ], largeurs=[44 * mm, 60 * mm, 56 * mm]))
    h += encadre("astuce", "Imprimer en PDF plutôt que sur papier",
                 "Dans la fenêtre d'impression, choisissez la destination "
                 "<b>« Enregistrer au format PDF »</b>. Le fichier est archivé sur "
                 "l'ordinateur, réexpédiable par email, et ne consomme rien sur le "
                 "serveur (un bulletin n'occupe <b>aucun octet</b> de stockage).")
    h.append(para("Ce qui est imprimé sur le bulletin", "h2"))
    h += puces([
        "Le <b>logo</b> et l'<b>en-tête officiel</b> réglés dans l'identité",
        "Le nom de l'établissement, la ville, le téléphone et l'email",
        "L'élève, sa classe, son matricule et la période",
        "Le tableau des matières : moyenne, coefficient, moyenne × coefficient",
        "La moyenne générale, le <b>rang</b>, la <b>mention</b>, l'appréciation",
        "La colonne <b>« Signature / du professeur »</b>, matière par matière",
        "Le bloc <b>« Le Professeur titulaire »</b> (à gauche) et le bloc "
        "<b>« Le Chef d'Établissement »</b> (à droite)",
    ])
    h += encadre("cle", "La signature n'est pas une image scannée à chaque fois",
                 "La photo de la signature est importée <b>une seule fois</b> et "
                 "réutilisée sur tous les bulletins de l'année. Elle est enregistrée "
                 "avec les réglages de l'établissement, et envoyée sur le stockage "
                 "externe : elle ne sera jamais perdue.")
    h.append(para("Vérifications avant d'imprimer 143 bulletins", "h2"))
    h.append(checklist([
        "L'en-tête officiel est exact (relisez-le une fois à l'écran)",
        "Le nom de l'établissement, la ville et l'année scolaire sont bons",
        "Chaque classe a bien son professeur titulaire",
        "La formule de moyenne correspond au règlement de l'établissement",
        "Les coefficients sont ceux du règlement",
        "Un bulletin de contrôle est imprimé et relu par le chef",
        "Les appréciations sont saisies pour tous les élèves",
        "La période est correcte (T1, T2, T3… pas la précédente)",
    ]))
    h += encadre("attention", "Le réflexe qui évite le drame",
                 "Avant d'imprimer toute la classe, ouvrez <b>un</b> bulletin et "
                 "vérifiez-le à l'écran. Une erreur d'en-tête corrigée après tirage "
                 "coûte 143 feuilles et une réimpression.")

    # ================================================================= 8
    h += titre_chapitre("8", "Les examens blancs",
                        "Simuler les résultats avant l'examen officiel.")
    h.append(para(
        "Un examen blanc se déroule comme une période ordinaire, mais il ne "
        "remplace pas le trimestre : il sert à situer les élèves avant l'épreuve "
        "réelle, et à repérer les matières fragiles."))
    h.append(para("Créer un examen blanc", "h2"))
    h += numeros([
        "Menu <b>« Examens blancs »</b> → <b>« + Nouvel examen »</b>.",
        "Donnez-lui un nom parlant : « Examen blanc n°1 — février 2027 ».",
        "Choisissez la ou les classes concernées.",
        "Définissez les épreuves : matière, barème et coefficient.",
    ])
    h.append(para("Saisir les notes de l'examen", "h2"))
    h.append(para(
        "Dans <b>« Saisie des notes »</b>, choisissez l'examen comme source plutôt "
        "qu'une période. La grille devient une simple colonne de notes par épreuve, "
        "avec la case <b>« abs. »</b>."))
    h.append(para("Lire les résultats", "h2"))
    h.append(para(
        "Dans <b>« Bulletins »</b>, sélectionnez l'examen comme source : le tableau "
        "affiche alors les résultats simulés, avec le rang, la moyenne et la mention "
        "de chaque élève. Rien n'est publié aux élèves : c'est un document de "
        "travail pour la direction et le conseil des professeurs."))
    h += encadre("astuce", "À quoi cela sert vraiment",
                 "Un examen blanc passé en février montre, matière par matière, où "
                 "la classe décroche. Vous ajustez les révisions sur les deux "
                 "matières les plus faibles, au lieu de tout réviser à l'aveugle.")

    # ================================================================= 9
    h += titre_chapitre("9", "Les statistiques",
                        "Voir en un écran ce que les colonnes de notes ne disent pas.")
    h.append(para("Chemin : <b>Statistiques</b>."))
    h.append(para(
        "Les statistiques se recalculent à chaque ouverture, à partir des notes "
        "réellement saisies : aucun chiffre n'est saisi à la main, aucun ne peut "
        "être faux tant que les notes sont justes."))
    h.append(tableau([
        ["Indicateur", "Ce qu'il révèle", "Décision qu'il permet"],
        ["Moyenne de la classe", "Le niveau général",
         "Comparer les divisions d'un même niveau"],
        ["Taux de réussite", "La part des élèves à 10 et plus",
         "Repérer une classe en difficulté"],
        ["Meilleure et plus faible moyenne", "L'amplitude de la classe",
         "Savoir si l'écart est creusé"],
        ["Répartition par mention", "La silhouette de la classe",
         "Préparer le conseil de classe"],
        ["Résultats par matière", "Les disciplines qui tirent vers le bas",
         "Cibler les remédiations"],
        ["Filles / garçons", "L'équilibre des résultats",
         "Argumenter un projet pédagogique"],
    ], largeurs=[42 * mm, 52 * mm, 66 * mm]))
    h += encadre("astuce", "Le rituel de fin de période",
                 "Ouvrez <b>Statistiques</b> avant chaque conseil de classe, "
                 "classe par classe, et notez les deux matières les plus faibles. "
                 "C'est tout ce qu'il faut pour animer la réunion.")

    # ================================================================= 10
    h += titre_chapitre("10", "Sauvegardes, stockage et capacité",
                        "Où vivent vos données, et combien de temps elles tiennent.")
    h.append(para("Où sont les données", "h2"))
    h.append(para(
        "Tout tient dans <b>un seul fichier</b> sur le serveur : la base de données. "
        "Élèves, classes, matières, notes, bulletins, paiements. Ce fichier se copie "
        "comme n'importe quel fichier, et c'est cette copie qui constitue une "
        "sauvegarde."))
    h += bloc_code(["~/app/data/terminish-ecole.db"], "Chemin de la base sur le serveur")
    h.append(para("Sauvegarder", "h2"))
    h += bloc_code(["cd ~/app", "npm run backup"],
                   "Sur le serveur : crée une copie horodatée")
    h.append(para(
        "La commande conserve les <b>14 dernières</b> copies et supprime les plus "
        "anciennes. Une copie faite après un conseil de classe, une fois par "
        "trimestre, suffit dans la plupart des cas ; une copie par mois est plus "
        "confortable."))
    h += encadre("attention", "Une sauvegarde sur le même disque ne protège pas de tout",
                 "Si le serveur disparaît, la copie disparaît avec lui. L'idéal est "
                 "d'envoyer la base sur <b>MEGA</b> (25 Go gratuits, déjà configuré) : "
                 "le fichier quitte alors l'hébergeur.")
    h.append(para("Le bouton « Base de données »", "h2"))
    h.append(para(
        "En bas du menu de gauche, réservé au chef d'établissement : il affiche le "
        "dossier réellement utilisé et la taille du fichier. C'est le premier "
        "réflexe en cas de doute sur l'emplacement des données."))
    h.append(para("Le stockage des images", "h2"))
    h.append(para(
        "Les fichiers lourds (logo, signature, pièces jointes) ne sont pas stockés "
        "dans la base : ils partent sur un stockage externe, dans cet ordre."))
    h.append(tableau([
        ["Ordre", "Service", "Capacité", "Rôle"],
        ["1", "<b>MEGA</b>", "25 Go gratuits", "Destination principale des fichiers"],
        ["2", "<b>Cloudinary</b>", "25 crédits / mois gratuits",
         "CDN : les images s'affichent plus vite"],
        ["3", "<b>Disque du serveur</b>", "Le Go de l'offre",
         "Secours : le site fonctionne toujours, même sans Internet"],
    ], largeurs=[14 * mm, 34 * mm, 44 * mm, 68 * mm], centre=(0,)))
    h.append(para(
        "<b>Ce qui ne part jamais à l'extérieur :</b> les notes, les élèves, les "
        "bulletins, les paiements. Ils restent dans la base, sur le serveur."))
    h.append(para("Combien de bulletins tiennent ?", "h2"))
    h.append(para(
        "Question posée souvent, et la réponse est rassurante : <b>un bulletin "
        "n'occupe aucun octet</b>. Il est fabriqué à l'affichage, jamais enregistré. "
        "Seules les notes sont stockées, et elles pèsent très peu."))
    h.append(tableau([
        ["Élément", "Poids mesuré", "Remarque"],
        ["Une note", "≈ 68 octets", "Mesuré sur une base de 7 200 notes"],
        ["Un élève pour un trimestre (36 notes)", "≈ 2,5 Ko", "Toutes matières, 3 évaluations"],
        ["Un bulletin imprimé", "0 octet", "Généré à la volée, jamais stocké"],
        ["Le site lui-même (code + bibliothèques)", "≈ 29 Mo", "Une seule fois"],
    ], largeurs=[60 * mm, 32 * mm, 68 * mm]))
    h.append(Spacer(1, 4))
    h += kpis([
        ("143 élèves × 3 trimestres", "429 bulletins ≈ <b>1 Mo</b> par an"),
        ("≈ 26 000 bulletins", "avec les 14 sauvegardes locales"),
        ("≈ 400 000 bulletins", "sans sauvegarde locale"),
    ])
    h += encadre("cle", "Conclusion pratique",
                 "Le stockage ne sera jamais votre limite. Sur 60 ans, votre "
                 "établissement produira moins de 60 Mo de données. La vraie limite, "
                 "ce sera le temps de saisie des notes — pas le disque.")

    # ================================================================= 11
    h += titre_chapitre("11", "Hébergement, abonnement et coûts",
                        "Ce que coûte réellement le site, et quand payer.")
    h.append(para("L'hébergement actuel", "h2"))
    h.append(tableau([
        ["Élément", "Valeur"],
        ["Hébergeur", "alwaysdata (offre gratuite)"],
        ["Adresse", SITE],
        ["Disque", "1 Go"],
        ["Mémoire", "256 Mo"],
        ["Coût", "<b>0 F par mois</b>, sans carte bancaire"],
        ["Sauvegardes de l'hébergeur", "3 jours"],
    ], largeurs=[54 * mm, 106 * mm]))
    h += encadre("attention", "La limite de l'offre gratuite",
                 "Les conditions d'alwaysdata réservent l'offre gratuite à un usage "
                 "<b>non commercial</b>. Tant que le site sert à préparer et à tester, "
                 "tout va bien. Dès qu'une école paie un abonnement, il faut passer à "
                 "une offre payante — sinon le site peut être suspendu.")
    h.append(para("Les offres payantes (tarifs publics, par an)", "h2"))
    h.append(tableau([
        ["Offre", "Disque", "Mémoire", "Paiement annuel", "Paiement mensuel"],
        ["Free", "1 Go", "256 Mo", "0 €", "0 €"],
        ["<b>Small</b>", "50 Go", "1 Go", "<b>60 € / an</b>", "72 € / an"],
        ["Medium", "100 Go", "2 Go", "240 € / an", "264 € / an"],
        ["Large", "200 Go", "4 Go", "600 € / an", "660 € / an"],
        ["X-Large", "500 Go", "8 Go", "1 800 € / an", "1 980 € / an"],
    ], largeurs=[30 * mm, 28 * mm, 28 * mm, 40 * mm, 34 * mm], centre=(1, 2, 3, 4)))
    h.append(para(
        "Prix hors taxes, convertibles à environ 656 FCFA pour 1 €. Toutes les "
        "offres payantes incluent des sites, des bases et des adresses email en "
        "nombre illimité, ainsi que 30 jours d'essai."))
    h.append(para("Quand passer à une offre payante", "h2"))
    h.append(tableau([
        ["Situation", "Offre conseillée", "Coût annuel"],
        ["Test, préparation, démonstration", "Free", "0 €"],
        ["Première école qui paie", "<b>Small</b>", "60 € ≈ 39 400 F"],
        ["5 à 15 écoles (≈ 2 000 élèves)", "Small", "60 €"],
        ["20 à 50 écoles (≈ 10 000 élèves)", "Medium", "240 €"],
        ["Réseau de 100 écoles et plus", "Large", "600 €"],
    ], largeurs=[70 * mm, 50 * mm, 40 * mm]))
    h += encadre("astuce", "Le calcul de rentabilité",
                 "Small coûte 60 € par an, soit environ 39 400 F. <b>Un seul "
                 "abonnement d'école vendu à 40 000 F couvre toute "
                 "l'infrastructure.</b> À trois écoles, l'exploitation est largement "
                 "bénéficiaire.")
    h.append(para("Comment changer d'offre", "h2"))
    h += numeros([
        "Interface alwaysdata → menu <b>« Abonnements »</b>.",
        "Cliquez sur <b>« Modifier »</b> à côté de l'offre actuelle.",
        "Choisissez <b>Small</b>, puis validez.",
    ])
    h.append(para(
        "Le changement est immédiat, sans coupure, sans migration : le site, la base "
        "et les fichiers restent exactement en place."))
    h.append(para("Les moyens de paiement", "h2"))
    h += puces([
        "Carte bancaire internationale (Visa, Mastercard)",
        "PayPal",
        "Virement bancaire",
    ])
    h += encadre("attention", "Mixx by Yas et Moov Money ne paient pas l'hébergeur",
                 "Ces deux moyens servent à <b>encaisser</b> les abonnements des "
                 "écoles, pas à payer alwaysdata. Pour l'hébergeur, il faut une carte "
                 "internationale, PayPal, ou un virement.")

    # ================================================================= 12
    h += titre_chapitre("12", "Téléphone, tablette et Chromebook",
                        "Travailler depuis n'importe où, sans installer de logiciel.")
    h.append(para("Ce qui a été prévu pour le petit écran", "h2"))
    h += puces([
        "Le menu de gauche devient un <b>tiroir</b>, qui se referme en touchant la "
        "page à côté, en choisissant une rubrique, ou avec <b>Échap</b>.",
        "La barre du haut se compacte : le nom de l'établissement et l'année "
        "restent visibles, le reste s'efface.",
        "Les <b>champs de saisie font 16 pixels</b> : le navigateur ne zoome plus "
        "tout seul quand on tape une note, et on ne perd plus le fil.",
        "Les tableaux <b>défilent horizontalement</b> au doigt, sans casser la page.",
        "La page ne déborde plus latéralement : plus de bande blanche à droite.",
    ])
    h.append(para("Le Chromebook", "h2"))
    h.append(para(
        "Rien à installer. Chrome suffit. Tout le travail se fait dans le navigateur, "
        "et le site reste accessible même quand le Chromebook est éteint : c'est "
        "l'hébergement chez alwaysdata qui fait tourner l'application."))
    h += encadre("astuce", "Le site a l'air figé après une mise à jour",
                 "C'est le cache de Chrome. Faites <b>Ctrl + Maj + R</b> pour "
                 "recharger complètement. Sur téléphone : Chrome ⋮ → "
                 "<b>« Paramètres des sites »</b> → <b>« Images et fichiers en "
                 "cache »</b>.")
    h += encadre("attention", "Ne travaillez jamais hors connexion",
                 "Les notes saisies ne sont enregistrées qu'au moment où vous cliquez "
                 "sur <b>« Enregistrer les notes »</b> (ou Ctrl + S). Si la connexion "
                 "tombe avant, la saisie est perdue. En zone peu couverte, enregistrez "
                 "toutes les cinq lignes.")

    # ================================================================= 13
    h += titre_chapitre("13", "Dépannage",
                        "Les vingt situations qui arrivent vraiment.")
    h.append(tableau([
        ["Symptôme", "Cause probable", "Solution"],
        ["« Identifiants incorrects »",
         "Mot de passe erroné, ou compte créé par un autre établissement",
         "Vérifiez la majuscule du clavier ; sinon demandez la réinitialisation au "
         "chef, ou utilisez « Mot de passe oublié ? »"],
        ["La page reste blanche", "Cache du navigateur après une mise à jour",
         "Ctrl + Maj + R ; sur téléphone, vider « Images et fichiers en cache »"],
        ["Un élève n'apparaît pas dans la saisie",
         "Il n'a pas de classe, ou son statut n'est pas « actif »",
         "Élèves → crayon → renseigner la classe et le statut"],
        ["Une matière manque au bulletin",
         "Elle n'est pas cochée dans la classe",
         "Classes → crayon → cocher la matière et son coefficient"],
        ["La moyenne ne correspond pas au calcul fait à la main",
         "Formule de moyenne différente, ou un élève marqué absent",
         "Vérifier Paramètres → Calcul des moyennes, puis la case « abs. »"],
        ["Le rang est surprenant",
         "Notes manquantes pour certains élèves, donc moyennes partielles",
         "Vérifier la colonne « matières évaluées » sur l'écran Bulletins"],
        ["La saisie est grisée",
         "La période est clôturée",
         "Le chef rouvre la période dans Paramètres → Périodes"],
        ["Le bulletin n'a pas d'en-tête",
         "Champ « En-tête officiel » vide",
         "Paramètres → Identité → En-tête officiel"],
        ["Le nom du professeur titulaire est vide",
         "Aucun titulaire désigné pour la classe",
         "Classes → crayon → Professeur titulaire"],
        ["L'élève ne voit pas son bulletin",
         "Les bulletins ne sont pas publiés",
         "Bulletins → bouton « Publier »"],
        ["L'impression coupe la dernière ligne",
         "Échelle d'impression trop grande",
         "Dans la fenêtre d'impression : « Ajuster à la page », marges par défaut"],
        ["« Enregistrer » ne répond pas",
         "Connexion tombée, ou période clôturée",
         "Recharger la page ; si le problème persiste, se reconnecter"],
        ["Le logo ne s'affiche pas",
         "Fichier trop lourd ou format non image",
         "Utiliser un PNG ou JPEG carré de moins de 300 Ko"],
        ["Le site répond lentement",
         "Plusieurs personnes saisissent en même temps sur 256 Mo de mémoire",
         "Normal en pointe ; passer à l'offre Small si cela se répète"],
        ["Le site est indisponible",
         "Redémarrage de l'hébergeur",
         "Attendre deux minutes, puis recharger ; vérifier l'interface alwaysdata"],
        ["« Ce site n'est pas sécurisé »",
         "Certificat en cours de renouvellement",
         "Attendre une heure ; vérifier que l'adresse commence bien par https"],
        ["Une note a été modifiée par erreur",
         "Saisie sur la mauvaise ligne",
         "Corriger directement : le site garde qui a saisi quoi et quand"],
        ["Deux classes portent le même nom",
         "Création en double",
         "Renommer l'une des deux (par exemple 6ème A bis) et y déplacer les élèves"],
        ["Le mot de passe du chef est perdu",
         "—",
         "Sur le serveur : ADMIN_PASSWORD=… npm run motdepasse"],
        ["Le site affiche une ancienne version",
         "Mise à jour du serveur non suivie d'un redémarrage",
         "Interface alwaysdata → Sites → ⟳, puis Ctrl + Maj + R"],
    ], largeurs=[46 * mm, 48 * mm, 66 * mm]))
    h.append(Spacer(1, 6))
    h += encadre("cle", "Le premier réflexe, toujours",
                 "Avant de chercher longtemps : <b>recharger complètement</b> "
                 "(Ctrl + Maj + R), puis <b>vérifier la classe et la période</b> "
                 "sélectionnées en haut de l'écran. Quatre problèmes sur cinq "
                 "s'expliquent par l'un de ces deux gestes.")

    # ================================================================= 14
    h += titre_chapitre("14", "Mémo du quotidien",
                        "Les dix gestes à connaître par cœur, et le calendrier de l'année.")
    h.append(para("Les dix gestes", "h2"))
    h.append(tableau([
        ["#", "Geste", "Où"],
        ["1", "Vérifier la classe et la période sélectionnées", "En haut de chaque écran"],
        ["2", "Saisir une série de notes au clavier", "Saisie des notes — Entrée, Ctrl + S"],
        ["3", "Marquer un absent", "Saisie des notes — case « abs. »"],
        ["4", "Voir les moyennes et rangs d'une classe", "Bulletins"],
        ["5", "Écrire une appréciation", "Bulletins — crayon sur la ligne de l'élève"],
        ["6", "Publier les bulletins aux familles", "Bulletins — « Publier »"],
        ["7", "Imprimer toute une classe", "Bulletins — « Imprimer la classe »"],
        ["8", "Clôturer un trimestre", "Paramètres — Périodes"],
        ["9", "Sauvegarder la base", "Serveur — npm run backup"],
        ["10", "Créer le compte d'un enseignant", "Enseignants — « + Nouvel enseignant »"],
    ], largeurs=[10 * mm, 82 * mm, 68 * mm], centre=(0,)))
    h.append(para("Le calendrier type d'une année", "h2"))
    h.append(tableau([
        ["Période", "Ce qu'on fait"],
        ["<b>Août – septembre</b>",
         "Réglages d'identité, classes, matières, coefficients, inscription des "
         "élèves, création des comptes enseignants"],
        ["<b>Octobre – novembre</b>",
         "Devoirs 1 et 2 du premier trimestre, premières compositions"],
        ["<b>Décembre</b>",
         "Composition de fin de trimestre, appréciations, conseil de classe, "
         "publication et impression des bulletins, <b>clôture du T1</b>, sauvegarde"],
        ["<b>Janvier – mars</b>",
         "Deuxième trimestre, examen blanc éventuel en février"],
        ["<b>Avril</b>",
         "Bulletins du T2, publication, clôture, sauvegarde"],
        ["<b>Mai – juin</b>",
         "Troisième trimestre, compositions finales, bulletins, décisions de "
         "passage, clôture du T3, sauvegarde finale et archivage du PDF annuel"],
    ], largeurs=[34 * mm, 126 * mm]))
    h += encadre("astuce", "L'archive du chef",
                 "À la fin de chaque trimestre, imprimez la classe <b>au format "
                 "PDF</b> et rangez le fichier sur MEGA, dans un dossier "
                 "« Bulletins 2026-2027 ». Vous aurez ainsi, en plus de la base, une "
                 "trace lisible de chaque période.")

    # ================================================================= annexes
    h += titre_chapitre("A", "Annexe — Glossaire",
                        "Les mots du site, en français simple.")
    h.append(tableau([
        ["Mot", "Ce que cela veut dire"],
        ["<b>Période</b>", "Un trimestre (collège) ou un semestre (lycée) : T1, T2, "
                           "T3, S1, S2"],
        ["<b>Évaluation</b>", "Un devoir, une composition ou une épreuve d'examen "
                              "blanc, pour une classe et une matière"],
        ["<b>Devoir 1 / Devoir 2</b>", "Les deux notes de contrôle du trimestre"],
        ["<b>Composition</b>", "L'épreuve de fin de période : elle pèse le plus"],
        ["<b>Coefficient</b>", "Le poids d'une matière dans la moyenne générale"],
        ["<b>Moyenne générale</b>", "Moyenne des matières, pondérée par les coefficients"],
        ["<b>Rang</b>", "La place de l'élève dans sa classe, pour la période"],
        ["<b>Mention</b>", "La catégorie correspondant à la moyenne "
                          "(Passable, Bien…)"],
        ["<b>Appréciation</b>", "La phrase du professeur sur le bulletin"],
        ["<b>Brouillon / Publié</b>", "Un bulletin invisible / visible par l'élève"],
        ["<b>Examen blanc</b>", "Une simulation d'examen, sans effet sur le bulletin "
                               "officiel"],
        ["<b>Professeur titulaire</b>", "Le professeur responsable de la classe, qui "
                                       "signe le bulletin"],
        ["<b>En-tête officiel</b>", "Les mentions du ministère et de la tutelle, "
                                    "imprimées en haut du bulletin"],
        ["<b>Sauvegarde</b>", "Une copie du fichier de la base, à conserver ailleurs"],
    ], largeurs=[46 * mm, 114 * mm]))
    h.append(CondPageBreak(95 * mm))
    h.append(Paragraph("Annexe — Raccourcis clavier", S["h1_annexe"]))
    h.append(Paragraph("Utiles dans toute l'application.", S["h1_sous"]))
    h.append(tableau([
        ["Raccourci", "Effet"],
        ["<b>Ctrl + S</b>", "Enregistrer la grille de notes"],
        ["<b>Entrée</b>", "Valider et passer au champ suivant"],
        ["<b>Maj + Tab</b>", "Revenir au champ précédent"],
        ["<b>Échap</b>", "Fermer la fenêtre ou le menu ouvert"],
        ["<b>Ctrl + Maj + R</b>", "Recharger la page sans le cache (Chrome)"],
        ["<b>Ctrl + P</b>", "Imprimer la page affichée"],
        ["<b>Ctrl + Maj + Suppr</b>", "Vider le cache de Chrome"],
    ], largeurs=[46 * mm, 114 * mm]))
    h.append(CondPageBreak(110 * mm))
    h.append(Paragraph("Annexe — Fiche à imprimer : fin de trimestre", S["h1_annexe"]))
    h.append(Paragraph("À cocher dans l'ordre, le jour du conseil de classe.",
                       S["h1_sous"]))
    h.append(checklist([
        "Toutes les notes du trimestre sont saisies, matière par matière",
        "Les absents sont cochés « abs. » (aucun faux zéro)",
        "Les appréciations sont écrites pour chaque élève",
        "Un bulletin est relu à l'écran (en-tête, nom, rang, mention)",
        "Les bulletins de la classe sont publiés",
        "La classe est imprimée, ou enregistrée en PDF",
        "Le PDF est rangé dans le dossier MEGA de l'année",
        "La période est passée en « Clôturée »",
        "La base est sauvegardée (npm run backup)",
        "Les notes sont envoyées à la direction pour archivage papier",
    ]))
    h.append(Spacer(1, 10))
    h += encadre("cle", "Et si un jour vous doutez",
                 "Un seul réflexe suffit : ouvrez <b>Paramètres → Identité</b> et "
                 "<b>Paramètres → Calcul des moyennes</b>. Neuf fois sur dix, la "
                 "question posée par une famille vient de là.")
    h.append(Spacer(1, 12))

    return h


# --------------------------------------------------------------------------- #
def main():
    enregistrer_polices()
    sortie = sys.argv[1] if len(sys.argv) > 1 else "GUIDE-TERMINISH-ECOLE.pdf"
    os.makedirs(os.path.dirname(os.path.abspath(sortie)), exist_ok=True)
    doc = Gabarit(sortie)
    doc.multiBuild(contenu())
    taille = os.path.getsize(sortie)
    print(f"✔ {sortie} — {taille / 1024:.0f} Ko — {doc.page} pages")


if __name__ == "__main__":
    main()
