# Stockage externe : MEGA, Cloudinary, Google Drive (et plusieurs comptes)

> Ce que ça couvre : **signatures des professeurs**, **logos d'établissement**, pièces jointes.
> Les notes et les bulletins vivent dans la base SQLite — **jamais** dans le stockage externe.

---

## 1. Ce qui est stocké où

| Objet | Taille | Où | Pourquoi |
|---|---|---|---|
| Signature d'un professeur | 10–40 Ko (réduite à 600 px) | stockage externe | apparaît sur chaque bulletin |
| Logo d'un établissement | 10–80 Ko | stockage externe | en-tête des bulletins |
| Pièces jointes | ≤ 4 Mo | stockage externe | documents |
| Base SQLite (élèves, notes, bulletins) | ~5–20 Mo pour 1 000 élèves | sur le serveur, **jamais** sur un Drive | transactions, vitesse |

Une signature est réduite automatiquement dans le navigateur avant envoi (600 px, PNG/JPEG).
Ordre de grandeur : **10 000 signatures ≈ 300 Mo** — quelques pour cent d'un espace gratuit.

Autrement dit : même si MEGA, Cloudinary ou Drive tombe, **le site continue de fonctionner** et les
bulletins restent imprimables (le logo et la signature restent en base).

---

## 2. Le principe : un fournisseur, puis un autre, puis le disque

L'application n'appelle jamais un fournisseur directement. Elle appelle `enregistrer()` :

```
1. Premier fournisseur de STORAGE_PROVIDERS (mega, cloudinary, drive…)
2. Le suivant…
3. Disque local (TOUJOURS en dernier) → /media/signatures/<uuid>.png
```

- `enregistrer()` **ne lève jamais d'erreur** : en cas de panne externe, le fichier est écrit sur le
  disque et le site continue.
- Le fournisseur retenu est mémorisé dans `utilisateurs.signature_provider`.
- `local` est ajouté automatiquement en fin de liste, même si on l'oublie.

Vérifier ce qui est actif :

```bash
npm run stockage        # ou : GET /api/stockage/etat
```

```json
{ "ordre": ["mega","local"],
  "local": { "dossier": "/home/compte/app/data/media", "url": "/media" },
  "cloudinary": { "configure": false, "comptes": [] },
  "drive": { "configure": false },
  "mega": { "configure": true, "dossier": "mega:Terminish",
            "rclone": { "present": true, "chemin": "/home/compte/bin/rclone", "version": "v1.68.1" } } }
```

Depuis l'application : **Réglages → Stockage externe** affiche chaque fournisseur (Actif / Non
configuré) et un bouton **Tester** qui envoie réellement un fichier (`POST /api/stockage/tester`).

---

## 3. MEGA — le stockage principal (compte existant)

### 3.1 Pourquoi rclone, et pas une « API MEGA pour Node »

MEGA ne publie pas de bibliothèque Node.js maintenue : les paquets existants cassent à chaque
changement de protocole et exigent souvent Node 20+. **rclone** est un binaire unique (~20 Mo),
sans droits administrateur, qui gère le chiffrement et les sessions, et parle aussi à Google Drive,
Dropbox, S3… C'est la méthode fiable — celle des serveurs en production.

Chaque envoi fait `rclone copy` puis `rclone link` (lien public). C'est plus lent qu'un CDN
(1–3 s) : parfait pour les signatures et les logos, pas pour servir un site entier.

> **Espace** : l'offre gratuite MEGA donne 20 Go (jusqu'à 25 Go sur certains comptes ou avec les
> bonus d'inscription). Vérifiez le vôtre avec `--verifier` : le script affiche l'espace réel.

### 3.2 Les commandes, une par une

Depuis le dossier de l'application, sur le serveur :

**1.** Installer rclone dans `~/bin` (aucun droit administrateur) :

```bash
bash deploy/alwaysdata/rclone.sh --installer
```

Résultat attendu : `✔ rclone installé : /home/COMPTE/bin/rclone (rclone v1.xx.x)`
et la ligne `RCLONE_BIN=/home/COMPTE/bin/rclone`.

**2.** Enregistrer le compte MEGA (email + mot de passe du compte existant) :

```bash
bash deploy/alwaysdata/rclone.sh --configurer
```

Le script demande l'email puis le mot de passe (saisie invisible), crée le compte distant `mega`,
le dossier `Terminish`, et écrit dans `.env` :

```ini
RCLONE_BIN=/home/COMPTE/bin/rclone
MEGA_RCLONE_REMOTE=mega:Terminish
STORAGE_PROVIDERS=mega,local
```

En une seule ligne, sans question :

```bash
bash deploy/alwaysdata/rclone.sh --configurer --email vous@exemple.tg --motdepasse '…'
```

> ⚠ **Double authentification MEGA activée ?** Le code se saisit dans l'assistant interactif :
> ```bash
> ~/bin/rclone config
> ```
> → `n` (nouveau compte) → nom `mega` → type `mega` → email → mot de passe → coller le code.
> Puis relancer `--configurer` (le compte existe déjà, il ne touche plus au mot de passe).

