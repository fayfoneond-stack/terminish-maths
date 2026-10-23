#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Terminish École — accès permanent SANS carte bancaire
#
#   bash deploy/gratuit/lien-stable.sh --tailscale   → adresse HTTPS STABLE
#        (https://mon-pc.mon-reseau.ts.net) — pas de port à ouvrir, marche
#        même derrière une box en CGNAT. Compte gratuit (Google/GitHub), sans carte.
#
#   bash deploy/gratuit/lien-stable.sh --ip          → diagnostic « adresse IP »
#        explique si votre IP est publique, quoi faire dans la box, et l'adresse
#        http://<ip>:3000 à utiliser. Aucun compte, aucune carte.
#
#   bash deploy/gratuit/lien-stable.sh --duckdns moncolec TOKEN
#        nom fixe moncolec.duckdns.org (gratuit, sans carte) à la place de l'IP.
#
#   bash deploy/gratuit/lien-stable.sh --etat        → où en est-on ?
# ---------------------------------------------------------------------------
set -uo pipefail

VERT=$'\033[32m'; JAUNE=$'\033[33m'; ROUGE=$'\033[31m'; GRIS=$'\033[90m'; RAZ=$'\033[0m'
ok()    { printf '%s✔%s %s\n' "$VERT" "$RAZ" "$*"; }
info()  { printf '%s•%s %s\n' "$GRIS" "$RAZ" "$*"; }
alerte(){ printf '%s!%s %s\n' "$JAUNE" "$RAZ" "$*"; }
erreur(){ printf '%s✘%s %s\n' "$ROUGE" "$RAZ" "$*" >&2; }
titre() { printf '\n%s\n  %s\n%s\n' '────────────────────────────────────────────────────────────' "$*" '────────────────────────────────────────────────────────────'; }

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3000}"
DATA_DIR="${TERMINISH_DATA_DIR:-$RACINE/data}"

MODE=""; DUCKDNS_NOM=""; DUCKDNS_TOKEN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tailscale) MODE="tailscale" ;;
    --ip)        MODE="ip" ;;
    --duckdns)   MODE="duckdns"; DUCKDNS_NOM="${2:-}"; DUCKDNS_TOKEN="${3:-}"; shift 2 ;;
    --etat)      MODE="etat" ;;
    --port)      PORT="${2:-3000}"; shift ;;
    -h|--help)   sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) erreur "Option inconnue : $1"; exit 1 ;;
  esac
  shift
done
[ -z "$MODE" ] && { erreur "Choisissez : --tailscale, --ip, --duckdns NOM TOKEN, ou --etat"; exit 1; }

# Le site tourne peut-être sur un autre port (3001 quand 3000 était occupé) :
# on adopte le port qui répond réellement, au lieu d'échouer.
port_actif() { curl -fsS --max-time 2 "http://127.0.0.1:$1/api/health" >/dev/null 2>&1; }
if ! port_actif "$PORT"; then
  for p in 3000 3001 3002 3003 3004 3005; do
    if port_actif "$p"; then PORT="$p"; info "Site détecté sur le port ${PORT}."; break; fi
  done
fi

