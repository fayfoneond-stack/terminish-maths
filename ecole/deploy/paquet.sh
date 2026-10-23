#!/usr/bin/env bash
# =============================================================================
# Terminish École — fabrication du paquet de déploiement
# -----------------------------------------------------------------------------
# Produit documents/terminish-ecole-deploiement.zip (dossier racine :
# terminish-ecole/) à partir du contenu de ecole/, sans node_modules, sans
# base de données, sans secret.
#
#   bash deploy/paquet.sh              # construit et affiche taille + sha256
#   bash deploy/paquet.sh --verifier    # vérifie le zip déjà présent
# =============================================================================
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # …/ecole
DEPOT="$(cd "$RACINE/.." && pwd)"                            # …/terminish-maths
SORTIE="$DEPOT/documents/terminish-ecole-deploiement.zip"
NOM="terminish-ecole"

vert() { printf '\033[32m✔\033[0m %s\n' "$1"; }
rouge() { printf '\033[31m✘\033[0m %s\n' "$1"; }

# ----------------------------------------------------------------- vérifier
verifier() {
  [ -f "$SORTIE" ] || { rouge "Paquet absent : $SORTIE"; exit 1; }
  echo "Paquet   : $SORTIE"
  echo "Taille   : $(stat -c%s "$SORTIE") octets"
  echo "sha256   : $(sha256sum "$SORTIE" | cut -d' ' -f1)"
  echo "Fichiers : $(unzip -Z1 "$SORTIE" | grep -vc '/$')"
  echo
  echo "Contrôles :"
  for f in INSTALLATION.txt LIEN-ETERNEL.md README.md DEPLOIEMENT-GRATUIT.md \
           FIREBASE.md STOCKAGE-EXTERNE.md firebase.json \
           server/index.js server/storage.js server/print.js \
           public/config.js \
           deploy/gratuit/tout.sh deploy/gratuit/service-auto.sh \
           deploy/gratuit/lien-stable.sh deploy/gratuit/demarrer.js \
           deploy/gratuit/firebase.sh \
           deploy/vm/installer-vm.sh; do
    if unzip -Z1 "$SORTIE" | grep -qx "$NOM/$f"; then
      vert "$f"
    else
      rouge "$f  MANQUANT"
    fi
  done
  if unzip -Z1 "$SORTIE" | grep -qE 'node_modules/|/data/|\.env$|\.db$'; then
    rouge "le paquet contient des fichiers interdits (node_modules, data, .env, .db)"
    exit 1
  else
    vert "aucun fichier interdit (node_modules, data, .env, .db)"
  fi
}

if [ "${1:-}" = "--verifier" ]; then verifier; exit 0; fi

# ------------------------------------------------------------------ fabriquer
command -v zip    >/dev/null || { rouge "zip manquant : sudo apt install zip"; exit 1; }
command -v unzip  >/dev/null || { rouge "unzip manquant : sudo apt install unzip"; exit 1; }

ETAPE="$(mktemp -d)"
trap 'rm -rf "$ETAPE"' EXIT

mkdir -p "$ETAPE/$NOM"

# copie sélective : on n'embarque ni dépendances, ni base, ni secrets
( cd "$RACINE" && \
  find . -mindepth 1 \
       \( -name node_modules -o -name data -o -name .git -o -name '.env' \
          -o -name '.env.local' -o -name '*.log' -o -name '*.db' \
          -o -name '*.db-wal' -o -name '*.db-shm' -o -name '.DS_Store' \) -prune -o \
       -type f -print ) | sed 's|^\./||' > "$ETAPE/liste.txt"

while IFS= read -r f; do
  mkdir -p "$ETAPE/$NOM/$(dirname "$f")"
  cp -p "$RACINE/$f" "$ETAPE/$NOM/$f"
done < "$ETAPE/liste.txt"

mkdir -p "$DEPOT/documents"
rm -f "$SORTIE"
( cd "$ETAPE" && zip -q -r -X "$SORTIE" "$NOM" )

echo
verifier
echo
vert "Paquet prêt : $SORTIE"
echo
echo "Lien de téléchargement (branche courante) :"
echo "  https://github.com/fayfoneond-stack/terminish-maths/raw/arena/c4eb5c08-terminish-maths/documents/terminish-ecole-deploiement.zip"
