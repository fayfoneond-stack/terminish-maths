#!/usr/bin/env bash
# =============================================================================
# Terminish École — « je veux juste que ça marche »
# -----------------------------------------------------------------------------
# Une seule commande qui remet TOUT en route, dans le bon ordre :
#
#   1. les dépendances (si absentes)
#   2. le site sur le port 3000 (service systemd, sinon lancement détaché)
#   3. Tailscale : connecté ? (sinon « tailscale up »)
#   4. le tunnel public : ouvert ? (sinon « tailscale funnel --bg »)
#   5. un test réel de bout en bout + l'adresse à utiliser
#
# À relancer après chaque redémarrage du Chromebook (ou mise en veille longue).
#
#   bash deploy/gratuit/tout.sh
#   bash deploy/gratuit/tout.sh --verifier    # ne change rien, juste l'état
# =============================================================================
set -uo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3000}"
DATA_DIR="${TERMINISH_DATA_DIR:-$RACINE/data}"
NOM="terminish-ecole"
UNITE="$HOME/.config/systemd/user/${NOM}.service"
JOURNAL="$DATA_DIR/journal-site.log"
PIDFILE="$DATA_DIR/site.pid"
NODE_BIN="$(command -v node || true)"
VERIFIER_SEULEMENT="${1:-}" 

vert()  { printf '  \033[32m✔\033[0m %s\n' "$1"; }
rouge() { printf '  \033[31m✘\033[0m %s\n' "$1"; }
jaune() { printf '  \033[33m!\033[0m %s\n' "$1"; }
etape() { printf '\n\033[1m%s\033[0m\n' "$1"; }
info()  { printf '    \033[90m%s\033[0m\n' "$1"; }

site_repond() {
  if command -v curl >/dev/null; then
    curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1
  else
    "$NODE_BIN" -e "fetch('http://127.0.0.1:${PORT}/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1
  fi
}
systemd_dispo() { systemctl --user show-environment >/dev/null 2>&1; }
ts() { command -v tailscale 2>/dev/null || echo ""; }
ts_etat() {   # Running | NeedsLogin | Stopped | Absent
  local b; b="$(ts)"; [ -z "$b" ] && { echo Absent; return; }
  local s; s="$("$b" status --json 2>/dev/null | grep -o '"BackendState":"[^"]*"' | head -n1 | cut -d'"' -f4)"
  echo "${s:-Stopped}"
}
nom_tailscale() {
  local b; b="$(ts)"; [ -z "$b" ] && return
  "$b" status --json 2>/dev/null | grep -o '"DNSName":"[^"]*"' | head -n1 | cut -d'"' -f4 | sed 's/\.$//'
}
url_funnel() {
  local b; b="$(ts)"; [ -z "$b" ] && return
  sudo "$b" funnel status 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.ts\.net' | head -n1
}

echo
echo "══════════════════════════════════════════════════════════════"
echo "  TERMINISH ÉCOLE — remise en route complète"
echo "  dossier : ${RACINE}"
echo "  port    : ${PORT}"
echo "══════════════════════════════════════════════════════════════"

# ---------------------------------------------------------------- 1. Node/npm
etape "1/5 · Vérifications"
if [ -z "$NODE_BIN" ]; then
  rouge "Node.js introuvable. Installez Node 22+ (https://nodejs.org), puis relancez."
  exit 1
fi
vert "Node.js $("$NODE_BIN" --version)"
if [ ! -d "$RACINE/node_modules/express" ]; then
  if [ "$VERIFIER_SEULEMENT" = "--verifier" ]; then
    rouge "Dépendances manquantes (npm ci --omit=dev)."
  else
    info "Installation des dépendances (une seule fois)…"
    ( cd "$RACINE" && npm ci --omit=dev >/dev/null 2>&1 ) \
      && vert "Dépendances installées" || { rouge "npm ci a échoué (connexion ?)"; exit 1; }
  fi
else
  vert "Dépendances présentes"
fi

# ---------------------------------------------------------------- 2. Le site
etape "2/5 · Le site (port ${PORT})"
if site_repond; then
  vert "Le site répond déjà — rien à faire"
elif [ "$VERIFIER_SEULEMENT" = "--verifier" ]; then
  rouge "Le site ne répond pas"
  echo "        → bash deploy/gratuit/tout.sh"
else
  mkdir -p "$DATA_DIR"
  if systemd_dispo && [ -f "$UNITE" ]; then
    info "Redémarrage du service systemd…"
    systemctl --user restart "$NOM" >/dev/null 2>&1
    for i in 1 2 3 4 5 6 7 8; do sleep 1; site_repond && break; done
    if site_repond; then
      vert "Site démarré par le service"
    else
      rouge "Le service ne démarre pas. Dernières lignes :"
      journalctl --user -u "$NOM" -n 10 --no-pager 2>/dev/null | sed 's/^/        /'
    fi
  fi
  if ! site_repond; then
    info "Lancement direct en arrière-plan…"
    : > "$JOURNAL" 2>/dev/null || true
    setsid env TERMINISH_SEED=prod PORT="$PORT" TERMINISH_DATA_DIR="$DATA_DIR" \
      nohup "$NODE_BIN" "$RACINE/server/index.js" >> "$JOURNAL" 2>&1 < /dev/null &
    local_pid="$!"
    echo "$local_pid" > "$PIDFILE" 2>/dev/null || true
    for i in 1 2 3 4 5 6 7 8; do sleep 1; site_repond && break; done
    if site_repond; then
      vert "Site démarré (processus ${local_pid})"
    else
      rouge "Le site n'a pas démarré. Journal :"
      tail -n 12 "$JOURNAL" 2>/dev/null | sed 's/^/        /'
    fi
  fi
fi

# ------------------------------------------------------------ 3. Tailscale
etape "3/5 · Tailscale (le réseau privé qui porte le lien public)"
ETAT_TS="$(ts_etat)"
case "$ETAT_TS" in
  Absent)
    rouge "Tailscale n'est pas installé."
    if [ "$VERIFIER_SEULEMENT" != "--verifier" ]; then
      info "Installation : curl -fsSL https://tailscale.com/install.sh | sh"
      curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1 \
        && vert "Tailscale installé" || { rouge "Installation impossible"; exit 1; }
      echo "    → puis : sudo tailscale up   (connexion Google/GitHub, sans carte)"
      exit 1
    fi ;;
  NeedsLogin)
    rouge "Tailscale est installé mais la session a expiré."
    echo "        → sudo tailscale up   (ouvrez l'adresse affichée dans Chrome)"
    if [ "$VERIFIER_SEULEMENT" != "--verifier" ]; then sudo "$(ts)" up; fi ;;
  Stopped)
    rouge "Tailscale est arrêté."
    if [ "$VERIFIER_SEULEMENT" != "--verifier" ]; then
      sudo "$(ts)" up || { rouge "Connexion Tailscale impossible"; exit 1; }
      sleep 2
    fi ;;
  Running) vert "Tailscale connecté ($(nom_tailscale))" ;;
  *) jaune "État Tailscale inconnu : ${ETAT_TS}" ;;