ip_publique() {
  # TERMINISH_IP permet de forcer la valeur (réseaux filtrés, tests)
  if [ -n "${TERMINISH_IP:-}" ]; then echo "$TERMINISH_IP"; return 0; fi
  local ip=""
  for s in https://api.ipify.org https://ifconfig.me/ip https://checkip.amazonaws.com https://ipv4.icanhazip.com; do
    ip="$(curl -4 -fsS --max-time 6 "$s" 2>/dev/null | tr -d '[:space:]')"
    [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && { echo "$ip"; return 0; }
  done
  return 1
}

ip_locale() {
  ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' \
    || hostname -I 2>/dev/null | awk '{print $1}'
}

site_repond() { curl -fsS --max-time 4 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; }

# ===========================================================================
# 1. Adresse IP directe
# ===========================================================================
mode_ip() {
  titre "Accès par adresse IP"
  local pub loc
  pub="$(ip_publique)" || { erreur "Impossible de détecter l'IP publique (réseau bloqué ?)"; return 1; }
  loc="$(ip_locale || true)"
  ok "IP publique vue d'Internet : $pub"
  [ -n "$loc" ] && info "IP locale de cette machine : $loc"

  if [ "$pub" != "$loc" ] && printf '%s' "$pub" | grep -qE '^(100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)'; then
    alerte "Votre IP publique est dans une plage privée/CGNAT : Internet ne peut PAS l'atteindre."
  fi

  cat <<EOF

  ┌─ Ce qu'il faut savoir ────────────────────────────────────────────────┐
  │ Une adresse « http://<ip>:3000 » ne fonctionne que si :               │
  │   1. votre fournisseur vous donne une VRAIE IP publique (pas CGNAT) ; │
  │   2. la box redirige le port 3000 vers cette machine ;                 │
  │   3. votre box reste allumée, avec la même IP.                        │
  │                                                                       │
  │ Et il n'y aura PAS de cadenas HTTPS : les mots de passe circulent en  │
  │ clair. Acceptable pour une démonstration, risqué pour des notes       │
  │ d'élèves réelles.                                                     │
  └───────────────────────────────────────────────────────────────────────┘

  1) Vérifier si vous êtes en CGNAT
     · ouvrez l'interface de votre box (souvent http://192.168.1.1)
     · cherchez « IP WAN » / « Adresse Internet »
     · si elle est IDENTIQUE à $pub  → bonne nouvelle, l'IP est publique
     · si elle est différente (souvent 10.x, 100.64.x) → CGNAT : cette voie
       ne marchera pas, utilisez --tailscale (gratuit, sans carte)

  2) Rediriger le port (dans la box : NAT / Redirection de ports)
     Port externe  : ${PORT}
     Port interne  : ${PORT}
     Protocole     : TCP
     Destinataire  : ${loc:-IP locale de cette machine}

  3) Tester depuis un téléphone en 4G (pas en Wi-Fi) :
     http://${pub}:${PORT}

EOF
  if site_repond; then
    ok "Le site tourne bien sur cette machine (port ${PORT})"
  else
    alerte "Le site ne tourne pas encore : lancez « npm run partage » dans un autre terminal."
  fi

  cat <<EOF
  ℹ Sur un Chromebook, le conteneur Linux est isolé : la box ne peut pas
    atteindre le port ${PORT} du conteneur. Cette voie suppose un PC classique
    (Windows, Mac ou Linux) allumé en permanence.
    → Sur Chromebook, utilisez --tailscale : c'est fait pour ce cas.

EOF
}

# ===========================================================================
# 2. Tailscale Funnel — HTTPS stable, sans carte, sans ouvrir de port
# ===========================================================================
mode_tailscale() {
  titre "Adresse HTTPS stable avec Tailscale (gratuit, sans carte)"

  if ! command -v tailscale >/dev/null; then
    info "Installation de Tailscale…"
    if command -v curl >/dev/null; then
      curl -fsSL https://tailscale.com/install.sh | sh || {
        erreur "Installation impossible. Vérifiez la connexion, ou installez à la main :"
        echo "   curl -fsSL https://tailscale.com/install.sh | sh"
        return 1
      }
    else
      erreur "curl est requis : sudo apt install curl"; return 1
    fi
  fi
  TS="$(command -v tailscale)"
  if [ -z "$TS" ]; then
    for c in /usr/bin/tailscale /usr/local/bin/tailscale /usr/sbin/tailscale; do
      [ -x "$c" ] && TS="$c" && break
    done
  fi
  [ -z "$TS" ] && { erreur "Tailscale installé mais introuvable. Fermez et rouvrez le terminal."; return 1; }
  ok "Tailscale : $("$TS" version 2>/dev/null | head -n1 || echo 'installé')"

  # Chromebook : systemd absent → le démon ne redémarre pas tout seul.
  if ! tailscale status >/dev/null 2>&1; then
    if systemctl is-active --quiet tailscaled 2>/dev/null; then
      :
    else
      info "Démarrage du démon Tailscale (mode sans systemd)…"
      sudo mkdir -p /var/lib/tailscale
      sudo nohup tailscaled --state=/var/lib/tailscale/tailscaled.state \
        --tun=userspace-networking >> /var/log/tailscaled.log 2>&1 &
      for i in $(seq 1 10); do sleep 1; tailscale status >/dev/null 2>&1 && break; done
    fi
  fi
  if ! tailscale status >/dev/null 2>&1; then
    alerte "Connexion au réseau Tailscale nécessaire (une seule fois)."
    cat <<'EOF'
  Une adresse va s'afficher : ouvrez-la dans Chrome et connectez-vous avec un
  compte Google ou GitHub. Aucune carte bancaire n'est demandée.
