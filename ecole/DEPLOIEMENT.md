# Déployer Terminish École

Ce guide part de zéro : un serveur loué (ou un PC allumé au bureau), un nom de domaine,
et l'application accessible en HTTPS à vos écoles.

> Tout est déjà prévu dans le dépôt : `Dockerfile`, `docker-compose.yml`, `deploy/Caddyfile`,
> `deploy/nginx.conf`, `deploy/terminish-ecole.service`, `render.yaml`, `.env.example`.
> Il n'y a aucune dépendance payante côté logiciel.

---

## 1. Ce que l'application demande

| Élément | Valeur |
|---|---|
| Runtime | **Node.js 22 ou plus** (le serveur utilise le module natif `node:sqlite`) |
| Mémoire | 256 Mo suffisent (512 Mo confortable) |
| Disque | ~200 Mo de code + la base, qui grossit de quelques Mo par an et par école |
| Base de données | un simple **fichier SQLite** dans `/data` → il faut un disque **persistant** |
| Persistance | un volume disque (Docker, VPS, Render disk, Fly volume…) |
| HTTPS | obligatoire (mots de passe, notes des élèves, paiements) |
| Domaine | recommandé : `ecole.votre-domaine.tg` (sous-domaine suffit) |

Deux conséquences pratiques :

1. **Une base SQLite ne survit pas** sur un hébergeur qui efface le disque à chaque redéploiement
   (offres « gratuites » de Render, Railway, Vercel…). Il faut soit un disque persistant,
   soit un VPS, soit un PC chez vous.
2. L'application écoute sur le port `3000` en HTTP. **C'est le proxy (Caddy/Nginx) qui apporte le HTTPS.**
   Ne l'exposez jamais directement sur Internet sans TLS.

---

## 2. Choisir son hébergement

| Option | Coût indicatif | Difficulté | Persistance | Pour qui |
|---|---|---|---|---|
| **A. VPS + Docker + Caddy** | 4 000–7 000 F/mois (≈ 5–8 €) | ★★☆ | ✅ volume Docker | recommandé : simple, rapide, HTTPS automatique |
| **B. Render (Blueprint)** | ≈ 7 $/mois + disque 1 Go | ★☆☆ | ✅ disque payant | vous ne voulez gérer aucun serveur |
| **C. PC au bureau + Cloudflare Tunnel** | 0 F (juste Internet) | ★★☆ | ✅ disque local | budget zéro, coupures Internet acceptables |
| **D. VPS sans Docker (systemd + Nginx)** | 4 000–7 000 F/mois | ★★★ | ✅ dossier local | vous préférez la méthode « classique » |

Un nom de domaine coûte en plus 8 000–20 000 F/an (`.com`), davantage pour un `.tg`.
Pour tester sans domaine : `http://IP_DU_SERVEUR:3000` fonctionne, mais **sans HTTPS** —
utilisez alors un sous-domaine gratuit type `xxx.sslip.io` qui pointe tout seul vers une IP.

---

## 3. Option A — VPS + Docker + Caddy (recommandé)

### 3.1 Louer le serveur

N'importe quel VPS Ubuntu 24.04 LTS avec 1 vCPU / 1 Go de RAM convient
(Hetzner, Contabo, OVH, Scaleway, DigitalOcean…). Choisissez une région Europe
ou Afrique si disponible : la latence depuis Lomé reste correcte.

### 3.2 Pointer le domaine

Chez votre registrar, créez un enregistrement DNS :

| Type | Nom | Valeur |
|---|---|---|
| A | `ecole` | adresse IPv4 du VPS |

Attendez la propagation (2 à 30 min) : `ping ecole.votre-domaine.tg` doit répondre l'IP du VPS.

### 3.3 Installer Docker

```bash
ssh root@IP_DU_SERVEUR

apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
docker --version            # Docker version 27.x…
```

### 3.4 Récupérer l'application

```bash
mkdir -p /srv && cd /srv
git clone https://github.com/fayfoneond-stack/terminish-maths.git
cd terminish-maths/ecole
```

### 3.5 Configurer

```bash
cp .env.example .env
nano .env
```

Renseignez au minimum :

```ini
DOMAIN=ecole.votre-domaine.tg
EMAIL_CONTACT=vous@votre-domaine.tg     # pour les alertes Let's Encrypt
ADMIN_EMAIL=vous@votre-domaine.tg
ADMIN_PASSWORD=un-mot-de-passe-solide-de-12-caracteres-minimum
TERMINISH_SEED=prod
```

`TERMINISH_SEED=prod` est important : sans lui, l'application installe
l'école de démonstration **et** les comptes de test (`admin1234`, `demo1234`).

Les clés PayDunya / CinetPay peuvent rester vides : le paiement manuel
(Mixx by Yas / Moov Money + validation dans la console) fonctionne sans elles.

### 3.6 Démarrer

```bash
docker compose up -d --build
docker compose logs -f app
```

Attendu dans les journaux :

