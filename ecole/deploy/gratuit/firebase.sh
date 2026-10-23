#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Terminish École — publication de l'interface sur Firebase Hosting (0 F)
#
#   bash deploy/gratuit/firebase.sh                     → prépare + déploie
#   bash deploy/gratuit/firebase.sh --api https://xxx.ts.net
#   bash deploy/gratuit/firebase.sh --projet mon-ecole
#   bash deploy/gratuit/firebase.sh --preparer          → écrit les fichiers, sans publier
#   bash deploy/gratuit/firebase.sh --etat              → où en est-on ?
#   bash deploy/gratuit/firebase.sh --annuler           → remet config.js comme avant
#
# Ce que fait ce script :
#   1. trouve l'adresse FIXE de l'API (Tailscale Funnel) et l'inscrit dans
#      public/config.js ;
#   2. associe le projet Firebase (.firebaserc) ;
#   3. publie le dossier public/ sur Firebase Hosting.
#
# Rappel important : Firebase Hosting ne sert QUE l'interface (HTML/CSS/JS).
# Le serveur (Express + SQLite) reste sur votre machine ; il doit donc avoir
# lui aussi une adresse fixe, sinon le site s'affiche mais la connexion échoue.
# ---------------------------------------------------------------------------
set -uo pipefail

VERT=$'\033[32m'; JAUNE=$'\033[33m'; ROUGE=$'\033[31m'; GRIS=$'\033[90m'; RAZ=$'\033[0m'
ok()    { printf '%s✔%s %s\n' "$VERT" "$RAZ" "$*"; }
info()  { printf '%s•%s %s\n' "$GRIS" "$RAZ" "$*"; }
alerte(){ printf '%s!%s %s\n' "$JAUNE" "$RAZ" "$*"; }
erreur(){ printf '%s✘%s %s\n' "$ROUGE" "$RAZ" "$*" >&2; }
titre() { printf '\n%s\n  %s\n%s\n' '────────────────────────────────────────────────────────────' "$*" '────────────────────────────────────────────────────────────'; }

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RACINE"
CONFIG="$RACINE/public/config.js"
SAUVEGARDE="$RACINE/public/config.js.avant-firebase"
FIREBASERC="$RACINE/.firebaserc"

API="${TERMINISH_API_BASE:-}"
PROJET=""
MODE="deployer"
while [ $# -gt 0 ]; do
  case "$1" in
    --api)      API="${2:-}"; shift ;;
    --projet)   PROJET="${2:-}"; shift ;;
    --preparer) MODE="preparer" ;;
    --deployer) MODE="deployer" ;;
    --etat)     MODE="etat" ;;
    --annuler)  MODE="annuler" ;;
    -h|--help)  sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) erreur "Option inconnue : $1"; exit 1 ;;
  esac
  shift
done

ENVFILE="$RACINE/.env"
DEBUT_ENV="# --- Terminish / Firebase (géré par deploy/gratuit/firebase.sh) ---"
FIN_ENV="# --- fin du bloc Firebase ---"

ecrire_env() {   # $1 = origine(s) autorisées
  local origines="$1"
  local tmp; tmp="$(mktemp)"
  # on retire un éventuel ancien bloc
  awk -v d="$DEBUT_ENV" -v f="$FIN_ENV" '
    $0 == d { saut = 1; next }
    $0 == f { saut = 0; next }
    saut != 1 { print }
  ' "$ENVFILE" 2>/dev/null > "$tmp" || : > "$tmp"
  {
    printf '%s\n' "$DEBUT_ENV"
    printf 'CORS_ORIGIN=%s\n' "$origines"
    printf 'COOKIE_SECURE=1\n'
    printf '%s\n' "$FIN_ENV"
  } >> "$tmp"
  mv "$tmp" "$ENVFILE"
}

retirer_env() {
  [ -f "$ENVFILE" ] || return 0
  local tmp; tmp="$(mktemp)"
  awk -v d="$DEBUT_ENV" -v f="$FIN_ENV" '
    $0 == d { saut = 1; next }
    $0 == f { saut = 0; next }
    saut != 1 { print }
  ' "$ENVFILE" > "$tmp"
  mv "$tmp" "$ENVFILE"
}

# --- 0. annuler -------------------------------------------------------------
if [ "$MODE" = "annuler" ]; then
  retirer_env
  ok "Variables Firebase retirées de .env (CORS_ORIGIN / COOKIE_SECURE)."

  titre "Retour à la configuration locale"
  if [ -f "$SAUVEGARDE" ]; then
    cp "$SAUVEGARDE" "$CONFIG"
    ok "public/config.js restauré (l'interface appelle de nouveau le serveur local)."
  else
    printf "window.TERMINISH_API_BASE = window.TERMINISH_API_BASE || '';\n" > "$CONFIG"
    ok "public/config.js remis à vide (adresse relative)."
  fi
  info "Il reste à republier : bash deploy/gratuit/firebase.sh --preparer puis firebase deploy"
  exit 0
