#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  compiler.sh — Compile un fichier LaTeX (.tex) en PDF avec le moteur
#  XeLaTeX WebAssembly installé dans /home/user/latex-runtime.
#
#  Usage :
#    bash outils_latex/compiler.sh document.tex              → document.pdf
#    bash outils_latex/compiler.sh document.tex -o out.pdf   → out.pdf
#    bash outils_latex/compiler.sh document.tex --passes 3   (3 passes XeTeX)
#
#  Si le runtime n'est pas encore installé, il est installé automatiquement.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f /home/user/latex-runtime/thtex/public/xelatex/runtime-manifest.json ]; then
  echo "→ Runtime XeLaTeX absent, installation…"
  bash "$ICI/installer_runtime.sh"
fi

exec node "$ICI/xelatex.mjs" "$@"
