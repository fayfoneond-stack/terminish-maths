#!/usr/bin/env bash
# =============================================================================
# Terminish École — le site tourne tout seul, en arrière-plan
# -----------------------------------------------------------------------------
# Problème résolu : « Cette page ne fonctionne pas / HTTP ERROR 502 ».
# Le 502 ne vient pas de Tailscale : il signifie que le site n'est pas démarré
# sur le port 3000 (fenêtre fermée, veille, redémarrage du Chromebook).
#
# Ce script installe le site comme service de session (systemd) avec relance
# automatique ; si systemd n'est pas disponible dans le conteneur Linux du
# Chromebook, il bascule sur un lancement détaché (setsid) et explique comment
# le relancer à la main.
#
#   bash deploy/gratuit/service-auto.sh --installer   # site toujours démarré
#   bash deploy/gratuit/service-auto.sh --etat        # ça tourne ? lequel ?
#   bash deploy/gratuit/service-auto.sh --arreter
#   bash deploy/gratuit/service-auto.sh --redemarrer
#   bash deploy/gratuit/service-auto.sh --journaux
#   bash deploy/gratuit/service-auto.sh --simulation  # affiche sans installer
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
ACTION="${1:---etat}"

vert()  { printf '\033[32m✔\033[0m %s\n' "$1"; }
rouge() { printf '\033[31m✘\033[0m %s\n' "$1"; }
jaune() { printf '\033[33m!\033[0m %s\n' "$1"; }
info()  { printf '\033[90m•\033[0m %s\n' "$1"; }

site_repond() {
  if command -v curl >/dev/null; then
    curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1
  else
    "$NODE_BIN" -e "fetch('http://127.0.0.1:${PORT}/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1
  fi
}

systemd_dispo() {
  systemctl --user show-environment >/dev/null 2>&1
}

unite_contenu() {
  cat <<EOF
# Terminish École — site scolaire (généré par deploy/gratuit/service-auto.sh)
# Redémarrer : systemctl --user restart ${NOM}
# Journaux    : journalctl --user -u ${NOM} -f
[Unit]
Description=Terminish École — site scolaire (port ${PORT})
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${RACINE}
Environment=TERMINISH_SEED=prod
Environment=PORT=${PORT}
Environment=TERMINISH_DATA_DIR=${DATA_DIR}
ExecStart=${NODE_BIN} ${RACINE}/server/index.js
Restart=always
RestartSec=5
# Un arrêt propre laisse le temps d'écrire la base.
KillSignal=SIGINT
TimeoutStopSec=15
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF
}

# ------------------------------------------------------------------ installer
installer() {
  echo
  echo "── Installation du service (une seule fois) ─────────────────────"
  if [ -z "$NODE_BIN" ]; then
    rouge "Node.js introuvable. Installez-le (https://nodejs.org), puis relancez."; return 1
  fi
  if [ ! -d "$RACINE/node_modules/express" ]; then
    info "Dépendances manquantes : npm ci --omit=dev…"
    ( cd "$RACINE" && npm ci --omit=dev ) || { rouge "npm ci a échoué."; return 1; }
  fi
  mkdir -p "$DATA_DIR"

  if systemd_dispo; then
    mkdir -p "$(dirname "$UNITE")"
    unite_contenu > "$UNITE"
    systemctl --user daemon-reload
    systemctl --user enable --now "$NOM" >/dev/null 2>&1
    # Démarre même sans session ouverte (indispensable sur un Chromebook)
    loginctl enable-linger "$USER" >/dev/null 2>&1 || \
      jaune "« loginctl enable-linger » a échoué : le site démarrera à l'ouverture de session."
    sleep 3
    if site_repond; then
      vert "Service installé et site démarré sur le port ${PORT}."
      info "Fichier : ${UNITE}"
      info "Redémarrer : systemctl --user restart ${NOM}"
      info "Journaux   : journalctl --user -u ${NOM} -f"
    else
      rouge "Le service est installé mais le site ne répond pas encore."
      echo "   Voir : journalctl --user -u ${NOM} -n 30"
    fi
  else
    jaune "systemd n'est pas disponible dans ce conteneur : lancement détaché."
    demarrer_fond
  fi

  # Tailscale : le tunnel persiste, mais on le réapplique s'il pointe dans le vide.
  if command -v tailscale >/dev/null; then
    local ts; ts="$(command -v tailscale)"
    if sudo "$ts" funnel status 2>/dev/null | grep -q "https://"; then
      vert "Tunnel public Tailscale déjà ouvert (rien à faire)."
    else
      info "Ouverture du tunnel public…"
      sudo "$ts" funnel --bg "$PORT" 2>&1 | tail -3
    fi
  fi

  echo
  bash "${BASH_SOURCE[0]}" --etat
}

