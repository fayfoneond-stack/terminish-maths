#!/usr/bin/env node
/**
 * Chaîne de production PDF TERMINISH
 * HTML (avec KaTeX)  ->  PDF A4 imprimable
 *
 * Usage :
 *   node render.mjs source.html sortie.pdf [--sans-entete] [--titre "..."]
 *
 * Le script :
 *   1. prépare l'environnement (bibliothèques NSS + Chromium patché) si besoin ;
 *   2. charge le fichier HTML local (KaTeX rend les formules $...$ et $$...$$) ;
 *   3. génère un PDF A4 avec en-tête/pied de page de la charte TERMINISH.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PYTHON = process.env.TERMINISH_PYTHON || 'python3';
let CHROMIUM_PATCHE = '';   // défini à côté du binaire extrait (libGLESv2.so, swiftshader…)

// ---------------------------------------------------------------- arguments
const args = process.argv.slice(2);
const options = { entete: true, titre: 'TERMINISH' };
const positionnels = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--sans-entete') options.entete = false;
  else if (args[i] === '--titre') options.titre = args[++i];
  else positionnels.push(args[i]);
}
const [source, sortie] = positionnels;
if (!source || !sortie) {
  console.error('Usage : node render.mjs source.html sortie.pdf [--sans-entete] [--titre "..."]');
  process.exit(1);
}

// ------------------------------------------------------------ environnement
function preparerBibliothequesNSS() {
  const dossier = path.join(ICI, 'nss');
  if (fs.existsSync(path.join(dossier, 'libnss3.so'))) return dossier;
  console.log('  · installation des bibliothèques NSS…');
  execFileSync('bash', [path.join(ICI, 'setup_nss.sh')], { stdio: 'inherit' });
  return dossier;
}

async function preparerChromium() {
  const brut = await chromium.executablePath();          // extrait Chromium dans /tmp
  CHROMIUM_PATCHE = path.join(path.dirname(brut), 'chromium-terminish');
  if (!fs.existsSync(CHROMIUM_PATCHE) ||
      fs.statSync(CHROMIUM_PATCHE).mtimeMs < fs.statSync(brut).mtimeMs) {
    console.log('  · adaptation du binaire Chromium (NSS)…');
    execFileSync(PYTHON, [path.join(ICI, 'patch_chromium_nss.py'), brut, CHROMIUM_PATCHE],
                 { stdio: 'inherit' });
    fs.chmodSync(CHROMIUM_PATCHE, 0o755);
  }
  return CHROMIUM_PATCHE;
}

// ------------------------------------------------------------------- rendu
const libsNSS = preparerBibliothequesNSS();
const executable = await preparerChromium();

const navigateur = await puppeteer.launch({
  executablePath: executable,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--single-process', '--no-zygote', '--disable-gpu', '--in-process-gpu',
    '--font-render-hinting=none', '--disable-lcd-text',
    '--allow-file-access-from-files', '--hide-scrollbars',
    '--disable-print-preview', '--export-tagged-pdf', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--force-color-profile=srgb',
    '--disable-features=Translate,BackForwardCache,OptimizationHints',
    '--window-size=1240,1754',
  ],
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: libsNSS },
});

try {
  const page = await navigateur.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });

  const url = 'file://' + path.resolve(source);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });

  // attendre le rendu des formules et le chargement des polices
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(images.map((i) => i.complete ? null :
      new Promise((r) => { i.onload = i.onerror = r; })));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });

  const titreDoc = options.titre || (await page.title()) || 'TERMINISH';

  const enTete = `
    <div style="font-family:'DejaVu Serif',serif;font-size:7.5pt;color:#1f3a5f;
                width:100%;padding:0 16mm;display:flex;justify-content:space-between;">
      <span>KODJONE Kodjo</span><span>LYKPETA KPALIME</span><span>${titreDoc}</span>
    </div>`;

  const pied = `
    <div style="font-family:'DejaVu Serif',serif;font-size:8pt;color:#1f3a5f;
                width:100%;text-align:center;">
      <span class="pageNumber"></span>
    </div>`;

  await page.emulateMediaType('print');
  await page.pdf({
    path: sortie,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: options.entete,
    headerTemplate: options.entete ? enTete : '<div></div>',
    footerTemplate: options.entete ? pied : '<div></div>',
    timeout: 180000,
  });

  if (erreurs.length) {
    console.warn('  ! messages de la page :');
    for (const e of erreurs.slice(0, 10)) console.warn('    -', e);
  }
  const taille = (fs.statSync(sortie).size / 1024).toFixed(0);
  console.log(`PDF généré : ${sortie} (${taille} Ko)`);
} finally {
  await navigateur.close();
}
