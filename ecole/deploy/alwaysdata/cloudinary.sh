#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Terminish École — Cloudinary (gratuit, sans carte bancaire)
#
#   À exécuter SUR le serveur (alwaysdata, VPS, Chromebook…), sans sudo :
#       bash deploy/alwaysdata/cloudinary.sh --configurer
#       bash deploy/alwaysdata/cloudinary.sh --verifier
#       bash deploy/alwaysdata/cloudinary.sh --tester
#
#   Options :
#       --configurer        enregistre les identifiants dans .env
#       --verifier          contrôle les identifiants auprès de Cloudinary
#       --tester            envoie une image de 1 pixel par l'application
#       --cloud NOM         Cloud name (sinon demandé)
#       --cle CLE           API Key (sinon demandée)
#       --secret SECRET     API Secret (sinon demandé, saisie invisible)
#       --dossier NOM       dossier Cloudinary (défaut : terminish)
#       --supprimer         retire la configuration Cloudinary de .env
#       -h | --help
#
#   Où trouver les trois valeurs :
#       console.cloudinary.com → Dashboard
#       « Cloud name », « API Key », « API Secret »
#
#   Créer un compte : https://cloudinary.com/users/register_free
#   Gratuit : 25 crédits/mois, aucune carte bancaire.
#
#   ⚠ L'API Secret ne doit être communiqué à personne : il est écrit dans .env
#     (mode 600) et n'apparaît jamais sur le site.
# ---------------------------------------------------------------------------
set -uo pipefail

VERT=$'\033[32m'; JAUNE=$'\033[33m'; ROUGE=$'\033[31m'; GRIS=$'\033[90m'; RAZ=$'\033[0m'
ok()    { printf '%s✔%s %s\n' "$VERT" "$RAZ" "$*"; }
info()  { printf '%s•%s %s\n' "$GRIS" "$RAZ" "$*"; }
alerte(){ printf '%s!%s %s\n' "$JAUNE" "$RAZ" "$*"; }
erreur(){ printf '%s✘%s %s\n' "$ROUGE" "$RAZ" "$*" >&2; }
titre() { printf '\n%s\n  %s\n%s\n' '────────────────────────────────────────────────────────────' "$*" '────────────────────────────────────────────────────────────'; }

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENVFILE="$RACINE/.env"
CLOUD="${CLOUDINARY_CLOUD_NAME:-}"
CLE="${CLOUDINARY_API_KEY:-}"
SECRET="${CLOUDINARY_API_SECRET:-}"
DOSSIER="${CLOUDINARY_FOLDER:-terminish}"
ACTIONS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --configurer) ACTIONS+=("configurer") ;;
    --verifier)   ACTIONS+=("verifier") ;;
    --tester)     ACTIONS+=("tester") ;;
    --supprimer)  ACTIONS+=("supprimer") ;;
    --cloud)      CLOUD="${2:-}"; shift ;;
    --cle)        CLE="${2:-}"; shift ;;
    --secret)     SECRET="${2:-}"; shift ;;
    --dossier)    DOSSIER="${2:-terminish}"; shift ;;
    -h|--help)    sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) erreur "Option inconnue : $1"; exit 1 ;;
  esac
  shift
