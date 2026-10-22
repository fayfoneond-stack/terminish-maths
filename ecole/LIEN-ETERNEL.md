# Un lien éternel, gratuitement — sans carte bancaire

> **Réponse courte** : oui. Avec **Tailscale Funnel**, votre Chromebook obtient une adresse
> **HTTPS fixe** du type `https://mon-pc.requin-bleu.ts.net`, **gratuite à vie, sans carte
> bancaire, sans ouvrir de port** dans la box. L'adresse ne change plus, même après un
> redémarrage du Chromebook.
> Une seule condition : le site doit tourner — donc le Chromebook doit rester allumé et
> connecté pendant que des gens s'en servent.

**Le tout-en-un** :

```bash
cd ~/"TERMINISH ECOLE"
npm run partage                 # 1er terminal : lance le site (laisser ouvert)
bash deploy/gratuit/lien-stable.sh --tailscale   # 2e terminal : crée l'adresse stable
```

---

## 1. Pourquoi un lien `trycloudflare.com` ne peut pas être éternel

Ce lien est un **tunnel rapide** : Cloudflare crée une adresse à la volée quand la commande
démarre, puis **la supprime du DNS** quand elle s'arrête. Elle ne revient jamais, même en
relançant. Ce n'est pas un défaut de configuration : c'est le fonctionnement de ce service
gratuit. Il reste parfait pour une démonstration de dix minutes, jamais pour une école.

Pour un lien qui ne change jamais, il faut **un nom fixe** qui pointe vers **une machine
allumée**. Trois façons d'y arriver sans payer :

| Solution | Nom stable | HTTPS | Carte bancaire | Ports à ouvrir | Marche sur Chromebook |
|---|---|---|---|---|---|
| **Tailscale Funnel** ⭐ | `mon-pc.xxx.ts.net` | ✅ automatique | **non** | **aucun** | **oui** |
| IP publique + redirection | `http://IP:3000` | ❌ | non | oui (box) | non (NAT du conteneur) |
| DuckDNS + redirection | `nom.duckdns.org` | à ajouter | non | oui (box) | non (NAT du conteneur) |

---

## 2. Tailscale Funnel — la solution retenue (10 minutes, une seule fois)

### 2.1 Ce que c'est

Tailscale relie vos appareils entre eux par un réseau privé chiffré. **Funnel** en ouvre une
seule porte vers Internet, avec un **vrai certificat HTTPS**. L'adresse est dérivée du nom de
la machine et de votre réseau : elle est **prévisible et permanente**.

| Caractéristique | Détail |
|---|---|
| Prix | **0 F, gratuit à vie** (offre *Personal*) |
| Carte bancaire | **aucune**, jamais |
| Inscription | compte Google ou GitHub (2 clics) |
| Nom obtenu | `https://<machine>.<votre-reseau>.ts.net` |
| Plage de ports | 443 / 8443 / 10000 seulement (3000 → 443 automatiquement) |
| CGNAT / 4G / box fermée | **aucun problème**, aucun port à ouvrir |
| Limites honnêtes | usage personnel ; débit plafonné (suffisant pour une école) ; pas de nom de domaine à vous |

> **À savoir** : l'offre *Personal* est prévue pour un usage personnel. Pour un usage
> franchement commercial à grande échelle, Tailscale demande un plan payant. Pour une école
> unique avec quelques dizaines de connexions par jour, c'est parfaitement utilisable — et
> c'est la seule option **réellement gratuite sans carte**.

### 2.2 Les 4 étapes

**Étape 1 — lancer le site** (terminal n°1, à laisser ouvert) :

```bash
cd ~/"TERMINISH ECOLE"
npm run partage
```

**Étape 2 — installer et connecter Tailscale** (terminal n°2, `Ctrl+Shift+T`) :

```bash
bash deploy/gratuit/lien-stable.sh --tailscale
```

Le script installe Tailscale, affiche une adresse `https://login.tailscale.com/...` :
ouvrez-la dans Chrome, connectez-vous avec **Google ou GitHub**. Aucune carte n'est demandée.

**Étape 3 — activer les deux options dans la console Tailscale** (2 clics) :

<https://login.tailscale.com/admin/dns>

- **MagicDNS** : activé
- **HTTPS Certificates** : *Enable HTTPS*

**Étape 4 — ouvrir la porte** :

```bash
sudo tailscale funnel --bg 3000
```

