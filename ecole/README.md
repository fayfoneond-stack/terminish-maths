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
- Tableau de bord : effectifs, dossiers à compléter, progression de la saisie, moyennes par classe, meilleurs élèves, activité récente.
- Élèves : inscription unitaire, **import direct des listes PDF** (ou CSV/Excel par copier-coller),
  dossier individuel, historique, export CSV, archivage.
- Classes : cycles collège (trimestres) / lycée (semestres), séries, titulaire, matières et coefficients.
- Matières : bibliothèque de l'établissement, groupes disciplinaires.
- Enseignants : comptes et **affectations classe × matière** (matrice de cases à cocher).
  **Le chef est le seul à gérer les identifiants** : 🔑 *Nouveaux identifiants* (mot de passe lisible,
  affiché **une seule fois**, sessions de l'enseignant fermées), 🚫 *Retirer l'accès* / ✅ *Rétablir*,
  et panneau **🔔 Demandes de mot de passe** alimenté par le lien « Mot de passe oublié » de l'écran
  de connexion.
- Bulletins : calcul automatique, appréciations et décisions, **publication aux familles**, impression
  individuelle ou de toute la classe, export CSV, et **bulletins de composition seule** (option
  « Type de bulletin → Composition seule » : moyennes et rangs recalculés sur la composition).
- Statistiques : par classe, par matière et pour tout l'établissement (moyenne, min/max, médiane, écart-type,
  taux de réussite, histogramme, classements) + **volet composition** : nombre d'élèves ayant la moyenne
  (≥ 10), n'ayant pas la moyenne (< 10), non notés, **répartition « qui a 1, qui a 2, qui a 3… »** et
  tableau composition par matière.
