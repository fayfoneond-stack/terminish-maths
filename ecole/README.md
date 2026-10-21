# Terminish École — plateforme SaaS de gestion scolaire

Application web complète pour collèges et lycées : **inscription des élèves, saisie des notes à distance,
calcul automatique des moyennes et rangs, bulletins trimestriels et semestriels avec le logo de l'établissement,
statistiques, examens blancs et console multi-établissements** pour l'éditeur.

Elle est pensée pour être **commercialisée** : site vitrine, tarifs, demandes de démonstration, essai gratuit,
console de supervision des écoles clientes et suivi des paiements.

---

## 1. Démarrage rapide

```bash
cd ecole
npm install
npm start
```

→ http://localhost:3000

- Site commercial : `/`
- Application : `/app`

Prérequis : **Node.js ≥ 22.5** (utilise le module natif `node:sqlite`, aucune compilation nécessaire).
Le port peut être changé avec `PORT=8080 npm start`.

La base SQLite est créée automatiquement dans `ecole/data/terminish-ecole.db` et remplie avec un jeu de
démonstration (2 établissements, 7 classes, 142 élèves, notes du 1er trimestre / 1er semestre, examen blanc).

### Comptes de démonstration

| Profil | Email | Mot de passe |
|---|---|---|
| Chef d'établissement | `directeur@demo.tg` | `demo1234` |
| Enseignant (Maths) | `prof.maths@demo.tg` | `prof1234` |
| Élève / parent | `eleve@demo.tg` | `eleve1234` |
| Super administrateur (éditeur) | `admin@terminish.tg` | `admin1234` |

> Pour repartir d'une base propre : supprimez le dossier `ecole/data/` puis relancez le serveur.

---

## 2. Fonctionnalités

### Direction (chef d'établissement)
- Tableau de bord : effectifs, progression de la saisie, moyennes par classe, meilleurs élèves, activité récente.
- Élèves : inscription unitaire ou **import CSV/Excel (copier-coller)**, dossier individuel, historique,
  export CSV, archivage.
- Classes : cycles collège (trimestres) / lycée (semestres), séries, titulaire, matières et coefficients.
- Matières : bibliothèque de l'établissement, groupes disciplinaires.
- Enseignants : comptes et **affectations classe × matière** (matrice de cases à cocher).
- Bulletins : calcul automatique, appréciations et décisions, **publication aux familles**, impression
  individuelle ou de toute la classe, export CSV.
- Statistiques : par classe, par matière et pour tout l'établissement (moyenne, min/max, médiane, écart-type,
  taux de réussite, histogramme, classements).
- Examens blancs : planification des épreuves (date, heure, durée, salle, coefficient), saisie des notes,
  résultats comparables aux bulletins de période.
- Paramètres : identité, **logo importé**, titre du chef, année scolaire, devise, formule de calcul des
  moyennes, ouverture/clôture des périodes, changement de mot de passe.
- Abonnement : formule, échéance, historique des paiements, demande d'activation.

### Enseignant
- Connexion à distance depuis n'importe quel appareil.
- Accès **limité à ses classes et matières** (contrôlé côté serveur).
- Saisie des devoirs et compositions avec calcul de moyenne en direct, navigation clavier (`Entrée`),
  enregistrement groupé, verrouillage si la période est clôturée.
- Saisie des épreuves d'examen blanc.
- Consultation des bulletins et statistiques de ses classes, impression.

### Élève / parent
- Espace personnel : bulletins **uniquement après publication** par la direction.
- Moyenne, rang, mention, appréciation et détail par matière ; impression du bulletin.

### Éditeur (SaaS)
- Console multi-établissements : nombre d'écoles, élèves, revenus, essais en cours.
- Création d'un établissement client + compte direction.
- Suivi des demandes entrantes du site vitrine.
- Enregistrement des paiements, activation/renouvellement des abonnements, changement de formule.

---

## 3. Règles de calcul

- Moyenne par matière (paramétrable par établissement) :
  - `co2` (défaut) : `(moyenne des devoirs + 2 × composition) ÷ 3`
  - `moy_co` : `(moyenne des devoirs + composition) ÷ 2`
  - une absence ou une note non saisie est exclue ;
