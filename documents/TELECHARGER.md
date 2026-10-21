# Téléchargements — Terminish École

## ⬇️ Le fichier à prendre pour déployer

### `terminish-ecole-deploiement-2026-10-21.zip` — 153 Ko

Tout ce qu'il faut pour installer et mettre le site en ligne, et **rien de plus** :

```
terminish-ecole/
├── INSTALLATION.txt      ← à lire en premier (démarrage, Docker, Render, variables)
├── server/               8 fichiers .js : base, API, bulletins, paiements, reçus, stats
├── public/               site vitrine + application (HTML, CSS, JS)
├── deploy/               Caddy, Nginx, systemd, lanceur + installateur Linux
├── package.json / package-lock.json    dépendances (versions figées)
├── Dockerfile / docker-compose.yml     mise en ligne Docker + HTTPS automatique
├── render.yaml                         déploiement Render (disque persistant)
├── .env.example / .nvmrc               configuration
└── README.md, DEPLOIEMENT.md, DEPLOIEMENT-GRATUIT.md, FIREBASE.md
```

32 fichiers · aucun `node_modules` · aucune donnée · testé (extraction vierge,
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
unzip terminish-ecole-deploiement-2026-10-21.zip
cd terminish-ecole

# 1) essai immédiat, gratuit, avec lien HTTPS public
bash deploy/gratuit/installer-linux.sh --demo

# 2) mise en ligne permanente (VPS avec Docker)
cp .env.example .env && nano .env      # DOMAIN, ADMIN_EMAIL, ADMIN_PASSWORD, TERMINISH_SEED=prod
docker compose up -d --build
```

**Sur Windows/macOS** : mêmes archives, mais lancez `npm install --omit=dev` puis `node deploy/gratuit/demarrer.js`
(le script `installer-linux.sh` est réservé à Linux).

## À savoir

- **Aucun `node_modules`** dans les zips : `npm ci --omit=dev` le reconstruit en ~1 seconde.
- **`TERMINISH_SEED=prod`** est indispensable en production ; sinon les comptes de démo
  (`admin1234`, `demo1234`) restent accessibles publiquement.
- **Sauvegarde** : `npm run backup` → fichier daté dans `data/sauvegardes/` (à copier hors du serveur).
- Le dépôt Git reste la référence pour les mises à jour :
  `git clone https://github.com/fayfoneond-stack/terminish-maths.git`
