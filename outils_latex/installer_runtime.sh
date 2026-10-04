#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  installer_runtime.sh — Installe le moteur XeLaTeX WebAssembly (thtex)
#  dans /home/user/latex-runtime, puis y ajoute les polices Latin Modern
#  17 pt complémentaires (référencées dans runtime-manifest.json).
#
#  Usage :  bash outils_latex/installer_runtime.sh
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

DEST="/home/user/latex-runtime"
PKG_DIR="$DEST/thtex"
RUNTIME="$PKG_DIR/public/xelatex"
URL="https://registry.npmjs.org/@arnon3339/thtex/-/thtex-0.1.1.tgz"
ICI="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$RUNTIME/runtime-manifest.json" ]; then
  echo "✓ Runtime déjà présent dans $RUNTIME"
else
  echo "→ Téléchargement du moteur XeLaTeX WASM (~27 Mo)…"
  mkdir -p "$DEST"
  curl -fsSL --retry 3 -o "$DEST/thtex.tgz" "$URL"
  echo "→ Extraction…"
  tar xzf "$DEST/thtex.tgz" -C "$DEST"
  rm -f "$DEST/thtex.tgz"
  # le tarball s'extrait dans package/ : on renomme
  [ -d "$DEST/package" ] && mv "$DEST/package" "$PKG_DIR"
  echo "✓ Moteur installé : $RUNTIME"
fi

echo "→ Ajout des polices Latin Modern 17 pt (complément)…"
python3 - "$ICI" "$RUNTIME" <<'EOF'
import json, os, shutil, sys
ici, runtime = sys.argv[1], sys.argv[2]
polices = os.path.join(ici, "polices")
mp = os.path.join(runtime, "runtime-manifest.json")
m = json.load(open(mp))
existants = {f["path"] for f in m["files"]}
for nom in sorted(os.listdir(polices)):
    src = os.path.join(polices, nom)
    dest = os.path.join(runtime, "fonts", nom)
    shutil.copyfile(src, dest)
    rel = f"fonts/{nom}"
    if rel not in existants:
        m["files"].append({"path": rel, "size": os.path.getsize(dest)})
        print(f"  + {rel} ({os.path.getsize(dest)} octets)")
json.dump(m, open(mp, "w"))
print(f"✓ Manifeste à jour : {len(m['files'])} fichiers")
EOF

echo "✅ Installation terminée. Test : bash outils_latex/compiler.sh <fichier.tex>"
