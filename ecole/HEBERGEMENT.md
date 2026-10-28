# Une base d'hébergement pour le site — la solution retenue

> Mise à jour : 23 octobre 2026.
> **En une phrase** : le site tourne aujourd'hui sur le Chromebook, derrière un tunnel. Ce n'est pas
> une base d'hébergement. La seule qui réponde à vos contraintes réelles — **0 F, aucune carte
> bancaire, disque permanent, Node.js, base SQLite intacte** — c'est **alwaysdata, offre Free**
> (hébergeur français, gratuit à vie, sans carte). Le site y tourne 24 h/24, indépendamment de votre
> ordinateur, avec une adresse qui ne change jamais.

---

## 1. Pourquoi votre site n'est pas « hébergé » aujourd'hui

| Ce que vous avez | Ce que ça implique |
|---|---|
| Le serveur tourne sur le Chromebook (`npm run partage`) | Chromebook éteint = site mort |
| Le lien passe par un tunnel (Cloudflare ou Tailscale) | l'adresse dépend d'une machine qui doit rester allumée |
| La base est un fichier `data/terminish-ecole.db` | elle vit sur ce même Chromebook |

Le tunnel a réglé le problème de l'**adresse** (Tailscale : elle ne change plus). Il ne règle pas
celui de l'**hébergement** : il faut une machine allumée en permanence, chez un hébergeur.

---

## 2. Le comparatif, sans marketing

| Plateforme | Disque permanent ? | Node.js 22 ? | Carte bancaire ? | Verdict pour votre cas |
|---|---|---|---|---|
| **alwaysdata (Free)** | ✅ **1 Go SSD** | ✅ 22.23 / 24 | ❌ **aucune** | ✅ **retenu** |
| Render (free) | ❌ disque éphémère | oui | non | ❌ la base serait perdue à chaque redéploiement |
| Firebase Hosting | ❌ statique seulement | — | non | ❌ ne sert que les pages, pas la base |
| Vercel / Netlify | ❌ serverless | partiel | non | ❌ pas de fichier SQLite |
| Fly.io / Railway | ✅ | oui | ✅ **carte obligatoire** | ❌ hors contrainte |
| Oracle Cloud « Always Free » | ✅ (VM) | oui | ✅ carte pour vérifier | ❌ hors contrainte |
| VPS classique (OVH, Hetzner…) | ✅ | oui | ✅ | ❌ 4 000–7 000 F/mois |

**Ce qui élimine la plupart des offres gratuites** : elles sont « serverless ». Un fichier SQLite y
disparaît au redémarrage. Votre application n'est pas un site statique : elle a une base, des
sessions, des PDF. Il lui faut un **disque**, pas seulement de la mémoire.

---

## 3. La solution retenue : alwaysdata Free

