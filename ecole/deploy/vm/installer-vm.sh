#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Terminish École — installation sur un serveur (VM Oracle Cloud « Always Free »,
# VPS, serveur dédié…). À exécuter SUR la machine, après connexion ssh.
#
#   sudo bash installer-vm.sh                          → HTTPS sur ecole.<ip-publique>.sslip.io
#   sudo bash installer-vm.sh --domaine ecole.mondomaine.tg
#   sudo bash installer-vm.sh --email moi@exemple.tg --admin moi@exemple.tg --mot-de-passe 'MonSecret!2026'
#   sudo bash installer-vm.sh --verifier                → diagnostic, sans rien modifier
#   sudo bash installer-vm.sh --ip 1.2.3.4              → si la détection d'IP échoue
#   sudo bash installer-vm.sh --simulation              → affiche le plan, sans installer
#
# Résultat : site en ligne 24 h/24 en HTTPS, adresse stable, relance automatique
# après redémarrage du serveur.
# ---------------------------------------------------------------------------
set -euo pipefail

VERT=$'\033[32m'; JAUNE=$'\033[33m'; ROUGE=$'\033[31m'; GRIS=$'\033[90m'; RAZ=$'\033[0m'
ok()    { printf '%s✔%s %s\n'     "$VERT" "$RAZ" "$*"; }
info()  { printf '%s•%s %s\n'     "$GRIS" "$RAZ" "$*"; }
alerte(){ printf '%s!%s %s\n'     "$JAUNE" "$RAZ" "$*"; }
erreur(){ printf '%s✘%s %s\n'     "$ROUGE" "$RAZ" "$*" >&2; }
titre() { printf '\n%s\n  %s\n%s\n' '────────────────────────────────────────────────────────────' "$*" '────────────────────────────────────────────────────────────'; }

# --- options ---------------------------------------------------------------
DOMAINE=""; EMAIL=""; ADMIN_ID="admin@terminish.tg"; MOT_DE_PASSE=""; VERIFIER=0; SIMULATION=0; DEPOT=""; IP_FORCEE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domaine)       DOMAINE="${2:-}"; shift ;;
    --email)         EMAIL="${2:-}"; shift ;;
    --admin)         ADMIN_ID="${2:-}"; shift ;;
    --mot-de-passe)  MOT_DE_PASSE="${2:-}"; shift ;;
    --ip)            IP_FORCEE="${2:-}"; shift ;;
    --verifier)      VERIFIER=1 ;;
    --simulation|--dry-run) SIMULATION=1 ;;
    -h|--help) sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) erreur "Option inconnue : $1"; exit 1 ;;
  esac
  shift
done

titre "Terminish École — installation sur serveur"

# --- 1. environnement ------------------------------------------------------
[ "$(id -u)" -eq 0 ] || { erreur "Lancez avec sudo : sudo bash installer-vm.sh"; exit 1; }
[ -r /etc/os-release ] && . /etc/os-release && ok "Système : ${PRETTY_NAME:-$ID}" || alerte "Système inconnu"
command -v curl >/dev/null || { erreur "curl est requis (apt install curl)"; exit 1; }

ARCH="$(uname -m)"
[ "$ARCH" = "aarch64" ] || [ "$ARCH" = "x86_64" ] || alerte "Architecture $ARCH non testée (l'image Node 22 couvre amd64 et arm64)"