Le terminal affiche :

```
Available on the internet:
https://mon-pc.requin-bleu.ts.net
```

**C'est fini. Cette adresse est la vôtre, définitivement.**

- Site : `https://mon-pc.requin-bleu.ts.net`
- Console : `https://mon-pc.requin-bleu.ts.net/app`

> Le nom exact dépend de votre machine et de votre réseau. Le script l'écrit aussi dans
> `data/lien-stable.txt` : `cat data/lien-stable.txt` à tout moment.

### 2.3 Au quotidien

```bash
npm run partage                          # démarrer le site (1er terminal)
bash deploy/gratuit/lien-stable.sh --tailscale   # rouvrir le tunnel (2e terminal)
bash deploy/gratuit/lien-stable.sh --etat        # où en est-on ?
sudo tailscale funnel --bg off           # fermer l'accès public
sudo tailscale funnel status             # qui est ouvert ?
```

Le tunnel reste ouvert après un redémarrage ; le **site**, lui, doit être relancé. C'est le
seul geste quotidien.

### 2.4 Avant d'ouvrir au public : les mots de passe

Avec Funnel, **votre site est visible sur Internet**. Les comptes de démonstration
(`admin@terminish.tg` / `admin1234`, etc.) deviennent donc joignables par n'importe qui.
Avant la première ouverture :

```bash
npm run motdepasse            # change le mot de passe administrateur
```

Et ne démarrez pas en mode démo (`npm run partage:demo`) sur un lien public.

---

## 3. Deuxième voie : votre IP publique (sans HTTPS)

À utiliser si vous voulez éviter Tailscale, et **sur un PC classique** (pas le conteneur du
Chromebook, qui est derrière le NAT de ChromeOS).

```bash
bash deploy/gratuit/lien-stable.sh --ip
```

Le script vous dit tout de suite si c'est possible :

- **IP publique = IP de la box** → il suffit de rediriger le port 3000 vers l'ordinateur.
- **IP publique ≠ IP de la box** → vous êtes en **CGNAT** : la redirection est impossible,
  passez à Tailscale.

Ensuite, dans l'interface de la box (souvent `http://192.168.1.1`) :
*NAT / PAT / Redirection de ports* → TCP **3000** → IP locale de l'ordinateur → enregistrer.

Test décisif : **coupez le Wi-Fi, passez en 4G**, puis ouvrez `http://VOTRE_IP:3000`.
Si ça s'affiche, c'est bon.

⚠ Sans HTTPS, les mots de passe circulent **en clair**. Acceptable pour un test, pas pour
des notes d'élèves. Tailscale règle ce problème gratuitement.

### DuckDNS : un nom au lieu d'une IP

```bash
bash deploy/gratuit/lien-stable.sh --duckdns terminish VOTRE_TOKEN
```

