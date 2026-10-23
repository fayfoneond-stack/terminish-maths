# Publier sur Firebase — ce qui marche, ce qui ne marche pas, et comment faire

> Mise à jour : 23 octobre 2026. À lire avant `firebase deploy`.
> **En une ligne** : Firebase Hosting peut servir l'interface gratuitement, mais **aucune** offre
> Firebase sans carte bancaire ne peut exécuter le serveur (Express + SQLite). La combinaison qui
> marche à 0 F : **interface sur Firebase Hosting + API sur votre machine (Tailscale Funnel)**.

---

## 1. La réalité, sans détour

| Ce que vous voulez | Firebase | Verdict |
|---|---|---|
| Servir l'interface (HTML/CSS/JS) en HTTPS, CDN mondial, nom de domaine | **Hosting** — gratuit, sans carte | ✅ **oui** |
| Exécuter `server/index.js` (API, sessions, PDF, webhooks) | App Hosting / Cloud Functions — plan **Blaze**, carte obligatoire | ❌ sans carte |
| Garder la base SQLite dans un fichier | Cloud Run = disque **éphémère**, redémarre, plusieurs instances | ❌ |
| Base relationnelle (`JOIN`, transactions), 1 000 écoles | Firestore = NoSQL, il faudrait tout réécrire | ❌ (chantier de plusieurs semaines) |
| Héberger les signatures et les logos | Cloudinary / Drive (voir `STOCKAGE-EXTERNE.md`) | ✅ oui, gratuit |

**Pourquoi SQLite ne tient pas sur Firebase** : un conteneur Cloud Run démarre avec un disque vide,
redémarre à chaque déploiement et peut tourner en plusieurs exemplaires. Trois raisons qui font perdre
les notes d'un élève. Le problème n'est pas Firebase, c'est « une base dans un fichier ».

---

## 2. La combinaison qui fonctionne, gratuitement

```
   Navigateur (école, professeur, parent)
              │
              ├──► Firebase Hosting   ── interface HTML/CSS/JS (gratuit, CDN)
              │        https://mon-ecole.web.app
              │
              └──► Tailscale Funnel   ── API + base SQLite (votre machine)
                       https://penguin.xxxx.ts.net
```

L'interface appelle l'API par son adresse absolue. Le fichier `public/config.js` contient cette
adresse — **une seule ligne à changer**.

### 2.1 La commande unique : `deploy/gratuit/firebase.sh`

```bash
cd ~/"TERMINISH ECOLE 1"

# 1. l'API a besoin d'une adresse FIXE (gratuite, sans carte) :
bash deploy/gratuit/lien-stable.sh --tailscale

# 2. publication de l'interface + réglages du serveur, en une fois :
bash deploy/gratuit/firebase.sh --projet NOM-DU-PROJET

# 3. redémarrer le serveur pour qu'il prenne les nouveaux réglages :
bash deploy/gratuit/tout.sh
```

Le script fait quatre choses, et il est rejouable sans risque :

| Étape | Effet |
|---|---|
| trouve l'adresse du tunnel | `tailscale funnel status` → `https://machine.ts.net` |
| écrit `public/config.js` | l'interface sait où joindre l'API (sauvegarde dans `public/config.js.avant-firebase`) |
| écrit `.firebaserc` | associe le dossier au projet Firebase |
| publie `public/` | `firebase deploy --only hosting` → `https://NOM.web.app` |

Il écrit aussi un bloc dans **`.env`** :

```
# --- Terminish / Firebase (géré par deploy/gratuit/firebase.sh) ---
CORS_ORIGIN=https://NOM.web.app,https://NOM.firebaseapp.com
COOKIE_SECURE=1
# --- fin du bloc Firebase ---
```

> Le serveur lit automatiquement `.env` au démarrage (aucune dépendance, aucune variable à
> retaper). C'est ce qui fait que `tout.sh`, le service systemd et un démarrage manuel se
> comportent tous de la même façon après un redémarrage du Chromebook.
> `CORS_ORIGIN` autorise l'origine Firebase **et** passe le cookie en `SameSite=None; Secure`,
> obligatoire quand l'interface et l'API sont sur deux domaines.

Autres options du script :