| Caractéristique | Valeur (offre Free, 2026) |
|---|---|
| Prix | **0 €, à vie** |
| Carte bancaire | **aucune**, à l'inscription |
| Disque | **1 Go SSD** (permanent, vos fichiers ET la base) |
| RAM / CPU | 256 Mo · ¼ de CPU (largement suffisant : l'appli consomme ~80 Mo) |
| Langages | Node.js **22.23.4** et 24.22.1 proposés (vérifié le 22/10/2026) |
| Accès | SSH, SFTP, FTP, WebDAV |
| Adresse | `votre-compte.alwaysdata.net`, HTTPS Let's Encrypt gratuit |
| Domaine propre | possible (ex. `ecole.mon-ecole.tg`) |
| Sauvegardes | automatiques, conservées 3 jours (en plus de `npm run backup`) |
| Serveurs | en France |

### Les limites, dites franchement
- **Usage personnel** dans les conditions de l'offre gratuite. Pour une école **payante**, c'est la
  même réserve que Tailscale : ça fonctionne très bien, mais l'hébergeur peut demander un jour de
  passer sur une offre payante (à partir de 5 € HT/mois). À prévoir dans le prix de vente, pas à
  découvrir en cours d'année.
- 256 Mo de RAM : aucun souci pour 1 000 élèves, mais évitez de lancer plusieurs instances.
- 1 Go de disque : la base d'une école fait quelques mégaoctets ; vous avez des années devant vous.
  Surveillez avec `npm run base` (taille du fichier).
  **Ce 1 Go n'est pas une limite pour les images** : branchez votre compte MEGA (25 Go gratuits) et
  les signatures, logos et pièces jointes partent chez MEGA, le disque ne gardant qu'une copie de
  secours. Deux commandes, sans droits administrateur :

  ```bash
  bash deploy/alwaysdata/rclone.sh --installer
  bash deploy/alwaysdata/rclone.sh --configurer
  ```

  Détail complet : **[STOCKAGE-EXTERNE.md](STOCKAGE-EXTERNE.md)**.

---

## 4. Mise en ligne — étape par étape

### 4.1 Créer le compte (5 minutes, une seule fois)

1. <https://www.alwaysdata.com/fr/> → **Gratuit** → *S'inscrire*.
2. Choisir l'offre **Cloud public gratuit (1 Go)**, **sans carte bancaire**.
3. Choisir un **nom de compte** : il devient une partie de votre adresse.
   Exemple : compte `terminish-ecole` → `terminish-ecole.alwaysdata.net`.
   ⚠ Ce nom ne se change plus facilement : choisissez-le comme l'adresse que vous donnerez aux écoles.

### 4.2 Activer Node.js 22

Administration → **Environnement → Node.js** → version **22** (ou 24).
Sans cette étape, le serveur refuse de démarrer (il a besoin de `node:sqlite`, présent depuis Node 22.5).

### 4.3 Envoyer l'application

Depuis le Chromebook (terminal du conteneur Linux) :

```bash
cd ~/Téléchargements
```

```bash
scp terminish-ecole-deploiement.zip COMPTE@ssh-COMPTE.alwaysdata.net:~/
```

*(remplacez `COMPTE` par votre nom de compte alwaysdata ; le mot de passe demandé est celui du compte.
Le même mot de passe sert pour SSH.)*

Puis, en SSH :

```bash
ssh COMPTE@ssh-COMPTE.alwaysdata.net
```

```bash
unzip -q terminish-ecole-deploiement.zip && mv terminish-ecole app && cd app
```

> Pour repartir de zéro plus tard : `rm -rf ~/app` puis recommencer. La base est dans `~/app/data`,
> pensez à la télécharger avant (`scp COMPTE@ssh-COMPTE.alwaysdata.net:~/app/data/terminish-ecole.db .`).

### 4.4 Installer (une commande)

Toujours en SSH, dans `~/app` :

```bash
bash deploy/alwaysdata/installer.sh --email vous@mon-ecole.tg
```

Le script :
1. vérifie Node.js 22.5+ ;
2. installe les dépendances de production (`npm ci`) ;
3. crée `data/` et le fichier **`.env`** (mode production, dossier de données, identifiants,
   cookie sécurisé) ;
4. génère un **mot de passe** et le note dans `data/compte-administrateur.txt` (lisible par vous seul) ;
5. affiche la commande exacte à coller dans l'interface.

**Mise à jour « annuler une activation » (28 octobre 2026) :** elle ajoute
`server/abonnements.js`, modifie `server/db.js`, `server/index.js`, `public/js/app.js` et
`public/app.html`. Sauvegardez la base SQLite **avant** de remplacer ces cinq fichiers dans
`~/app`, sans toucher à `~/app/data`, à `.env` ni à `node_modules` ; aucune dépendance nouvelle
n'est nécessaire. Dans **alwaysdata → Web → Sites → Redémarrer**, redémarrez le site pour que
la nouvelle table `operations_abonnement` soit créée automatiquement. Vérifiez ensuite la page
**Console → Paiements** et le journal dans **Console → Établissements**. Ne lancez pas `npm ci`
juste pour cette mise à jour.

**Mise à jour « consultation seulement des écoles suspendues » :** remplacez
`server/index.js`, `public/js/app.js`, `public/css/styles.css` et `public/app.html`, et ajoutez
`server/acces-abonnement.js` depuis **la même version GitHub**. Faites d'abord une **nouvelle
sauvegarde SQLite** dans `~/app/data/sauvegardes/` ; conservez `data/`, `.env` et `node_modules`
intacts. Redémarrez ensuite **alwaysdata → Web → Sites → kodjone.alwaysdata.net → Redémarrer**
(les fichiers statiques sont déjà publiés après la copie). Vérifiez avec une école de test suspendue :
lecture de notes/bulletins/PDF et déclaration de paiement permises, saisie de notes interdite ;
réactivez-la et contrôlez le retour des droits sans déconnexion. Pas de nouvelle dépendance, pas de
migration de la base, **ne lancez pas `npm ci`** sur alwaysdata pour cette mise à jour.

**Si alwaysdata arrête npm avec `Killed` :** ne redémarrez pas : `npm ci` a peut-être vidé
`node_modules` avant d'être interrompu. Sur un serveur **Linux x64**, lancez depuis `~/app` :

```bash
NODE_OPTIONS=--max-old-space-size=64 node deploy/alwaysdata/installer-dependances-leger.js
```

Ce dépanneur sans npm lit le `package-lock.json`, télécharge les paquets de production un par un
depuis le registre officiel, vérifie leur SHA-512 et peut reprendre après une interruption. Il ne
touche ni `data/` ni `.env` ; attendez le message **« DÉPENDANCES PRÊTES »** avant de redémarrer.

### 4.5 Déclarer le site (interface web)

**Web → Sites → Ajouter un site**

| Champ | Valeur |
|---|---|
| Nom | Terminish École |
| Type | **Node.js** |
| Version de Node | 22 (ou 24) |
| Adresses | `COMPTE.alwaysdata.net` |
| Commande | `node /home/COMPTE/app/server/index.js` |
| Répertoire de travail | `/home/COMPTE/app` |

Puis, sur la page du site : **HTTPS / SSL → Let's Encrypt** (gratuit, 1 clic).

### 4.6 Vérifier

```
https://COMPTE.alwaysdata.net/api/health
```
doit répondre `{"ok":true,...}`. Ensuite, ouvrez `https://COMPTE.alwaysdata.net/app` et connectez-vous.

Dans le menu, en bas : **🗄️ Base de données** doit afficher
`/home/COMPTE/app/data/terminish-ecole.db`. C'est la preuve que tout est au bon endroit.

### 4.7 Courriels « Mot de passe oublié » (Gmail)

Réservés au **chef d'établissement et au super-administrateur** ; l'enseignant continue de passer par
son chef. Sur alwaysdata, ajoutez au fichier privé `~/app/.env` les variables `APP_PUBLIC_URL`
(`https://COMPTE.alwaysdata.net`, sans `/app`), `GMAIL_USER` (adresse Gmail expéditrice) et
`GMAIL_APP_PASSWORD` (mot de passe **d'application** généré après validation en deux étapes chez Google).
Ne collez **aucun secret dans Git, dans un chat ou dans une capture d'écran** ; limitez l'accès au fichier
avec `chmod 600 ~/app/.env`. Le mot de passe habituel du compte Gmail ne convient pas. Le script
`deploy/alwaysdata/installer.sh` conserve ces réglages si vous le relancez.

Après avoir copié une version qui change les dépendances, vérifiez qu'elles sont présentes ; si
alwaysdata interrompt npm, utilisez l'installateur léger décrit en **4.4** au lieu de relancer `npm ci`.
La mise à jour de la seule interface mobile ne change aucune dépendance et ne nécessite pas ce traitement.
Après configuration de Gmail dans `.env`, faites **Web → Sites → Redémarrer**. Testez depuis la page
de connexion avec un chef dont l'adresse est bien
renseignée ; vérifiez sa boîte de réception et les indésirables. Si rien n'arrive, consultez **Web → Sites
→ Journaux** : le serveur peut indiquer un échec SMTP sans afficher le secret ni le lien. L'envoi réel
ne peut pas être garanti avant ce test sur l'hébergement. Tant que Gmail n'est pas prêt, le formulaire
l'indique et les demandes des enseignants sont toujours transmises au chef.

---

## 5. Reprendre les données déjà saisies

Si vous avez des notes réelles sur le Chromebook (et pas seulement la démo) :

```bash
# 1. sur le Chromebook : sauvegarde propre
npm run backup
```

```bash
# 2. envoyer le fichier sur l'hébergeur
scp data/terminish-ecole.db COMPTE@ssh-COMPTE.alwaysdata.net:~/app/data/terminish-ecole.db
```

Puis, en SSH, redémarrer le site (interface → Sites → **Redémarrer**), et vérifier avec
**🗄️ Base de données** : le nombre d'élèves et de notes doit correspondre.

⚠ Un fichier `.db` remplace l'autre : ne copiez pas une base de démonstration par-dessus une base
réelle. `npm run base` affiche le mode (démo / production) avant l'envoi.

---

## 6. Sauvegardes (indispensable)

Le disque d'un hébergeur n'est pas éternel ; les sauvegardes automatiques d'alwaysdata ne durent que
3 jours.

```bash
npm run backup
```
→ copie horodatée dans `data/sauvegardes/` (14 conservées). Pour la rapatrier sur le Chromebook :

```bash
scp COMPTE@ssh-COMPTE.alwaysdata.net:'~/app/data/sauvegardes/*.db' ~/sauvegardes-ecole/
```

Une fois par mois suffit pour une petite école ; une fois par semaine si les notes bougent beaucoup.

**Copie hors site sur MEGA** (en plus de la sauvegarde locale) :

```bash
npm run backup
rclone copy data/sauvegardes mega:Terminish/sauvegardes
```

À programmer dans alwaysdata → **Tâches planifiées** (une fois par semaine). Voir
**[STOCKAGE-EXTERNE.md](STOCKAGE-EXTERNE.md)** §3.4.

---

## 7. Et Firebase dans tout ça ?

Firebase reste utile pour **le site vitrine** (`public/index.html`), servi gratuitement par Google sur
une adresse définitive. Mais il ne remplace pas l'hébergement du serveur : la base doit vivre sur un
disque, et Firebase Hosting n'a pas de disque.

Ordre logique recommandé :

1. **alwaysdata** héberge l'application complète → `https://COMPTE.alwaysdata.net` (tout fonctionne).
2. Plus tard, si vous voulez une adresse plus vendeuse : un nom de domaine (≈ 5 000–8 000 F/an) ou
   Firebase Hosting pour la vitrine, qui pointe vers l'application.

Le lien Tailscale peut alors être fermé (`sudo tailscale funnel --bg off`) : il n'a plus d'utilité.

---

## 8. Aide-mémoire

| Besoin | Commande |
|---|---|
| Installer / réinstaller sur l'hébergeur | `bash deploy/alwaysdata/installer.sh --email vous@ecole.tg` |
| Contrôler sans rien changer | `bash deploy/alwaysdata/installer.sh --verifier` |
| Voir la base réellement utilisée | `npm run base` |
| Sauvegarder | `npm run backup` |
| Changer le mot de passe administrateur | `npm run motdepasse` |
| Voir les journaux du site | Interface alwaysdata → Sites → Journaux |
| Redémarrer après un changement | Interface alwaysdata → Sites → Redémarrer |
