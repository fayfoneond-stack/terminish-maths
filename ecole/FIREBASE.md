# Firebase : est-ce possible ? Combien ça coûte ?

> Document de décision — 21 octobre 2026. À lire avant de lancer la migration.
> **Conclusion en une ligne : oui c'est techniquement possible, mais il faut réécrire toute la couche de
> données (≈ 3 à 5 semaines de travail), pour un gain quasi nul à votre échelle. Le déploiement Render/VPS
> déjà préparé fait la même chose en 20 minutes.**

---

## 1. Ce que Firebase peut et ne peut pas faire pour cette application

| Besoin de Terminish École | Firebase |
|---|---|
| Servir le site vitrine (HTML/CSS) avec HTTPS et domaine | ✅ Firebase Hosting, gratuit, CDN mondial |
| Exécuter un serveur Express/Node | ✅ App Hosting (Cloud Run) — mais nécessite le plan **Blaze** (facturation à l'usage) |
| Garder une base **SQLite** dans un fichier | ❌ aucun disque persistant : le conteneur Cloud Run est **éphémère** |
| Écrire des fichiers (sauvegardes, PDF mis en cache) | ❌ même problème, sauf envoi explicite vers Cloud Storage |
| Base relationnelle avec `JOIN`, `ORDER BY`, transactions | ❌ Firestore = NoSQL ; il faut soit changer de modèle, soit louer Cloud SQL |
| Sessions, mots de passe | ⚠️ notre système (cookie + scrypt + table `sessions`) fonctionne, mais suppose une base persistante |
| Sauvegarde | ⚠️ export Firestore planifié ; plus de « un fichier à copier » |
| Coût prévisible | ⚠️ facturation à l'usage : un pic (génération de tous les bulletins) se voit sur la facture |

Le point bloquant n'est pas Firebase en général : c'est **`node:sqlite` + un fichier dans `/data`**.
Un conteneur Cloud Run démarre avec un disque vide, redémarre à chaque déploiement et peut tourner en
plusieurs exemplaires simultanés — trois raisons pour lesquelles SQLite n'y survit pas.

### Firebase Hosting seul ?

Non : il ne sert que des fichiers statiques. Notre app a besoin d'un serveur (API, sessions, PDF, webhooks).

---

## 2. Trois scénarios possibles, du plus cher au plus raisonnable

### Scénario A — Firebase App Hosting + **Firestore** (le « vrai » Firebase)

C'est ce que vous avez en tête. Il faut remplacer SQLite par Firestore.

| À réécrire | Volume actuel |
|---|---|
| Points d'accès à la base | **229** (`db.prepare(...)`) |
| Routes HTTP | **72** |
| Code serveur | **≈ 3 000 lignes** (`db.js`, `index.js`, `stats.js`, `paiements.js`, `print.js`, `recu.js`) |
| Transactions implicites (saisie d'une grille de notes) | à transformer en `WriteBatch` / `runTransaction` |
| Agrégats (moyennes, rangs, statistiques d'établissement) | à pré-calculer dans des documents de synthèse |

Modèle Firestore envisagé :

```
ecoles/{ecoleId}                       infos établissement, plan, abonnement
ecoles/{ecoleId}/utilisateurs/{uid}    comptes (rôle, scrypt)
ecoles/{ecoleId}/classes/{id}
ecoles/{ecoleId}/eleves/{id}
ecoles/{ecoleId}/matieres/{id}
ecoles/{ecoleId}/periodes/{id}
ecoles/{ecoleId}/notes/{eleveId_matiereId_eval}   ← le plus volumineux
ecoles/{ecoleId}/paiements/{id}
ecoles/{ecoleId}/agregats/{classeId_periode}      ← moyennes/rangs pré-calculés
```

**Pourquoi les agrégats sont obligatoires** : la page « statistiques de l'établissement » lit aujourd'hui
toutes les notes en une requête SQL. En Firestore, chaque document lu est facturé et compte dans le quota
(50 000 lectures/jour gratuites). Afficher les stats de 20 classes = plusieurs milliers de lectures ;
sans documents de synthèse, une seule visite coûterait plus que tout le reste.

**Effort réaliste** (1 développeur connaissant le code) :

| Phase | Durée |
|---|---|
| 1. Modèle de données Firestore + couche d'accès (remplace `db.js`) | 2–3 j |
| 2. Conversion des 72 routes en asynchrone (`await`, gestion d'erreurs) | 5–7 j |
| 3. Agrégats : moyennes, rangs, statistiques, bulletins, examens blancs | 3–4 j |
| 4. Paiements, webhooks CinetPay/PayDunya, reçus PDF | 1–2 j |
| 5. Migration des données existantes + script de vérification | 2–3 j |
| 6. Tests de non-régression (les 4 profils) + charge | 2–3 j |
| 7. Déploiement Blaze, règles, sauvegardes, supervision | 1–2 j |
| **Total** | **16 à 24 jours ouvrés** (3 à 5 semaines) |

Risques principaux : régressions silencieuses sur les calculs de moyennes/rangs (le cœur du produit),
latence des agrégats, perte du mode « impression de masse » fluide, dépendance totale à Google.

### Scénario B — Cloud Run + **Cloud SQL (PostgreSQL)**

On garde le modèle relationnel, on change seulement le moteur.

- Réécriture **asynchrone** de tous les appels (le driver `pg` est asynchrone, `node:sqlite` est synchrone) :
  même volume de travail que A, un peu moins de conception.
- **Coût fixe supplémentaire** : une instance Cloud SQL la plus petite tourne 24 h/24 (~8–12 $/mois),
  même sans aucune école connectée. C'est le point noir de cette option.
- Effort : **14 à 20 jours**.

### Scénario C — Cloud Run + **libSQL/Turso** (SQL conservé) ⭐ le moins douloureux si vous tenez à Google Cloud

Turso est un SQLite hébergé, compatible SQL, accessible en HTTP.

- Les requêtes SQL elles-mêmes changent très peu (mêmes tables, mêmes `SELECT`, `INSERT`, `ON CONFLICT`) ;
  on remplace `db.prepare(...).get()/run()/all()` par un client asynchrone.
- Reste un travail d'`async`/`await` sur les 72 routes, mais **pas de remodelage des données**.
- Turso a une offre gratuite (stockage et lectures généreux) ; Cloud Run reste à 0 tant qu'il n'y a pas de trafic.
- Effort : **8 à 12 jours**.
- Inconvénient : une dépendance de plus (Turso) en plus de Google.

---

## 3. Chiffrage financier (ordre de grandeur, échelle 5 écoles / 1 500 élèves)

| Poste | Firestore + App Hosting | Cloud Run + Cloud SQL | Cloud Run + Turso | VPS actuel | Render |
|---|---|---|---|---|---|
| Serveur | ~0–5 $/mois (Blaze, trafic faible) | ~0–5 $ | ~0–5 $ | 5–8 € | ~7 $ |
| Base de données | incluse (quelques centimes) | **8–12 $** (instance permanente) | 0 $ (offre gratuite) | 0 € | disque inclus |
| Disque persistant | non applicable | non applicable | non applicable | inclus | 1 $/Go |
| Sauvegarde | export planifié (payant au-delà du quota) | automatique incluse | à organiser | `npm run backup`, gratuit | volume |
| **Total mensuel** | **≈ 0–10 $** | **≈ 10–17 $** | **≈ 0–5 $** | **≈ 5–8 €** | **≈ 8 $** |
| **Coût de migration** | **16–24 j** | 14–20 j | 8–12 j | **0 j** | 0 j |

Les montants Firebase sont faibles : le vrai coût, c'est **le temps de développement** et le risque de
régression. À 15 000 F/mois par école, 3 semaines de réécriture représentent plusieurs abonnements annuels.

---

## 4. Ce que Firebase apporterait réellement

- HTTPS + domaine + CDN sans configuration (déjà couvert par Caddy dans `docker-compose.yml`).
- Mise à l'échelle automatique (utile au-delà de plusieurs centaines d'écoles simultanées — pas votre cas).
- Firestore en temps réel (utile pour une app mobile, superflu ici).
- Pas de serveur à patcher.

## 5. Ce que vous perdriez

- **La sauvegarde en une commande** (`npm run backup` → un fichier daté), aujourd'hui testée.
- **La portabilité** : aujourd'hui l'app tourne sur n'importe quel VPS, PC ou conteneur ; demain, elle est
  mariée à Google.
- **La prédictibilité des coûts** : un usage de masse (tous les bulletins d'un coup) devient facturé.
- **Le confort d'impression** : les bulletins sont générés côté serveur en quelques millisecondes depuis
  SQLite ; en Firestore, il faut lire des centaines de documents par bulletin.
- **La simplicité de développement** : chaque évolution future (statistiques, examens blancs, exports)
  sera plus longue à écrire.

---

## 6. Recommandation

1. **Maintenant** : déployez sur Render ou un VPS (déjà prêt, 20 minutes, HTTPS automatique).
   Cloudinary est déjà branché pour les logos, indépendamment de l'hébergeur.
2. **Gardez Firebase Hosting** pour la **page vitrine** si vous voulez : c'est gratuit, rapide, et sans
   impact sur l'application (les formulaires continueront de pointer vers l'app).
3. **Ne migrez vers Firestore que si** l'un de ces trois signaux apparaît :
   - plus de ~200 écoles actives simultanément (SQLite tient largement jusque-là) ;
   - besoin d'une application mobile temps réel ;
   - obligation d'héberger chez Google (marché, partenaire, financement).
   Dans ce cas, préférez le **scénario C** (Cloud Run + libSQL) ou un Postgres managé : même bénéfice,
   moitié du travail, et le modèle relationnel — donc les bulletins — reste intact.

---

## 7. Si vous confirmez malgré tout le scénario A

Je procède dans cet ordre, avec un point de contrôle à chaque étape :

1. **Gel** : tag Git `v1-sqlite` (l'application actuelle reste déployable).
2. Branche `migration/firestore` ; **couche d'accès isolée** (`server/store/`) pour que les routes ne
   connaissent plus le moteur.
3. Migration écran par écran, avec un **test de comparaison** : mêmes données d'entrée → mêmes moyennes,
   mêmes rangs, mêmes bulletins (comparaison automatique SQLite vs Firestore).
4. Bascule progressive : l'application continue de tourner sur SQLite pendant la migration.
5. Mise en production Blaze, alertes de budget, export quotidien vers Cloud Storage.

Livrables : code migré, suite de tests de non-régression, script de migration des données,
guide de déploiement Firebase, procédure de sauvegarde/restauration Firestore.

Dites-moi « on y va » et je démarre par l'étape 1–2 (2 à 3 jours) avant tout engagement sur le reste.
