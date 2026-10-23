#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Terminish École — rclone + compte MEGA (25 Go gratuits)
#
#   À exécuter SUR le serveur (alwaysdata, VPS, Chromebook…), sans sudo :
#       bash deploy/alwaysdata/rclone.sh --installer
#       bash deploy/alwaysdata/rclone.sh --configurer
#       bash deploy/alwaysdata/rclone.sh --verifier
#
#   Options :
#       --installer          télécharge le binaire rclone dans ~/bin
#       --configurer         crée le compte distant « mega » et le dossier
#       --verifier           contrôle binaire + connexion MEGA
#       --dossier NOM        dossier MEGA cible (défaut : Terminish)
#       --email / --motdepasse   identifiants MEGA (sinon demandés, ou $MEGA_EMAIL / $MEGA_PASSWORD)
#       --tester             envoie un fichier de test via l'application
#       -h | --help
#
#   Pourquoi rclone : MEGA n'a pas de SDK Node fiable côté serveur, et rclone
#   est un binaire unique, sans droits administrateur, qui sait aussi parler à
#   Google Drive, Dropbox, S3… Un seul outil pour tout.
#
#   ⚠ Avec la double authentification MEGA activée, rclone demande le code
#     à la création du compte distant (rclone config), pas par ce script.
# ---------------------------------------------------------------------------
set -uo pipefail

VERT=$'\033[32m'; JAUNE=$'\033[33m'; ROUGE=$'\033[31m'; GRIS=$'\033[90m'; RAZ=$'\033[0m'
ok()    { printf '%s✔%s %s\n' "$VERT" "$RAZ" "$*"; }
info()  { printf '%s•%s %s\n' "$GRIS" "$RAZ" "$*"; }
alerte(){ printf '%s!%s %s\n' "$JAUNE" "$RAZ" "$*"; }
erreur(){ printf '%s✘%s %s\n' "$ROUGE" "$RAZ" "$*" >&2; }
titre() { printf '\n%s\n  %s\n%s\n' '────────────────────────────────────────────────────────────' "$*" '────────────────────────────────────────────────────────────'; }

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BIN_DIR="$HOME/bin"
BINAIRE="$BIN_DIR/rclone"
DOSSIER="Terminish"
EMAIL="${MEGA_EMAIL:-}"
MDP="${MEGA_PASSWORD:-}"
ACTIONS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --installer)  ACTIONS+=("installer") ;;
    --configurer) ACTIONS+=("configurer") ;;
    --verifier)   ACTIONS+=("verifier") ;;
    --tester)     ACTIONS+=("tester") ;;
    --dossier)    DOSSIER="${2:-Terminish}"; shift ;;
    --email)      EMAIL="${2:-}"; shift ;;
    --motdepasse) MDP="${2:-}"; shift ;;
    -h|--help)    sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) erreur "Option inconnue : $1"; exit 1 ;;
  esac
  shift
