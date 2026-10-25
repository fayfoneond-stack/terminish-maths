# Téléchargements — Terminish École

## 📘 Le guide d'utilisation (à lire, à imprimer, à garder)

### `GUIDE-TERMINISH-ECOLE.pdf` — 161 Ko · 29 pages (25/10/2026)

sha256 : `dabe7c443d6ea79bdd57d30c82456c407634559363747d939187dfc8f36d9e5f`

Le mode d'emploi complet, en français simple, pour maîtriser le site :

- **les 8 étapes d'une année scolaire**, et qui fait quoi (chef, enseignant, élève) ;
- se connecter, gérer les comptes, réinitialiser un mot de passe ;
- les **réglages de départ** : identité, en-tête officiel, périodes, formule de
  moyenne (avec un exemple chiffré), noms de matières par cycle (PCT / lycée) ;
- classes, matières, **coefficients** (calcul détaillé), rang et mentions ;
- élèves : inscription et **import de toute une liste** depuis Excel ;
- **saisie des notes** au clavier, absences, saisie à distance depuis un téléphone ;
- **bulletins** : calcul, appréciations, publication, impression, et ce qui figure
  sur le document (dont la colonne « Signature / du professeur ») ;
- examens blancs, statistiques ;
- **sauvegardes, stockage et capacité** : combien de bulletins tiennent (mesures réelles) ;
- **hébergement, abonnement, coûts** : tarifs alwaysdata par an, quand payer ;
- téléphone, tablette, Chromebook ;
- **dépannage** : 20 situations réelles avec cause et solution ;
- mémo des 10 gestes, calendrier type, glossaire, raccourcis, **fiche à imprimer
  de fin de trimestre**.

**⬇️ Télécharger d'un clic :**

`https://github.com/fayfoneond-stack/terminish-maths/raw/arena/c4eb5c08-terminish-maths/documents/GUIDE-TERMINISH-ECOLE.pdf`

**Si le lien ci-dessus n'ouvre rien** (certains réseaux bloquent le domaine des
fichiers bruts), utilisez la page GitHub du fichier, puis le bouton
**« Download raw file »** (icône ⤓ en haut à droite de l'aperçu) :

`https://github.com/fayfoneond-stack/terminish-maths/blob/arena/c4eb5c08-terminish-maths/documents/GUIDE-TERMINISH-ECOLE.pdf`

**Vérifier le fichier reçu** : 164 325 octets, sha256
`dabe7c443d6ea79bdd57d30c82456c407634559363747d939187dfc8f36d9e5f`.
Sur le Chromebook : Fichiers → clic droit sur le PDF → « Informations »
(taille en octets), ou `sha256sum GUIDE-TERMINISH-ECOLE.pdf` dans le terminal.

*Le guide se régénère avec* `python3 ecole/guide/generer-guide.py documents/GUIDE-TERMINISH-ECOLE.pdf`
*(nécessite `pip install reportlab` et les polices DejaVu).*

---

## ⬇️ Le fichier à prendre pour déployer

### `terminish-ecole-deploiement.zip` — 266 Ko (25/10/2026)

sha256 : `b47713e3ef139dac32f374f144caefbf0926b26b0aea437d548d1995e38d3999`

Tout ce qu'il faut pour installer et mettre le site en ligne, et **rien de plus** :

```
terminish-ecole/
├── INSTALLATION.txt      ← à lire en premier (démarrage, Docker, Render, variables)
├── FIREBASE.md / STOCKAGE-EXTERNE.md   publication et stockage (MEGA, Cloudinary, Drive)
├── HEBERGEMENT.md        héberger gratuitement sur alwaysdata (sans carte bancaire)
├── server/               14 fichiers .js : base, API, bulletins, paiements, reçus, stats,
│                         stockage (storage.js, stockage.js), sauvegardes
├── public/               site vitrine + application (HTML, CSS, JS)
├── deploy/               Caddy, Nginx, systemd, lanceur, installateur Linux,
│                         lien-stable.sh (adresse fixe Tailscale) + paquet.sh
│                         alwaysdata/installer.sh, rclone.sh, cloudinary.sh
├── package.json / package-lock.json    dépendances (versions figées)
├── Dockerfile / docker-compose.yml     mise en ligne Docker + HTTPS automatique
├── render.yaml                         déploiement Render (disque persistant)
├── .env.example / .nvmrc               configuration
└── README.md, LIEN-ETERNEL.md, DEPLOIEMENT.md, DEPLOIEMENT-GRATUIT.md, FIREBASE.md
```

54 fichiers · aucun `node_modules` · aucune donnée · testé (extraction vierge,
`npm ci`, démarrage, `/api/health` OK, `npm run stockage` OK).

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