Gratuit, sans carte (<https://www.duckdns.org>, connexion Google/GitHub). Vous obtenez
`https://terminish.duckdns.org`. Le script crée une tâche qui met le nom à jour toutes les
5 minutes. **Mais** il faut toujours une IP publique et une redirection de port : DuckDNS ne
résout pas le CGNAT, et il n'apporte pas le HTTPS tout seul.

---

## 4. Comparatif honnête (tout compris)

| Solution | Lien stable | HTTPS | Carte | Durée | Effort |
|---|---|---|---|---|---|
| Tunnel rapide `trycloudflare` | ❌ | ✅ | non | minutes | 1 commande |
| **Tailscale Funnel** | ✅ | ✅ | **non** | **tant que le compte existe** | 10 min, une fois |
| IP publique + box | ✅ | ❌ | non | tant que l'IP ne change pas | 15 min |
| DuckDNS + box | ✅ | à ajouter | non | tant que le cron tourne | 20 min |
| Oracle Always Free + `sslip.io` | ✅ | ✅ | **oui** (vérification) | illimitée | 30 min |
| Render / Railway | ✅ | ✅ | **oui** | tant que l'abonnement | 10 min |
| VPS Hetzner / OVH | ✅ | ✅ | **oui** | tant que l'abonnement | 20 min |

---

## 5. Annexe — Oracle Cloud « Always Free » (si un jour vous avez une carte)

À garder pour plus tard : c'est la seule option qui fait tourner le site **sans votre
Chromebook**, 24 h/24, avec une vraie IP et un vrai HTTPS. Mais **une carte bancaire est
exigée à l'inscription**, même pour un compte gratuit — d'où son classement en annexe.

### 5.1 Ce que l'offre donne

| Ressource | Allocation (après réduction de juin 2026) |
|---|---|
| Ampere A1 (ARM) | 2 OCPU + 12 Go de RAM au total |
| Instances AMD micro | 2 × (1/8 OCPU, 1 Go) |
| Stockage bloc + démarrage | 200 Go |
| Trafic sortant | 10 To/mois |

Terminish École consomme moins de 300 Mo de RAM : **une micro-instance AMD 1 Go suffit**.
Préférez-la, l'ARM tombe souvent en « out of host capacity ».

### 5.2 Marche à suivre

1. <https://www.oracle.com/cloud/free/> → **Start for free**, région **Marseille / Paris /
   Francfort**, carte pour vérification d'identité (aucun débit).
2. **Compute → Instances → Create instance** : Ubuntu 24.04, shape
   *VM.Standard.E2.1.Micro*, *Generate a key pair* → téléchargez la clé privée. Notez l'IP.
3. **Ouvrir 80 et 443** — deux niveaux de filtrage :
   - *Networking → VCN → Security Lists → Default Security List → Add Ingress Rules* :
     `0.0.0.0/0`, TCP, ports **80** et **443** ;
   - pare-feu interne d'Ubuntu :
     ```bash
     sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
     sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
     sudo netfilter-persistent save
     ```
4. Depuis le Terminal du Chromebook :
   ```bash
   chmod 600 ~/Downloads/ssh-key-*.key
   ssh -i ~/Downloads/ssh-key-*.key ubuntu@IP_PUBLIQUE
   ```
   Puis, sur la VM :
   ```bash
   curl -fsSL https://raw.githubusercontent.com/fayfoneond-stack/terminish-maths/arena/c4eb5c08-terminish-maths/documents/terminish-ecole-deploiement.zip -o te.zip
   sudo apt update && sudo apt install -y unzip
   unzip -o te.zip -d ~ && cd ~/terminish-ecole
   sudo bash deploy/vm/installer-vm.sh
   ```
   Le script fait tout : Docker, application, HTTPS, mot de passe administrateur, pare-feu,
   démarrage automatique. Il affiche à la fin :
   ```
   🌍 Site          : https://ecole.141.94.12.34.sslip.io
   🔐 Console       : https://ecole.141.94.12.34.sslip.io/app
   👤 Identifiant   : admin@terminish.tg
   🔑 Mot de passe  : palmier-solide-4821
   ```

### 5.3 Options de `installer-vm.sh`

```bash
sudo bash deploy/vm/installer-vm.sh --simulation        # voir le plan, ne rien installer
sudo bash deploy/vm/installer-vm.sh --verifier          # diagnostic (Docker, ports, pare-feu)
sudo bash deploy/vm/installer-vm.sh --domaine ecole.mon-ecole.tg
sudo bash deploy/vm/installer-vm.sh --admin moi@mon-ecole.tg --mot-de-passe 'MonSecret!2026'
sudo bash deploy/vm/installer-vm.sh --ip 141.94.12.34   # si la détection d'IP échoue
```

### 5.4 Entretien (2 minutes par mois)

```bash
cd /srv/terminish-ecole
sudo docker compose ps                      # tout doit être « running »
sudo docker compose exec app npm run backup
```

Sauvegarde hors de la VM (obligatoire : une VM perdue = tout perdu) :

```bash
scp -i ~/Downloads/ssh-key.key ubuntu@IP:/srv/terminish-ecole -r ~/Terminish-sauvegardes/
```

### 5.5 Un domaine à vous (~10 000 F/an)

`ecole.terminish.tg` fait plus sérieux qu'un nom `ts.net`. Enregistrement **A** → IP de la
VM, puis dans `/srv/terminish-ecole/.env` : `DOMAIN=ecole.terminish.tg`,
`sudo docker compose up -d`. Caddy redemande le certificat tout seul.

---

## 6. La règle à ne jamais oublier

> **Ne donnez jamais à une école un lien `trycloudflare.com`.**

Il sera mort avant la fin de la semaine. Distribuez `https://<machine>.<reseau>.ts.net`
(Tailscale) : c'est la seule adresse à la fois **stable**, **gratuite**, **sans carte** et
**sans configuration de box**.