done
[ ${#ACTIONS[@]} -eq 0 ] && ACTIONS=("verifier")

rclone_bin() {
  if [ -x "$BINAIRE" ]; then echo "$BINAIRE"; return 0; fi
  if command -v rclone >/dev/null 2>&1; then command -v rclone; return 0; fi
  return 1
}

# --- installer --------------------------------------------------------------
if printf '%s\n' "${ACTIONS[@]}" | grep -qx installer; then
  titre "Installation de rclone (sans droits administrateur)"
  if rclone_bin >/dev/null && [ -x "$BINAIRE" ]; then
    ok "Déjà installé : $(rclone_bin) ($("$(rclone_bin)" version | head -1))"
  else
    ARCH="$(uname -m)"
    case "$ARCH" in
      x86_64|amd64) RARCH="amd64" ;;
      aarch64|arm64) RARCH="arm64" ;;
      armv7l|armv6l) RARCH="arm" ;;
      *) erreur "Architecture non reconnue : $ARCH"; info "Téléchargez le binaire sur https://rclone.org/downloads/"; exit 1 ;;
    esac
    mkdir -p "$BIN_DIR"
    TMP="$(mktemp -d)"
    URL="https://downloads.rclone.org/rclone-current-linux-${RARCH}.zip"
    info "Téléchargement ($ARCH, environ 20 Mo)…"
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL "$URL" -o "$TMP/rclone.zip" || { erreur "Téléchargement impossible ($URL)"; rm -rf "$TMP"; exit 1; }
    else
      wget -q "$URL" -O "$TMP/rclone.zip" || { erreur "Téléchargement impossible"; rm -rf "$TMP"; exit 1; }
    fi
    if command -v unzip >/dev/null 2>&1; then
      unzip -q "$TMP/rclone.zip" -d "$TMP"
    else
      erreur "unzip est nécessaire pour décompresser rclone."
      info "Installez-le (apt install unzip) ou déposez le binaire manuellement dans ~/bin."
      rm -rf "$TMP"; exit 1
    fi
    TROUVE="$(find "$TMP" -type f -name rclone | head -1)"
    [ -z "$TROUVE" ] && { erreur "Binaire introuvable dans l'archive."; rm -rf "$TMP"; exit 1; }
    cp "$TROUVE" "$BINAIRE" && chmod 755 "$BINAIRE"
    rm -rf "$TMP"
    if [ -x "$BINAIRE" ]; then
      ok "rclone installé : $BINAIRE ($("$BINAIRE" version | head -1))"
      info "Chemin à mettre dans .env :  RCLONE_BIN=$BINAIRE"
    else
      erreur "L'installation a échoué."; exit 1
    fi
  fi
fi

RC="$(rclone_bin || true)"
if [ -z "$RC" ]; then
  alerte "rclone absent : lancez d'abord --installer"
fi

# --- configurer -------------------------------------------------------------
if printf '%s\n' "${ACTIONS[@]}" | grep -qx configurer; then
  titre "Compte MEGA"
  [ -z "$RC" ] && { erreur "rclone requis."; exit 1; }

  if "$RC" listremotes 2>/dev/null | grep -qx 'mega:'; then
    ok "Compte distant « mega » déjà configuré"
  else
    if [ -z "$EMAIL" ] && [ -t 0 ]; then
      printf '  Adresse email MEGA : '; read -r EMAIL
    fi
    if [ -z "$MDP" ] && [ -t 0 ]; then
      printf '  Mot de passe MEGA (invisible) : '; stty -echo; read -r MDP; stty echo; echo
    fi
    if [ -z "$EMAIL" ] || [ -z "$MDP" ]; then
      erreur "Email et mot de passe MEGA nécessaires."
      info "Variables possibles : MEGA_EMAIL / MEGA_PASSWORD, ou options --email / --motdepasse"
      info "Ou interactif (recommandé, gère la double authentification) : $RC config"
      exit 1
    fi
    info "Création du compte distant (le mot de passe est chiffré par rclone)…"
    if "$RC" config create mega mega user="$EMAIL" pass="$MDP" --non-interactive 2>&1 | sed 's/^/    /'; then
      ok "Compte distant « mega » créé"
    else
      erreur "Création impossible."
      info "Essayez l'assistant interactif (nécessaire si la double authentification est active) :"
      info "    $RC config     → n) New remote → mega → email → mot de passe"
      exit 1
    fi
  fi

  info "Création du dossier /$DOSSIER sur MEGA (s'il n'existe pas)…"
  "$RC" mkdir "mega:$DOSSIER" 2>&1 | sed 's/^/    /' || true
  if "$RC" lsd "mega:" >/dev/null 2>&1; then
    ok "Connexion MEGA vérifiée"
  else
    erreur "Connexion MEGA impossible (mot de passe ou double authentification ?)"
    info "Vérifiez à la main : $RC lsd mega:"
    exit 1
  fi

  # Écriture dans .env, sans toucher au reste du fichier
  DEBUT="# --- Terminish / stockage MEGA (géré par deploy/alwaysdata/rclone.sh) ---"
  FIN="# --- fin du bloc stockage MEGA ---"
  ENVFILE="$RACINE/.env"
  TMP="$(mktemp)"
  awk -v d="$DEBUT" -v f="$FIN" '$0==d{saut=1;next} $0==f{saut=0;next} saut!=1{print}' "$ENVFILE" 2>/dev/null > "$TMP" || : > "$TMP"
  {
    printf '%s\n' "$DEBUT"
    printf 'RCLONE_BIN=%s\n' "$RC"
    printf 'MEGA_RCLONE_REMOTE=mega:%s\n' "$DOSSIER"
    printf 'STORAGE_PROVIDERS=mega,local\n'
    printf '%s\n' "$FIN"
  } >> "$TMP"
  mv "$TMP" "$ENVFILE"
  ok ".env mis à jour : STORAGE_PROVIDERS=mega,local"
  info "Les signatures et logos partiront sur MEGA ; le disque local reste en secours."

  cat <<FIN

  ⚠ Le site doit être redémarré pour lire le nouveau .env :
       interface alwaysdata → Sites → Redémarrer
     (ou, sur un VPS :  systemctl restart terminish-ecole )

