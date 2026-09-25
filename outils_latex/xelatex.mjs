#!/usr/bin/env node
/**
 * xelatex.mjs — Adaptateur Node.js pour le moteur XeLaTeX WebAssembly (thtex).
 *
 * Compile un fichier .tex en PDF via le worker WebAssembly d'@arnon3339/thtex,
 * sans navigateur : on shimme `self`, `fetch` (file://) et on importe le worker.
 *
 * Usage :
 *   node xelatex.mjs document.tex [-o sortie.pdf] [--passes N] [--workdir DIR]
 *                                 [--extra chemin=dans_vfs:fichier_local ...]
 *
 * Runtime attendu dans : /home/user/latex-runtime/thtex/public/xelatex/
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";

const RUNTIME_ROOT = process.env.THX_RUNTIME
  ?? "/home/user/latex-runtime/thtex/public/xelatex";
const THX_DIST = process.env.THX_DIST
  ?? "/home/user/latex-runtime/thtex/dist";
const WORKER_FILE = path.join(THX_DIST, "xelatex.worker.js");

/* ─────────────────────────── Arguments CLI ─────────────────────────── */
function parseArgs(argv) {
  const opts = {
    input: null,
    output: null,
    passes: 2,
    workdir: null,
    extra: [], // { vfsPath, localPath }
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-o" || a === "--output") opts.output = argv[++i];
    else if (a === "--passes") opts.passes = Number(argv[++i]);
    else if (a === "--workdir") opts.workdir = argv[++i];
    else if (a === "--extra") {
      const spec = argv[++i]; // "dans_vfs:fichier_local"
      const idx = spec.indexOf(":");
      if (idx < 1) throw new Error(`--extra attend "vfs:local", reçu : ${spec}`);
      opts.extra.push({
        vfsPath: spec.slice(0, idx),
        localPath: spec.slice(idx + 1),
      });
    }
    else if (a === "-h" || a === "--help") usage();
    else if (!opts.input) opts.input = a;
    else throw new Error(`Argument inattendu : ${a}`);
  }
  if (!opts.input) usage();
  return opts;
}
function usage() {
  console.error("Usage : node xelatex.mjs document.tex [-o sortie.pdf] [--passes N] [--extra vfs:local ...]");
  process.exit(2);
}
const opts = parseArgs(process.argv.slice(2));

const texSource = readFileSync(opts.input, "utf8");
const outPath = opts.output
  ?? opts.input.replace(/\.tex$/i, "") + ".pdf";
const workdir = opts.workdir ?? path.dirname(path.resolve(opts.input));

/* ─────────────────────── Shims environnement "worker" ─────────────────────── */
let onResult = null; // reçoit les messages du worker
let readyResolve, readyReject;
const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
let doneResolve, doneReject;
const done = new Promise((res, rej) => { doneResolve = res; doneReject = rej; });

globalThis.self = {
  // Le worker déduit toutes ses URLs de son propre emplacement :
  // on le fait pointer vers le dossier runtime (engine/, texmf/, manifeste…).
  location: { href: pathToFileURL(path.join(RUNTIME_ROOT, "xelatex.worker.js")).href },
  postMessage(message) {
    switch (message.type) {
      case "ready":
        console.error(`[moteur] prêt (${message.runtimeFileCount} fichiers runtime, ${Math.round(message.runtimeBytes / 1e6)} Mo)`);
        readyResolve();
        break;
      case "initialization-error":
        readyReject(new Error(message.message));
        break;
      case "initialization-status":
        console.error(`[moteur] ${message.message}`);
        break;
      case "status":
        console.error(`[compil] ${message.message}`);
        break;
      case "log":
        break; // log verbeux XeTeX : désactivé par défaut
      case "success":
        onResult?.({ ok: true, pdf: message.pdf, log: message.log, passes: message.passes });
        doneResolve();
        break;
      case "error":
        onResult?.({ ok: false, message: message.message, log: message.log });
        doneResolve();
        break;
      default:
        console.error(`[worker] message inconnu : ${message.type}`);
    }
  },
};
// Le worker lit `event.data` :
self.onmessage = null; // sera posé par le worker lui-même

// fetch(file://…) → lecture système de fichiers + Response Node
const nodeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input instanceof URL ? input.href : input?.url);
  if (typeof url !== "string") throw new TypeError(`fetch : URL non reconnue (${typeof input})`);
  if (url.startsWith("file://")) {
    const p = fileURLToPath(url);
    const bytes = readFileSync(p);
    const enTetes = p.endsWith(".wasm")
      ? { headers: { "content-type": "application/wasm" } }
      : {};
    return new Response(bytes, { status: 200, ...enTetes });
  }
  return nodeFetch(input, init);
};

/* ─────────────────────────── Lancement ─────────────────────────── */
if (!existsSync(WORKER_FILE)) {
  console.error(`Runtime introuvable : ${WORKER_FILE}`);
  console.error("Installez-le avec : bash outils_latex/installer_runtime.sh");
  process.exit(3);
}
await import(pathToFileURL(WORKER_FILE).href);
await ready; // moteurs wasm + arbre texmf chargés

const additionalFiles = opts.extra.map((e) => ({
  path: e.vfsPath,
  data: new Uint8Array(readFileSync(e.localPath)),
}));

onResult = (r) => { globalThis.__result = r; };
self.onmessage({
  data: {
    type: "compile",
    requestId: `cli-${Date.now()}`,
    source: texSource,
    passes: Math.min(5, Math.max(1, opts.passes)),
    bibtex: false,
    additionalFiles,
  },
});
await done;

const r = globalThis.__result;
if (!r?.ok) {
  console.error(`\n✖ Échec de la compilation : ${r?.message ?? "erreur inconnue"}`);
  const logFile = (opts.output ?? opts.input).replace(/\.(pdf|tex)?$/i, "") + ".log";
  writeFileSync(logFile, r?.log ?? "(log vide)");
  console.error(`  Journal complet : ${logFile}`);
  process.exit(1);
}

mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
writeFileSync(outPath, Buffer.from(r.pdf));
const log = r.log ?? "";
const pages = (log.match(/Output written on .*?\((\d+) page/) ?? [])[1];
console.error(`\n✔ PDF généré : ${outPath}${pages ? ` — ${pages} page(s)` : ""} (${r.passes} passe(s) XeTeX)`);
if (log.includes("LaTeX Warning")) {
  const warns = [...new Set(log.split("\n").filter((l) => l.includes("LaTeX Warning")))];
  for (const w of warns.slice(0, 6)) console.error(`  ⚠ ${w.trim()}`);
}
process.exit(0);
