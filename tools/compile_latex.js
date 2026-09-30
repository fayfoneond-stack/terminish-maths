#!/usr/bin/env node
/*
 * compile_latex.js — compilateur LaTeX hors-ligne pour ce dépôt.
 *
 * Utilise le paquet npm « texlive » (pdfTeX 1.40.11 compilé en asm.js + une
 * arborescence TeX Live complète) comme moteur, piloté depuis Node via le
 * protocole de messages de son web-worker. Aucun accès réseau au moment de
 * la compilation.
 *
 * Mise en place (une seule fois) :
 *   mkdir -p /tmp/tl && cd /tmp/tl && npm pack texlive && tar xzf texlive-*.tgz
 *   (l'arborescence est alors dans /tmp/tl/package)
 *
 * Utilisation :
 *   node tools/compile_latex.js entree.tex sortie.pdf [/chemin/vers/package]
 *
 * Auteur : généré pour le dépôt terminish-maths.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TEX = process.argv[2];
const OUT = process.argv[3];
const PKG = process.argv[4] || process.env.TEXLIVE_PKG || '/tmp/tl/package';
if (!TEX || !OUT) {
  console.error('usage: node tools/compile_latex.js entree.tex sortie.pdf [chemin_du_paquet_texlive]');
  process.exit(2);
}
if (!fs.existsSync(path.join(PKG, 'pdftex-worker.js'))) {
  console.error('paquet texlive introuvable dans ' + PKG);
  process.exit(2);
}

/* ---------- XMLHttpRequest synchrone, branché sur le disque ---------- */
class XHR {
  constructor() { this.headers = {}; this.status = 0; this.response = null; this.responseType = ''; this.readyState = 0; }
  open(m, u) { this.method = m; this.url = u; this.readyState = 1; }
  setRequestHeader(k, v) { this.headers[String(k).toLowerCase()] = v; }
  getResponseHeader(n) {
    n = String(n).toLowerCase();
    if (n === 'content-length') return String(this._buf ? this._buf.length : 0);
    if (n === 'content-type') return this.responseType === 'arraybuffer' ? 'application/octet-stream' : 'text/plain';
    return null;
  }
  getAllResponseHeaders() { return 'content-length: ' + (this._buf ? this._buf.length : 0) + '\r\n'; }
  _resolve(url) {
    let u = String(url).split('?')[0];
    if (u.startsWith('file://')) u = u.slice(7);
    if (u.startsWith(PKG)) return u;
    if (u.startsWith('/')) {
      const p1 = path.join(PKG, u);
      if (fs.existsSync(p1)) return p1;
      const p2 = path.join(PKG, 'texlive', u);
      if (fs.existsSync(p2)) return p2;
      return p1;
    }
    return path.resolve(PKG, u);
  }
  send() {
    let buf = null;
    try { buf = fs.readFileSync(this._resolve(this.url)); } catch (e) { buf = null; }
    if (buf === null) {
      this.status = 404; this.response = null; this.readyState = 4;
      if (this.onerror) this.onerror(new Error('404 ' + this.url));
      return;
    }
    const range = this.headers['range'];
    let status = 200;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] === '' ? Math.max(0, buf.length - parseInt(m[2], 10)) : parseInt(m[1], 10);
        const end = (m[1] !== '' && m[2] !== '') ? Math.min(buf.length - 1, parseInt(m[2], 10)) : buf.length - 1;
        buf = buf.slice(start, end + 1);
        status = 206;
      }
    }
    this._buf = buf; this.status = status; this.readyState = 4;
    if (this.responseType === 'arraybuffer') {
      const ab = new ArrayBuffer(buf.length);
      new Uint8Array(ab).set(buf);
      this.response = ab;
    } else {
      this.response = buf.toString('binary');
    }
    if (this.onreadystatechange) this.onreadystatechange();
    if (this.onload) this.onload();
  }
}

/* ---------- bac à sable imitant un web-worker ---------- */
const sandbox = {};
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = console;
sandbox.XMLHttpRequest = XHR;
sandbox.setTimeout = setTimeout;
sandbox.clearTimeout = clearTimeout;
sandbox.setInterval = setInterval;
sandbox.clearInterval = clearInterval;
sandbox.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
sandbox.atob = (s) => Buffer.from(s, 'base64').toString('binary');
sandbox.navigator = { userAgent: 'Mozilla/5.0 (Node)' };
sandbox.location = { href: 'file://' + PKG + '/' };
sandbox.performance = { now: () => Date.now() };
sandbox.URL = URL;
sandbox.importScripts = function () {};      // → emscripten autorise les XHR synchrones
sandbox.self.importScripts = sandbox.importScripts;

const waiters = {};
let readyResolve;
const ready = new Promise((r) => (readyResolve = r));

sandbox.postMessage = function (msg) {
  let data;
  try { data = typeof msg === 'string' ? JSON.parse(msg) : msg; } catch (e) { return; }
  if (data.msg_id !== undefined && waiters[data.msg_id]) {
    const w = waiters[data.msg_id]; delete waiters[data.msg_id]; w(data); return;
  }
  if (data.command === 'stdout') process.stdout.write(String(data.contents));
  else if (data.command === 'stderr') process.stderr.write(String(data.contents));
  else if (data.command === 'ready') readyResolve();
  else if (data.command === 'error') console.error('[moteur] ' + data.message);
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(PKG, 'pdftex-worker.js'), 'utf8'), sandbox, { filename: 'pdftex-worker.js' });

let msgId = 0;
function send(command, args) {
  const id = msgId++;
  return new Promise((resolve) => {
    waiters[id] = resolve;
    ready.then(() => sandbox.onmessage({ data: JSON.stringify({ command, arguments: args, msg_id: id }) }));
  });
}

(async function main() {
  await ready;
  // latin1 : les octets UTF-8 du fichier doivent parvenir tels quels à pdfTeX
  const source = fs.readFileSync(TEX).toString('latin1');
  await send('FS_createDataFile', ['/', 'input.tex', source, true, true]);
  await send('FS_createLazyFilesFromList', ['/', 'texlive.lst', './texlive', true, true]);
  const res = await send('run', ['-interaction=nonstopmode', '-output-format', 'pdf', 'input.tex']);
  if (res.command !== 'success') console.error('[compilation] ' + res.command + ' ' + (res.message || ''));
  const pdf = await send('FS_readFile', ['/input.pdf']);
  if (typeof pdf.result !== 'string') { console.error('[compilation] aucun PDF produit'); process.exit(1); }
  fs.writeFileSync(OUT, Buffer.from(pdf.result, 'binary'));
  console.log('\n[compilation] ' + OUT + ' (' + fs.statSync(OUT).size + ' octets)');
})().catch((e) => { console.error(e); process.exit(1); });