**3.** Vérifier :

```bash
bash deploy/alwaysdata/rclone.sh --verifier
```

```
✔ rclone : /home/COMPTE/bin/rclone (rclone v1.xx.x)
✔ compte distant mega : présent
✔ espace MEGA : 0.02 Go utilisés / 25.00 Go (libre 24.98 Go)
✔ dossier mega:Terminish accessible
```

**4.** Redémarrer le site : interface alwaysdata → **Sites** → *Redémarrer*
(ou `systemctl restart terminish-ecole` sur un VPS).

**5.** **Réglages → Stockage externe → MEGA → Tester** : un carré d'un pixel est réellement envoyé,
l'URL s'affiche, un fichier de test apparaît dans `Terminish/test/`.

### 3.3 En ligne de commande

```bash
npm run stockage                    # état des 4 fournisseurs
npm run stockage -- --test mega     # envoi réel sur MEGA
npm run stockage -- --rclone        # diagnostic rclone (chemin, version, remotes)
```

### 3.4 MEGA comme copie des sauvegardes (recommandé)

```bash
npm run backup
rclone copy data/sauvegardes mega:Terminish/sauvegardes
```

À mettre dans une tâche planifiée alwaysdata (*Tâches planifiées*) une fois par semaine.
**Une sauvegarde sur MEGA ne remplace pas la sauvegarde de la base** : c'est une copie hors site.

---

## 4. Cloudinary — recommandé pour les images

**Gratuit sans carte** : 25 crédits/mois (≈ 25 Go de trafic, transformations illimitées pour cette
application). Inscription : <https://cloudinary.com/users/register/free> (Google suffit).

### 4.1 Un seul compte

