# Déployer sans un franc

Objectif : un site **en ligne, en HTTPS**, que vous pouvez montrer à une école dès aujourd'hui,
**sans payer ni hébergement, ni domaine, ni service**.

C'est possible, et voici comment. Le principe :

> Le site tourne sur **votre ordinateur**. Cloudflare (gratuit, sans compte) lui donne une adresse
> `https://…trycloudflare.com` accessible depuis n'importe quel téléphone ou ordinateur au Togo.
> Aucun port à ouvrir sur votre box, aucune IP publique à louer.

Durée : **10 minutes** la première fois, puis **une commande** à chaque démonstration.

---

## 0. Démarrage rapide sur Linux (vous êtes ici)

Un seul script fait tout : vérifie Node.js 22, installe les dépendances, installe `cloudflared`
dans `~/.local/bin` (**sans sudo**), puis démarre le site et affiche votre lien HTTPS.

```bash
git clone https://github.com/fayfoneond-stack/terminish-maths.git
cd terminish-maths/ecole
bash deploy/gratuit/installer-linux.sh            # site propre + lien public
# ou
bash deploy/gratuit/installer-linux.sh --demo     # avec l'école de démonstration
```

Options utiles :

| Commande | Effet |
|---|---|
| `bash deploy/gratuit/installer-linux.sh --verifier` | contrôle tout **sans rien installer** ni démarrer |
| `... --local` | pas de lien public (site sur votre réseau Wi-Fi seulement) |
| `... --port 3001` | si le port 3000 est déjà pris |
| `npm run installer` | raccourci du script |

Sortie attendue :

```
✔ Node.js v22.x
✔ Dépendances en place
✔ cloudflared installé (sans sudo)

┌────────────────────────────────────────────────────────────────┐
│ VOTRE SITE EST EN LIGNE                                        │
└────────────────────────────────────────────────────────────────┘
  🌍 Lien public  : https://joli-nuage-rapide-42.trycloudflare.com

  Comptes de démonstration :
    admin@terminish.tg       admin1234    console éditeur
    directeur@demo.tg        demo1234     chef d'établissement
    prof.maths@demo.tg       prof1234     enseignant
    eleve@demo.tg            eleve1234    élève / parent
```

**Important** : en mode `--demo`, les identifiants sont ceux du jeu de démonstration
(`admin1234`, `demo1234`…). Le mot de passe généré ne sert qu'au mode normal (`npm run partage`),
sur une base neuve.

Les sections 2 et 3 détaillent chaque étape si le script rencontre un problème.

---

### Cas particulier : Chromebook (ChromeOS)

Le dossier **« Fichiers Linux »** du gestionnaire de fichiers correspond au dossier personnel du
conteneur Linux (`~`). Un dossier visible comme `Mes fichiers > Fichiers Linux > TERMINISH ECOLE`
se retrouve donc dans le Terminal sous `~/"TERMINISH ECOLE"` (guillemets obligatoires : le nom
contient une espace).

```bash
cd ~/"TERMINISH ECOLE"
ls                       # doit afficher : server  public  deploy  package.json  README.md
bash deploy/gratuit/installer-linux.sh --demo
```

Si `ls` n'affiche pas ces dossiers, on est un niveau trop haut ou trop bas : utilisez `pwd` et `ls`
pour vous repérer, ou `find ~ -name installer-linux.sh` pour localiser l'application.

Rappel ChromeOS : le conteneur Linux s'arrête quand le Chromebook s'éteint ou se met en veille.
Excellent pour démontrer, insuffisant pour un site permanent → voir la section 4 (VM Oracle gratuite).

---

## 1. Ce qu'il vous faut (et ce que ça coûte)

| Élément | Coût |
|---|---|
| Un ordinateur (Windows, Mac ou Linux) | celui que vous avez déjà |
| Une connexion Internet | celle que vous avez déjà (une clé 4G suffit) |
| Node.js 22 | **0 F** — logiciel libre |
| Cloudflare Tunnel (`cloudflared`) | **0 F**, aucune carte bancaire, aucun compte |
| Hébergement, domaine, certificat HTTPS | **0 F** |
| **Total** | **0 F** |