esac

# --------------------------------------------------------------- 4. Le tunnel
etape "4/5 · Le tunnel public"
if [ "$(ts_etat)" != "Running" ]; then
  rouge "Impossible d'ouvrir le tunnel tant que Tailscale n'est pas connecté."
  echo "        → sudo tailscale up"
else
  URL="$(url_funnel)"
  if [ -n "$URL" ]; then
    vert "Tunnel déjà ouvert : ${URL}"
  elif [ "$VERIFIER_SEULEMENT" = "--verifier" ]; then
    rouge "Aucun tunnel ouvert (le nom .ts.net ne résout pas → ERR_NAME_NOT_RESOLVED)"
  else
    info "Ouverture du tunnel sur le port ${PORT}…"
    SORTIE="$(sudo "$(ts)" funnel --bg "$PORT" 2>&1)"
    echo "$SORTIE" | sed 's/^/        /'
    URL="$(echo "$SORTIE" | grep -oE 'https://[a-z0-9.-]+\.ts\.net' | head -n1)"
    [ -z "$URL" ] && URL="$(url_funnel)"
    [ -z "$URL" ] && URL="https://$(nom_tailscale)"
    if echo "$SORTIE" | grep -qi 'funnel.*not enabled'; then
      echo
      rouge "Funnel n'est pas autorisé sur votre réseau (une seule fois)."
      echo "        Ouvrez ce lien dans Chrome, cliquez « Enable Funnel », puis relancez :"
      echo "        $(echo "$SORTIE" | grep -oE 'https://login\.tailscale\.com/f/funnel[^ ]*' | head -n1)"
      exit 1
    fi
    vert "Tunnel ouvert : ${URL}"
  fi
  [ -n "$URL" ] && printf '%s\n' "$URL" > "$DATA_DIR/lien-stable.txt" 2>/dev/null
fi

# ---------------------------------------------------------------- 5. Le test
etape "5/5 · Vérification de bout en bout"
site_repond && vert "Site local : OK (port ${PORT})" || rouge "Site local : INJOIGNABLE (port ${PORT})"
URL="$(url_funnel)"
if [ -n "$URL" ]; then
  vert "Tunnel : ${URL}"
  if command -v curl >/dev/null; then
    CODE="$(curl -s -o /dev/null -m 12 -w '%{http_code}' "${URL}/api/health" 2>/dev/null)"
    case "$CODE" in
      200) vert "Internet → ${URL} : OK (HTTP 200) — le lien fonctionne" ;;
      000) jaune "Pas de réponse depuis Internet (DNS en cours de propagation : attendez 30 s)" ;;
      502) rouge "HTTP 502 : le tunnel est ouvert mais le site n'écoute pas sur ${PORT}" ;;
      *)   jaune "Réponse HTTP ${CODE} (vérifiez dans le navigateur)" ;;
    esac
  fi
else
  rouge "Pas de tunnel : le nom .ts.net ne résoudra pas (ERR_NAME_NOT_RESOLVED)"
fi

echo
echo "──────────────────────────────────────────────────────────────"
if site_repond && [ -n "${URL:-}" ]; then
  echo "  LIEN À UTILISER :  ${URL}"
  echo "  Console admin   :  ${URL}/app"
else
  echo "  Quelque chose cloche encore : relisez les ✘ ci-dessus."
fi
echo "──────────────────────────────────────────────────────────────"
echo "  Après chaque redémarrage du Chromebook, une seule commande :"
echo "     bash deploy/gratuit/tout.sh"
echo
