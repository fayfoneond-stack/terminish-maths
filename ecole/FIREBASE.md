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

### 2.1 Côté serveur (votre machine)

```bash
cd ~/"TERMINISH ECOLE"

# accepter les appels venant de Firebase, et sécuriser le cookie
export CORS_ORIGIN="https://mon-ecole.web.app,https://mon-ecole.firebaseapp.com"
export COOKIE_SECURE=1

bash deploy/gratuit/tout.sh          # site + tunnel
```

> `CORS_ORIGIN` fait deux choses : autorise ces origines, et passe le cookie de session en
> `SameSite=None; Secure` — obligatoire quand l'interface et l'API sont sur deux domaines.
> `COOKIE_SECURE=1` exige HTTPS : Tailscale Funnel le fournit.

### 2.2 Côté interface (le dossier `public/`)

1. Dans `public/config.js`, mettez l'adresse du tunnel :

```js
window.TERMINISH_API_BASE = 'https://penguin.xxxx.ts.net';
```

2. Installez Firebase CLI (une fois) et connectez-vous :

```bash
npm install -g firebase-tools
firebase login
```

3. Dans le dossier `ecole/`, associez le projet :

```bash
cp .firebaserc.example .firebaserc
nano .firebaserc        # remplacez "terminish-ecole" par l'identifiant de votre projet
firebase deploy --only hosting
```

Firebase affiche à la fin :

```
Hosting URL: https://mon-ecole.web.app
```

C'est l'adresse que vous donnez aux écoles. Elle ne change jamais, même si le Chromebook redémarre :
seule l'API doit être relancée (`bash deploy/gratuit/tout.sh`).

### 2.3 Le fichier `firebase.json` fourni

Il publie uniquement `public/` (jamais `data/`, jamais `.env`), redirige `/app` vers `app.html`
et met en cache CSS/JS une heure. Rien d'autre.

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
