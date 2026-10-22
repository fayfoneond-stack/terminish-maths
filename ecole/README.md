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
- Abonnement : formule, échéance, **paiement par Mixx by Yas ou Moov Money**, paiement en ligne
  (CinetPay/PayDunya si activés), historique et **reçus PDF**.

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
- **Validation des paiements Mobile Money** déclarés par les écoles (Mixx by Yas / Moov Money),
  prolongation automatique de l'abonnement à la validation, **reçus PDF**.
- Configuration des **numéros marchands**, des tarifs et de CinetPay.
- Enregistrement des paiements hors ligne, création d'établissements, suivi des demandes.

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

## 4. Paiements Mobile Money (Togo)

Trois moyens sont proposés aux établissements depuis **Abonnement** :

| Moyen | Comment l'école paie | Activation |
|---|---|---|
| **Mixx by Yas** (ex T-Money, Yas Togo) | Paiement marchand `*145*5#` vers le numéro de l'éditeur | L'école déclare l'ID de transaction → l'éditeur valide |
| **Moov Money** (Flooz, Moov Africa) | `*155#` → option 2 (marchand), ou `*155*2*2*numéro*montant*code#` | idem |
| **CinetPay** (optionnel) | Page de paiement CinetPay (Mobile Money + carte) | **automatique** via notification |
| **PayDunya** (optionnel) | Page de paiement PayDunya (T-Money/Mixx, Flooz/Moov, cartes) | **automatique** via IPN |

### Mode manuel (fonctionne immédiatement, sans contrat)
1. L'éditeur renseigne ses numéros marchands dans **Console → Paiements → Numéros marchands**.
2. Sur la page Abonnement, l'école choisit sa formule, sa durée (1, 3 ou 12 mois), son opérateur, puis paie
   vers le numéro marchand affiché.
3. Elle colle l'**ID de transaction reçu par SMS**.
4. L'éditeur vérifie (relevé Mobile Money) et clique **Valider** : l'établissement passe « actif » et
   l'échéance est prolongée du nombre de mois payés. Un rejet est possible avec un motif.

Durées : 1 mois, 3 mois, ou 12 mois **facturés 10 mois** (2 mois offerts). Les prix sont modifiables
dans la console ; par défaut Essentiel 15 000 F et Standard 25 000 F par mois.

### Reçus PDF
Chaque paiement validé génère un **reçu PDF A4** téléchargeable (bouton 📄 dans l'historique de l'école ou
dans la console éditeur) : montant, formule, durée, moyen de paiement, référence opérateur, période couverte,
identité de l'éditeur, mention légale et empreinte de vérification. L'identité imprimée (nom commercial,
ville, téléphone, email) se règle dans la console.

### Logos et Cloudinary (optionnel)

Le logo de l'établissement est stocké en **data URL dans la base** : il s'imprime sur les bulletins et les
relevés même hors ligne, et rien ne dépend d'un service externe.

Si `CLOUDINARY_URL` (ou les trois variables `CLOUDINARY_*`) sont renseignées, une copie optimisée du logo
est en plus envoyée sur le CDN ; son URL est enregistrée dans `etablissements.logo_url` et utilisée en priorité
pour l'affichage. La data URL reste en base et sert de **repli automatique** si le CDN est injoignable.

- Seuls PNG, JPEG et WebP sont envoyés (le SVG reste local : quelques Ko, aucun intérêt à le déporter).
- Un identifiant stable (`ecole-<id>`) est réutilisé : un nouveau logo remplace l'ancien, sans doublon.
- Tout échec réseau ou de quota est silencieux : le logo local reste utilisé, un avertissement est renvoyé à
  l'interface et journalisé côté serveur.
- État visible dans Console → Paiements → Cloudinary.

### Mode automatique PayDunya (optionnel)
PayDunya couvre **t-money-togo** et **moov-togo** via une page de paiement (et les cartes bancaires).

```bash
export PAYDUNYA_MASTER_KEY="..."
export PAYDUNYA_PRIVATE_KEY="..."
export PAYDUNYA_TOKEN="..."
export PAYDUNYA_MODE="live"      # test | live
npm start
```

L'IPN `POST /api/webhooks/paydunya` contrôle l'empreinte SHA-512 de la master key puis **confirme la facture
auprès de l'API PayDunya** avant validation ; le montant confirmé doit couvrir le montant attendu. Les liens
de paiement renvoyés sont refusés s'ils ne sont pas en HTTPS. Les clés peuvent aussi être saisies dans la
console (elles priment sur les variables d'environnement par ordre inverse : les variables d'environnement
ont la priorité).

### Mode automatique CinetPay (optionnel)
CinetPay couvre Tmoney (Mixx) et Flooz (Moov) au Togo. Il faut un compte marchand CinetPay, puis :