demarrer_fond() {
  if site_repond; then info "Le site répond déjà : rien à faire."; return 0; fi
  : > "$JOURNAL" 2>/dev/null || true
  setsid env TERMINISH_SEED=prod PORT="$PORT" TERMINISH_DATA_DIR="$DATA_DIR" \
    nohup "$NODE_BIN" "$RACINE/server/index.js" >> "$JOURNAL" 2>&1 < /dev/null &
  local pid="$!"
  echo "$pid" > "$PIDFILE" 2>/dev/null || true
  sleep 3
  if site_repond; then
    vert "Site démarré en arrière-plan (processus ${pid})."
    info "Journaux : tail -f ${JOURNAL}"
    echo
    echo "   ⚠ Un lancement détaché meurt si le conteneur Linux est redémarré"
    echo "     (fermeture de session ChromeOS). Pour relancer :"
    echo "       bash deploy/gratuit/service-auto.sh --installer"
  else
    rouge "Le site n'a pas démarré. Dernières lignes du journal :"
    tail -n 15 "$JOURNAL" 2>/dev/null
    return 1
  fi
}

arreter() {
  if systemd_dispo && systemctl --user is-active "$NOM" >/dev/null 2>&1; then
    systemctl --user stop "$NOM" && vert "Service arrêté."
  fi
  if [ -f "$PIDFILE" ]; then
    local p; p="$(cat "$PIDFILE" 2>/dev/null)"
    [ -n "$p" ] && kill "$p" 2>/dev/null && vert "Processus ${p} arrêté."
    rm -f "$PIDFILE"
  fi
  # dernier recours : tuer ce qui écoute sur le port
  local p2; p2="$(ss -ltnp 2>/dev/null | grep ":${PORT} " | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)"
  [ -n "${p2:-}" ] && kill "$p2" 2>/dev/null && vert "Port ${PORT} libéré (processus ${p2})."
  site_repond && jaune "Quelque chose répond encore sur ${PORT}." || info "Port ${PORT} libre."
}

etat() {
  echo
  echo "── État du site ────────────────────────────────────────────────"
  if site_repond; then vert "Le site répond sur le port ${PORT}"; else rouge "Le site NE répond PAS sur le port ${PORT}"; fi

  if systemd_dispo; then
    if systemctl --user is-enabled "$NOM" >/dev/null 2>&1; then
      local act; act="$(systemctl --user is-active "$NOM" 2>/dev/null)"
      info "Service systemd : ${act} (démarrage automatique actif)"
    else
      info "Service systemd : non installé (--installer pour le mettre en place)"
    fi
  else
    info "systemd : indisponible dans ce conteneur (lancement détaché)"
  fi

  if [ -f "$PIDFILE" ]; then
    local p; p="$(cat "$PIDFILE" 2>/dev/null)"
    if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then info "Processus détaché : ${p} (vivant)"; else info "Processus détaché : ${p:-?} (mort)"; fi
  fi

  if command -v tailscale >/dev/null; then
    local ts; ts="$(command -v tailscale)"
    local url; url="$(sudo "$ts" funnel status 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.ts\.net' | head -n1)"
    if [ -n "$url" ]; then
      vert "Tunnel public : ${url}"
      if site_repond; then
        info "Chaîne complète : Internet → ${url} → port ${PORT} ✔"
      else
        echo
        jaune "C'est la cause du « HTTP ERROR 502 » :"
        echo "   Tailscale joint bien votre machine (le nom et le certificat"
        echo "   fonctionnent), mais il n'y a RIEN sur le port ${PORT}."
        echo "   → démarrez le site :  bash deploy/gratuit/service-auto.sh --installer"
      fi
    else
      info "Tunnel public : aucun (sudo tailscale funnel --bg ${PORT})"
    fi
  else
    info "Tailscale : non installé"
  fi

  if [ -f "$JOURNAL" ]; then
    echo
    info "Dernières lignes du journal (${JOURNAL}) :"
    tail -n 6 "$JOURNAL" | sed 's/^/     /'
  fi
  echo
}

case "$ACTION" in
  --installer|--install) installer ;;
  --etat|--status|"")    etat ;;
  --arreter|--stop)      arreter; echo; etat ;;
  --redemarrer|--restart)
    if systemd_dispo && systemctl --user is-enabled "$NOM" >/dev/null 2>&1; then
      systemctl --user restart "$NOM" && sleep 3 && vert "Service relancé."
    else
      arreter >/dev/null 2>&1; demarrer_fond
    fi
    echo; etat ;;
  --journaux|--logs)
    if systemd_dispo && systemctl --user is-enabled "$NOM" >/dev/null 2>&1; then
      journalctl --user -u "$NOM" -n 60 --no-pager
    else
      tail -n 60 "$JOURNAL" 2>/dev/null || echo "Aucun journal : le site n'a jamais été lancé par ce script."
    fi ;;
  --simulation)
    echo "── Fichier ${UNITE} qui serait installé ──"
    unite_contenu
    echo
    echo "Node détecté : ${NODE_BIN:-INTROUVABLE}"
    echo "Dossier      : ${RACINE}"
    echo "Données      : ${DATA_DIR}"
    echo "Port         : ${PORT}"
    echo "systemd      : $(systemd_dispo && echo disponible || echo indisponible)" ;;
  *)
    echo "Usage : bash deploy/gratuit/service-auto.sh [--installer|--etat|--arreter|--redemarrer|--journaux|--simulation]"
    exit 1 ;;
esac
