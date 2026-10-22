# Téléchargements — Terminish École

## ⬇️ Le fichier à prendre pour déployer

### `terminish-ecole-deploiement.zip` — 180 Ko (22/10/2026)

sha256 : `7662e71f32aac6b7b62ae6acafcef008f6fa47472b1acc3cd9c5126e96c4e518`

Tout ce qu'il faut pour installer et mettre le site en ligne, et **rien de plus** :

```
terminish-ecole/
├── INSTALLATION.txt      ← à lire en premier (démarrage, Docker, Render, variables)
├── server/               8 fichiers .js : base, API, bulletins, paiements, reçus, stats
├── public/               site vitrine + application (HTML, CSS, JS)
├── deploy/               Caddy, Nginx, systemd, lanceur, installateur Linux,
│                         lien-stable.sh (adresse fixe Tailscale) + paquet.sh
├── package.json / package-lock.json    dépendances (versions figées)
├── Dockerfile / docker-compose.yml     mise en ligne Docker + HTTPS automatique
├── render.yaml                         déploiement Render (disque persistant)
├── .env.example / .nvmrc               configuration
└── README.md, LIEN-ETERNEL.md, DEPLOIEMENT.md, DEPLOIEMENT-GRATUIT.md, FIREBASE.md
```

39 fichiers · aucun `node_modules` · aucune donnée · testé (extraction vierge,
`npm ci`, démarrage, `/api/health` OK).

## Les autres archives (facultatives)

| Fichier | Taille | Contenu |
|---|---|---|
| `terminish-ecole-avec-donnees-2026-10-21.zip` | 261 Ko | L'application **+ la base de démonstration** : 2 établissements, 8 comptes, 4 624 notes, bulletins, examens, paiements. Pour montrer le produit déjà rempli. |
| `terminish-maths-tout-2026-10-21.zip` | 2,0 Mo | Tout le dépôt : site de maths statique, `Examen/` (PDF), les 3 fiches, **et** l'application. |
| `MANIFESTE.txt` | — | Liste de chaque fichier avec sa taille et son rôle. |

---

## Déployer (Linux)

```bash
unzip terminish-ecole-deploiement.zip
cd terminish-ecole

# 1) essai immédiat, gratuit, avec lien HTTPS public
bash deploy/gratuit/installer-linux.sh --demo

# 2) adresse fixe gratuite, sans carte bancaire (Tailscale)
npm run partage                                     # terminal 1
bash deploy/gratuit/lien-stable.sh --tailscale       # terminal 2

# 3) mise en ligne permanente (VPS avec Docker)
cp .env.example .env && nano .env      # DOMAIN, ADMIN_EMAIL, ADMIN_PASSWORD, TERMINISH_SEED=prod
docker compose up -d --build
```

**Sur Windows/macOS** : mêmes archives, mais lancez `npm install --omit=dev` puis `node deploy/gratuit/demarrer.js`
(le script `installer-linux.sh` est réservé à Linux).

## À savoir

- **Lien fixe sans carte bancaire** : `deploy/gratuit/lien-stable.sh --tailscale` →
  `https://<machine>.<reseau>.ts.net`, HTTPS inclus. Voir `LIEN-ETERNEL.md`.
- **Aucun `node_modules`** dans les zips : `npm ci --omit=dev` le reconstruit en ~1 seconde.
- **`TERMINISH_SEED=prod`** est indispensable en production ; sinon les comptes de démo
  (`admin1234`, `demo1234`) restent accessibles publiquement.
- **Sauvegarde** : `npm run backup` → fichier daté dans `data/sauvegardes/` (à copier hors du serveur).
- Le paquet se refabrique à l'identique avec `bash deploy/paquet.sh` (taille + sha256 + contrôles).
- Le dépôt Git reste la référence pour les mises à jour :
  `git clone https://github.com/fayfoneond-stack/terminish-maths.git`

---

## Mise à jour du 22/10

Le lanceur retrouve désormais `cloudflared` même installé dans `~/.local/bin` (hors `PATH`).
Si vous utilisez une copie extraite avant cette date : `Ctrl+C`, puis
`export PATH="$HOME/.local/bin:$PATH"` et relancez `npm run partage`.