- Moyenne générale : `Σ (moyenne matière × coefficient) ÷ Σ coefficients` (seules les matières évaluées comptent).
- Rang : classement « compétition » (1, 1, 3…), non classé si aucune moyenne.
- Mentions : < 10 Insuffisant, 10–12 Passable, 12–14 Assez bien, 14–16 Bien, 16–18 Très bien, ≥ 18 Excellent.
- Statistiques : moyenne, min, max, médiane, écart-type (population) et taux de réussite (≥ 10/20).
- Collège : 3 trimestres. Lycée : 2 semestres.

---

## 4. Architecture

Monolithe léger, sans étape de build :

```
ecole/
├── server/
│   ├── db.js        schéma SQLite, helpers, jeu de démonstration
│   ├── stats.js     moteur de calcul (moyennes, rangs, statistiques)
│   ├── print.js     génération des bulletins HTML imprimables (A4)
│   └── index.js     API REST, authentification, contrôle d'accès
├── public/
│   ├── index.html   site commercial (fonctionnalités, tarifs, contact)
│   ├── app.html     coquille de l'application
│   ├── css/styles.css
│   └── js/util.js, js/app.js  SPA (vanilla JS, routage par hash)
└── data/            base SQLite (ignorée par Git)
```

- Sessions : cookie `HttpOnly` + table `sessions` (30 jours).
- Mots de passe : `scrypt` avec sel aléatoire, comparaison à temps constant.
- Isolation multi-tenant : chaque requête est filtrée par `ecole_id` issu de l'utilisateur connecté ; les
  enseignants sont en plus restreints à leurs affectations (classes **et** matières).
- Bulletins imprimables : page HTML A4 autonome (`/print/bulletin/:id`, `/print/classe/:id`), impression
  navigateur ou « Enregistrer au format PDF ». La direction, l'enseignant affecté ou l'élève concerné
  (si publié) peuvent y accéder.

### Principales tables

`etablissements`, `utilisateurs`, `sessions`, `classes`, `matieres`, `classe_matieres`, `eleves`,
`periodes`, `affectations`, `examens`, `epreuves`, `evaluations`, `notes`, `bulletins`, `paiements`,
`demandes`.

### API (aperçu)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/logout`, `/api/auth/password` | tous |
| POST | `/api/inscription` | création d'un établissement (essai 30 j) |
| GET/PUT | `/api/etablissement` | direction |
| GET/PUT | `/api/periodes` | direction |
| CRUD | `/api/eleves`, `/api/classes`, `/api/matieres`, `/api/enseignants` | direction (lecture élargie) |
| POST | `/api/eleves/import` | direction |
| GET | `/api/notes/grille` | personnel (affectations) |
| POST | `/api/notes/saisie` | personnel (affectations) |
| GET | `/api/bulletins/classe` | personnel |
| PUT/POST | `/api/bulletins/...` | direction |
| GET | `/api/stats/classe`, `/api/stats/etablissement` | personnel |
| CRUD | `/api/examens`, `/api/examens/:id/epreuves` | direction |
| GET | `/api/eleve/espace` | élève |
| GET | `/api/admin/*` | super administrateur |
| GET | `/print/bulletin/:id`, `/print/classe/:id` | personnel / élève concerné |

---

## 5. Déploiement

1. Serveur Linux avec Node.js ≥ 22.5.
2. `npm install --omit=dev`, puis `pm2 start server/index.js --name terminish-ecole`.
3. Reverse proxy Nginx (HTTPS) vers le port 3000. En production, servez uniquement en HTTPS pour que le
   cookie de session soit protégé.
4. **Sauvegarde** : copier régulièrement `ecole/data/` (base SQLite en mode WAL). Un simple `rsync` ou une
   tâche `sqlite3 .backup` suffit.
5. Variables : `PORT` (défaut 3000).

Pour un réseau de plusieurs écoles, la console super-admin crée les établissements ; chaque école reste
cloisonnée par `ecole_id`.

---

## 6. Limites connues / pistes d'évolution

- Paiement en ligne (Mobile Money / carte) non branché : l'éditeur enregistre les paiements manuellement.
- Pas d'envoi automatique de SMS/WhatsApp aux parents (les demandes partent vers WhatsApp en un clic).
- Import des notes depuis Excel non prévu (la grille de saisie est l'interface principale).
- Bulletins au format PDF côté serveur : l'impression navigateur (« Enregistrer en PDF ») est utilisée.
- Notifications e-mail non configurées (pas de fournisseur SMTP).
- Sauvegarde automatique planifiée à mettre en place côté hébergement.

---

© 2026 Terminish École — Lomé, Togo.