```bash
bash deploy/gratuit/firebase.sh --etat        # où en est-on ?
bash deploy/gratuit/firebase.sh --preparer    # écrit les fichiers, ne publie pas
bash deploy/gratuit/firebase.sh --api https://xxxx.ts.net --projet NOM
bash deploy/gratuit/firebase.sh --annuler     # revient au site 100 % local
```

### 2.2 Ce qu'il faut faire à la main (une seule fois)

1. Créer le projet sur <https://console.firebase.google.com> (nom libre, ex. `mon-ecole-togo`).
   Le forfait **Spark (gratuit)** suffit : Hosting est inclus, aucune carte demandée.
2. Se connecter à la CLI :

```bash
npx firebase-tools login
```

Un onglet s'ouvre : choisissez le compte Google, autorisez. Sur un Chromebook sans onglet :

```bash
npx firebase-tools login --no-localhost
```

3. Relancer `bash deploy/gratuit/firebase.sh --projet NOM-DU-PROJET`.

Firebase affiche à la fin :

```
Hosting URL: https://mon-ecole.web.app
```

C'est l'adresse que vous donnez aux écoles. Elle ne change jamais, même si le Chromebook redémarre :
seule l'API doit être relancée (`bash deploy/gratuit/tout.sh`).

### 2.3 Le fichier `firebase.json` fourni

Il publie uniquement `public/` (jamais `data/`, jamais `.env`), redirige `/app` vers `app.html`
et met en cache CSS/JS une heure. Rien d'autre.

### 2.4 Vérifier que la combinaison fonctionne

| Test | Résultat attendu |
|---|---|
| Ouvrir `https://NOM.web.app` | la page de connexion s'affiche (servie par Google) |
| Se connecter | le tableau de bord apparaît |
| `curl -s https://NOM.web.app` | du HTML, jamais une erreur 404 |
| Console du navigateur (F12) | aucune ligne rouge `CORS` / `blocked` |

Si la page s'affiche mais que la connexion « tourne dans le vide » : l'API n'est pas joignable
(tunnel arrêté, ou adresse du tunnel changée → relancer `firebase.sh`, qui réécrit `config.js`).

---

## 3. Et si un jour vous avez une carte bancaire

Deux chemins seulement :

| Option | Ce qu'il faut faire | Coût |
|---|---|---|
| **Firebase App Hosting + Cloud SQL (PostgreSQL)** | remplacer `node:sqlite` par `pg` (~2 à 3 jours de travail), déployer | Cloud SQL ≈ 8–10 $/mois + usage |
| **VPS classique** (Hetzner, OVH) | `sudo bash deploy/vm/installer-vm.sh`, rien à réécrire | 4 000–7 000 F/mois |

Tant que la carte n'existe pas, la section 2 est la seule voie — et elle suffit largement pour
démarrer avec plusieurs écoles.

---

## 4. Ce qu'il ne faut PAS faire

- ❌ Publier `data/` ou `.env` sur Firebase Hosting (le `firebase.json` fourni l'interdit).
- ❌ Mettre l'API sur Cloud Functions « pour voir » : le disque est vide à chaque appel, les
  inscriptions disparaissent.
- ❌ Mettre `TERMINISH_API_BASE` sans `CORS_ORIGIN` : le navigateur bloquera chaque requête et
  l'écran de connexion tournera dans le vide.
- ❌ Utiliser `http://` pour l'API : un cookie `SameSite=None` **exige** `Secure`, donc HTTPS.

---

## 5. Vérifier que tout est branché

```bash
# 1. l'API répond-elle ? (depuis n'importe où)
curl https://penguin.xxxx.ts.net/api/health
# → {"ok":true,...}

# 2. l'interface connaît-elle la bonne adresse ?
#    ouvrez https://mon-ecole.web.app, puis dans la console du navigateur :
#    window.TERMINISH_API_BASE   → doit afficher l'adresse du tunnel

# 3. connexion depuis l'interface Firebase
#    /app → identifiant + mot de passe → vous devez arriver sur le tableau de bord
```

Si l'étape 3 échoue avec « CORS » dans la console : `CORS_ORIGIN` ne correspond pas exactement à
l'origine affichée par Firebase (attention à `https://` et à l'absence de `/` final).
