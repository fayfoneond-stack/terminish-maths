# Un lien éternel, gratuitement

> **Réponse courte** : oui, c'est possible — mais pas depuis votre Chromebook, et pas en une commande.
> Il faut une machine qui tourne 24 h/24. Le seul moyen durable et gratuit est une **VM gratuite à vie**
> (Oracle Cloud « Always Free »). Le reste, je l'ai automatisé : un seul script à lancer sur la VM.

---

## 1. Pourquoi un lien `trycloudflare.com` ne peut pas être éternel

Ce lien est un **tunnel rapide** : Cloudflare crée une adresse à la volée quand la commande démarre,
puis **la supprime du DNS** quand elle s'arrête. Elle ne revient jamais, même en relançant.
Ce n'est pas un défaut de configuration : c'est le fonctionnement de ce service gratuit.

Pour un lien qui ne change jamais, il faut **une adresse fixe qui pointe vers une machine toujours allumée** :

| Élément | Rôle | Coût |
|---|---|---|
| Une machine 24 h/24 | héberge le site | 0 F (Oracle Always Free) |
| Une IP publique fixe | ne change pas | incluse |
| Un nom de domaine | adresse lisible | 0 F (`sslip.io`, dérivé de l'IP) |
| Un certificat HTTPS | le cadenas | 0 F (Let's Encrypt) |

---

## 2. Oracle Cloud « Always Free » — ce que vous obtenez réellement

Offre gratuite **sans limite de durée**, dans la région d'accueil du compte :

| Ressource | Allocation (après réduction de juin 2026) |
|---|---|
| Ampere A1 (ARM) | **2 OCPU + 12 Go de RAM** au total |
| Instances AMD micro | **2 × (1/8 OCPU, 1 Go)** |
| Stockage bloc + démarrage | 200 Go |
| Trafic sortant | 10 To/mois |

Terminish École consomme moins de 300 Mo de RAM : **une micro-instance AMD 1 Go suffit très largement**.
Préférez-la : contrairement aux instances ARM, elle est presque toujours disponible immédiatement
(l'ARM tombe souvent en « out of host capacity »).

Une carte bancaire est demandée **pour vérifier l'identité**, sans débit sur le compte Always Free.

---

## 3. Marche à suivre (20 minutes, une seule fois)

### 3.1 Créer le compte

1. <https://www.oracle.com/cloud/free/> → **Start for free**.
2. Région d'accueil : **Marseille, Paris ou Francfort** (la plus proche du Togo où l'ARM est disponible).
3. Validez l'e-mail et la carte (empreinte de vérification, pas de prélèvement).

### 3.2 Créer la machine

1. Menu ☰ → **Compute → Instances → Create instance**.
2. **Image** : Ubuntu 24.04 (ou 22.04).
3. **Shape** : *Ampere → VM.Standard.A1.Flex* (1 OCPU / 6 Go suffisent)
   ou *Specialty and previous generation → VM.Standard.E2.1.Micro* (AMD, plus disponible).
4. **SSH keys** : *Generate a key pair for me* → **téléchargez la clé privée** (`.key`), gardez-la.
5. **Create**. Attendez l'état **Running**, notez l'**IP publique**.

### 3.3 Ouvrir les deux ports (étape la plus souvent oubliée)

Deux niveaux de filtrage existent chez Oracle :

1. **Security List** du VCN : Networking → Virtual Cloud Networks → votre VCN → Security Lists →
   Default Security List → **Add Ingress Rules** :
   - source `0.0.0.0/0`, protocole TCP, destination port **80**
   - idem pour **443**
2. **Pare-feu interne de l'image Ubuntu** (Oracle l'active par défaut) — le script le détecte,
   mais vous pouvez le faire avant :

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 3.4 Se connecter et installer

Depuis le Terminal de votre Chromebook :

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

Le script fait le reste : Docker, application, HTTPS, mot de passe administrateur, pare-feu, démarrage
automatique. Il affiche à la fin :

```
🌍 Site          : https://ecole.141.94.12.34.sslip.io
🔐 Console       : https://ecole.141.94.12.34.sslip.io/app
👤 Identifiant   : admin@terminish.tg
🔑 Mot de passe  : palmier-solide-4821
```

**Cette adresse ne changera plus.** Elle reste valable tant que la VM existe — y compris quand votre
Chromebook est éteint, en voyage, ou après une coupure de courant chez vous.

### 3.5 Options du script

```bash
sudo bash deploy/vm/installer-vm.sh --simulation          # voir le plan, ne rien installer
sudo bash deploy/vm/installer-vm.sh --verifier            # diagnostic (Docker, ports, pare-feu)
sudo bash deploy/vm/installer-vm.sh --domaine ecole.mon-ecole.tg
sudo bash deploy/vm/installer-vm.sh --admin moi@mon-ecole.tg --mot-de-passe 'MonSecret!2026'
sudo bash deploy/vm/installer-vm.sh --ip 141.94.12.34     # si la détection d'IP échoue
```

---

## 4. Et si un jour vous achetez un domaine (~10 000 F/an)

Plus court et plus crédible pour une école : `ecole.terminish.tg`.

1. Chez votre registrar, créez un enregistrement **A** : `ecole` → IP de la VM.
2. Sur la VM :

```bash
cd /srv/terminish-ecole
sudo nano .env          # DOMAIN=ecole.terminish.tg
sudo docker compose up -d
```

Caddy redemande un certificat pour le nouveau nom, automatiquement. Aucune autre manipulation.

---

## 5. Comparatif honnête

| Solution | Lien stable | Durée de vie | Coût | Effort |
|---|---|---|---|---|
| Tunnel rapide Cloudflare (actuel) | ❌ change à chaque démarrage | tant que la fenêtre est ouverte | 0 F | 1 commande |
| **Oracle Always Free + `sslip.io`** | ✅ | **illimitée** | **0 F** | 20 min, une fois |
| Oracle + votre domaine | ✅ | illimitée | ~10 000 F/an | 25 min |
| Render (disque persistant) | ✅ | tant que l'abonnement | ~8 $/mois | 10 min |
| VPS classique (Hetzner, OVH…) | ✅ | tant que l'abonnement | 4 000–7 000 F/mois | 20 min |
| Google Cloud e2-micro « gratuit » | ✅ | illimitée | **attention : IP externe ≈ 3,65 $/mois** | 20 min |

> Le « gratuit » de Google Cloud facture l'adresse IPv4 publique (~3,65 $/mois) et le disque si vous
> laissez le type par défaut (balanced). Oracle reste réellement à 0 F.

---

## 6. Entretien minimum (2 minutes par mois)

```bash
cd /srv/terminish-ecole
sudo docker compose ps                    # tout doit être « running »
sudo docker compose exec app npm run backup
```

Sauvegarde hors de la VM (obligatoire : une VM perdue = tout perdu) :

```bash
# depuis votre Chromebook, dans un autre terminal
scp -i ~/Downloads/ssh-key.key ubuntu@IP:/srv/terminish-ecole -r ~/Terminish-sauvegardes/
```

Mise à jour de l'application :

```bash
cd /srv/terminish-ecole
sudo docker compose exec app npm run backup
git pull && sudo docker compose up -d --build
```

---

## 7. Si Oracle refuse votre carte

Ordre de préférence, du plus raisonnable au moins bon :

1. **Une école pilote** prête son ordinateur allumé en permanence (0 F, lien stable, mais dépend d'eux).
2. **Google Cloud e2-micro** (3,65 $/mois d'IP — ce n'est plus vraiment gratuit).
3. **VPS à 4 000–5 000 F/mois** (Hetzner CX22, OVH VPS) : le site ne dépend plus de personne.
4. Rester sur le **tunnel rapide** pour les démonstrations, en attendant le premier client payant.

Dans tous les cas, ne donnez jamais à une école un lien `trycloudflare.com` : il sera mort avant
la fin du mois. Ce guide existe pour ça.
