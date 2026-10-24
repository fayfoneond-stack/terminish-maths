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
#       --configurer        enregistre les identifiants puis VÉRIFIE qu'ils
#                           ont le droit d'envoyer (un pixel de test est envoyé)
#       --verifier          contrôle les identifiants + le droit d'écriture
#       --tester            envoie une image de 1 pixel par l'application
#       --cloud NOM         Cloud name (sinon demandé)
#       --cle CLE           API Key (sinon demandée)
#       --secret SECRET     API Secret (sinon demandé, saisie invisible)
#       --dossier NOM       dossier Cloudinary (défaut : terminish)
#       --supprimer         retire la configuration Cloudinary de .env
#       -h | --help
#
#   Où trouver les trois valeurs :
#       console.cloudinary.com → Settings → API Keys
#       « Cloud name », « API Key », « API Secret »
#
#   ⚠ Prenez une clé dont le RÔLE autorise l'envoi : « Master Admin »
#     (bouton « + Generate New API Key »). Une clé « Media Library User »
#     passe le ping mais refuse toute écriture :
#     Request forbidden due to missing permissions (actions=["create"])
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

# Envoi réel d'un pixel (même signature que l'application) : seule façon de
# savoir si la clé a le DROIT d'envoyer, ce que le ping ne dit pas.
# Affiche : OK <url>  |  PERMIS <message>  |  REFUS <message>  |  RESEAU <message>
sonde_envoi() {
  CLOUD="$1" CLE="$2" SECRET="$3" DOSSIER="$4" node -e '
    const crypto = require("crypto");
    (async () => {
      const cloud = process.env.CLOUD, key = process.env.CLE, secret = process.env.SECRET;
      const dossier = (process.env.DOSSIER || "terminish") + "/sonde";
      const base = (process.env.CLOUDINARY_API_BASE || "https://api.cloudinary.com").replace(/\/+$/, "");
      const timestamp = Math.floor(Date.now() / 1000);
      const params = { folder: dossier, timestamp };
      const aSigner = Object.keys(params).sort().map(k => k + "=" + params[k]).join("&");
      const signature = crypto.createHash("sha1").update(aSigner + secret).digest("hex");
      const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      const corps = new URLSearchParams({ ...params, api_key: key, signature, file: pixel });
      try {
        const r = await fetch(`${base}/v1_1/${encodeURIComponent(cloud)}/image/upload`,
          { method: "POST", body: corps, signal: AbortSignal.timeout(20000) });
        const d = await r.json().catch(() => null);
        if (r.ok && d && d.secure_url) { console.log("OK " + d.secure_url); process.exit(0); }
        const msg = (d && d.error && d.error.message) || ("HTTP " + r.status);
        console.log(((r.status === 401 || r.status === 403) ? "PERMIS " : "REFUS ") + msg);
      } catch (e) { console.log("RESEAU " + e.message); }
    })();
  ' 2>/dev/null
}

conseil_cle() {
  cat <<FIN

  Cause : l'API Key est valide (le ping passe) mais son RÔLE interdit l'envoi.
  La clé « Untitled » créée par défaut a le rôle « Media Library User » sans
  accès à aucun dossier → toute création de fichier est refusée.

  Solution (2 minutes), dans console.cloudinary.com → Settings → API Keys :
    1. « + Generate New API Key »
    2. Key Name : Terminish
    3. Role : « Master Admin »   ← le rôle qui a tous les droits
    4. Create → le SECRET s'affiche UNE SEULE FOIS : copiez-le tout de suite
    5. relancez :  bash deploy/alwaysdata/cloudinary.sh --configurer

  (Une clé « Media Library User » ne peut pas convenir sans droits sur un
   dossier, réglables uniquement par l'API Admin : inutile pour une école.)

FIN
}

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

  # Contrôle immédiat : une clé valide peut quand même être privée d'écriture.
  info "Envoi d'un pixel de contrôle…"
  REP="$(sonde_envoi "$CLOUD" "$CLE" "$SECRET" "$DOSSIER")"
  case "$REP" in
    OK\ *)     ok "Envoi autorisé : cette clé peut écrire"
                info "${REP#OK }" ;;
    PERMIS*)    erreur "Cette clé ne peut PAS envoyer de fichiers (rôle insuffisant)."
                conseil_cle ;;
    REFUS*)     erreur "Envoi refusé : ${REP#REFUS }" ;;
    RESEAU*)    alerte "Réseau indisponible : ${REP#RESEAU } (identifiants enregistrés)" ;;
    *)          alerte "Contrôle impossible (node absent) : lancez --tester plus tard" ;;
  esac

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

    # Le ping ne prouve pas le droit d'écrire : on tente un vrai envoi.
    case "$REP" in
      OK)
        info "Contrôle du droit d'écriture (envoi d'un pixel)…"
        REP2="$(sonde_envoi "$CLOUD" "$CLE" "$SECRET" "$DOSSIER")"
        case "$REP2" in
          OK\ *)  ok "Envoi autorisé : cette clé peut écrire" ; info "${REP2#OK }" ;;
          PERMIS*) erreur "Cette clé ne peut PAS envoyer de fichiers (rôle insuffisant)."
                   conseil_cle ;;
          REFUS*)  erreur "Envoi refusé : ${REP2#REFUS }" ;;
          RESEAU*) alerte "Réseau : ${REP2#RESEAU }" ;;
          *)       alerte "Contrôle impossible (node absent)" ;;
        esac ;;
    esac
  fi
fi

# -------------------------------------------------------------------- tester
if printf '%s\n' "${ACTIONS[@]}" | grep -qx tester; then
  titre "Envoi d'une image de test par l'application"
  if [ -d "$RACINE/node_modules/express" ]; then
    SORTIE_TEST=$( cd "$RACINE" && STORAGE_PROVIDERS=cloudinary node server/stockage.js --test cloudinary 2>&1 )
    CODE_TEST=$?
    printf '%s\n' "$SORTIE_TEST"
    if [ "$CODE_TEST" -ne 0 ]; then
      case "$SORTIE_TEST" in
        *"missing permissions"*|*"not allowed to create"*)
          alerte "Cette clé API n'a pas le droit d'envoyer des fichiers."
          conseil_cle
          ;;
        *)
          erreur "Le test a échoué : lisez le message ci-dessus."
          ;;
      esac
    fi
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