Le plus simple, sur le serveur (l'assistant demande les trois valeurs) :

```bash
bash deploy/alwaysdata/cloudinary.sh --configurer
```

⚠️ **Quelle clé ?** Prenez la clé de la ligne **« Root »** (badge *Root*) dans
Settings → API Keys. Une clé créée avec « Generate New API Key » reçoit le rôle
*Media Library User* sans accès à aucun dossier : le ping réussit, mais tout
envoi échoue avec `Request forbidden due to missing permissions (actions=["create"])`.
La clé Root a tous les droits — c'est celle qu'il faut pour un établissement.

Il écrit dans `.env`, en **conservant** MEGA (l'ordre devient `mega,cloudinary,local`
si MEGA est configuré), puis :

```bash
bash deploy/alwaysdata/cloudinary.sh --verifier   # appelle réellement Cloudinary
bash deploy/alwaysdata/cloudinary.sh --tester     # envoie une image de 1 pixel
```

À la main, si vous préférez :

```ini
CLOUDINARY_CLOUD_NAME=mon-ecole
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnop
STORAGE_PROVIDERS=cloudinary,local
```

ou en une seule ligne :

```bash
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

Retirer Cloudinary sans rien casser (les images déjà envoyées restent accessibles) :

```bash
bash deploy/alwaysdata/cloudinary.sh --supprimer
```

### 4.2 Plusieurs comptes (rotation automatique)

Quand le premier compte approche de son quota, ajoutez-en un autre — **sans rien changer dans
l'application** :

```bash
CLOUDINARY_ACCOUNTS=cloud1|key1|secret1;cloud2|key2|secret2;cloud3|key3|secret3
STORAGE_PROVIDERS=cloudinary,local
```

Le compte est choisi par **empreinte de l'identifiant de l'établissement** : une école reste
toujours sur le même compte (ses liens ne se cassent pas), et les écoles se répartissent entre les
comptes. Avec 4 comptes gratuits, vous couvrez confortablement des milliers d'établissements.

> ⚠️ La rotation se fait **à l'écriture**. Un fichier déjà écrit ne change pas de compte : c'est
> voulu, sinon les bulletins déjà imprimés pointeraient vers une image disparue.

---

## 5. Google Drive — archives et pièces jointes

Drive n'est pas un CDN : chaque image affichée passe par une redirection Google. Parfait pour des
archives, acceptable pour des signatures (petit volume).

1. Console Google Cloud → **API Drive activée**.
2. **Compte de service** → clé JSON → déposer le fichier sur le serveur (mode 600).
3. Dans Drive, partager le dossier cible avec l'email du compte de service (rôle *Éditeur*).
   Identifiant du dossier dans l'URL : `https://drive.google.com/drive/folders/`**`1AbC...`**

```ini
GOOGLE_DRIVE_SA_JSON=/home/COMPTE/app/compte-de-service.json
GOOGLE_DRIVE_FOLDER_ID=1AbC...
STORAGE_PROVIDERS=cloudinary,drive,local
```

Les fichiers sont créés en lecture publique (sinon les bulletins afficheraient une image cassée).
**Un compte Google gratuit = 15 Go** ; la rotation multi-comptes n'existe que pour Cloudinary
(Drive accepte un compte de service à la fois).

---

## 6. L'ordre d'essai (`STORAGE_PROVIDERS`)

```ini
STORAGE_PROVIDERS=mega,local               # MEGA puis disque
STORAGE_PROVIDERS=mega,cloudinary,local    # MEGA, sinon Cloudinary, sinon disque
STORAGE_PROVIDERS=cloudinary,local         # défaut si la variable est absente
```

- Le premier fournisseur qui répond gagne.
- **`local` est toujours ajouté en dernier**, même si on l'oublie.
- Toute modification impose un **redémarrage** du site.
- Relancer `deploy/alwaysdata/installer.sh` **ne perd plus** ces réglages : seul son propre bloc
  est réécrit, le reste de `.env` est conservé.

---

## 7. Si un service externe tombe

Rien à faire : `enregistrer()` ne lève jamais d'erreur.

1. MEGA ne répond pas → essai suivant (Cloudinary/Drive) → puis disque local.
2. Le fichier est **toujours** écrit sur le disque local ; la copie externe est un supplément.
3. Les notes et les bulletins ne dépendent d'aucun service externe.
4. L'échec est visible : **Réglages → Stockage externe**, ou `npm run stockage`.

Seul désagrément : une image enregistrée pendant une panne reste servie depuis `data/media` au lieu
de MEGA. Aucune perte.

---

## 8. Sécurité et sauvegardes

- `.env` est créé en mode **600** et n'est jamais publié sur le web.
- Le mot de passe MEGA est **chiffré par rclone** dans `~/.config/rclone/rclone.conf` (mode 600).
- Ne mettez **jamais** `.env` ni `rclone.conf` dans une sauvegarde publique ou un dépôt Git.
- Une clé de compte de service Google donne accès au Drive : traitez-la comme un mot de passe.
- Sur alwaysdata, les sauvegardes de l'hébergeur couvrent 3 jours ; faites en plus une copie
  mensuelle chez vous (`npm run backup` puis téléchargement).

---

## 9. Ce que ça change pour « 1 000 établissements × 1 000 élèves »

| Ce qui grossit | Où | Volume pour 1 000 écoles × 1 000 élèves |
|---|---|---|
| Élèves, notes, bulletins | base SQLite | 1 000 000 d'élèves ≈ **8 à 15 Go** de base |
| Signatures de professeurs | stockage externe | ~10 000 signatures ≈ **300 Mo** |
| Logos | stockage externe | 1 000 logos ≈ **50 Mo** |

- **Les images ne sont pas le problème** : quelques centaines de Mo, couverts par le gratuit.
- La base non plus, en taille — mais elle doit rester sur **un seul serveur**, avec un
  `npm run backup` quotidien et une copie hors du serveur (MEGA).
- Ce qui limite vraiment à cette échelle, c'est le **nombre d'écritures simultanées** et la
  **sauvegarde** : à partir de quelques centaines d'écoles actives en même temps, il faut passer à
  PostgreSQL (voir `FIREBASE.md` §3) et à un serveur dédié — pas à cause des fichiers.

**Conseil pratique** : `mega,local` ou `cloudinary,local` pour démarrer. Ajoutez un second compte
Cloudinary quand le premier dépasse 70 % de son quota. MEGA sert aussi de copie de sauvegarde hors
site.

---

## 10. Vérifier en 3 commandes

```bash
# 1. quels fournisseurs sont prêts ?
npm run stockage

# 2. envoi réel d'un fichier de test
npm run stockage -- --test mega

# 3. côté base : signatures et fournisseur retenu
sqlite3 data/terminish-ecole.db \
  "SELECT nom, signature_provider FROM utilisateurs WHERE signature IS NOT NULL;"
```

Puis ouvrir un bulletin : la signature doit s'afficher au-dessus du nom du professeur.

---

## 11. Questions fréquentes

**Le disque de 1 Go d'alwaysdata suffit-il ?**
Oui pour une école entière (la base pèse moins de 1 Mo par an). Ce sont les images qui grossissent :
MEGA prend le relais dès qu'il est configuré, le disque ne garde qu'une copie de secours.

**Puis-je changer de fournisseur plus tard ?**
Oui : modifiez `STORAGE_PROVIDERS`, redémarrez. Les fichiers déjà écrits restent accessibles (l'URL
est enregistrée avec chaque image).

**Pourquoi pas Dropbox / OneDrive ?**
rclone les gère aussi ; ajoutez le compte distant (`rclone config`) et demandez-nous l'ajout du
fournisseur correspondant.

**Est-ce que cela ralentit la saisie des notes ?**
Non : les notes ne passent jamais par le stockage externe.

**Multi-établissements ?**
Chaque école a son sous-dossier (`mega:Terminish/ecole-<id>/…`), et Cloudinary peut répartir sur
plusieurs comptes. Une seule installation sert plusieurs écoles sans mélange des fichiers.