- **Fusion de classes** : réunissez plusieurs divisions d'un même niveau (6ème A + B + C) pour obtenir
  **un seul classement** (rangs recalculés sur l'ensemble), la **meilleure et la plus faible note de chaque
  matière** (nom de l'élève + sa classe), la **répartition note par note** par matière (« combien ont 1,
  puis 2, puis 3… en maths ») et la **répartition des moyennes** (« combien ont 10, 11, 12… »).
  Fonctionne aussi sur un examen blanc et en mode « composition seule » ; export CSV.
- Examens blancs : planification des épreuves (date, heure, durée, salle, coefficient), saisie des notes,
  résultats comparables aux bulletins de période. Un accès direct à l'import PDF permet d'inscrire les élèves
  dans leurs classes avant de saisir les épreuves.
- **Décision finale** : seuil réglable, moyenne annuelle sur les trois trimestres ou deux semestres,
  aperçu élève par élève, confirmation des passages 6ème → 5ème, 5ème → 4ème, 4ème → 3ème et
  2nde → 1ère (choix de la division/série), historique et ouverture de l'année suivante.
- Paramètres : identité, **logo importé**, titre du chef, année scolaire, devise, formule de calcul des
  moyennes, ouverture/clôture des périodes, changement de mot de passe. Une fois des résultats saisis,
  l'année ne se change plus ici : utilisez « Décision finale » pour la suivante.
- Abonnement : formule, échéance, **paiement par Mixx by Yas ou Moov Money**, paiement en ligne
  (CinetPay/PayDunya si activés), historique et **reçus PDF**.

### Enseignant
- Connexion à distance depuis n'importe quel appareil.
- Accès **limité à ses classes et matières** (contrôlé côté serveur).
- Saisie des devoirs et compositions avec calcul de moyenne en direct, navigation clavier (`Entrée`),
  enregistrement des seules cases modifiées, verrouillage si la période est clôturée.
- Sur **Android**, l'écran « Saisie des notes » présente **une fiche par élève**, avec de grands champs
  numériques et les absences à cocher ; sur **ordinateur**, il reste un tableau. Choisissez la classe,
  la matière et la période, saisissez 0 à 20 (virgule ou point acceptés) et touchez **« Enregistrer les notes »**.
  Un indicateur signale les modifications en attente et prévient avant de quitter sans enregistrer.
- Saisie des épreuves d'examen blanc, avec la même présentation adaptée au téléphone.
- Consultation des bulletins et statistiques de ses classes, impression.

### Élève / parent
- Espace personnel : bulletins **uniquement après publication** par la direction.
- Moyenne, **rang dans la classe**, mention, appréciation et détail par matière ; impression du bulletin.

### Éditeur (SaaS)
- Console multi-établissements : nombre d'écoles, élèves, revenus, essais en cours.
- Création d'un établissement client + compte direction.
- Suivi des demandes entrantes du site vitrine.
- **Validation des paiements Mobile Money** déclarés par les écoles (Mixx by Yas / Moov Money),
  prolongation automatique de l'abonnement à la validation, **reçus PDF**.
- Configuration des **numéros marchands**, des tarifs et de CinetPay.
- Enregistrement des paiements hors ligne, création d'établissements, suivi des demandes.
- **Correction des activations erronées** : annulation tracée de la dernière activation manuelle,
  restauration du statut, de la formule et de l'échéance précédents ; suspension prudente pour les
  anciennes activations ou les paiements en ligne, sans suppression des transactions.

---

### Importer une liste de classe en PDF

1. La direction ouvre **Scolarité → Élèves → « Importer une liste PDF »** (ou
   **Évaluations → Examens blancs → « Importer une liste PDF »**).
2. Elle choisit une **classe déjà créée** et sélectionne son PDF. Le site lit les tableaux textuels ; pour une
   page scannée sans texte, il essaie un **OCR français local**, sans service externe. La reconnaissance d'une
   écriture manuscrite ou d'une mise en page inhabituelle n'est pas garantie.
3. Dans l'**aperçu**, elle corrige les noms, prénoms, matricules, classes ou dates mal reconnus et décoche
   les lignes à écarter ; les doublons et les classes inconnues sont signalés. Rien n'est enregistré avant
   « Confirmer l'inscription ».

**Nom + classe uniquement obligatoires** dans ce parcours. Prénom(s), sexe, date de naissance et matricule
peuvent rester vides. Un matricule manquant est généré ; un sexe inconnu n'est jamais deviné et aucun tuteur
n'est inventé. Chaque nouvel élève est immédiatement disponible dans les épreuves de sa classe. Les
**notes, moyennes et classements déjà présents ne sont pas modifiés** par l'import.

**Compléter plus tard :** après confirmation, cliquez sur **« Voir les dossiers à compléter »** ; ou ouvrez
**Scolarité → Élèves → « À compléter »**, puis **« Compléter »** à côté de l'élève. La liste montre les
renseignements encore absents (naissance, sexe, prénom, tuteur et téléphone). Ils restent **facultatifs** :
leur absence n'empêche ni l'inscription ni la saisie des notes. La date et les autres informations peuvent
être ajoutées ou corrigées ultérieurement, sans perdre les notes ni les bulletins.

**Limites :** PDF de 8 Mo et 15 pages maximum ; jusqu'à 6 pages scannées avec OCR par fichier, 300 élèves
par confirmation. Pour un document plus grand, séparer les classes en plusieurs PDF. Relire soigneusement
les pages OCR et les lignes « Nom / prénom à vérifier ». Les doublons sont contrôlés à nouveau côté serveur au
moment de la confirmation (matricule ou même nom et prénom déjà présents dans l'établissement) ; importer
le même fichier une seconde fois ne réinscrit pas ses élèves. Les octets du PDF et les images OCR ne sont pas
conservés par l'application.

L'OCR fonctionne avec les dépendances locales installées depuis `package-lock.json`. Si une future version
modifie ces dépendances, sauvegardez la base avant de les mettre à jour. Sur alwaysdata, **si `npm ci` affiche
`Killed`, ne le relancez pas** : utilisez l'installateur léger décrit dans `HEBERGEMENT.md` pour restaurer
`node_modules` avant tout redémarrage. La présente adaptation mobile ne change aucune dépendance.

### Décision finale et changement d'année

**Chemin : Évaluations → Décision finale** (également accessible depuis **Résultats → Décision finale**).
Ce parcours est réservé au chef d'établissement. Faites une **sauvegarde SQLite avant la mise à jour de
l'application**, puis vérifiez que les listes et les notes sont complètes avant toute confirmation.

1. Dans **Paramètres → Périodes & verrouillage**, clôturez les trois trimestres du collège et/ou les deux
   semestres du lycée, puis enregistrez. L'aperçu reste possible avant cette clôture, pas la validation.
2. Dans **Décision finale**, choisissez la classe (6ème, 5ème, 4ème ou 2nde), la **classe supérieure précise**
   (division/série) et le **seuil de passage sur 20** (10 par défaut, modifiable). Cliquez sur **Voir l'aperçu** :
   chaque élève apparaît avec ses moyennes de période, sa moyenne annuelle et la décision envisagée.
   Si plusieurs divisions/séries existent, choisissez **la classe supérieure de chaque admis** dans le tableau
   (par exemple 1ère A pour l'un et 1ère D pour un autre) : l'aperçu se recalcule.
3. Cliquez sur **Confirmer le passage** et acceptez la confirmation. Seuls les admis sont déplacés ; les autres
   restent dans leur classe. Recommencez pour chaque classe concernée, y compris les divisions parallèles.
   Un élève sans moyenne pour **au moins une** période est « Période manquante » et ne passe pas. Si les notes
   ou l'effectif changent entre aperçu et validation, il faut demander un nouvel aperçu. Une décision déjà
   validée peut être annulée *avant l'ouverture de la nouvelle année* si la classe des élèves n'a pas changé
   et qu'aucune nouvelle note n'a été enregistrée dans la classe supérieure.
4. Une fois toutes les décisions validées et toutes les périodes clôturées, cliquez sur **Ouvrir l'année
   suivante** : de nouvelles périodes sont créées, les notes de l'année terminée ne sont ni effacées ni
   copiées. Les bulletins et classements antérieurs sont accessibles en sélectionnant leur **année dans
   Bulletins ou Résultats** ; les décisions se retrouvent dans **Décision finale → Décisions enregistrées**.
   Après l'ouverture, une ancienne décision ne peut plus être annulée et les anciennes notes sont protégées.

**Calcul :** moyenne annuelle = moyenne arithmétique des **3 moyennes trimestrielles** (collège) ou des
**2 moyennes semestrielles** (lycée), calculées à partir des notes ordinaires selon la formule de l'établissement.
Le seuil est inclusif (`moyenne ≥ seuil`), avec deux décimales au plus. Il n'y a pas d'arrondi à l'entier,
ni de passage automatique si une moyenne manque. Les examens blancs ne participent pas à ce calcul.

À la première validation, l'application conserve l'effectif, la formule, les intitulés de classes et les
matières/coefficient(s) de l'année : les bulletins anciens gardent leurs moyennes lorsque ces réglages
changent **l'année suivante**. Tant qu'une décision est en cours pour l'année présente, la formule et la
structure des classes/matières sont verrouillées. L'historique des décisions garde toujours la moyenne
annuelle, le seuil et la destination effectivement validés. Ne supprimez pas une base SQLite ou un élève
doté de résultats : privilégiez l'archivage.

---

## 3. Règles de calcul

- Moyenne par matière (paramétrable par établissement) :
  - `co2` (défaut) : `(moyenne des devoirs + 2 × composition) ÷ 3`
  - `moy_co` : `(moyenne des devoirs + composition) ÷ 2`
  - une absence ou une note non saisie est exclue ;
- Moyenne générale : `Σ (moyenne matière × coefficient) ÷ Σ coefficients` (seules les matières évaluées comptent).
- Rang : classement « compétition » (1, 1, 3…), non classé si aucune moyenne. Il figure sur **chaque
  bulletin** (bloc « Résultats et positionnement » + colonne Rang par matière) et sur les **relevés
  d'examens blancs**.
- **Bulletin de composition seule** (`?mode=composition`) : la moyenne de chaque matière devient la note
  de composition ; les moyennes générales et les rangs sont recalculés sur ces notes. Utile en fin de
  trimestre pour ne sortir que les compositions.
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

### Corriger une activation faite par erreur (super-administrateur)

- **Console → Paiements** : sur la **dernière activation manuelle** de l'école, cliquez sur
  **« Annuler l'activation »**, indiquez le motif puis **« Confirmer »**. Le statut, la formule et
  l'échéance *d'avant cette activation* sont restaurés. La transaction reste en base avec le statut
  « Activation annulée », son montant, sa référence, la date, l'administrateur et le motif. Le total
  « Validé » n'inclut plus cette validation ; le montant apparaît séparément « Activations annulées ».
- **Console → Établissements** : le même bouton annule la dernière modification traçable (y compris
  une activation directe via la liste). **« Suspendre »** est proposé si l'activation précède cette
  mise à jour ou si un paiement en ligne doit être vérifié auprès du prestataire. La suspension
  conserve l'échéance et les transactions ; elle peut être annulée pour rétablir le statut précédent.
  L'onglet **« Historique des modifications et annulations »** montre les motifs et les auteurs.

**Sécurité :** seul le super-administrateur agit ; un motif de 5 à 300 caractères est obligatoire ;
le serveur refuse d'annuler un paiement si une autre activation/modification est intervenue depuis.
Pour corriger plusieurs erreurs successives, commencer par **la plus récente**. Les opérations sont
atomiques en SQLite ; une annulation ne supprime ni une école ni un élève. Une activation faite avant
cette version n'a pas d'état antérieur enregistré : ne pas deviner cet état, choisir la suspension.
Les paiements en ligne ne sont **jamais annulés par la console** : voir le prestataire si nécessaire.
Un webhook tardif ne réactive pas une validation annulée ou rejetée.

**Important :** annuler une activation ou suspendre un établissement **ne rembourse pas** le paiement
réel (Mobile Money, espèces, virement). Vérifiez le relevé et régularisez/remboursez séparément ; un
reçu déjà téléchargé ne peut pas être effacé chez son destinataire.

### Établissement suspendu : consultation seulement
Le statut **« suspendu »** conserve la connexion des comptes de l'établissement (direction,
enseignants, familles) et leurs droits **de lecture et de téléchargement** selon leur profil : notes,
élèves, résultats, bulletins imprimables, PDF de résultats et reçus déjà validés. Un bandeau l'indique
sur chaque page ; la grille des notes devient non modifiable. Le serveur revérifie le statut de l'école
à **chaque requête authentifiée** et rejette les créations/modifications/suppressions scolaires avec
`HTTP 403` et le code `ABONNEMENT_SUSPENDU` : ce blocage ne dépend pas de l'interface.

Restent possibles pour la direction : consulter l'abonnement, déclarer un paiement Mobile Money et
initier un paiement en ligne **uniquement si la passerelle est configurée** ; l'éditeur vérifie les
règlements manuels avant toute réactivation. La déconnexion, le changement du mot de passe personnel
et le calcul de l'aperçu de passage (sans écriture) restent possibles. La récupération du mot de passe
par les voies habituelles reste disponible. Après validation du paiement ou réactivation par l'éditeur,
les écritures reviennent **sans reconnexion** (bouton « Vérifier l'activation » ou navigation).
Les écoles **« actif »** et **« essai »**, ainsi que la console du super-administrateur, ne sont pas
restreintes. La suspension ne rembourse pas un paiement et n'annule pas l'historique.

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
├── deploy/          Caddyfile, nginx.conf, systemd, gratuit/ (PC : lanceur, lien stable, service), vm/ (serveur 24 h/24)
├── Dockerfile, docker-compose.yml, render.yaml
├── DEPLOIEMENT.md   guide de mise en ligne pas à pas
├── LIEN-ETERNEL.md  adresse fixe gratuite sans carte (Tailscale Funnel ; Oracle en annexe)
├── FIREBASE.md      publier sur Firebase : ce qui marche sans carte
├── STOCKAGE-EXTERNE.md  Cloudinary, Drive, MEGA, multi-comptes
└── DEPLOIEMENT-GRATUIT.md  mise en ligne à 0 F (ordinateur + Cloudflare Tunnel)
```

- Sessions : cookie `HttpOnly` + table `sessions` (30 jours).
- Mots de passe : `scrypt` avec sel aléatoire, comparaison à temps constant.
- Isolation multi-tenant : chaque requête est filtrée par `ecole_id` issu de l'utilisateur connecté ; les
  enseignants sont en plus restreints à leurs affectations (classes **et** matières).

### Qui peut voir quoi, qui peut modifier quoi

| | Chef d'établissement | Enseignant | Élève / parent |
|---|---|---|---|
| Classes visibles | toutes | seulement celles où il est affecté | la sienne |
| Matières où il saisit | toutes | **seulement les siennes** (classe + matière) | — |
| Notes d'un collègue (autre matière) | voit (bulletins) | **ne voit pas la grille, ne peut pas écrire** | — |
| Bulletins d'une classe | toutes ses classes | ses classes seulement | le sien, si publié |
| Journal de saisie (qui a modifié quoi) | **oui** | non | non |
| Liste des enseignants | oui | non | non |
| Création d'élèves, classes, matières, périodes | oui | non | non |

Concrètement : un professeur de Physique-Chimie qui ouvre la grille de Mathématiques de la même
classe reçoit un **403** ; son menu ne propose d'ailleurs que ses propres matières. Le cloisonnement
est fait **côté serveur** (`canAccessClasse` + `canSaisir`), pas seulement dans l'interface.
La direction contrôle tout cela depuis `Enseignants → affectations` (une ligne = une matière dans
une classe). Deux professeurs affectés à la **même** matière peuvent co-saisir : c'est voulu
(remplacement, co-enseignement), et chaque note garde la trace de qui l'a modifiée en dernier
(`notes.saisi_par` + `notes.modifie_le`), visible dans le **journal de saisie** de la page
« Saisie des notes ».

Autres verrous : une période **clôturée** (`parametres → Périodes`) refuse toute nouvelle saisie aux
enseignants ; une note ne peut viser qu'un élève de la classe de l'évaluation.
- Bulletins imprimables : page HTML A4 autonome (`/print/bulletin/:id`, `/print/classe/:id`), impression
  navigateur ou « Enregistrer au format PDF ». La direction, l'enseignant affecté ou l'élève concerné
  (si publié) peuvent y accéder.

### Bulletin : professeurs et signatures

| Élément du bulletin | D'où il vient |
|---|---|
| Nom de la matière | `matieres.nom` (lycée) ou `matieres.nom_college` si la classe est au collège |
| Nom du professeur, sous chaque matière | affectations (classe + matière) |
| **Colonne « Signature du professeur »**, à droite du tableau | signature importée de l'enseignant affecté à la matière (case vide s'il n'en a pas : elle se signe à la main sur le bulletin imprimé) |
| Bloc « Le Professeur titulaire » | `classes.titulaire_id` → nom **et signature** de l'enseignant |
| Bloc « Le Chef d'Établissement » | `etablissements.chef_nom` / `chef_titre` + signature du compte direction |
| Le tuteur | **supprimé du bulletin** (les coordonnées du tuteur restent dans la fiche élève) |

La signature s'importe **une seule fois** : console → *Enseignants* → ✏️ → zone de dépôt
(glisser une photo, coller avec `Ctrl+V`, ou choisir un fichier). Elle est réduite à 600 px dans le
navigateur, puis enregistrée sur le stockage configuré (`STORAGE_PROVIDERS`). Elle apparaît ensuite
automatiquement sur tous les bulletins de l'enseignant, au-dessus de son nom.
Le chef d'établissement importe la sienne depuis *Paramètres → Logo & signature*.

### Identifiants des enseignants (récupération de mot de passe)

Il n'y a **pas d'envoi d'e-mail** dans la plateforme (contrainte 0 F). La récupération passe donc par
le chef d'établissement, seul habilité :

| Situation | Ce que fait le chef | Effet |
|---|---|---|
| Un enseignant a perdu son mot de passe | *Enseignants* → 🔑 | Nouveau mot de passe lisible (ex. `baobab-solide-4821`), affiché **une seule fois**, copiable ; anciennes sessions fermées, compte réactivé, demandes marquées traitées |
| Il veut imposer un mot de passe connu | 🔑 → champ « Mot de passe imposé » | Le mot de passe choisi est appliqué (minimum 6 caractères) |
| Il veut retirer l'accès immédiatement | 🚫 | `actif = 0` : sessions fermées (déconnexion immédiate), affectations retirées ; les notes déjà saisies sont conservées |
| Il veut rétablir | ✅ | `actif = 1`, l'enseignant se reconnecte et les affectations peuvent être réattribuées |

L'enseignant, lui, ne peut **jamais** se redonner un accès : l'endpoint est réservé à la direction
(`directionOnly`). Depuis l'écran de connexion, « Mot de passe oublié ? » dépose pour l'enseignant
une **demande** (`demandes_mdp`) qui apparaît en haut de la page *Enseignants* ; seul le chef lui
communique ses nouveaux identifiants. **Aucun e-mail de réinitialisation n'est envoyé à un enseignant.**

Pour les **chefs et le super-administrateur seulement**, ce même formulaire envoie un **lien Gmail** vers
l'adresse e-mail de connexion, *si le serveur Gmail est configuré*. Ouvrir le lien, choisir un mot de
passe d'au moins 12 caractères, puis se reconnecter. Le lien expire au bout de **30 minutes**, n'est
utilisable **qu'une fois** et ferme les anciennes sessions. La base ne conserve que l'empreinte du
jeton ; un nouveau lien n'est envoyé au même compte qu'après **10 minutes**. Une réponse identique est
donnée pour les comptes inconnus et les différents rôles (aucune adresse existante divulguée).

**Activer Gmail sur l'hébergement :** dans le fichier privé `~/app/.env` (ne jamais le publier dans Git,
ni communiquer son contenu dans un chat), ajouter :

```dotenv
APP_PUBLIC_URL=https://votre-compte.alwaysdata.net
GMAIL_USER=votre-adresse@gmail.com
GMAIL_APP_PASSWORD=
```

Activer la validation en deux étapes dans son propre compte Google et créer un **mot de passe
d'application** Gmail ; le placer soi-même, uniquement dans la dernière ligne du `.env` sur le serveur,
puis protéger le fichier (`chmod 600 ~/app/.env`), installer les nouvelles dépendances (`npm ci --omit=dev`)
et redémarrer le site dans **alwaysdata → Web → Sites → Redémarrer**. `APP_PUBLIC_URL` est l'origine
**publique en HTTPS** du site, sans `/app` ni slash final. Sans ces **trois** valeurs valides, le
formulaire indique honnêtement que l'e-mail n'est pas disponible ; les demandes enseignants restent
fonctionnelles. **Aucun envoi réel Gmail n'est garanti sans un test depuis l'hébergement** (boîte de
réception et indésirables ; si besoin, consulter les journaux du site).

### Bulletins de composition seule

- Interface : *Bulletins* → **Type de bulletin → Composition seule**, puis 🖨️ *Bulletins de composition*.
- URL directe : `/print/classe/:classeId?periode_id=…&mode=composition` (ou `/print/bulletin/:eleveId?...`).
- Le bulletin s'intitule alors « **Bulletin de composition** », les colonnes Devoir 1 / Devoir 2
  disparaissent, seules les compositions et les moyennes de composition sont imprimées, avec le rang
  recalculé sur ces notes.
- Les bulletins complets restent disponibles : l'option **remplace l'affichage à l'écran**, elle ne
  supprime rien.

### Fusion de classes (« tous les 6ème réunis »)

- Interface : menu **Évaluations → 🏆 Résultats** (direction), ou **Mes classes → 🏆 Résultats**
  (enseignants). La page affiche directement **🔗 Fusionner les classes** avec les classes à cocher ;
  bouton **📄 Résultats d’une classe** pour revenir aux bulletins par classe. Sur téléphone, ouvrez
  d’abord le menu ☰ ; depuis le tableau de bord, un raccourci **🏆 Résultats** est aussi disponible.
- Cochez les divisions à réunir (bouton **Tout cocher** par niveau), choisissez la période **ou** un
  examen blanc, puis **🔗 Fusionner**. Si plusieurs divisions ont le même niveau, elles sont
  pré-cochées à l'ouverture de la page.
- Résultats : 4 indicateurs (effectif réuni, moyenne du niveau, taux de réussite, premier du niveau),
  bandeau **premier du niveau**, bandeau **plus faible note de la matière principale**,
  tableau **meilleure / plus faible note par matière** (note, élève, classe, effectif ≥ 10),
  **répartition note par note par matière** (histogramme 0→20 et tableau), **répartition des moyennes
  générales**, **classement fusionné** et repères par classe (premier de chaque division et son rang
  dans le niveau).
- **Deux sources indépendantes** : sélectionnez une période puis cochez **Compositions seules (sans devoirs)**
  pour utiliser uniquement les notes de composition, ou choisissez dans **Source des résultats** un
  **examen blanc programmé** (ses épreuves et notes sont distinctes). La direction peut passer par
  **🎯 Programmer un examen blanc** pour créer une épreuve séparée.
- **PDF de proclamation** : après fusion, bouton **⬇️ PDF : tableau des matières** (personnel), ou,
  si la direction utilise les **compositions seules**, bouton **🏆 PDF de proclamation (examen blanc)**.
  Ce dernier titre le document « Examen blanc » mais précise explicitement que les résultats viennent
  des compositions de la période ; il ne crée pas d'épreuve, ne publie rien aux familles et ne modifie
  aucune note. Le PDF de proclamation A4 contient le classement commun, les non-classés, le bilan par
  matière, la répartition des moyennes et celle des mathématiques ; le PDF ordinaire détaille toutes
  les matières note par note. **Les premières pages sont un tableau A4 paysage : une ligne par élève,
  une colonne par matière (MATH, SVT, etc.), rang commun, matricule, nom, classe, total des coefficients,
  total des points, moyenne et mention.** Les codes sont accompagnés d'une légende avec les noms complets
  des matières et les coefficients. Au-delà de huit matières, le tableau répète les élèves sur plusieurs
  groupes de pages. « — » indique une matière non notée ou non enseignée ; les élèves sans moyenne restent
  visibles en fin de classement. Le bilan, les statistiques et la signature suivent en A4 portrait.
- URL directe : `/app#/resultats?classes=1,2,3&periode_id=4` (ou `&examen_id=2`, `&mode=composition`).
  L’ancien lien `/app#/fusion` continue de fonctionner.
- PDF : `GET /api/fusion/pdf?classe_ids=1,2,3&periode_id=4&mode=composition` ; ajouter
  `&presentation=examen-blanc` pour un PDF de proclamation (direction uniquement). La même route
  accepte `examen_id` à la place de `periode_id` pour un examen blanc réellement programmé.
- API : `GET /api/fusion?classe_ids=1,2,3&periode_id=4` — un enseignant ne peut réunir que **ses**
  classes (403 sinon). La fusion ne modifie **aucune** note : elle recalcule un classement commun.

### Stockage externe

`server/storage.js` centralise l'envoi des fichiers : Cloudinary (jusqu'à plusieurs comptes en
rotation), Google Drive, **MEGA via rclone** (25 Go gratuits), et **repli local** systématique
(`data/media`, servi sous `/media/...`). Seules les images (logos, signatures, pièces jointes)
sortent : les notes et les bulletins restent dans SQLite.

```bash
npm run stockage                    # état des fournisseurs
npm run stockage -- --test mega     # envoi réel d'un fichier de test
bash deploy/alwaysdata/rclone.sh --installer --configurer   # MEGA en 2 étapes
bash deploy/alwaysdata/cloudinary.sh --configurer            # Cloudinary (CDN)
# Guide d'utilisation (PDF) : python3 guide/generer-guide.py ../documents/GUIDE-TERMINISH-ECOLE.pdf
```

Depuis l'application : **Réglages → Stockage externe** affiche l'état de chaque fournisseur et
permet de le tester en un clic. Diagnostic HTTP : `GET /api/stockage/etat`,
`POST /api/stockage/tester`. Tout est expliqué dans **[STOCKAGE-EXTERNE.md](STOCKAGE-EXTERNE.md)**.

### Sur quelle base tourne le site ? (`npm run base`)

Les données (élèves, notes, bulletins) vivent dans **un seul fichier SQLite** :
`data/terminish-ecole.db` du dossier depuis lequel le site est lancé. Deux
exemplaires du projet dans deux dossiers = deux bases différentes, sans le dire.

```bash
npm run base
```

Ou, sans terminal : menu de gauche, en bas → **🗄️ Base de données** (chef
d'établissement). La fenêtre affiche le dossier, le fichier, sa date, sa taille,
le mode démo/production et le contenu réel. C'est la preuve visuelle de ce que le
site utilise réellement — utile quand deux dossiers « TERMINISH ECOLE » coexistent.

Affiche, sans rien modifier : le dossier de données, le fichier et sa date de
dernière écriture, le mode (démo / production), le nombre réel d'établissements,
d'élèves, de notes et de bulletins, les **autres bases présentes** sur la
machine, et — point clé — **quel processus utilise quelle base**, avec le port
et le contrôle du tunnel (`502` si le tunnel ne pointe pas sur le même port).

### Principales tables

`etablissements`, `utilisateurs`, `sessions`, `classes`, `matieres`, `classe_matieres`, `eleves`,
`periodes`, `affectations`, `examens`, `epreuves`, `evaluations`, `notes`, `bulletins`, `paiements`,
`operations_abonnement` (états avant/après, auteur, motif d'annulation), `demandes`, `reglages`
(numéros marchands, tarifs, clés CinetPay). La nouvelle table est créée automatiquement au démarrage,
sans retirer de données aux paiements déjà enregistrés.

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
| GET | `/api/journal-notes` | direction (traçabilité des saisies) |
| PUT | `/api/moi/signature` | personnel (sa propre signature manuscrite) |
| GET | `/api/stockage/etat` | direction (fournisseurs de stockage actifs) |
| POST | `/api/stockage/tester` | direction (envoie un fichier de test, `{fournisseur}` facultatif) |
| POST | `/api/notes/saisie` | personnel (affectations) |
| GET | `/api/bulletins/classe` | personnel |
| PUT/POST | `/api/bulletins/...` | direction |
| GET | `/api/stats/classe`, `/api/stats/etablissement` (`?mode=composition`) | personnel |
| GET | `/api/fusion` (`?classe_ids=1,2,3&periode_id=…` ou `&examen_id=…`, `&mode=composition`) | personnel (ses classes pour un enseignant) |
| CRUD | `/api/examens`, `/api/examens/:id/epreuves` | direction |
| GET | `/api/eleve/espace` | élève |
| POST | `/api/auth/oubli` | public (e-mail sécurisé pour chef/admin si Gmail prêt ; demande au chef pour enseignant) |
| POST | `/api/auth/recuperation/verifier`, `/api/auth/recuperation/terminer` | public (lien à usage unique ; mot de passe ≥ 12 caractères) |
| GET | `/api/demandes-mdp` | direction (demandes des enseignants à traiter) |
| POST | `/api/demandes-mdp/:id/traiter` | direction |
| POST | `/api/enseignants/:id/identifiants` | direction (nouveau mot de passe, affiché une fois) |
| POST | `/api/enseignants/:id/acces` | direction (`actif` 0/1, révoque les sessions) |
| GET | `/api/paiement/options` | direction (opérateurs, tarifs) |
| POST | `/api/paiement/declarer` | direction (déclaration Mobile Money) |
| POST | `/api/paiement/cinetpay/initier` | direction (si CinetPay configuré) |
| POST | `/api/paiement/paydunya/initier` | direction (si PayDunya configuré) |
| POST | `/api/webhooks/cinetpay` | CinetPay (public, vérifié côté API) |
| POST | `/api/webhooks/paydunya` | PayDunya (public, empreinte + confirmation API) |
| GET | `/api/paiements/:id/recu.pdf` | direction (reçu PDF de son école) |
| GET | `/api/admin/paiements/:id/recu.pdf` | super administrateur |
| GET/POST | `/api/admin/paiements` | super administrateur (liste / encaissement manuel) |
| PATCH | `/api/admin/paiements/:id` (`valider`, `rejeter`, `annuler` + `motif`) | super administrateur (paiements manuels) |
| PATCH | `/api/admin/etablissements/:id/abonnement` (`annuler` + `operation_id` ou `suspendre`, `motif`) | super administrateur |
| GET | `/api/admin/abonnements/historique` | super administrateur (50 derniers changements) |
| GET/PUT | `/api/admin/reglages` | super administrateur |
| GET | `/api/admin/*` | super administrateur |
| GET | `/print/bulletin/:id`, `/print/classe/:id`, `/print/examen/:id` (`?mode=composition`) | personnel / élève concerné |

---

## 6. Déploiement

**Vous voulez que le site tourne sans votre ordinateur ?** Lisez
**[HEBERGEMENT.md](HEBERGEMENT.md)** : une base d'hébergement gratuite, sans carte bancaire, avec
disque permanent (la base SQLite y survit aux redémarrages). Installation en une commande
(`deploy/alwaysdata/installer.sh`).

**Budget zéro ?** Suivez **[DEPLOIEMENT-GRATUIT.md](DEPLOIEMENT-GRATUIT.md)** : le site tourne sur votre
ordinateur et devient accessible en HTTPS via Cloudflare Tunnel (gratuit, sans compte).

**Besoin d'un lien qui ne change jamais, sans carte bancaire ?** **[LIEN-ETERNEL.md](LIEN-ETERNEL.md)** :
**Tailscale Funnel** donne une adresse HTTPS permanente `https://<machine>.<reseau>.ts.net`, gratuite à
vie, sans ouvrir de port (fonctionne même derrière le NAT du Chromebook). Une seule commande :

```bash
bash deploy/gratuit/tout.sh                      # tout remettre en route (site + tunnel + test)
bash deploy/gratuit/service-auto.sh --installer  # le site démarre tout seul (fini le 502)
bash deploy/gratuit/lien-stable.sh --tailscale   # installe, connecte, ouvre le tunnel
bash deploy/gratuit/lien-stable.sh --etat        # où en est-on ?
bash deploy/gratuit/lien-stable.sh --ip          # variante : diagnostic IP publique / CGNAT
bash deploy/gratuit/lien-stable.sh --duckdns NOM TOKEN   # variante : nom fixe DuckDNS
```

Avec une carte bancaire (vérification d'identité, aucun débit), une VM Oracle Cloud « Always Free »
fait tourner le site 24 h/24 : `deploy/vm/installer-vm.sh` installe Docker, HTTPS et l'adresse
`https://ecole.<ip>.sslip.io` en une commande (voir §5 de LIEN-ETERNEL.md).

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
| `APP_PUBLIC_URL` | origine HTTPS du site, ex. `https://votre-compte.alwaysdata.net`, sans chemin |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | compte Gmail expéditeur et mot de passe **d'application** privé (jamais celui du compte Google) ; requis avec `APP_PUBLIC_URL` pour la récupération chef/admin |
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