```
  Compte administrateur créé
  Identifiant : vous@votre-domaine.tg
  Mot de passe : celui fourni dans ADMIN_PASSWORD
Terminish École — serveur démarré sur http://0.0.0.0:3000
```

Puis ouvrez **https://ecole.votre-domaine.tg** : Caddy a demandé le certificat,
le cadenas doit apparaître (comptez 30 s au premier lancement).

### 3.7 Première connexion

1. `/app` → connexion avec `ADMIN_EMAIL` / `ADMIN_PASSWORD` (console éditeur).
2. **Changez le mot de passe** : menu utilisateur → Mon compte.
3. Console → **Paiements** : vérifiez les numéros marchands
   (Mixx `+228 93 15 01 78`, Moov `+228 97 24 30 86`) et les tarifs.
4. Console → **Paiements → Identité sur les reçus** : nom commercial, ville, email, WhatsApp.
5. Créez votre première école : Console → Établissements → Ajouter, ou laissez
   les écoles s'inscrire depuis la page publique (essai 30 jours).

---

## 4. Option B — Render (aucun serveur à gérer)

Le fichier `render.yaml` décrit le service (Docker) et le disque persistant.

1. Poussez le dépôt sur GitHub (déjà fait).
2. Render → **New** → **Blueprint** → sélectionnez le dépôt.
3. Render détecte `render.yaml` (contexte Docker `./ecole`) et demande les valeurs
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. Déployez, puis ajoutez votre domaine dans **Settings → Custom Domain**.

⚠️ Le disque persistant (`disk:`) est facturé. L'offre gratuite **efface la base**
à chaque redéploiement et met le service en veille : inutilisable pour de vraies notes.
Comptez ~7 $/mois (service) + disque 1 Go.

---

## 5. Option C — Un PC au bureau + Cloudflare Tunnel (gratuit)

Idéal quand il n'y a pas de budget d'hébergement ou pas d'IP publique fixe
(beaucoup de connexions togolaises sont derrière un NAT).

1. Sur le PC (Windows, Linux ou Mac), installez Node.js 22 puis :

   ```bash
   git clone https://github.com/fayfoneond-stack/terminish-maths.git
   cd terminish-maths/ecole
   npm ci --omit=dev
   ADMIN_EMAIL=vous@votre-domaine.tg ADMIN_PASSWORD='motdepasse-solide' TERMINISH_SEED=prod npm start
   ```

2. Installez `cloudflared` (gratuit) et créez un tunnel :

   ```bash
   cloudflared tunnel login
   cloudflared tunnel create terminish
   cloudflared tunnel route dns terminish ecole.votre-domaine.tg
   cloudflared tunnel run --url http://localhost:3000 terminish
   ```

   Le domaine (gratuit chez Cloudflare) reçoit le HTTPS, le PC n'ouvre aucun port.

3. Pour que l'application redémarre toute seule : installez `cloudflared` comme service
   et créez une tâche de démarrage qui lance `npm start` (ou utilisez `pm2`).

**Limites** : si le PC s'éteint ou si Internet tombe, le site tombe. D'où la sauvegarde
quotidienne (section 8) et, à terme, un VPS.

---

## 6. Option D — VPS sans Docker (systemd + Nginx)

```bash
# 1. Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx

# 2. Application
mkdir -p /var/www && cd /var/www
git clone https://github.com/fayfoneond-stack/terminish-maths.git
cd terminish-maths/ecole
npm ci --omit=dev

# 3. Dossier de données + droits
mkdir -p /var/lib/terminish-ecole
chown -R www-data:www-data /var/www/terminish-maths /var/lib/terminish-ecole

# 4. Secrets
cat > /etc/terminish-ecole.env <<'EOF'
ADMIN_EMAIL=vous@votre-domaine.tg
ADMIN_PASSWORD=motdepasse-solide
EOF
chmod 600 /etc/terminish-ecole.env

# 5. Service
cp deploy/terminish-ecole.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now terminish-ecole
systemctl status terminish-ecole     # le mot de passe admin s'affiche au 1er démarrage

# 6. Nginx + HTTPS
cp deploy/nginx.conf /etc/nginx/sites-available/terminish
# remplacer ecole.votre-domaine.tg par votre domaine
ln -s /etc/nginx/sites-available/terminish /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ecole.votre-domaine.tg
```

Mise à jour :

```bash
cd /var/www/terminish-maths && git pull
cd ecole && npm ci --omit=dev && systemctl restart terminish-ecole
```

---

## 7. Checklist juste après la mise en ligne

- [ ] `https://votre-domaine/api/health` renvoie `{"ok":true,…}`
- [ ] le cadenas HTTPS est présent, et `http://` redirige vers `https://`
- [ ] connexion console OK, **mot de passe administrateur changé**
- [ ] `TERMINISH_SEED=prod` : aucune école de démonstration, aucun compte `demo1234`
- [ ] numéros marchands Mixx / Moov et tarifs vérifiés dans Console → Paiements
- [ ] identité des reçus (nom, ville, téléphone, email, WhatsApp) vérifiée
- [ ] une école de test créée, un élève ajouté, une note saisie, un bulletin imprimé
- [ ] un paiement de test déclaré puis validé → reçu PDF téléchargeable
- [ ] sauvegarde quotidienne en place (section 8) **et restauration testée**
- [ ] accès SSH par clé, mot de passe root désactivé, pare-feu `ufw allow 22,80,443`

