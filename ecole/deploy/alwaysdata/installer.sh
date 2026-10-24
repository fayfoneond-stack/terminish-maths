#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Terminish École — installation sur un hébergement alwaysdata (offre Free)
#
#   À exécuter SUR le serveur alwaysdata, en SSH, après avoir déposé le dossier
#   de l'application dans votre compte :
#
#       ssh COMPTE@ssh-COMPTE.alwaysdata.net
#       cd ~/terminish-ecole
#       bash deploy/alwaysdata/installer.sh
#
#   Options :
#       --dossier CHEMIN      dossier de l'application (défaut : dossier courant)
#       --email EMAIL         identifiant du chef/administrateur
#       --motdepasse MDP      mot de passe imposé (sinon généré)
#       --demo                remplir avec l'école de démonstration
#       --verifier            contrôle seulement, n'installe rien
#       -h | --help
#
#   Ce script ne fait QUE ce qui est nécessaire :
#     1. vérifie Node.js 22.5+ (obligatoire : le serveur utilise node:sqlite) ;
#     2. installe les dépendances de production (npm ci) ;
#     3. crée le dossier de données et le fichier .env (réglages permanents) ;
#     4. affiche la commande exacte à coller dans Web > Sites > Node.js.
#   Il n'ouvre aucun port, ne touche pas au pare-feu et ne demande pas sudo.
# ---------------------------------------------------------------------------
set -uo pipefail

VERT=$'\033[32m'; JAUNE=$'\033[33m'; ROUGE=$'\033[31m'; GRIS=$'\033[90m'; RAZ=$'\033[0m'
ok()    { printf '%s✔%s %s\n' "$VERT" "$RAZ" "$*"; }
info()  { printf '%s•%s %s\n' "$GRIS" "$RAZ" "$*"; }
alerte(){ printf '%s!%s %s\n' "$JAUNE" "$RAZ" "$*"; }
erreur(){ printf '%s✘%s %s\n' "$ROUGE" "$RAZ" "$*" >&2; }
titre() { printf '\n%s\n  %s\n%s\n' '────────────────────────────────────────────────────────────' "$*" '────────────────────────────────────────────────────────────'; }

DOSSIER=""; EMAIL=""; MDP=""; DEMO=0; VERIFIER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dossier)   DOSSIER="${2:-}"; shift ;;
    --email)     EMAIL="${2:-}"; shift ;;
    --motdepasse) MDP="${2:-}"; shift ;;
    --demo)      DEMO=1 ;;
    --verifier)  VERIFIER=1 ;;
    -h|--help)   sed -n '2,27p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) erreur "Option inconnue : $1"; exit 1 ;;
  esac
  shift
done

# Le script vit dans <application>/deploy/alwaysdata/ : on remonte de deux crans.
RACINE_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="${DOSSIER:-$RACINE_SCRIPT}"
APP="$(cd "$APP" 2>/dev/null && pwd)" || { erreur "Dossier introuvable : ${DOSSIER}"; exit 1; }

titre "Terminish École — installation sur alwaysdata"
info "Application : ${APP}"

# --- 1. Node.js -------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  erreur "Node.js est introuvable sur ce compte."
  cat <<FIN

  Dans l'administration alwaysdata :
      Environnement > Node.js  → choisir la version 22 (ou 24)
  puis reconnectez-vous en SSH (une nouvelle session charge le nouveau PATH).

FIN
  exit 1
fi
VERSION_NODE="$(node -v)"
MAJEUR="$(printf '%s' "$VERSION_NODE" | sed 's/^v//' | cut -d. -f1)"
MINEUR="$(printf '%s' "$VERSION_NODE" | sed 's/^v//' | cut -d. -f2)"
if [ "$MAJEUR" -lt 22 ] || { [ "$MAJEUR" -eq 22 ] && [ "$MINEUR" -lt 5 ]; }; then
  erreur "Node.js ${VERSION_NODE} : il faut 22.5 ou plus (le serveur utilise node:sqlite)."
  info "Administration alwaysdata → Environnement > Node.js → version 22 ou 24."
  exit 1
fi
ok "Node.js ${VERSION_NODE}"

# --- 2. Le dossier de l'application ----------------------------------------
[ -f "$APP/package.json" ] || { erreur "Ce n'est pas le dossier de l'application (package.json absent)."; exit 1; }
[ -f "$APP/server/index.js" ] || { erreur "server/index.js absent : le dossier est incomplet."; exit 1; }
ok "Application reconnue"

ESPACE="$(df -Pk "$APP" 2>/dev/null | awk 'NR==2{print int($4/1024)}')"
[ -n "${ESPACE:-}" ] && info "Espace libre : environ ${ESPACE} Mo (offre Free : 1 Go)"

if [ "$VERIFIER" = "1" ]; then
  [ -d "$APP/node_modules/express" ] && ok "Dépendances installées" || alerte "Dépendances absentes (npm ci à lancer)"
  [ -f "$APP/.env" ] && ok "Fichier .env présent" || alerte "Fichier .env absent"
  [ -f "$APP/data/terminish-ecole.db" ] && ok "Base de données présente" || info "Pas encore de base (elle sera créée au premier démarrage)"
  exit 0
fi

# --- 3. Dépendances ---------------------------------------------------------
titre "Dépendances"
if [ -d "$APP/node_modules/express" ]; then
  ok "Déjà installées — rien à faire"