done
[ ${#ACTIONS[@]} -eq 0 ] && ACTIONS=("verifier")

DEBUT="# --- Terminish / stockage Cloudinary (géré par deploy/alwaysdata/cloudinary.sh) ---"
FIN="# --- fin du bloc stockage Cloudinary ---"

# Valeur d'une clé dans .env (vide si absente)
lire_env() { grep -E "^$1=" "$ENVFILE" 2>/dev/null | tail -1 | cut -d= -f2-; }

# Réécrit .env en retirant puis réajoutant le bloc Cloudinary
ecrire_bloc() {
  local tmp; tmp="$(mktemp)"
  awk -v d="$DEBUT" -v f="$FIN" '$0==d{saut=1;next} $0==f{saut=0;next} saut!=1{print}' "$ENVFILE" 2>/dev/null > "$tmp" || : > "$tmp"
  if [ "$1" != "vider" ]; then
    {
      printf '%s\n' "$DEBUT"
      printf 'CLOUDINARY_CLOUD_NAME=%s\n' "$2"
      printf 'CLOUDINARY_API_KEY=%s\n' "$3"
      printf 'CLOUDINARY_API_SECRET=%s\n' "$4"
      printf 'CLOUDINARY_FOLDER=%s\n' "$5"
      printf '%s\n' "$FIN"
    } >> "$tmp"
  fi
  mv "$tmp" "$ENVFILE"
  chmod 600 "$ENVFILE" 2>/dev/null || true
}

# Ordre d'essai : on garde les fournisseurs déjà choisis (MEGA d'abord s'il est
# là), on ajoute cloudinary, et « local » reste toujours en dernier.
maj_ordre() {
  local actuel ajout="$1" nouveau=""
  actuel="$(lire_env STORAGE_PROVIDERS)"
  [ -z "$actuel" ] && actuel="local"
  # Si MEGA est déjà configuré (bloc du script rclone.sh) mais absent de la
  # liste, on le remet en tête : les deux scripts coopèrent au lieu de se
  # remplacer l'un l'autre.
  if [ -n "$(lire_env MEGA_RCLONE_REMOTE)" ] && ! printf '%s' "$actuel" | grep -q 'mega'; then
    actuel="mega,$actuel"
  fi
  local IFS=','
  for f in $actuel; do
    f="$(printf '%s' "$f" | tr -d ' ')"
    [ -z "$f" ] && continue
    [ "$f" = "$ajout" ] && continue
    [ "$f" = "local" ] && continue
    nouveau="${nouveau:+$nouveau,}$f"
  done
  nouveau="${nouveau:+$nouveau,}$ajout"
  nouveau="$nouveau,local"
  unset IFS
  local tmp; tmp="$(mktemp)"
  awk -v k="STORAGE_PROVIDERS=" 'index($0,k)!=1{print}' "$ENVFILE" > "$tmp" 2>/dev/null || : > "$tmp"
  printf 'STORAGE_PROVIDERS=%s\n' "$nouveau" >> "$tmp"
  mv "$tmp" "$ENVFILE"
  chmod 600 "$ENVFILE" 2>/dev/null || true
  echo "$nouveau"
}

# ------------------------------------------------------------------ supprimer
if printf '%s\n' "${ACTIONS[@]}" | grep -qx supprimer; then
  titre "Retrait de Cloudinary"
  ecrire_bloc vider
  ORDRE="$(lire_env STORAGE_PROVIDERS)"
  nouveau=""
  local_ifs="$IFS"; IFS=','
  for f in $ORDRE; do
    f="$(printf '%s' "$f" | tr -d ' ')"
    [ -z "$f" ] && continue
    [ "$f" = "cloudinary" ] && continue
    nouveau="${nouveau:+$nouveau,}$f"
  done
  IFS="$local_ifs"
  [ -z "$nouveau" ] && nouveau="local"
  tmp="$(mktemp)"
  awk 'index($0,"STORAGE_PROVIDERS=")!=1{print}' "$ENVFILE" > "$tmp" 2>/dev/null || : > "$tmp"
  printf 'STORAGE_PROVIDERS=%s\n' "$nouveau" >> "$tmp"
  mv "$tmp" "$ENVFILE"; chmod 600 "$ENVFILE" 2>/dev/null || true
  ok "Cloudinary retiré — ordre désormais : $nouveau"
  info "Les images déjà envoyées restent accessibles (leur URL est en base)."
  printf '\n  Redémarrez le site pour appliquer : Web → Sites → Redémarrer\n\n'
  exit 0
fi

# ---------------------------------------------------------------- configurer
if printf '%s\n' "${ACTIONS[@]}" | grep -qx configurer; then
  titre "Cloudinary — identifiants (console.cloudinary.com → Dashboard)"
  if [ -z "$CLOUD" ] && [ -t 0 ]; then
    printf '  Cloud name  : '; read -r CLOUD
  fi
  if [ -z "$CLE" ] && [ -t 0 ]; then
    printf '  API Key     : '; read -r CLE
  fi
  if [ -z "$SECRET" ] && [ -t 0 ]; then
    printf '  API Secret (invisible) : '; stty -echo; read -r SECRET; stty echo; echo
  fi
  CLOUD="$(printf '%s' "$CLOUD" | tr -d ' ')"; CLE="$(printf '%s' "$CLE" | tr -d ' ')"; SECRET="$(printf '%s' "$SECRET" | tr -d ' ')"

  if [ -z "$CLOUD" ] || [ -z "$CLE" ] || [ -z "$SECRET" ]; then
    erreur "Les trois valeurs sont nécessaires (cloud name, API key, API secret)."
    info "Sinon : options --cloud / --cle / --secret, ou l'assistant interactif."
    exit 1
  fi
  # Un secret Cloudinary est une suite de 27 caractères alphanumériques.
  if ! printf '%s' "$SECRET" | grep -Eq '^[A-Za-z0-9_-]{10,}$'; then
    alerte "L'API Secret contient des caractères inhabituels : vérifiez la copie."
  fi
  if ! printf '%s' "$CLOUD" | grep -Eq '^[A-Za-z0-9_-]+$'; then
    alerte "Le Cloud name contient des caractères inhabituels : vérifiez la copie."
  fi

  [ -f "$ENVFILE" ] || { erreur ".env absent : lancez d'abord deploy/alwaysdata/installer.sh"; exit 1; }
  ecrire_bloc garder "$CLOUD" "$CLE" "$SECRET" "$DOSSIER"
  ORDRE="$(maj_ordre cloudinary)"
  ok "Identifiants enregistrés dans .env (mode 600)"
  ok "Ordre d'essai : $ORDRE"
  info "Cloud name : $CLOUD · API Key : ${CLE:0:4}…${CLE: -2} · Secret : ••••"

  cat <<FIN

  ⚠ Le site doit être redémarré pour lire le nouveau .env :
       interface alwaysdata → Sites → Redémarrer
     (ou, sur un VPS :  systemctl restart terminish-ecole )

FIN
fi

# ------------------------------------------------------------------ vérifier
if printf '%s\n' "${ACTIONS[@]}" | grep -qx verifier; then
  titre "Vérification"
  if [ ! -f "$ENVFILE" ]; then
    alerte ".env absent"
  else
    CLOUD="$(lire_env CLOUDINARY_CLOUD_NAME)"; CLE="$(lire_env CLOUDINARY_API_KEY)"
    SECRET="$(lire_env CLOUDINARY_API_SECRET)"
    DOSSIER="$(lire_env CLOUDINARY_FOLDER)"; DOSSIER="${DOSSIER:-terminish}"
    if [ -n "$CLOUD" ] && [ -n "$CLE" ] && [ -n "$SECRET" ]; then
      ok "identifiants présents : cloud « $CLOUD », clé ${CLE:0:4}…${CLE: -2}, secret ••••"
    else
      alerte "identifiants incomplets (lancez --configurer)"
    fi
    grep -E '^STORAGE_PROVIDERS=' "$ENVFILE" | sed 's/^/    /'
    grep -q '^STORAGE_PROVIDERS=.*cloudinary' "$ENVFILE" || alerte "STORAGE_PROVIDERS n'inclut pas cloudinary"
    if [ -n "$(lire_env MEGA_RCLONE_REMOTE)" ] && ! grep -q '^STORAGE_PROVIDERS=.*mega' "$ENVFILE"; then
      alerte "MEGA est configuré mais absent de STORAGE_PROVIDERS : il ne sera pas utilisé."
    fi
  fi

  # Appel réel à l'API (endpoint « ping » de l'API Admin, HTTP Basic).
  if [ -n "${CLOUD:-}" ] && [ -n "${CLE:-}" ] && [ -n "${SECRET:-}" ]; then
    info "Appel à Cloudinary (ping)…"
    REP="$(CLOUD="$CLOUD" CLE="$CLE" SECRET="$SECRET" node -e '
      (async () => {
        const base = (process.env.CLOUDINARY_API_BASE || "https://api.cloudinary.com").replace(/\/+$/, "");
        const auth = Buffer.from(process.env.CLE + ":" + process.env.SECRET).toString("base64");
        try {
          const r = await fetch(`${base}/v1_1/${encodeURIComponent(process.env.CLOUD)}/ping`,
            { headers: { Authorization: "Basic " + auth }, signal: AbortSignal.timeout(12000) });
          const d = await r.json().catch(() => null);
          if (r.ok && d && d.status === "ok") { console.log("OK"); process.exit(0); }
          console.log("ECHEC " + (r.status) + " " + ((d && d.error && d.error.message) || ""));
        } catch (e) { console.log("ECHEC reseau " + e.message); }
      })();
    ' 2>/dev/null)"
    case "$REP" in
      OK) ok "Cloudinary répond : identifiants valides" ;;
      ECHEC\ 401*|ECHEC\ 403*) erreur "Identifiants refusés (401/403) : vérifiez l'API Key et le Secret." ;;
      ECHEC*) erreur "Réponse inattendue : ${REP#ECHEC }" ;;
      *) alerte "Vérification impossible (node absent ou réseau bloqué)" ;;
    esac
  fi
fi

# -------------------------------------------------------------------- tester
if printf '%s\n' "${ACTIONS[@]}" | grep -qx tester; then
  titre "Envoi d'une image de test par l'application"
  if [ -d "$RACINE/node_modules/express" ]; then
    ( cd "$RACINE" && STORAGE_PROVIDERS=cloudinary node server/stockage.js --test cloudinary ) \
      || erreur "Le test a échoué : lisez le message ci-dessus."
  else
    alerte "Dépendances absentes : lancez d'abord deploy/alwaysdata/installer.sh"
  fi
fi

titre "Résumé"
cat <<FIN
  Fichiers envoyés sur Cloudinary : signatures, logos, pièces jointes
  Ce qui reste sur le disque       : secours (data/media) + base SQLite
  Notes, élèves, bulletins         : JAMAIS envoyés à l'extérieur (base SQLite)

  À retenir :
      npm run stockage                       → état du stockage
      npm run stockage -- --test cloudinary  → envoi réel d'un fichier de test

FIN
