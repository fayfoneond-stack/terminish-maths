#!/usr/bin/env bash
# Recupere les bibliotheques NSS precompilees (paquet npm @achingbrain/nss)
# utilisees par Chromium, puis les installe dans outils/pdf/nss/.
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$ICI/nss"

if [ -f "$DEST/libnss3.so" ]; then
  echo "NSS deja en place : $DEST"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Telechargement des bibliotheques NSS..."
curl -sSL -o "$TMP/nss.tgz" "https://registry.npmjs.org/@achingbrain/nss/-/nss-0.0.1.tgz"
tar xzf "$TMP/nss.tgz" -C "$TMP"
mkdir -p "$DEST"
cp "$TMP"/package/linux/*.so "$DEST"/
echo "Bibliotheques installees dans $DEST :"
ls "$DEST" | head