FIN
fi

# --- verifier ---------------------------------------------------------------
if printf '%s\n' "${ACTIONS[@]}" | grep -qx verifier; then
  titre "Vérification"
  if [ -n "$RC" ]; then
    ok "rclone : $RC ($("$RC" version | head -1))"
    if "$RC" listremotes 2>/dev/null | grep -qx 'mega:'; then
      ok "compte distant mega : présent"
      if timeout 25 "$RC" about mega: --json >/tmp/rclone-about.json 2>/dev/null; then
        node -e '
          try {
            const q = require("/tmp/rclone-about.json");
            const go = n => n ? (n/1073741824).toFixed(2) + " Go" : "—";
            console.log("  \033[32m✔\033[0m espace MEGA : " + go(q.used) + " utilisés / " + go(q.total) + " (libre " + go(q.free) + ")");
          } catch (_) {}
        ' 2>/dev/null || info "quota MEGA non communiqué (normal)"
      else
        info "quota MEGA non communiqué (normal)"
      fi
      if timeout 25 "$RC" lsd "mega:$DOSSIER" >/dev/null 2>&1; then
        ok "dossier mega:$DOSSIER accessible"
      else
        alerte "dossier mega:$DOSSIER introuvable — créez-le : $RC mkdir mega:$DOSSIER"
      fi
    else
      alerte "aucun compte distant « mega » (lancez --configurer)"
    fi
  else
    erreur "rclone absent"
  fi
  if [ -f "$RACINE/.env" ]; then
    ok ".env présent : $(grep -c . "$RACINE/.env") ligne(s)"
    grep -E '^STORAGE_PROVIDERS=|^MEGA_RCLONE_REMOTE=|^RCLONE_BIN=' "$RACINE/.env" 2>/dev/null | sed 's/^/    /'
    grep -q '^STORAGE_PROVIDERS=.*mega' "$RACINE/.env" || alerte "STORAGE_PROVIDERS n'inclut pas mega"
  else
    alerte ".env absent : lancez d'abord deploy/alwaysdata/installer.sh"
  fi
fi

# --- tester -----------------------------------------------------------------
if printf '%s\n' "${ACTIONS[@]}" | grep -qx tester; then
  titre "Envoi d'un fichier de test par l'application"
  if [ -d "$RACINE/node_modules/express" ]; then
    ( cd "$RACINE" && STORAGE_PROVIDERS=mega,local RCLONE_BIN="${RC:-}" node server/stockage.js --test mega ) \
      || erreur "Le test a échoué : lisez le message ci-dessus."
  else
    alerte "Dépendances absentes : lancez d'abord deploy/alwaysdata/installer.sh"
  fi
fi

# --- suite ------------------------------------------------------------------
titre "Résumé"
cat <<FIN
  Fichiers envoyés sur MEGA     : signatures, logos, pièces jointes
  Ce qui reste sur le disque    : secours (data/media) + base SQLite
  Notes, élèves, bulletins      : JAMAIS envoyés à l'extérieur (base SQLite)

  À retenir pour la suite :
      npm run stockage                 → état du stockage
      npm run stockage -- --test mega  → envoi réel d'un fichier de test

FIN