fi

# --- 1. état ----------------------------------------------------------------
api_actuelle() {
  # on ignore les lignes de commentaire (elles contiennent des exemples)
  grep -E "^[[:space:]]*window\.TERMINISH_API_BASE" "$CONFIG" 2>/dev/null \
    | grep -oE "'[^']*'" | head -1 | tr -d "'"
}
if [ "$MODE" = "etat" ]; then
  titre "État de la publication Firebase"
  local_api="$(api_actuelle || true)"
  if [ -z "$local_api" ]; then ok "config.js : adresse relative (l'interface et l'API sont sur le même serveur)"
  else ok "config.js : l'interface appelle $local_api"; fi
  if [ -f "$FIREBASERC" ]; then
    ok ".firebaserc : projet « $(grep -oE '"default" *: *"[^"]*"' "$FIREBASERC" | head -1 | sed 's/.*"\([^"]*\)"$/\1/') »"
  else
    alerte ".firebaserc absent : projet Firebase pas encore associé."
  fi
  if command -v firebase >/dev/null 2>&1; then ok "Firebase CLI : $(firebase --version 2>/dev/null)"
  else info "Firebase CLI non installé globalement (le script utilisera npx firebase-tools)."; fi
  if command -v tailscale >/dev/null 2>&1; then
    local_funnel="$(tailscale funnel status 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.ts\.net' | head -1 || true)"
    [ -n "$local_funnel" ] && ok "Tunnel Tailscale actif : $local_funnel" \
                           || alerte "Tunnel Tailscale non actif (adresse API non fixe)."
  else
    alerte "Tailscale non installé : l'API n'a pas d'adresse fixe."
  fi
  exit 0
fi

# --- 2. vérifications -------------------------------------------------------
titre "Publication de l'interface sur Firebase Hosting"
command -v node >/dev/null 2>&1 || { erreur "Node.js absent."; exit 1; }
ok "Node.js $(node -v)"
[ -f "$CONFIG" ] || { erreur "public/config.js introuvable — lancez ce script depuis le dossier terminish-ecole."; exit 1; }
[ -f "$RACINE/firebase.json" ] || { erreur "firebase.json introuvable."; exit 1; }

# --- 3. adresse FIXE de l'API ----------------------------------------------
if [ -z "$API" ] && command -v tailscale >/dev/null 2>&1; then
  API="$(tailscale funnel status 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.ts\.net' | head -1 || true)"
  [ -n "$API" ] && info "Adresse détectée depuis Tailscale : $API"
fi
if [ -z "$API" ]; then
  echo
  alerte "Aucune adresse fixe d'API trouvée."
  cat <<'FIN'
  L'interface publiée sur Firebase doit joindre le serveur : il lui faut une
  adresse HTTPS qui ne change jamais. Deux façons de l'obtenir :

    a) Tailscale Funnel (recommandé, gratuit, sans carte) :
         bash deploy/gratuit/lien-stable.sh --tailscale
       puis relancez ce script : l'adresse sera détectée automatiquement.

    b) Si vous la connaissez déjà :
         bash deploy/gratuit/firebase.sh --api https://votre-machine.xxxx.ts.net
FIN
  exit 1
fi
API="${API%/}"
case "$API" in
  https://*) : ;;
  *) erreur "L'adresse de l'API doit commencer par https:// (obligatoire pour le cookie de session)."; exit 1 ;;
esac
case "$API" in
  *trycloudflare.com*)
    alerte "Cette adresse est un lien trycloudflare : elle CHANGE à chaque redémarrage."
    alerte "Le site Firebase fonctionnera aujourd'hui, puis affichera « erreur réseau » demain."
    info "Pour une adresse stable : bash deploy/gratuit/lien-stable.sh --tailscale"
    ;;
esac
ok "API : $API"

# Quel dossier répond réellement derrière cette adresse ?
# (deux exemplaires du projet = deux bases différentes : on le dit tout de suite)
if command -v curl >/dev/null 2>&1; then
  SANTE="$(curl -s -m 6 "$API/api/health" 2>/dev/null)"
  INST="$(printf '%s' "$SANTE" | grep -o '"installation":"[^"]*"' | cut -d'"' -f4)"
  IPORT="$(printf '%s' "$SANTE" | grep -o '"port":[0-9]*' | cut -d: -f2)"
  if [ -z "$INST" ]; then
    alerte "L'API ne répond pas pour l'instant sur ${API}."
    info "Le site publié s'affichera, mais la connexion échouera."
    info "Démarrez-le d'abord : bash deploy/gratuit/tout.sh"
  else
    ok "L'API répond : dossier « ${INST} » · port ${IPORT}"
    if [ "$INST" != "$(basename "$RACINE")" ]; then
      alerte "ATTENTION : ce n'est pas le dossier que vous publiez ($(basename "$RACINE"))."
      info "Le site Firebase affichera les données de « ${INST} », pas les vôtres."
      info "Arrêtez l'autre instance, puis : bash deploy/gratuit/tout.sh"
      if [ -t 0 ]; then
        printf '  Continuer quand même ? [o/N] '
        read -r REPONSE
        case "$REPONSE" in o|O|oui|Oui) : ;; *) erreur "Publication annulée."; exit 1 ;; esac
      fi
    fi
  fi