else
  info "npm ci --omit=dev (1 à 3 minutes)…"
  ( cd "$APP" && npm ci --omit=dev --no-audit --no-fund ) || {
    erreur "npm ci a échoué. Vérifiez la connexion, puis relancez."
    exit 1
  }
  ok "Dépendances installées"
fi

# --- 4. Réglages permanents (.env) -----------------------------------------
titre "Réglages"
mkdir -p "$APP/data"

if [ -z "$EMAIL" ] && [ -f "$APP/.env" ]; then
  EMAIL="$(grep -E '^ADMIN_EMAIL=' "$APP/.env" 2>/dev/null | cut -d= -f2-)"
fi
if [ -z "$EMAIL" ]; then
  if [ -t 0 ]; then
    printf '  Identifiant du chef d’établissement (email) : '
    read -r EMAIL
  fi
fi
[ -z "$EMAIL" ] && EMAIL="admin@terminish.tg"

if [ -z "$MDP" ]; then
  MDP="$(node -e "
    const c=require('node:crypto');
    const a=['baobab','hibiscus','mangrove','savane','cauri','fromager','karite','lagon'];
    const b=['solide','brillant','paisible','nouveau','fidele','radieux','calme','vaillant'];
    console.log(a[c.randomInt(a.length)]+'-'+b[c.randomInt(b.length)]+'-'+c.randomInt(1000,9999));
  ")"
fi

# Les réglages ajoutés à la main (MEGA, Cloudinary, Drive…) sont CONSERVÉS :
# seul le bloc géré ci-dessous est réécrit. Sans cela, relancer l'installateur
# effacerait la configuration du stockage externe.
CONSERVER="$(mktemp)"
if [ -f "$APP/.env" ]; then
  grep -Ev '^(TERMINISH_SEED|TERMINISH_DATA_DIR|ADMIN_EMAIL|ADMIN_PASSWORD|COOKIE_SECURE)=' "$APP/.env" \
    | grep -Ev '^# Terminish École — réglages du serveur' > "$CONSERVER" 2>/dev/null || true
fi

cat > "$APP/.env" <<EOF
# Terminish École — réglages du serveur (généré par deploy/alwaysdata/installer.sh)
# Ce fichier est lu au démarrage ; il n'est jamais publié sur le web.
TERMINISH_SEED=$([ "$DEMO" = "1" ] && echo demo || echo prod)
TERMINISH_DATA_DIR=$APP/data
ADMIN_EMAIL=$EMAIL
ADMIN_PASSWORD=$MDP
COOKIE_SECURE=1
#
# --- Stockage externe (facultatif) -------------------------------------------
# Par défaut : tout reste sur le disque, dans data/media (1 Go sur alwaysdata).
# MEGA (25 Go gratuits) : bash deploy/alwaysdata/rclone.sh --installer --configurer
#   écrit automatiquement RCLONE_BIN, MEGA_RCLONE_REMOTE et STORAGE_PROVIDERS.
# Cloudinary (25 crédits/mois) : bash deploy/alwaysdata/cloudinary.sh --configurer
#   écrit CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
#   et ajoute cloudinary à STORAGE_PROVIDERS.
# Google Drive : GOOGLE_DRIVE_SA_JSON=/chemin/compte-de-service.json
#                GOOGLE_DRIVE_FOLDER_ID=identifiant_du_dossier
# Ordre d'essai : STORAGE_PROVIDERS=mega,cloudinary,local
# Voir STOCKAGE-EXTERNE.md pour le détail.
EOF
if [ -s "$CONSERVER" ]; then
  printf '\n# --- réglages conservés (stockage, options) ---\n' >> "$APP/.env"
  cat "$CONSERVER" >> "$APP/.env"
fi
rm -f "$CONSERVER"
chmod 600 "$APP/.env"
ok ".env écrit (mode $([ "$DEMO" = "1" ] && echo 'démonstration' || echo 'production'))"
info "Données : $APP/data/terminish-ecole.db"

umask 077
cat > "$APP/data/compte-administrateur.txt" <<EOF
Terminish École — compte administrateur
Identifiant : $EMAIL
Mot de passe : $MDP
Créé le : $(date '+%d/%m/%Y à %H:%M')
À conserver en lieu sûr. Modifier : npm run motdepasse
EOF
ok "Identifiants notés dans data/compte-administrateur.txt"

# --- 5. Ce qu'il reste à faire dans l'administration ------------------------
titre "Il reste UNE chose à faire dans l'administration alwaysdata"
cat <<FIN
  Web > Sites > Ajouter un site

    Nom              : Terminish École
    Type             : Node.js
    Version de Node  : 22 (ou 24)
    Adresses         : votre-adresse.alwaysdata.net
    Commande         : node $APP/server/index.js
    Répertoire       : $APP

  Puis, sur la page du site :
    • « HTTPS » / « Certificat SSL » → activer Let's Encrypt (gratuit) ;
    • laisser la variable PORT fournie par alwaysdata (ne pas la fixer).

  Test : https://votre-adresse.alwaysdata.net/api/health
         doit répondre {"ok":true,...}

  Identifiant : $EMAIL
  Mot de passe : $MDP

FIN

if [ "$VERIFIER" != "1" ]; then
  alerte "Notez le mot de passe maintenant : il reste aussi dans data/compte-administrateur.txt"
  info "Sauvegarde de la base : npm run backup   (dossier data/sauvegardes)"
fi