```bash
export CINETPAY_APIKEY="..."
export CINETPAY_SITE_ID="..."
export CINETPAY_MODE="live"      # test | live
npm start
```

(ou renseigner les clés dans la console éditeur). Le serveur crée alors un lien de paiement ; la
notification `POST /api/webhooks/cinetpay` **revérifie la transaction auprès de l'API CinetPay** avant
de valider (le contenu de la notification n'est jamais pris pour argent comptant), et contrôle que le
montant reçu couvre bien le montant attendu.

### Devenir marchand
Un numéro marchand s'obtient auprès de **Yas (Mixx by Yas)** et de **Moov Africa** avec une carte
d'opérateur économique / CFE (NIF), une pièce d'identité et la signature d'un contrat marchand.
En attendant, l'éditeur peut encaisser sur son numéro personnel et valider manuellement.
Les montants arrivent directement sur le compte marchand : **la plateforme ne prélève aucune commission**.

---

## 5. Architecture

Monolithe léger, sans étape de build :

```
ecole/
├── server/
│   ├── db.js        schéma SQLite, helpers, jeu de démonstration
│   ├── stats.js     moteur de calcul (moyennes, rangs, statistiques)
│   ├── print.js     génération des bulletins HTML imprimables (A4)
│   ├── recu.js      reçu de paiement PDF (A4)
│   ├── paiements.js Mobile Money, CinetPay, PayDunya
│   ├── cloudinary.js miroir optionnel des logos sur le CDN
│   └── index.js     API REST, authentification, contrôle d'accès
├── public/
│   ├── index.html   site commercial (fonctionnalités, tarifs, contact)
│   ├── app.html     coquille de l'application
│   ├── css/styles.css
│   └── js/util.js, js/app.js  SPA (vanilla JS, routage par hash)
├── data/            base SQLite (ignorée par Git)
├── deploy/          Caddyfile, nginx.conf, systemd, gratuit/ (PC), vm/ (serveur 24 h/24)
├── Dockerfile, docker-compose.yml, render.yaml
├── DEPLOIEMENT.md   guide de mise en ligne pas à pas
├── LIEN-ETERNEL.md  adresse fixe gratuite (VPS Oracle Always Free)
└── DEPLOIEMENT-GRATUIT.md  mise en ligne à 0 F (ordinateur + Cloudflare Tunnel)
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
`demandes`, `reglages` (numéros marchands, tarifs, clés CinetPay).

### API (aperçu)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/health` | public (sonde de supervision) |
| POST | `/api/auth/login`, `/api/auth/logout`, `/api/auth/password` | tous |
| POST | `/api/inscription` | création d'un établissement (essai 30 j) |
| GET | `/api/public/contact` | public (coordonnées de l'éditeur : téléphone, WhatsApp, email, ville) |
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
| GET | `/api/paiement/options` | direction (opérateurs, tarifs) |
| POST | `/api/paiement/declarer` | direction (déclaration Mobile Money) |
| POST | `/api/paiement/cinetpay/initier` | direction (si CinetPay configuré) |
| POST | `/api/paiement/paydunya/initier` | direction (si PayDunya configuré) |
| POST | `/api/webhooks/cinetpay` | CinetPay (public, vérifié côté API) |
| POST | `/api/webhooks/paydunya` | PayDunya (public, empreinte + confirmation API) |
| GET | `/api/paiements/:id/recu.pdf` | direction (reçu PDF de son école) |
| GET | `/api/admin/paiements/:id/recu.pdf` | super administrateur |
| GET/PATCH | `/api/admin/paiements`, `/api/admin/reglages` | super administrateur |
| GET | `/api/admin/*` | super administrateur |
| GET | `/print/bulletin/:id`, `/print/classe/:id`, `/print/examen/:id` | personnel / élève concerné |

---

## 6. Déploiement

**Budget zéro ?** Suivez **[DEPLOIEMENT-GRATUIT.md](DEPLOIEMENT-GRATUIT.md)** : le site tourne sur votre
ordinateur et devient accessible en HTTPS via Cloudflare Tunnel (gratuit, sans compte).

**Besoin d'un lien qui ne change jamais ?** **[LIEN-ETERNEL.md](LIEN-ETERNEL.md)** : VM Oracle Cloud
« Always Free » (0 F, 24 h/24) + `deploy/vm/installer-vm.sh`, qui installe Docker, HTTPS et l'adresse
`https://ecole.<ip>.sslip.io` en une commande.

```bash
bash deploy/gratuit/installer-linux.sh --demo   # Linux : tout installer (sans sudo) et démarrer
npm run partage          # site + lien public https://xxx.trycloudflare.com
npm run partage:demo     # idem avec l'école de démonstration (admin1234 / demo1234)
npm run local            # serveur seul (localhost / réseau Wi-Fi)
npm run motdepasse       # réinitialise le mot de passe du super administrateur
npm run lien             # lien public actuel + état du site
```

Guide complet pour un hébergement permanent : **[DEPLOIEMENT.md](DEPLOIEMENT.md)** (VPS + Docker + HTTPS
automatique, Render, Cloudflare Tunnel, systemd/Nginx, sauvegardes, dépannage, coûts).

Résumé :

```bash
cp .env.example .env      # DOMAIN, ADMIN_EMAIL, ADMIN_PASSWORD, TERMINISH_SEED=prod
docker compose up -d --build
```

Le `Dockerfile` (Node 22, utilisateur non-root, sonde `/api/health`), le `docker-compose.yml`
(application + Caddy pour le HTTPS) et `render.yaml` sont fournis.

Sans Docker : `npm ci --omit=dev` puis le service systemd de `deploy/terminish-ecole.service`,
derrière Nginx (`deploy/nginx.conf`) ou Caddy.

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `PORT` | port d'écoute (3000 par défaut) |
| `TERMINISH_DATA_DIR` | dossier de la base SQLite (ex. `/data` sur un volume) |
| `TERMINISH_SEED` | `demo` (défaut) = école + comptes de démonstration ; `prod` = uniquement le compte admin |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOM` | compte super-admin créé au premier démarrage (mot de passe aléatoire affiché si absent). En mode `TERMINISH_SEED=demo`, le compte est `admin@terminish.tg` / `admin1234` — pour imposer un autre mot de passe : `npm run motdepasse` |
| `COOKIE_SECURE` | `1` pour marquer le cookie de session `Secure` (obligatoire derrière HTTPS) |
| `CINETPAY_APIKEY`, `CINETPAY_SITE_ID`, `CINETPAY_MODE` | paiement automatique CinetPay |
| `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`, `PAYDUNYA_MODE` | paiement automatique PayDunya |
| `CLOUDINARY_URL` **ou** `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` | copie optionnelle des logos sur le CDN Cloudinary |

### Sauvegarde

```bash
npm run backup            # copie cohérente (VACUUM INTO) dans data/sauvegardes/, rotation 14 fichiers
```

À planifier en cron une fois par jour et à copier hors du serveur (voir DEPLOIEMENT.md, section 8).

> ⚠️ Ne déployez jamais avec `TERMINISH_SEED=demo` sur un site public : les comptes `admin1234`
> et `demo1234` seraient accessibles à tous.

Pour un réseau de plusieurs écoles, la console super-admin crée les établissements ; chaque école reste
cloisonnée par `ecole_id`.

---

## 7. Limites connues / pistes d'évolution

- Le mode Mobile Money manuel dépend d'une vérification humaine (pas de rapprochement automatique des
  relevés) ; CinetPay ou PayDunya automatisent cette étape mais demandent un compte marchand.
- Pas de paiement récurrent automatique (renouvellement à l'initiative de l'école).
- Les reçus sont des PDF simples (pas de facturation électronique certifiée ni de numérotation fiscale).
- Pas d'envoi automatique de SMS/WhatsApp aux parents (les demandes partent vers WhatsApp en un clic).
- Import des notes depuis Excel non prévu (la grille de saisie est l'interface principale).
- Bulletins au format PDF côté serveur : l'impression navigateur (« Enregistrer en PDF ») est utilisée.
- Notifications e-mail non configurées (pas de fournisseur SMTP).
- Sauvegarde automatique planifiée à mettre en place côté hébergement.

---

© 2026 Terminish École — Lomé, Togo.

---

## 8. À compléter avant la mise en vente

Quelques valeurs sont des exemples, à remplacer par les vôtres :

- **numéros marchands** Mixx by Yas / Moov Money : Console → Paiements → Numéros marchands ;
- **identité sur les reçus** (nom commercial, ville, téléphone, email, **WhatsApp**) : Console → Paiements →
  Identité sur les reçus. Ces valeurs alimentent les reçus PDF, le bouton « Une question ? WhatsApp » de la page
  Abonnement et le bloc Contact du site public (servi par `GET /api/public/contact`) ;
- **coordonnées de l'éditeur** déjà renseignées : Mixx by Yas `+228 93 15 01 78`, Moov Money
  `+228 97 24 30 86`, WhatsApp/téléphone `+228 93 15 01 78` (réglages modifiables dans la console,
  valeurs de repli dans `ecole/server/db.js` et `ecole/public/index.html`) ;
- **tarifs** : Console → Paiements (ils alimentent la page Abonnement) et section Tarifs du site public ;
- **mentions légales / nom commercial** de l'éditeur dans le pied de page du site.