fi

# --- 4. config.js -----------------------------------------------------------
if [ ! -f "$SAUVEGARDE" ]; then
  cp "$CONFIG" "$SAUVEGARDE"
  info "Sauvegarde de l'ancienne configuration : public/config.js.avant-firebase"
fi
cat > "$CONFIG" <<EOF
/* Généré par deploy/gratuit/firebase.sh — interface publiée sur Firebase Hosting.
   L'API (serveur Node + base SQLite) reste sur votre machine, joignable ici :
     $API
   Pour revenir en arrière :
     bash deploy/gratuit/firebase.sh --annuler
*/
window.TERMINISH_API_BASE = '$API';
EOF
ok "public/config.js pointe vers l'API"

# --- 5. projet Firebase -----------------------------------------------------
if [ -z "$PROJET" ] && [ -f "$FIREBASERC" ]; then
  PROJET="$(grep -oE '"default" *: *"[^"]*"' "$FIREBASERC" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
fi
if [ -z "$PROJET" ]; then
  if [ -t 0 ]; then
    echo
    info "Nom du projet Firebase (visible dans la console Firebase, ex. mon-ecole-togo) :"
    printf '  projet > '
    read -r PROJET
  fi
fi
if [ -z "$PROJET" ]; then
  erreur "Aucun projet Firebase indiqué."
  info "Créez-le sur https://console.firebase.google.com puis relancez avec :"
  info "  bash deploy/gratuit/firebase.sh --projet NOM-DU-PROJET"
  exit 1
fi
printf '{\n  "projects": {\n    "default": "%s"\n  }\n}\n' "$PROJET" > "$FIREBASERC"
ok "Projet Firebase : $PROJET"

# --- 6. CLI Firebase --------------------------------------------------------
if command -v firebase >/dev/null 2>&1; then
  FB=(firebase); ok "Firebase CLI $(firebase --version 2>/dev/null)"
else
  FB=(npx --yes firebase-tools)
  info "Firebase CLI utilisé via npx (téléchargement la première fois, 1 à 2 min)"
fi

if ! "${FB[@]}" projects:list >/dev/null 2>&1; then
  alerte "Vous n'êtes pas connecté à Firebase."
  cat <<FIN

  Lancez la connexion, puis relancez ce script :

      ${FB[*]} login

  (Un navigateur s'ouvre : connectez-vous avec votre compte Google.
   Sur un Chromebook sans navigateur disponible, utilisez :
      ${FB[*]} login --no-localhost
   et collez le code affiché.)

FIN
  exit 2
fi
ok "Compte Firebase connecté"

# --- 7. publication ---------------------------------------------------------
if [ "$MODE" = "preparer" ]; then
  titre "Prêt à publier"
  ok "config.js et .firebaserc écrits."
  info "Pour publier :  ${FB[*]} deploy --only hosting"
  exit 0
fi

titre "Publication en cours"
if ! "${FB[@]}" deploy --only hosting --project "$PROJET"; then
  erreur "La publication a échoué (voir le message ci-dessus)."
  exit 1
fi

HOTE="https://${PROJET}.web.app"
HOTE2="https://${PROJET}.firebaseapp.com"

# Le serveur doit accepter l'origine Firebase et sécuriser le cookie.
# Ces deux réglages sont écrits dans .env : ils survivent aux redémarrages,
# y compris quand le site est relancé par tout.sh ou par le service systemd.
ecrire_env "$HOTE,$HOTE2"
ok ".env : origines Firebase autorisées + cookie sécurisé"

titre "C'est en ligne — adresse définitive"
ok "Interface : $HOTE"
ok "Aussi     : $HOTE2"
cat <<FIN

  Cette adresse NE CHANGE JAMAIS, même si le Chromebook redémarre.

  Il reste à redémarrer le serveur pour qu'il prenne le nouveau réglage :

      cd ~/"TERMINISH ECOLE 1"
      bash deploy/gratuit/tout.sh

  Puis à ouvrir $HOTE : la page de connexion doit s'afficher et
  la connexion doit fonctionner.

  Si la page s'affiche mais que la connexion tourne dans le vide :
    • le tunnel de l'API est arrêté  → bash deploy/gratuit/tout.sh
    • ou l'adresse de l'API a changé → relancer ce script (firebase.sh)

FIN
