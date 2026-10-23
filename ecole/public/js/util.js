/* Terminish École — utilitaires partagés (landing + application) */
(function () {
  'use strict';

  /**
   * Adresse de base du serveur (API). Vide = même origine (cas normal).
   * Utile quand l'interface est servie par un hébergeur statique (Firebase
   * Hosting) et que l'API tourne ailleurs : voir public/config.js.
   */
  function apiBase() {
    const base = (typeof window !== 'undefined' && window.TERMINISH_API_BASE) || '';
    return String(base).replace(/\/+$/, '');
  }
  /** Transforme « /api/... », « /print/... », « /media/... » en URL absolue. */
  function lienServeur(chemin) {
    const base = apiBase();
    if (!base) return chemin;
    return base + (chemin.startsWith('/') ? chemin : '/' + chemin);
  }

  async function api(path, opts = {}) {
    const init = { credentials: 'same-origin', headers: {}, ...opts };
    if (opts.body && !(opts.body instanceof FormData)) {
      init.headers['Content-Type'] = 'application/json';
      init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    }
    const res = await fetch(lienServeur(path), init);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Erreur ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmt(n, d = 2) {
    if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '—';
    return Number(n).toFixed(d).replace('.', ',');
  }
  function money(n, devise = 'FCFA') {
    return `${Number(n || 0).toLocaleString('fr-FR')} ${devise}`;
  }
  function dateFr(d, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('fr-FR', opts);
  }
  function heureFr(d) {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt) ? '' : dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  function initiales(nom) {
    return String(nom || '?').replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  }
  function toast(message, type = 'ok', ms = 3800) {
    let host = document.getElementById('toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toasts'; document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = 'toast ' + (type === 'err' ? 'err' : 'ok');
    el.innerHTML = `<span>${type === 'err' ? '⚠️' : '✅'}</span><span>${esc(message)}</span>`;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, ms);
  }

  /** Modale générique. Retourne { close, root }. */
  function modal({ title = '', body = '', footer = '', size = '', onMount, onClose } = {}) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `
      <div class="modal ${size}" role="dialog" aria-modal="true">
        <header><h3>${esc(title)}</h3><button class="x" data-close aria-label="Fermer">✕</button></header>
        <div class="body">${body}</div>
        ${footer ? `<footer>${footer}</footer>` : ''}
      </div>`;
    document.body.appendChild(back);
    const close = () => { back.remove(); if (onClose) onClose(); };
    back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });
    if (onMount) onMount(back.querySelector('.modal'), close);
    return { root: back.querySelector('.modal'), close };
  }

  function confirmer(message, { titre = 'Confirmation', danger = true, ok = 'Confirmer' } = {}) {
    return new Promise(resolve => {
      let choix = false;
      modal({
        title: titre, size: 'small',
        body: `<p style="margin:0;line-height:1.6;font-size:14px">${message}</p>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button>
                 <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" data-ok>${esc(ok)}</button>`,
        onMount(root, close) {
          root.querySelector('[data-ok]').onclick = () => { choix = true; close(); resolve(true); };
        },
        onClose: () => { if (!choix) resolve(false); }
      });
    });
  }

  function download(filename, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /** Lecture d'un fichier image en data URL, avec redimensionnement (logo). */
  function readImage(file, maxSize = 400) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(type, 0.9));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function moyenneCalc(notes, formule = 'co2') {
    const num = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(String(v).replace(',', '.'));
      return Number.isNaN(n) ? null : n;
    };
    const d = notes.map(num).filter(n => n !== null);
    const devoirs = d.slice(0, 2);
    const co = d[2] !== undefined ? d[2] : null;
    const dev = devoirs.length ? devoirs.reduce((a, b) => a + b, 0) / devoirs.length : null;
    if (dev === null && co === null) return null;
    if (formule === 'moy_co') {
      if (dev !== null && co !== null) return (dev + co) / 2;
      return dev !== null ? dev : co;
    }
    if (dev !== null && co !== null) return (dev + 2 * co) / 3;
    return dev !== null ? dev : co;
  }

  window.api = api;
  window.apiBase = apiBase;
  window.lienServeur = lienServeur;
  window.esc = esc;
  window.fmt = fmt;
  window.money = money;
  window.dateFr = dateFr;
  window.heureFr = heureFr;
  window.initiales = initiales;
  window.toast = toast;
  window.modal = modal;
  window.confirmer = confirmer;
  window.download = download;
  window.readImage = readImage;
  window.moyenneCalc = moyenneCalc;
})();