---

## 8. Sauvegardes

La base est un fichier : `…/data/terminish-ecole.db`. La commande intégrée en produit
une copie cohérente **même si l'application tourne** :

```bash
cd /srv/terminish-maths/ecole
docker compose exec app npm run backup
# ou, sans Docker :
TERMINISH_DATA_DIR=/var/lib/terminish-ecole npm run backup
```

Les copies atterrissent dans `<données>/sauvegardes/` et les 14 dernières sont conservées.

Tâche quotidienne à 2 h :

```bash
crontab -e
0 2 * * * cd /srv/terminish-maths/ecole && docker compose exec -T app npm run backup >> /var/log/terminish-backup.log 2>&1
```

**Sortez les sauvegardes du serveur** (un disque perdu = tout perdu) :
`rsync` vers un autre poste, Google Drive, ou un bucket S3/Backblaze.
Une sauvegarde par semaine suffit pour commencer ; une par jour dès 3 écoles.

Restauration :

```bash
docker compose stop app
cp /chemin/terminish-ecole-2026-10-21-02-00-00.db ./data/terminish-ecole.db
rm -f ./data/terminish-ecole.db-wal ./data/terminish-ecole.db-shm
docker compose start app
```

---

## 9. Mises à jour

```bash
cd /srv/terminish-maths
git pull
cd ecole
docker compose exec app npm run backup     # sauvegarde avant tout
docker compose up -d --build
docker compose logs -f app
```

Les évolutions de schéma sont appliquées automatiquement au démarrage
(`ensureColumn`, `CREATE TABLE IF NOT EXISTS`) : pas de migration manuelle.

---

## 10. Surveiller

| Quoi | Où |
|---|---|
| Santé du service | `GET /api/health` (utilisez-le dans UptimeRobot, gratuit) |
| Journaux | `docker compose logs -f app` ou `journalctl -u terminish-ecole -f` |
| Expiration du certificat | automatique avec Caddy/Certbot (`certbot renew --dry-run`) |
| Espace disque | `df -h` — les sauvegardes et la base grossissent lentement |

---

## 11. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Error: Cannot find module 'node:sqlite'` | Node < 22 | installez Node 22 (`node -v`) |
| `502 Bad Gateway` | l'app n'écoute pas | `docker compose ps`, `docker compose logs app` |
| Boucle de connexion, session perdue | cookie `Secure` en HTTP | servez l'app en HTTPS, ou retirez `COOKIE_SECURE=1` en test local |
| `SQLITE_CANTOPEN` / données perdues au redéploiement | pas de disque persistant | montez un volume sur `/data` |
| `EADDRINUSE` | port 3000 déjà pris | changez `PORT` ou arrêtez l'autre processus |
| Caddy : `no such host` | DNS pas encore propagé | attendez, vérifiez l'enregistrement A |
| Les données de démo réapparaissent | `TERMINISH_SEED=demo` | passez à `prod` (les données existantes ne sont pas effacées) |
| Mot de passe admin perdu | — | `docker compose exec app node -e "…"` ou supprimez le compte en base ; le plus simple : `ADMIN_PASSWORD=… TERMINISH_SEED=prod` sur une base **vide** |

---

## 12. Combien ça coûte, concrètement

| Poste | Montant |
|---|---|
| Logiciel (ce dépôt) | 0 F — aucune licence, aucun frais par école |
| VPS 1 vCPU / 1 Go | 4 000–7 000 F/mois |
| Nom de domaine | 8 000–20 000 F/an (sous-domaine : gratuit) |
| HTTPS (Let's Encrypt) | 0 F |
| Sauvegarde hors site | 0 F (rsync/Drive) à ~1 500 F/mois (stockage objet) |
| Compte marchand PayDunya/CinetPay | 0 F d'abonnement, commissions par transaction (~2–3 %) |

Un seul VPS héberge sans problème plusieurs dizaines d'écoles :
la base est un fichier, et chaque école est isolée logiquement (filtrage par `ecole_id`).

---

## 13. Sécurité — les 6 réflexes

1. `TERMINISH_SEED=prod` et mot de passe administrateur long, changé après la première connexion.
2. HTTPS partout, `COOKIE_SECURE=1`.
3. Pare-feu : seuls 22, 80 et 443 ouverts ; base SQLite jamais exposée.
4. Sauvegardes quotidiennes **hors du serveur**, restauration testée une fois.
5. Clés PayDunya/CinetPay uniquement dans `.env` (jamais dans Git) — `.env` est ignoré.
6. Un compte par personne (directeur, enseignants, élèves) : ne partagez pas les identifiants.