# --- 2. IP publique --------------------------------------------------------
IP_PUBLIQUE="$IP_FORCEE"
for service in https://api.ipify.org https://ifconfig.me/ip https://checkip.amazonaws.com; do
  [ -n "$IP_PUBLIQUE" ] && break
  IP_PUBLIQUE="$(curl -4 -fsS --max-time 6 "$service" 2>/dev/null | tr -d '[:space:]' || true)"
  [[ "$IP_PUBLIQUE" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && break
  IP_PUBLIQUE=""
done
[ -n "$IP_PUBLIQUE" ] && ok "IP publique : $IP_PUBLIQUE" || {
  erreur "Impossible de détecter l'IP publique (réseau bloqué ?)"
  echo "   Indiquez-la à la main : sudo bash installer-vm.sh --ip 141.94.12.34"
  exit 1
}

[ -z "$DOMAINE" ] && DOMAINE="ecole.${IP_PUBLIQUE}.sslip.io"
# e-mail de contact pour Let's Encrypt (facultatif)
ADRESSE="https://${DOMAINE}"

titre "Plan d'installation"
echo "  Adresse du site   : $ADRESSE"
echo "  Dossier           : /srv/terminish-ecole"
echo "  Base de données   : volume Docker « donnees » (persistant)"
echo "  Identifiant admin : ${ADMIN_ID}"
echo "  HTTPS             : certificat Let's Encrypt automatique (Caddy)"
echo "  Démarrage auto    : oui (restart: unless-stopped + docker au boot)"

if [ "$SIMULATION" -eq 1 ]; then
  echo
  info "Simulation : rien n'a été modifié. Relancez sans --simulation pour installer."
  exit 0
fi

# --- 3. diagnostic seul ----------------------------------------------------
if [ "$VERIFIER" -eq 1 ]; then
  titre "Diagnostic"
  command -v docker >/dev/null && ok "Docker : $(docker --version)" || alerte "Docker absent (il sera installé)"
  docker compose version >/dev/null 2>&1 && ok "docker compose : $(docker compose version --short 2>/dev/null || echo présent)" || alerte "plugin compose absent (il sera installé)"
  (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -qE ':(80|443)\b' && alerte "Les ports 80/443 semblent déjà occupés" || ok "Ports 80/443 libres"
  command -v ufw >/dev/null && ufw status 2>/dev/null | head -3 || info "ufw non installé"
  echo
  info "Vérifiez aussi, dans la console de votre hébergeur, que les ports 80 et 443 sont ouverts"
  info "(Oracle : Security List du VCN + iptables de l'image Ubuntu)."
  exit 0
fi

# --- 4. paquets ------------------------------------------------------------
titre "1/5 — Outils système"
if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl git ufw >/dev/null
elif command -v dnf >/dev/null; then
  dnf install -y -q ca-certificates curl git firewalld >/dev/null
else
  erreur "Distribution non prise en charge (apt ou dnf attendu)."; exit 1
fi
ok "git, curl installés"

# --- 5. docker -------------------------------------------------------------
titre "2/5 — Docker"
if ! command -v docker >/dev/null; then
  info "Installation de Docker (script officiel)…"
  curl -fsSL https://get.docker.com | sh >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || { erreur "Le plugin docker compose est absent : apt install docker-compose-plugin"; exit 1; }
ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# --- 6. code ---------------------------------------------------------------
titre "3/5 — Application"
DEST=/srv/terminish-ecole
if [ -f "$DEST/package.json" ]; then
  ok "Application déjà présente dans $DEST (mise à jour sur place)"
else
  mkdir -p /srv
  if [ -f "./package.json" ] && [ -d "./server" ]; then
    info "Copie du dossier courant vers $DEST…"
    mkdir -p "$DEST"
    tar -cf - --exclude=node_modules --exclude=data --exclude='*.log' . | tar -xf - -C "$DEST"
  else
    info "Récupération du dépôt GitHub…"
    DEPOT="${DEPOT:-https://github.com/fayfoneond-stack/terminish-maths.git}"
    tmp="$(mktemp -d)"
    git clone --depth 1 "$DEPOT" "$tmp/depot" >/dev/null 2>&1 || {
      erreur "Clonage impossible. Copiez le dossier de l'application ici puis relancez."
      exit 1
    }
    if [ -f "$tmp/depot/ecole/package.json" ]; then
      cp -r "$tmp/depot/ecole" "$DEST"
    else
      cp -r "$tmp/depot" "$DEST"
    fi
    rm -rf "$tmp"
  fi
fi
cd "$DEST"
ok "Code en place ($(find . -maxdepth 2 -name '*.js' | wc -l) fichiers JS)"

# --- 7. configuration ------------------------------------------------------
titre "4/5 — Configuration"
if [ -z "$MOT_DE_PASSE" ]; then
  MOTS_A=(palmier baobab colibri calebasse harmattan savane lagune mangrove fromager hibiscus)
  MOTS_B=(solaire brillant paisible solide vivant clair ouvert joyeux)
  MOT_DE_PASSE="${MOTS_A[$RANDOM % ${#MOTS_A[@]}]}-${MOTS_B[$RANDOM % ${#MOTS_B[@]}]}-$((RANDOM % 9000 + 1000))"
fi

cat > .env <<EOF
# Généré par installer-vm.sh le $(date '+%d/%m/%Y à %H:%M')
DOMAIN=${DOMAINE}
EMAIL_CONTACT=${EMAIL}
PORT=3000
TERMINISH_DATA_DIR=/data
TERMINISH_SEED=prod
ADMIN_EMAIL=${ADMIN_ID}
ADMIN_PASSWORD=${MOT_DE_PASSE}
COOKIE_SECURE=1
EOF
chmod 600 .env
ok "Fichier .env écrit (droits 600)"

# pare-feu local si présent
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
  ok "ufw : ports 22, 80, 443 autorisés"
fi

# --- 8. lancement ----------------------------------------------------------
titre "5/5 — Démarrage"
docker compose up -d --build
info "Attente de la base et du certificat HTTPS (30 à 90 s)…"

SANTE=""
for i in $(seq 1 30); do
  sleep 3
  SANTE="$(curl -fsS --max-time 4 "http://127.0.0.1:3000/api/health" 2>/dev/null || true)"
  [ -n "$SANTE" ] && break
done

echo
if [ -n "$SANTE" ]; then
  ok "L'application répond : $SANTE"
else
  alerte "L'application ne répond pas encore. Consultez : docker compose logs -f app"
fi

# certificat : on laisse Caddy finir (premier appel peut prendre 20 s)
for i in $(seq 1 12); do
  if curl -fsS --max-time 5 -o /dev/null "$ADRESSE/api/health" 2>/dev/null; then
    ok "HTTPS valide sur $ADRESSE"
    break
  fi
  sleep 5
  [ "$i" -eq 12 ] && alerte "HTTPS pas encore prêt : vérifiez le DNS de $DOMAINE et les ports 80/443 (docker compose logs caddy)"
done

# --- 9. récapitulatif ------------------------------------------------------
FICHIER_ACCES=/root/terminish-acces.txt
cat > "$FICHIER_ACCES" <<EOF
Terminish École — accès installés le $(date '+%d/%m/%Y à %H:%M')
Adresse : ${ADRESSE}
Console : ${ADRESSE}/app
Identifiant : ${ADMIN_ID}
Mot de passe : ${MOT_DE_PASSE}
Sauvegarde : cd ${DEST} && docker compose exec app npm run backup
EOF
chmod 600 "$FICHIER_ACCES"

titre "INSTALLATION TERMINÉE"
cat <<EOF
  🌍 Site          : ${ADRESSE}
  🔐 Console       : ${ADRESSE}/app
  👤 Identifiant   : ${ADMIN_ID}
  🔑 Mot de passe  : ${MOT_DE_PASSE}
     (également dans ${FICHIER_ACCES})

  Commandes utiles (dans ${DEST}) :
    docker compose logs -f app      voir les journaux
    docker compose restart app      redémarrer
    docker compose exec app npm run backup    sauvegarder la base
    git pull && docker compose up -d --build  mettre à jour

  ⚠️  Le site redémarre tout seul après un reboot du serveur.
      Vérifiez une fois que le domaine répond depuis un téléphone en 4G.
EOF