EOF
    sudo "$TS" up || { erreur "Connexion Tailscale interrompue."; return 1; }
  fi
  ok "Machine connectée : $(tailscale status --json 2>/dev/null | grep -o '"DNSName":"[^"]*' | head -n1 | cut -d'"' -f4 || echo 'ok')"

  NOM="$(tailscale status --json 2>/dev/null | grep -o '"DNSName":"[^"]*' | head -n1 | cut -d'"' -f4 | sed 's/\.$//')"
  [ -z "$NOM" ] && NOM="$(hostname).$(tailscale status --json 2>/dev/null | grep -o '"MagicDNSSuffix":"[^"]*' | cut -d'"' -f4)"

  echo
  alerte "Avant la première ouverture publique, activez deux options (2 clics, gratuit) :"
  cat <<EOF
    1. https://login.tailscale.com/admin/dns
       → « MagicDNS » : activé
       → « HTTPS Certificates » : Enable HTTPS
    2. Vérifier que le site tourne : npm run partage   (autre terminal)

  Puis, ici, ouvrir le tunnel public :

      sudo tailscale funnel --bg ${PORT}

  L'adresse stable sera :  https://${NOM}
  (elle ne changera plus, même après redémarrage du Chromebook)

  ℹ Le nom de la machine fait partie de l'adresse. Pour un nom plus parlant
    (terminish-ecole au lieu de penguin), renommez-la MAINTENANT :
    https://login.tailscale.com/admin/machines → ⋯ → Edit machine name
    Une fois le lien distribué aux écoles, ne le renommez plus.

  Vérifier plus tard :
      sudo tailscale funnel status
      sudo tailscale funnel --bg off     # fermer l'accès public
EOF

  if site_repond; then
    info "Le site répond en local : ouverture du tunnel…"
    if sudo "$TS" funnel --bg "${PORT}" > /tmp/ts-funnel.log 2>&1; then
      cat /tmp/ts-funnel.log 2>/dev/null
      URL="$(grep -oE 'https://[a-z0-9.-]+\.ts\.net' /tmp/ts-funnel.log | head -n1)"
      [ -z "$URL" ] && URL="https://${NOM}"
      echo
      ok "SITE EN LIGNE : ${URL}"
      echo "   Console admin : ${URL}/app"
      echo "   Vérification :  sudo tailscale funnel status"
      printf '%s\n' "$URL" > "$DATA_DIR/lien-stable.txt" 2>/dev/null || true
    else
      cat /tmp/ts-funnel.log 2>/dev/null
      local lienf
      lienf="$(grep -oE 'https://login\.tailscale\.com/f/funnel[^ ]*' /tmp/ts-funnel.log 2>/dev/null | head -n1)"
      if [ -n "$lienf" ]; then
        echo
        alerte "Funnel n'est pas encore autorisé sur votre réseau (une seule fois) :"
        echo "   1. ouvrez ce lien dans Chrome :"
        echo "        ${lienf}"
        echo "   2. cliquez « Enable Funnel » (ou « Activer »)"
        echo "   3. attendez 10 secondes, puis relancez cette commande"
        return 0
      fi
      if grep -qi 'https.*not enabled\|HTTPS is not enabled' /tmp/ts-funnel.log 2>/dev/null; then
        echo
        alerte "Le HTTPS n'est pas encore actif pour votre réseau :"
        echo "   1. https://login.tailscale.com/admin/dns → « Enable HTTPS »"
        echo "   2. attendez 1 minute (émission du certificat)"
        echo "   3. relancez cette commande"
        return 0
      fi
      erreur "Le tunnel n'a pas pu s'ouvrir."
      echo "   Causes fréquentes : HTTPS pas encore activé (console Tailscale),"
      echo "   ou MagicDNS désactivé. Voir les messages ci-dessus."
    fi
  else
    alerte "Le site ne tourne pas encore sur le port ${PORT}."
    echo "   Lancez d'abord, dans un autre terminal :  npm run partage"
    echo "   puis relancez :  bash deploy/gratuit/lien-stable.sh --tailscale"
  fi
}

# ===========================================================================
# 3. DuckDNS — nom fixe gratuit (sans carte) vers votre IP publique
# ===========================================================================
mode_duckdns() {
  titre "Nom de domaine fixe gratuit (DuckDNS)"
  if [ -z "$DUCKDNS_NOM" ] || [ -z "$DUCKDNS_TOKEN" ]; then
    cat <<'EOF'
  Créez d'abord un sous-domaine gratuit (aucune carte) :
    1. https://www.duckdns.org → connexion Google ou GitHub
    2. « add domain » : par exemple  terminish
    3. copiez le « token » affiché en haut de la page

  Puis relancez :
    bash deploy/gratuit/lien-stable.sh --duckdns terminish VOTRE_TOKEN
EOF
    return 1
  fi

  local rep
  rep="$(curl -fsS --max-time 10 "https://www.duckdns.org/update?domains=${DUCKDNS_NOM}&token=${DUCKDNS_TOKEN}&ip=" 2>/dev/null || echo KO)"
  if [ "$rep" = "OK" ]; then
    ok "Adresse mise à jour : https://${DUCKDNS_NOM}.duckdns.org (DNS : ${DUCKDNS_NOM}.duckdns.org)"
  else
    erreur "Mise à jour refusée (réponse : ${rep}). Vérifiez le nom et le token."
    return 1
  fi

  # tâche d'entretien : l'IP change, le nom doit suivre
  local script="$HOME/duckdns/duck.sh"
  mkdir -p "$HOME/duckdns"
  cat > "$script" <<EOF
#!/bin/sh
# Terminish — met à jour ${DUCKDNS_NOM}.duckdns.org vers l'IP publique courante
echo url="https://www.duckdns.org/update?domains=${DUCKDNS_NOM}&token=${DUCKDNS_TOKEN}&ip=" | curl -k -o "$HOME/duckdns/duck.log" -K -
EOF
  chmod 700 "$script"
  ( crontab -l 2>/dev/null | grep -v "duckdns/duck.sh" ; echo "*/5 * * * * $script >/dev/null 2>&1" ) | crontab - 2>/dev/null \
    && ok "Mise à jour automatique toutes les 5 minutes (cron)" \
    || alerte "Ajoutez à la main dans crontab -e : */5 * * * * $script"

  cat <<EOF

  ⚠ Il reste à rediriger le port ${PORT} dans la box (voir --ip) et à servir
    en HTTPS (reverse proxy Caddy ou certificat). Sans HTTPS, le navigateur
    affichera « non sécurisé » et les mots de passe circuleront en clair.

EOF
}

# ===========================================================================
# 4. État
# ===========================================================================
mode_etat() {
  titre "État de l'accès"
  site_repond && ok "Application : en marche sur le port ${PORT}" || alerte "Application : arrêtée"

  local ip; ip="$(ip_publique || echo '?')"
  info "IP publique : ${ip}"

  if command -v tailscale >/dev/null; then
    ok "Tailscale installé"
    local ts; ts="$(command -v tailscale)"
    if tailscale status >/dev/null 2>&1; then
      info "  connecté : $(tailscale status 2>/dev/null | head -n1 | sed 's/^ *//')"
    else
      alerte "  non connecté (sudo tailscale up)"
    fi
    if sudo "$ts" funnel status 2>/dev/null | grep -q "https://"; then
      local url; url="$(sudo "$ts" funnel status 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.ts\.net' | head -n1)"
      ok "Adresse stable : ${url}"
      if ! site_repond; then
        echo
        alerte "C'est la cause du « HTTP ERROR 502 » : le tunnel est ouvert mais"
        echo "   le site n'est PAS démarré sur le port ${PORT}."
        echo "   → npm run partage          (ou, pour ne plus y penser :"
        echo "      bash deploy/gratuit/service-auto.sh --installer )"
      fi
    else
      info "  aucun tunnel public ouvert (sudo tailscale funnel --bg ${PORT})"
    fi
  else
    info "Tailscale non installé (--tailscale pour l'installer)"
  fi

  [ -f "$DATA_DIR/lien-stable.txt" ] && info "Dernier lien stable connu : $(cat "$DATA_DIR/lien-stable.txt")"
  echo
  echo "  Rappel : le lien trycloudflare (npm run partage) est ÉPHÉMÈRE."
  echo "           Seul un nom .ts.net (Tailscale) ou votre IP/DDNS est stable."
}

case "$MODE" in
  ip)        mode_ip ;;
  tailscale) mode_tailscale ;;
  duckdns)   mode_duckdns ;;
  etat)      mode_etat ;;
esac