C'est exactement comme si vous ouvriez votre site depuis votre salon, mais avec une adresse publique
et un cadenas de sécurité.

---

## 2. Voie 1 — Votre ordinateur, lien public (recommandé pour démarrer)

### Étape 1 — Installer Node.js

Téléchargez la version **LTS** sur <https://nodejs.org> et installez-la (Suivant → Suivant).
Vérifiez ensuite dans un terminal :

```bash
node -v      # doit afficher v22.x ou plus
```

- Windows : touche Windows → tapez `powershell` → Entrée.
- macOS : Spotlight → `Terminal`.
- Linux : votre terminal habituel.

### Étape 2 — Récupérer le site

```bash
git clone https://github.com/fayfoneond-stack/terminish-maths.git
cd terminish-maths/ecole
bash deploy/gratuit/installer-linux.sh --verifier   # contrôle sans rien installer
npm install --omit=dev
```

(Pas de `git` ? Téléchargez l'archive ZIP du dépôt sur GitHub → bouton vert **Code** → *Download ZIP*,
décompressez, puis ouvrez le dossier `terminish-maths/ecole` dans le terminal.)

### Étape 3 — Installer le tunnel

| Système | Commande |
|---|---|
| **Windows** | `winget install --id Cloudflare.cloudflared` |
| **macOS** | `brew install cloudflared` |
| **Linux (Debian/Ubuntu)** | voir ci-dessous |

```bash
# Linux — paquet officiel Cloudflare
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
```

