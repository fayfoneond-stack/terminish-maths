# Stockage externe : Cloudinary, Google Drive, MEGA (et plusieurs comptes)

> Ce que ça couvre : **signatures des professeurs**, **logos d'établissement**, pièces jointes.
> Les notes et les bulletins vivent dans la base — pas dans le stockage externe.

---

## 1. Ce qui est stocké où

| Objet | Taille | Où | Pourquoi |
|---|---|---|---|
| Signature d'un professeur | 10–40 Ko (réduite à 600 px) | stockage externe | apparaît sur chaque bulletin |
| Logo d'un établissement | 10–80 Ko | stockage externe | en-tête des bulletins |
| Base SQLite (élèves, notes, bulletins) | ~5–20 Mo pour 1 000 élèves | sur le serveur, **jamais** sur un Drive | transactions, vitesse |

Une signature est réduite automatiquement dans le navigateur avant envoi (600 px, PNG/JPEG).
Ordre de grandeur : **10 000 professeurs ≈ 300 Mo** — quelques pour cent du gratuit Cloudinary.

---

## 2. Le principe : un fournisseur, puis un autre, puis le disque

L'application n'appelle jamais un fournisseur directement. Elle appelle `enregistrer()` :

```
1. Cloudinary (si configuré)   → renvoie une URL https://res.cloudinary.com/...
2. Google Drive (si configuré) → renvoie une URL drive.google.com/thumbnail...
3. MEGA via rclone (si configuré)
4. Disque local (toujours)     → /media/signatures/<uuid>.png
```

Si tous échouent, le fichier reste **sur le disque** : l'application ne s'arrête jamais à cause
d'un stockage externe. Le fournisseur retenu est mémorisé dans `utilisateurs.signature_provider`.

Contrôler ce qui est actif, depuis la console (compte direction) :

```
GET /api/stockage/etat
```

```json
{ "ordre": ["cloudinary","local"],
  "cloudinary": { "configure": true, "comptes": ["mon-ecole-1","mon-ecole-2"] },
  "drive": { "configure": false },
  "mega": { "configure": false } }
```

---

## 3. Cloudinary — recommandé pour les images

**Gratuit sans carte** : 25 crédits/mois (≈ 25 Go de trafic, transformations illimitées pour cette
application). Inscription : <https://cloudinary.com/users/register/free> (Google suffit).

### 3.1 Un seul compte

```bash
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

### 3.2 Plusieurs comptes (rotation automatique)

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

## 4. Google Drive — pour les archives et les pièces jointes

Drive n'est pas un CDN : chaque image affichée passe par une redirection Google. C'est parfait pour
des archives, acceptable pour des signatures (petit volume).

1. Console Google Cloud → **API Drive activée**.
2. **Compte de service** → clé JSON → téléchargez-la sur le serveur.
3. Dans Drive, partagez le dossier cible avec l'e-mail du compte de service (rôle *Éditeur*).
   Récupérez l'identifiant du dossier dans l'URL : `https://drive.google.com/drive/folders/`**`1AbC...`**

```bash
GOOGLE_DRIVE_SA_JSON=/home/vous/cle-service.json
GOOGLE_DRIVE_FOLDER_ID=1AbC...
STORAGE_PROVIDERS=cloudinary,drive,local
```

Les fichiers sont créés en lecture publique (sinon les bulletins afficheraient une image cassée).
**Un compte Google gratuit = 15 Go** ; plusieurs comptes = plusieurs dossiers, mais la rotation
multi-comptes n'est implémentée que pour Cloudinary (Drive accepte un compte de service à la fois).

---

## 5. MEGA — par rclone

MEGA n'a pas d'API HTTP simple utilisable depuis Node. On passe par **rclone**, qui gère le
chiffrement et les sessions.

```bash
curl https://rclone.org/install.sh | sudo bash
rclone config          # n) nouveau remote → nom : mega → type : mega → e-mail + mot de passe
rclone lsd mega:Terminish          # vérifier l'accès
```

```bash
MEGA_RCLONE_REMOTE=mega:Terminish
RCLONE_BIN=rclone
STORAGE_PROVIDERS=cloudinary,mega,local
```

Chaque envoi fait `rclone copy` puis `rclone link` (lien public). C'est plus lent (1–3 s) : à
réserver aux archives, pas à l'affichage d'un bulletin.

> **MEGA gratuit = 20 Go**, sans carte. Utile comme **seconde copie** des sauvegardes :
> `npm run backup` puis `rclone copy data/sauvegardes mega:Terminish/sauvegardes`.

---

## 6. Ce que ça change pour « 1 000 établissements × 1 000 élèves »

Il faut séparer deux choses :

| Ce qui grossit | Où | Volume pour 1 000 écoles × 1 000 élèves |
|---|---|---|
| Élèves, notes, bulletins | base SQLite | 1 000 000 d'élèves ≈ **8 à 15 Go** de base |
| Signatures de professeurs | stockage externe | ~10 000 signatures ≈ **300 Mo** |
| Logos | stockage externe | 1 000 logos ≈ **50 Mo** |

- **Les images ne sont pas le problème** : quelques centaines de Mo, couverts par le gratuit.
- **La base non plus, en taille** — mais elle doit rester sur **un seul serveur**, avec
  `npm run backup` quotidien et une copie hors du serveur (Drive ou MEGA).
- Ce qui limite vraiment à cette échelle, c'est le **nombre d'écritures simultanées** et la
  **sauvegarde** : à partir de quelques centaines d'écoles actives en même temps, il faut passer à
  PostgreSQL (voir `FIREBASE.md` §3) et à un serveur dédié — pas à cause du stockage de fichiers.

**Conseil pratique** : restez sur `local` + Cloudinary pour démarrer. Ajoutez Drive/MEGA pour les
**sauvegardes**, pas pour les signatures. On branche un second compte Cloudinary quand le premier
dépasse 70 % de son quota.

---

## 7. Vérifier en 3 commandes

```bash
# 1. quels fournisseurs sont prêts ?
curl -s https://VOTRE-ADRESSE/api/stockage/etat -H "Cookie: …"

# 2. importer une signature (console → Enseignants → ✏️ → glisser une photo)
#    puis vérifier dans la base :
sqlite3 data/terminish-ecole.db \
  "SELECT nom, signature, signature_provider FROM utilisateurs WHERE signature IS NOT NULL;"

# 3. ouvrir un bulletin : la signature doit s'afficher au-dessus du nom
```
