#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Terminish École — installation et lancement sur Linux (0 F)
#
#   bash deploy/gratuit/installer-linux.sh              → site + lien public HTTPS
#   bash deploy/gratuit/installer-linux.sh --demo       → avec l'école de démonstration
#   bash deploy/gratuit/installer-linux.sh --local      → sans lien public (Wi-Fi)
#   bash deploy/gratuit/installer-linux.sh --verifier   → contrôle seulement, sans rien installer
#
# Aucun droit administrateur nécessaire : cloudflared est installé dans ~/.local/bin.
# ---------------------------------------------------------------------------
set -euo pipefail

VERT=$'\033[32m'; JAUNE=$'\033[33m'; ROUGE=$'\033[31m'; GRIS=$'\033[90m'; RAZ=$'\033[0m'
ok()    { printf '%s✔%s %s\n' "$VERT" "$RAZ" "$*"; }
info()  { printf '%s•%s %s\n' "$GRIS" "$RAZ" "$*"; }
alerte(){ printf '%s!%s %s\n' "$JAUNE" "$RAZ" "$*"; }
erreur(){ printf '%s✘%s %s\n' "$ROUGE" "$RAZ" "$*" >&2; }

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RACINE"

MODE_DEMO=0
MODE_LOCAL=0
VERIFIER=0
TRANSFERES=()          # options transmises telles quelles au lanceur (--port, …)
while [ $# -gt 0 ]; do
  case "$1" in
    --demo) MODE_DEMO=1 ;;
    --local|--sans-tunnel) MODE_LOCAL=1 ;;
    --verifier|--check) VERIFIER=1 ;;
    --port) TRANSFERES+=("--port" "${2:-3000}"); shift ;;
    -h|--help)
      sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) TRANSFERES+=("$1") ;;
  esac
  shift
done

printf '\n%s\n' '────────────────────────────────────────────────────────────'
printf '  Terminish École — installation Linux\n'
printf '%s\n\n' '────────────────────────────────────────────────────────────'

# --- 1. Système ------------------------------------------------------------
DISTRO="inconnue"
if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  DISTRO="${PRETTY_NAME:-${ID:-inconnue}}"
fi
info "Système : $DISTRO ($(uname -m))"

# --- 2. Node.js ------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  erreur "Node.js n'est pas installé."
  cat <<'FIN'

  Installez Node.js 22 (au choix) :

  · Ubuntu / Debian (avec votre mot de passe) :
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
      sudo apt install -y nodejs

  · Fedora / Rocky :
      sudo dnf install -y nodejs22

  · Arch / Manjaro :
      sudo pacman -S --needed nodejs npm

  · Sans droits administrateur (nvm, recommandé) :
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
      source ~/.bashrc
      nvm install 22

  Puis relancez : bash deploy/gratuit/installer-linux.sh

FIN
  exit 1
fi

VERSION_NODE="$(node -v)"
MAJEUR_NODE="$(printf '%s' "$VERSION_NODE" | sed 's/^v//' | cut -d. -f1)"
if [ "$MAJEUR_NODE" -lt 22 ]; then
  erreur "Node.js $VERSION_NODE est trop ancien : il faut la version 22 ou plus."
  cat <<'FIN'

  · Ubuntu / Debian : curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
  · nvm (aucun droit admin) : nvm install 22 && nvm use 22
  · Fedora / Arch : sudo dnf install -y nodejs22 / sudo pacman -S nodejs

FIN
  exit 1
fi
ok "Node.js $VERSION_NODE"

# --- 3. Dépendances --------------------------------------------------------
if [ ! -d node_modules/express ]; then
  info "Installation des dépendances npm…"
  if ! npm install --omit=dev --no-audit --no-fund; then
    erreur "L'installation a échoué. Vérifiez votre connexion Internet, puis relancez."
    exit 1
  fi
fi
ok "Dépendances en place"

# --- 4. cloudflared (lien public gratuit) ---------------------------------
CLOUDFLARED="$(command -v cloudflared || true)"
if [ -z "$CLOUDFLARED" ] && [ -x "$HOME/.local/bin/cloudflared" ]; then
  CLOUDFLARED="$HOME/.local/bin/cloudflared"
  case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac
fi

if [ -z "$CLOUDFLARED" ] && [ "$MODE_LOCAL" -eq 0 ] && [ "$VERIFIER" -eq 0 ]; then
  case "$(uname -m)" in
    x86_64|amd64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    armv7l|armv6l) ARCH="arm" ;;
    *) ARCH="" ;;
  esac
  if [ -n "$ARCH" ] && command -v curl >/dev/null 2>&1; then
    info "Téléchargement de cloudflared ($ARCH) dans ~/.local/bin…"
    mkdir -p "$HOME/.local/bin"
    if curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH" \
         -o "$HOME/.local/bin/cloudflared.tmp"; then
      chmod +x "$HOME/.local/bin/cloudflared.tmp"
      mv "$HOME/.local/bin/cloudflared.tmp" "$HOME/.local/bin/cloudflared"
      CLOUDFLARED="$HOME/.local/bin/cloudflared"
      export PATH="$HOME/.local/bin:$PATH"
      ok "cloudflared installé (sans sudo)"
    else
      rm -f "$HOME/.local/bin/cloudflared.tmp" 2>/dev/null || true
      alerte "Téléchargement impossible (réseau ou proxy). Le site fonctionnera en local seulement."
      alerte "Plus tard : sudo apt install cloudflared   (voir DEPLOIEMENT-GRATUIT.md)"
      MODE_LOCAL=1
    fi
  else
    alerte "Téléchargement de cloudflared non possible ici : le site restera local."
    MODE_LOCAL=1
  fi
fi

if [ -n "$CLOUDFLARED" ]; then
  ok "cloudflared : $("$CLOUDFLARED" --version 2>/dev/null | head -n1 || echo version inconnue)"
elif [ "$MODE_LOCAL" -eq 0 ]; then
  alerte "cloudflared absent : aucun lien public (site accessible sur le réseau local)."
fi

# --- 5. Fin du contrôle ----------------------------------------------------
if [ "$VERIFIER" -eq 1 ]; then
  printf '\n%s\n' '────────────────────────────────────────────────────────────'
  ok "Tout est prêt. Lancez maintenant :"
  echo "     npm run partage        (site + lien public)"
  echo "     npm run partage:demo   (avec l'école de démonstration)"
  printf '%s\n\n' '────────────────────────────────────────────────────────────'
  exit 0
fi

# --- 6. Lancement ----------------------------------------------------------
ARGS=("${TRANSFERES[@]}")
[ "$MODE_DEMO" -eq 1 ] && ARGS+=(--demo)
[ "$MODE_LOCAL" -eq 1 ] && ARGS+=(--sans-tunnel)

printf '\n%s\n' '────────────────────────────────────────────────────────────'
info "Démarrage… (Ctrl+C pour arrêter le site)"
printf '%s\n' '────────────────────────────────────────────────────────────'

exec node deploy/gratuit/demarrer.js "${ARGS[@]}"