Alternative sans installation : téléchargez le binaire sur
<https://github.com/cloudflare/cloudflared/releases> et placez-le dans un dossier du `PATH`
(sous Windows, le fichier `cloudflared.exe` peut simplement être posé dans `C:\Windows\`).

Vérification : `cloudflared --version`.

### Étape 4 — Démarrer et récupérer votre lien

```bash
npm run partage
```

Au bout de 3 secondes :

```
┌────────────────────────────────────────────────────────────────┐
│ VOTRE SITE EST EN LIGNE                                        │
└────────────────────────────────────────────────────────────────┘
  🌍 Lien public  : https://joli-nuage-rapide-42.trycloudflare.com
  💻 Sur place    : http://localhost:3000

  Console admin   : admin@terminish.tg
  Mot de passe    : palmier-clair-4821
```

Envoyez le lien à l'école par WhatsApp : le site s'ouvre, **avec le cadenas HTTPS**.
La console administrateur est sur `/app` avec l'identifiant et le mot de passe affichés
(ils sont aussi enregistrés dans `data/compte-administrateur.txt`).

**Laissez la fenêtre ouverte.** Fermer la fenêtre = fermer le site.

### Les trois commandes à retenir

| Commande | Effet |
|---|---|
| `npm run partage` | site + lien public HTTPS (site vide, prêt pour une vraie école) |
| `npm run partage:demo` | idem, avec l'école de démonstration (élèves, notes, bulletins) — pour montrer le produit |
| `npm run local` | site accessible uniquement sur votre ordinateur et votre réseau Wi-Fi |

---

## 2 bis. « Ce site est inaccessible » / ERR_NAME_NOT_RESOLVED

C'est le comportement normal d'un **tunnel rapide** Cloudflare : l'adresse `xxxx.trycloudflare.com`
n'existe que **tant que la commande tourne**. Dès que vous faites `Ctrl+C`, que le Chromebook se met en
veille ou que le conteneur Linux s'arrête, Cloudflare **supprime l'adresse du DNS** ; le lien devient
donc introuvable (`ERR_NAME_NOT_RESOLVED`) et ne reviendra jamais.

Trois réflexes :

```bash
npm run lien        # le site est-il en ligne ? quel est le lien actuel ?
npm run partage     # repartir (un NOUVEAU lien est créé)
```

| Situation | Que faire |
|---|---|
| Vous avez utilisé un lien d'hier | ouvrir le lien affiché par le terminal en cours |
| Le terminal est fermé | `npm run partage` → nouveau lien |
| Le lien s'arrête tout seul | le lanceur **relance automatiquement** le tunnel (5 tentatives) et affiche le nouveau lien |
| Vous voulez une adresse qui ne change jamais | VM Oracle gratuite + `sslip.io` (section 4) |

Le lien en cours est aussi écrit dans `data/lien-public.txt` et effacé à l'arrêt : il n'y a donc jamais
d'ambiguïté entre un lien mort et un lien vivant.

Pour éviter les coupures pendant une démonstration : Paramètres ChromeOS → Appareil → Économiseur
d'énergie → **Jamais** de mise en veille, Chromebook sur secteur.

---

## 3. Comment faire une démonstration convaincante

1. `npm run partage:demo` → vous obtenez un lien et l'école fictive « Complexe Scolaire Les Palmiers ».
2. Connectez-vous sur `/app` avec **`directeur@demo.tg` / `demo1234`** :
   montrez la saisie des notes, les statistiques, un bulletin imprimé avec logo.
3. Avec **`admin@terminish.tg` / `admin1234`**, montrez la console éditeur (écoles, paiements, réglages).
4. Envoyez le lien à la direction **juste avant** l'appel : il reste valable quelques heures,
   tant que votre fenêtre est ouverte.

> ⚠️ Ne laissez jamais tourner `partage:demo` en permanence : les comptes `demo1234` / `admin1234`
> seraient accessibles à Internet. Pour un site « sérieux », utilisez `npm run partage`.

**Astuce démo sans Internet** : `npm run partage:demo`, puis ouvrez le site sur votre écran et
projetez-le en salle avec un vidéoprojecteur, ou utilisez `npm run local` et connectez les téléphones
au même Wi-Fi que votre ordinateur (`http://VOTRE-IP:3000`).

---

## 4. Voie 2 — Une adresse stable, gratuitement (quand vous voulez faire sérieux)

Le lien `trycloudflare.com` change à chaque redémarrage. Pour une adresse fixe sans payer de domaine,
utilisez la **machine virtuelle gratuite à vie d'Oracle Cloud** (offre « Always Free »).

| Point | Détail |
|---|---|
| Ce que vous obtenez | une VM Linux 24 h/24, IP publique fixe, disque persistant |
| Coût | **0 F**, sans limite de durée |
| Ce qu'il faut | un compte Oracle Cloud (une carte est demandée **pour vérifier votre identité**, sans débit) |
| Adresse | `https://ecole.<votre-ip>.sslip.io` — gratuit, HTTPS automatique, ne dépend d'aucun achat de domaine |

Marche à suivre (20 minutes) :

1. Créez un compte sur <https://www.oracle.com/cloud/free/> et choisissez la région la plus proche
   (Europe : Paris, Francfort, Marseille).
2. **Instances → Create instance** → image *Ubuntu 24.04*, forme *VM.Standard.A1.Flex* (ARM, offre gratuite)
   ou *VM.Standard.E2.1.Micro*. Ajoutez votre clé SSH, créez.
3. Notez l'**IP publique** (ex. `141.94.x.x`). Elle ne change pas.
4. Ouvrez les ports 80 et 443 dans la *Security List* du réseau virtuel.
5. Sur la machine :

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
git clone https://github.com/fayfoneond-stack/terminish-maths.git /srv/app
cd /srv/app/ecole
cp .env.example .env
nano .env      # DOMAIN=ecole.141.94.x.x.sslip.io  + ADMIN_EMAIL + ADMIN_PASSWORD
sudo docker compose up -d --build
```

Caddy démarre, obtient un vrai certificat Let's Encrypt pour `ecole.<ip>.sslip.io`, et votre site est
en ligne **en permanence**, même quand votre ordinateur est éteint.

> Le jour où vous achèterez un domaine (`ecole.votre-ecole.tg`), il suffira de changer la ligne `DOMAIN=`
> et de relancer : le certificat se renouvelle tout seul.

**Automatisé** : `sudo bash deploy/vm/installer-vm.sh` fait tout cela depuis la VM (Docker, HTTPS,
adresse `ecole.<ip>.sslip.io`, mot de passe admin, pare-feu, démarrage automatique).
Détails et prérequis Oracle : **[LIEN-ETERNEL.md](LIEN-ETERNEL.md)**.

### Autres options gratuites (si Oracle est refusé)

| Service | Durée | Limite | Adapté ? |
|---|---|---|---|
| **Google Cloud** (300 $ de crédits, 90 jours) | 3 mois | carte requise | oui pour démarrer, puis à payer |
| **GitHub Codespaces** (60 h/mois) | illimité | machine éteinte quand vous fermez l'onglet | démonstrations seulement |
| **Ordinateur d'une école partenaire** | illimitée | dépend de leur électricité/Internet | bon plan si une école pilote vous fait confiance |
| Ancien smartphone Android (Termux) | illimitée | fragile | à éviter |

---

## 4 bis. Linux : redémarrer le site tout seul après une coupure

Sans droits administrateur, avec un service utilisateur systemd :

```bash
mkdir -p ~/.config/systemd/user
cp deploy/gratuit/terminish-partage.service ~/.config/systemd/user/
nano ~/.config/systemd/user/terminish-partage.service   # ajuster WorkingDirectory
systemctl --user daemon-reload
systemctl --user enable --now terminish-partage
loginctl enable-linger "$USER"        # démarre même sans session ouverte
```

Voir le lien public à tout moment :

```bash
journalctl --user -u terminish-partage -f | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com'
```

Arrêt : `systemctl --user stop terminish-partage`.

> Le lien change à chaque redémarrage. Pour une adresse fixe, passez à la section 4
> (VM Oracle Cloud gratuite + `sslip.io`).

---

## 5. Sauvegarder vos données, gratuitement

Votre base est un fichier. Sauvegarde en une commande :

```bash
npm run backup
```

→ crée `data/sauvegardes/terminish-ecole-AAAA-MM-JJ-HH-MM-SS.db` (les 14 dernières sont gardées).

Puis **copiez ce fichier ailleurs** : Google Drive (15 Go gratuits), une clé USB, ou un second ordinateur.
Une sauvegarde qui reste sur la machine qui tombe en panne ne sert à rien.

Automatisation Windows (tous les jours à 20 h) : *Planificateur de tâches* → créer une tâche →
action « Démarrer un programme » → `cmd.exe` → arguments :
`/c cd /d C:\chemin\terminish-maths\ecole && npm run backup`.

Linux/macOS : `crontab -e` puis
`0 20 * * * cd /chemin/terminish-maths/ecole && npm run backup`.

---

## 6. Rester en ligne : les 5 réflexes

1. **Empêcher la mise en veille** : Windows → Paramètres → Système → Alimentation → « Jamais »
   (ou `powercfg /change standby-timeout-ac 0`). Un PC endormi = site hors ligne.
2. **Brancher sur secteur** et, si possible, onduleur.
3. **Internet stable** : préférez la fibre/adsl à une clé 4G, ou gardez la 4G en secours.
4. **Ne pas éteindre la fenêtre** du terminal (`npm run partage`). Fermer = couper le site.
5. **Redémarrer proprement** : `Ctrl+C` dans la fenêtre, puis relancer la commande.

Pour que le site redémarre automatiquement après une coupure de courant :
- Linux/macOS : le service systemd de `deploy/terminish-ecole.service` (adapté avec `TERMINISH_SEED=prod`) ;
- Windows : *Planificateur de tâches* → « Au démarrage de l'ordinateur » → `npm run partage`.

---

## 7. Sécurité : le minimum vital quand le site est public

Même gratuit, un site exposé à Internet doit être protégé :

- [ ] mot de passe administrateur long (celui généré fait très bien l'affaire) et **noté** ;
- [ ] `npm run partage` (et non `:demo`) pour toute adresse que vous laissez ouverte ;
- [ ] une seule école de test au début, avec des données fictives ;
- [ ] sauvegarde quotidienne copiée hors de l'ordinateur ;
- [ ] ne jamais publier la clé de votre routeur, ni votre IP, ni `data/compte-administrateur.txt`.

Les mots de passe sont chiffrés (scrypt), les sessions sont signées et expirables, et chaque école
ne voit que ses propres données. Le HTTPS du tunnel protège les échanges.

---

## 8. Et les paiements, sans compte marchand ?

Rien à payer : l'application fonctionne en **mode manuel**, déjà configuré.

1. L'école paie sur votre **numéro marchand** : Mixx by Yas **+228 93 15 01 78**
   (`*145*5#`) ou Moov Money **+228 97 24 30 86** (`*155#` option 2).
2. Elle déclare le paiement dans son espace (montant, référence SMS).
3. Vous validez dans la console → l'abonnement est prolongé et le **reçu PDF** est généré.

Aucun frais, aucun abonnement marchand. Quand vous aurez plusieurs écoles et un compte PayDunya ou
CinetPay, l'encaissement deviendra automatique (les champs sont déjà prêts dans la console).

---

## 9. Quand vous gagnerez votre première école

Rien ne presse, mais voici l'ordre logique :

| Étape | Coût | Pourquoi |
|---|---|---|
| 1. Un vrai nom de domaine (`terminish.tg` ou `.com`) | 8 000–20 000 F/an | crédibilité, adresse stable, e-mails pro |
| 2. Un VPS à 5 000 F/mois | 5 000 F/mois | le site ne dépend plus de votre ordinateur |
| 3. Compte marchand PayDunya | 0 F d'abonnement | encaissement automatique, reçus sans validation manuelle |
| 4. Sauvegarde hors site (stockage objet) | ~1 500 F/mois | dormir tranquille |

**Jusque-là, tout ce qui précède est gratuit.** Le logiciel, l'application, les bulletins, les reçus,
les sauvegardes : aucun frais caché, aucune limite d'écoles, aucun quota.

---

## 10. Dépannage

| Symptôme | Cause | Solution |
|---|---|---|
| `node : commande introuvable` | Node.js absent ou terminal non rouvert | réinstallez Node 22, fermez puis rouvrez le terminal |
| `Le port 3000 est déjà utilisé` | une autre instance tourne déjà | `--port 3001`, ou `pkill -f deploy/gratuit/demarrer.js` |
| `Permission denied` au lancement du script | bit exécutable absent | `bash deploy/gratuit/installer-linux.sh` (sans `./`) |
| Le lien `trycloudflare` ne s'ouvre pas | tunnel pas encore prêt / réseau | attendez 10 s, rechargez ; vérifiez que la fenêtre affiche bien l'URL |
| `ERR_NAME_NOT_RESOLVED` | lien d'un tunnel arrêté (adresse supprimée) | `npm run lien`, puis `npm run partage` |
| « Aucun lien public » dans la console | `cloudflared` non installé ou bloqué | `cloudflared --version` ; antivirus → autoriser |
| Le lien change tout le temps | comportement normal du tunnel rapide | voir voie 2 (Oracle Cloud) pour une adresse fixe |
| « Cloudflare Tunnel introuvable » alors qu'il est installé | `~/.local/bin` absent du PATH du terminal | relancer avec `bash deploy/gratuit/installer-linux.sh`, ou `export PATH="$HOME/.local/bin:$PATH"`, ou `CLOUDFLARED_BIN="$HOME/.local/bin/cloudflared" npm run partage` |
| Site inaccessible depuis le téléphone | PC en veille / Internet coupé | réveillez le PC, relancez `npm run partage` |
| Mot de passe administrateur oublié | — | il est dans `data/compte-administrateur.txt`, sinon `npm run motdepasse` (nouveau mot de passe, sessions fermées) |
| « Identifiants incorrects » avec le mot de passe affiché | en mode `--demo`, le compte est `admin@terminish.tg` / **`admin1234`** (le mot de passe généré ne s'applique pas) | utilisez `admin1234`, ou `npm run motdepasse` pour imposer votre propre mot de passe |
| Données perdues | mauvais dossier de données | vérifiez `TERMINISH_DATA_DIR` : toujours le même |

---

## 11. Récapitulatif en 6 lignes

```bash
# une fois (Linux — tout est automatique, sans sudo)
git clone https://github.com/fayfoneond-stack/terminish-maths.git
cd terminish-maths/ecole
bash deploy/gratuit/installer-linux.sh --demo

# à chaque démonstration
npm run partage:demo      # site de démo + lien HTTPS
npm run partage           # site propre
npm run lien              # retrouver le lien actuel et l'état du site
```

Vous avez un site HTTPS, un lien à envoyer, une console d'administration, et zéro facture.
