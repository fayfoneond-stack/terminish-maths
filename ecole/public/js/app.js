/* =====================================================================
   Terminish École — application de gestion scolaire
   ===================================================================== */
(function () {
  'use strict';

  const S = {
    me: null,
    etab: null,
    eleve: null,
    classes: [],
    matieres: [],
    periodes: [],
    enseignants: [],
    route: 'dashboard',
    query: {},
    examenSel: null,
    eleveSel: null
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ROLE_LABEL = {
    directeur: "Chef d'établissement",
    enseignant: 'Enseignant',
    eleve: 'Élève / Parent',
    super_admin: 'Super administrateur'
  };

  const NAV = {
    directeur: [
      { group: 'Pilotage', items: [
        { r: 'dashboard', i: '🏠', l: 'Tableau de bord' },
        { r: 'statistiques', i: '📊', l: 'Statistiques' }
      ]},
      { group: 'Scolarité', items: [
        { r: 'eleves', i: '👨‍🎓', l: 'Élèves' },
        { r: 'classes', i: '🏫', l: 'Classes' },
        { r: 'matieres', i: '📚', l: 'Matières' },
        { r: 'enseignants', i: '👩‍🏫', l: 'Enseignants' }
      ]},
      { group: 'Évaluations', items: [
        { r: 'saisie', i: '✍️', l: 'Saisie des notes' },
        { r: 'resultats', i: '🏆', l: 'Résultats' },
        { r: 'passage', i: '🎓', l: 'Décision finale' },
        { r: 'bulletins', i: '📄', l: 'Bulletins' },
        { r: 'examens', i: '🎯', l: 'Examens blancs' }
      ]},
      { group: 'Administration', items: [
        { r: 'parametres', i: '⚙️', l: 'Paramètres' },
        { r: 'abonnement', i: '💳', l: 'Abonnement' }
      ]}
    ],
    enseignant: [
      { group: 'Pilotage', items: [
        { r: 'dashboard', i: '🏠', l: 'Tableau de bord' },
        { r: 'statistiques', i: '📊', l: 'Statistiques' }
      ]},
      { group: 'Mes classes', items: [
        { r: 'saisie', i: '✍️', l: 'Saisie des notes' },
        { r: 'resultats', i: '🏆', l: 'Résultats' },
        { r: 'eleves', i: '👨‍🎓', l: 'Mes élèves' },
        { r: 'bulletins', i: '📄', l: 'Bulletins' },
        { r: 'examens', i: '🎯', l: 'Examens blancs' }
      ]}
    ],
    eleve: [
      { group: 'Mon espace', items: [
        { r: 'espace', i: '🎒', l: 'Mes résultats' }
      ]}
    ],
    super_admin: [
      { group: 'Console', items: [
        { r: 'admin', i: '🛰️', l: 'Vue d’ensemble' },
        { r: 'admin-ecoles', i: '🏫', l: 'Établissements' },
        { r: 'admin-demandes', i: '📥', l: 'Demandes' },
        { r: 'admin-paiements', i: '💳', l: 'Paiements' }
      ]}
    ]
  };

  const TITRES = {
    dashboard: ['Tableau de bord', 'Vue d’ensemble de votre établissement'],
    eleves: ['Élèves', 'Inscriptions, dossiers et suivi'],
    classes: ['Classes', 'Organisation pédagogique et coefficients'],
    matieres: ['Matières', 'Disciplines enseignées'],
    enseignants: ['Enseignants', 'Comptes et affectations'],
    saisie: ['Saisie des notes', 'Devoirs, compositions et épreuves blanches'],
    bulletins: ['Bulletins', 'Résultats, appréciations et publication'],
    statistiques: ['Statistiques', 'Analyses automatiques des résultats'],
    resultats: ['Résultats', 'Fusion de classes et classement de tous les élèves'],
    fusion: ['Résultats', 'Fusion de classes et classement de tous les élèves'],
    passage: ['Décision finale', 'Moyenne annuelle et passage dans la classe supérieure'],
    examens: ['Examens blancs', 'Planification des épreuves et simulations'],
    parametres: ['Paramètres', 'Identité de l’établissement et calcul des moyennes'],
    abonnement: ['Abonnement', 'Formule, échéance et facturation'],
    espace: ['Mes résultats', 'Bulletins et moyennes publiés'],
    admin: ['Console SaaS', 'Pilotage de la plateforme'],
    'admin-ecoles': ['Établissements', 'Clients de la plateforme'],
    'admin-demandes': ['Demandes', 'Prospects et prises de contact'],
    'admin-paiements': ['Paiements', 'Encaissements et abonnements']
  };

  /* ---------------------------------------------------------------- */
  /* Auth & démarrage                                                 */
  /* ---------------------------------------------------------------- */
  function renderLogin(message = '') {
    document.getElementById('app').innerHTML = `
      <div class="login-wrap">
        <div class="login-side">
          <a class="brand login-logo" href="/" style="color:#fff">
            <span class="brand-mark">🎓</span>
            <span class="brand-text"><b style="color:#fff">Terminish École</b><span style="color:#8fb6a6">Gestion scolaire</span></span>
          </a>
          <div>
            <h1>Le bulletin de chaque élève, calculé et prêt à signer.</h1>
            <p>Notes saisies à distance par les enseignants, moyennes et rangs automatiques, bulletins trimestriels ou semestriels aux couleurs de votre établissement.</p>
            <ul>
              <li><i>✓</i> Collèges (trimestres) et lycées (semestres)</li>
              <li><i>✓</i> Statistiques par classe, matière et élève</li>
              <li><i>✓</i> Examens blancs &amp; simulation BEPC / BAC</li>
              <li><i>✓</i> Accès sécurisé direction, enseignants, familles</li>
            </ul>
          </div>
          <div style="font-size:12px;color:#7ba291">© 2026 Terminish École · Lomé, Togo</div>
        </div>
        <div class="login-form-wrap">
          <form class="login-form" id="login-form">
            <div class="brand"><span class="brand-mark">🎓</span>
              <span class="brand-text"><b>Terminish École</b><span>Espace sécurisé</span></span></div>
            <h2>Connexion</h2>
            <p class="sub">Entrez vos identifiants pour accéder à votre espace.</p>
            ${message ? `<div class="notice err">${esc(message)}</div>` : ''}
            <div class="field"><label>Adresse email</label><input type="email" name="email" id="login-email" required autocomplete="username" placeholder="vous@ecole.tg"></div>
            <div class="field"><label>Mot de passe</label><input type="password" name="password" id="login-password" required autocomplete="current-password" placeholder="••••••••"></div>
            <button class="btn btn-primary btn-block" type="submit" id="login-btn">Se connecter</button>
            <p class="small" style="text-align:center;margin:10px 0 0">
              <a href="#" id="lien-oubli">Mot de passe oublié ?</a>
            </p>
            <div class="demo-accounts">
              <div class="lbl">Comptes de démonstration</div>
              <button type="button" data-demo="directeur@demo.tg|demo1234"><span>👔</span><span><b>Direction</b> — chef d'établissement</span><span class="role">directeur</span></button>
              <button type="button" data-demo="prof.maths@demo.tg|prof1234"><span>👩‍🏫</span><span><b>Enseignant</b> — M. Agbeko (Maths)</span><span class="role">prof</span></button>
              <button type="button" data-demo="eleve@demo.tg|eleve1234"><span>🎒</span><span><b>Élève / Parent</b></span><span class="role">famille</span></button>
              <button type="button" data-demo="admin@terminish.tg|admin1234"><span>🛰️</span><span><b>Console SaaS</b> — Terminish</span><span class="role">éditeur</span></button>
            </div>
            <p class="small muted" style="margin-top:16px;text-align:center">Pas encore de compte ? <a href="#inscription">Créer un établissement</a> · <a href="/">Retour au site</a></p>
          </form>
        </div>
      </div>`;

    $$('[data-demo]').forEach(b => {
      b.onclick = () => {
        const [e, p] = b.dataset.demo.split('|');
        $('#login-email').value = e;
        $('#login-password').value = p;
        $('#login-form').requestSubmit();
      };
    });
    $('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('#login-btn');
      btn.disabled = true; btn.textContent = 'Connexion…';
      try {
        await api('/api/auth/login', { method: 'POST', body: {
          email: $('#login-email').value, password: $('#login-password').value
        }});
        await boot();
        toast('Bienvenue sur Terminish École');
      } catch (err) {
        renderLogin(err.message);
      }
    };
    const lienOubli = $('#lien-oubli');
    if (lienOubli) lienOubli.onclick = (ev) => {
      ev.preventDefault();
      const emailSaisi = $('#login-email').value || '';
      const m = modal({
        title: 'Mot de passe oublié',
        body: `<div class="notice info">Indiquez l'<b>adresse de connexion</b> :
            les chefs d'établissement et le super-administrateur peuvent recevoir un lien par e-mail
            (valable 30 minutes, si Gmail est configuré). Pour un enseignant, la demande est transmise
            au chef, qui lui communique un nouveau mot de passe. Aucun e-mail n'est envoyé aux enseignants.</div>
          <form id="oubli-form">
            <div class="field"><label>Adresse e-mail de connexion *</label>
              <input type="email" name="email" id="oubli-email" required autocomplete="username" value="${esc(emailSaisi)}" placeholder="vous@ecole.tg"></div>
            <div class="field"><label>Précisez si besoin (enseignants seulement)</label>
              <input name="message" maxlength="400" placeholder="Ex. : professeur de SVT en 4ème B"></div>
          </form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button>
                 <button class="btn btn-primary btn-sm" id="oubli-envoyer">Continuer</button>`
      });
      m.root.querySelector('#oubli-envoyer').onclick = async () => {
        const form = m.root.querySelector('#oubli-form');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form).entries());
        const btn = m.root.querySelector('#oubli-envoyer');
        btn.disabled = true; btn.textContent = 'Traitement…';
        try {
          const res = await api('/api/auth/oubli', { method: 'POST', body: data });
          m.root.querySelector('.body').innerHTML = `<div class="notice info" role="status">${esc(res.message)}</div>`;
          m.root.querySelector('footer').innerHTML = '<button class="btn btn-primary btn-sm" data-close>Fermer</button>';
        } catch (e) {
          toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Continuer';
        }
      };
    };
    setTimeout(() => $('#login-email') && $('#login-email').focus(), 60);
  }

  /** Le jeton reste dans le fragment (#), jamais dans une URL envoyée au serveur. */
  async function renderReinitialisation() {
    const jeton = location.hash.match(/^#\/reinitialiser\/([a-f0-9]{64})$/)?.[1];
    document.getElementById('app').innerHTML = `
      <div class="login-wrap">
        <div class="login-side">
          <a class="brand login-logo" href="/" style="color:#fff"><span class="brand-mark">🎓</span>
            <span class="brand-text"><b style="color:#fff">Terminish École</b><span>Gestion scolaire</span></span></a>
          <div><h1>Votre accès, en toute sécurité.</h1>
            <p>Choisissez un nouveau mot de passe pour reprendre le travail dans votre établissement.</p></div>
          <div style="font-size:12px;color:#7ba291">© 2026 Terminish École · Lomé, Togo</div>
        </div>
        <div class="login-form-wrap">
          <form class="login-form" id="reinit-form">
            <div class="brand"><span class="brand-mark">🎓</span>
              <span class="brand-text"><b>Terminish École</b><span>Récupération du compte</span></span></div>
            <h2>Nouveau mot de passe</h2>
            <p class="sub">Lien réservé aux chefs d'établissement et au super-administrateur.</p>
            <div id="reinit-etat" role="status" aria-live="polite" class="notice info">Vérification du lien…</div>
            <div class="field"><label for="reinit-nouveau">Nouveau mot de passe *</label>
              <input id="reinit-nouveau" type="password" required minlength="12" maxlength="128" autocomplete="new-password" placeholder="12 caractères minimum"></div>
            <div class="field"><label for="reinit-confirmation">Confirmer le mot de passe *</label>
              <input id="reinit-confirmation" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></div>
            <button type="submit" class="btn btn-primary btn-block" id="reinit-envoyer" disabled>Enregistrer et fermer les anciennes sessions</button>
            <p class="small" style="text-align:center;margin-top:16px"><a href="/app" id="reinit-retour">Retour à la connexion</a></p>
          </form>
        </div>
      </div>`;
    const formulaire = $('#reinit-form');
    const etat = $('#reinit-etat');
    const bouton = $('#reinit-envoyer');
    // Empêche l'envoi natif du formulaire pendant la vérification du jeton.
    formulaire.addEventListener('submit', ev => ev.preventDefault());
    const invalider = texte => {
      etat.className = 'notice err'; etat.textContent = texte;
      formulaire.querySelectorAll('.field, button[type=submit]').forEach(el => { el.hidden = true; });
    };
    if (!jeton) {
      invalider('Lien invalide. Demandez un nouveau lien depuis la connexion.');
      return;
    }
    try {
      const resultat = await api('/api/auth/recuperation/verifier', { method: 'POST', body: { jeton } });
      if (!formulaire.isConnected) return;
      if (!resultat.valide) {
        invalider('Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau depuis la connexion.');
        return;
      }
      etat.textContent = 'Lien valide pendant 30 minutes après son envoi. Votre ancien mot de passe cessera de fonctionner.';
      bouton.disabled = false;
    } catch (_) {
      if (formulaire.isConnected) invalider('Impossible de vérifier ce lien. Rechargez la page ou réessayez plus tard.');
      return;
    }
    formulaire.onsubmit = async ev => {
      ev.preventDefault();
      const nouveau = $('#reinit-nouveau').value;
      if (nouveau !== $('#reinit-confirmation').value) {
        etat.className = 'notice err'; etat.textContent = 'Les deux mots de passe sont différents.';
        return;
      }
      bouton.disabled = true; bouton.textContent = 'Enregistrement…';
      try {
        const resultat = await api('/api/auth/recuperation/terminer', {
          method: 'POST', body: { jeton, nouveau }
        });
        history.replaceState(null, '', location.pathname + location.search); // ôter le jeton de l'adresse
        S.me = null; S.etab = null;
        formulaire.innerHTML = `<div class="brand"><span class="brand-mark">🎓</span>
          <span class="brand-text"><b>Terminish École</b><span>Accès sécurisé</span></span></div>
          <h2>Mot de passe modifié</h2><div class="notice info" role="status">${esc(resultat.message)}</div>
          <a class="btn btn-primary btn-block" href="/app">Se connecter</a>`;
      } catch (e) {
        etat.className = 'notice err'; etat.textContent = e.message;
        bouton.disabled = false; bouton.textContent = 'Enregistrer et fermer les anciennes sessions';
      }
    };
  }

  function renderInscription() {
    document.getElementById('app').innerHTML = `
      <div class="login-wrap">
        <div class="login-side">
          <a class="brand login-logo" href="/" style="color:#fff">
            <span class="brand-mark">🎓</span>
            <span class="brand-text"><b style="color:#fff">Terminish École</b><span style="color:#8fb6a6">Gestion scolaire</span></span>
          </a>
          <div>
            <h1>Créez votre établissement en 2 minutes.</h1>
            <p>Essai gratuit de 30 jours, sans engagement et sans carte bancaire. Toutes les fonctionnalités sont débloquées pendant l'essai.</p>
            <ul>
              <li><i>✓</i> Bulletins trimestriels et semestriels automatiques</li>
              <li><i>✓</i> Saisie des notes à distance par les enseignants</li>
              <li><i>✓</i> Statistiques et examens blancs inclus</li>
            </ul>
          </div>
          <div style="font-size:12px;color:#7ba291">Déjà inscrit ? <a href="#" id="to-login" style="color:#f0b429">Se connecter</a></div>
        </div>
        <div class="login-form-wrap">
          <form class="login-form" id="signup-form">
            <div class="brand"><span class="brand-mark">🎓</span>
              <span class="brand-text"><b>Terminish École</b><span>Nouvel établissement</span></span></div>
            <h2>Créer mon établissement</h2>
            <p class="sub">Vous serez le chef d'établissement administrateur.</p>
            <div class="field"><label>Nom de l'établissement *</label><input name="etablissement" required placeholder="Complexe Scolaire ..."></div>
            <div class="grid2">
              <div class="field"><label>Type *</label>
                <select name="type" required>
                  <option value="mixte">Collège + Lycée</option>
                  <option value="college">Collège uniquement</option>
                  <option value="lycee">Lycée uniquement</option>
                </select>
              </div>
              <div class="field"><label>Ville</label><input name="ville" placeholder="Lomé"></div>
            </div>
            <div class="grid2">
              <div class="field"><label>Votre nom *</label><input name="nom" required placeholder="M. Kodjo AMEGAN"></div>
              <div class="field"><label>Téléphone</label><input name="telephone" placeholder="+228 ..."></div>
            </div>
            <div class="field"><label>Email de connexion *</label><input name="email" type="email" required placeholder="direction@ecole.tg"></div>
            <div class="field"><label>Mot de passe *</label><input name="password" type="password" required minlength="6" placeholder="6 caractères minimum"><div class="hint">Conservez-le : il donne accès à tous les bulletins.</div></div>
            <button class="btn btn-gold btn-block" type="submit">Démarrer mon essai gratuit</button>
            <p class="small muted" style="margin-top:14px;text-align:center">En créant un compte, vous acceptez les conditions d'utilisation.</p>
          </form>
        </div>
      </div>`;
    $('#to-login').onclick = (e) => { e.preventDefault(); location.hash = ''; renderLogin(); };
    $('#signup-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const data = Object.fromEntries(new FormData(f).entries());
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Création…';
      try {
        await api('/api/inscription', { method: 'POST', body: data });
        await boot();
        toast('Votre établissement est créé. Bienvenue !');
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false; btn.textContent = 'Démarrer mon essai gratuit';
      }
    };
  }

  function defaultRoute() {
    if (!S.me) return 'dashboard';
    if (S.me.role === 'super_admin') return 'admin';
    if (S.me.role === 'eleve') return 'espace';
    return 'dashboard';
  }

  async function loadRefs() {
    const tasks = [
      api('/api/classes').then(d => S.classes = d).catch(() => S.classes = []),
      api('/api/matieres').then(d => S.matieres = d).catch(() => S.matieres = []),
      api('/api/periodes').then(d => S.periodes = d).catch(() => S.periodes = [])
    ];
    await Promise.all(tasks);
  }

  async function boot() {
    const me = await api('/api/me');
    S.me = me.user;
    S.affectations = me.affectations || [];
    S.signature = me.signature || null;
    S.etab = me.etablissement;
    S.eleve = me.eleve;
    document.title = S.etab ? `${S.etab.nom} — Terminish École` : 'Terminish École';
    await loadRefs();
    buildShell();
    const route = parseHash().route || defaultRoute();
    if (!location.hash || location.hash === '#' || location.hash === '') location.hash = '#/' + route;
    else await renderRoute();
  }

  /* ---------------------------------------------------------------- */
  /* Coquille de l'application                                        */
  /* ---------------------------------------------------------------- */
  function navFor(role) { return NAV[role] || NAV.directeur; }

  function buildShell() {
    const role = S.me.role;
    const nav = navFor(role).map(g => `
      <div class="sb-label">${esc(g.group)}</div>
      ${g.items.map(it => `<a class="sb-item" data-route="${it.r}" href="#/${it.r}"><span class="i">${it.i}</span>${esc(it.l)}</a>`).join('')}
    `).join('');
    const ecoleBloc = S.etab ? `
      <div class="sb-ecole">
        ${(S.etab.logo_url || S.etab.logo) ? `<img src="${S.etab.logo_url || S.etab.logo}" alt="logo">` : `<div class="ph">${esc((S.etab.nom || 'E').slice(0, 1))}</div>`}
        <div style="min-width:0"><b>${esc(S.etab.nom)}</b><span>${esc(S.etab.annee_scolaire || '')} · ${esc(S.etab.ville || '')}</span></div>
      </div>` : '';

    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        <aside class="sidebar" id="sidebar">
          <a class="brand" href="/" title="Site public">
            <span class="brand-mark">🎓</span>
            <span class="brand-text"><b>Terminish École</b><span>${esc(ROLE_LABEL[role] || '')}</span></span>
          </a>
          ${ecoleBloc}
          ${nav}
          <div class="sb-foot">
            ${role === 'directeur' ? `<a href="#" id="btn-base" title="Voir le dossier et le fichier de données réellement utilisés">🗄️ Base de données</a><br>` : ''}
            <a href="/" target="_blank" rel="noopener">Site public ↗</a><br>
            <span>© 2026 Terminish École</span>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="burger" id="burger" aria-label="Menu">☰</button>
            <div><h1 id="page-title">Tableau de bord</h1><div class="crumb" id="page-sub"></div></div>
            <div class="topbar-right">
              <span class="tag vert" id="annee-tag">${esc(S.etab ? (S.etab.annee_scolaire || '') : 'Plateforme')}</span>
              <div class="userbox"><b>${esc(S.me.nom)}</b><span>${esc(ROLE_LABEL[role] || role)}</span></div>
              <div class="avatar">${esc(initiales(S.me.nom))}</div>
              <button class="icon-btn" id="btn-logout" title="Se déconnecter">⎋</button>
            </div>
          </header>
          <div class="content" id="content"></div>
        </div>
      </div>`;

    /* ---------------- Menu latéral sur téléphone ----------------
       Sur petit écran le menu est un tiroir. Il doit se refermer dès qu'on
       choisit une rubrique ou qu'on touche la page à côté, sinon il reste
       par-dessus le site (on ne voyait plus rien derrière). */
    const voile = document.createElement('button');
    voile.className = 'sb-voile';
    voile.type = 'button';
    voile.setAttribute('aria-label', 'Fermer le menu');
    voile.tabIndex = -1;
    document.getElementById('app').appendChild(voile);

    const fermerMenu = () => {
      $('#sidebar').classList.remove('open');
      voile.classList.remove('show');
    };
    const ouvrirMenu = () => {
      $('#sidebar').classList.add('open');
      voile.classList.add('show');
    };
    $('#burger').onclick = () => {
      if ($('#sidebar').classList.contains('open')) fermerMenu(); else ouvrirMenu();
    };
    voile.onclick = fermerMenu;
    $('#sidebar').addEventListener('click', (e) => {
      if (e.target.closest('.sb-item')) fermerMenu();
    });
    // Échap referme (clavier des Chromebooks), et un retour à l'accueil aussi.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fermerMenu();
    });
    // Rotation du téléphone ou retour au grand écran : on referme le tiroir.
    window.addEventListener('resize', () => {
      if (window.innerWidth > 960) fermerMenu();
    });
    const btnBase = $('#btn-base');
    if (btnBase) btnBase.onclick = (e) => { e.preventDefault(); App.voirBase(); };
    $('#btn-logout').onclick = async () => {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      S.me = null; location.hash = '';
      renderLogin();
      toast('Vous êtes déconnecté');
    };
  }

  function parseHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    if (raw.startsWith('inscription')) return { route: 'inscription', query: {} };
    const [path, qs] = raw.split('?');
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => query[k] = v);
    return { route: path || '', query };
  }

  const ACCESS = {
    directeur: ['dashboard', 'eleves', 'classes', 'matieres', 'enseignants', 'saisie', 'bulletins', 'statistiques', 'resultats', 'fusion', 'passage', 'examens', 'parametres', 'abonnement'],
    enseignant: ['dashboard', 'eleves', 'saisie', 'bulletins', 'statistiques', 'resultats', 'fusion', 'examens'],
    eleve: ['espace'],
    super_admin: ['admin', 'admin-ecoles', 'admin-demandes', 'admin-paiements']
  };

  async function renderRoute() {
    if (!S.me) { renderLogin(); return; }
    if (location.hash.replace(/^#\/?/, '').startsWith('inscription')) { renderInscription(); return; }
    let { route, query } = parseHash();
    if (!route) route = defaultRoute();
    if (!(ACCESS[S.me.role] || []).includes(route)) route = defaultRoute();
    S.route = route; S.query = query;

    // Sur téléphone, toute navigation referme le tiroir : la page reste visible.
    const sb = $('#sidebar');
    if (sb) sb.classList.remove('open');
    const vl = document.querySelector('.sb-voile');
    if (vl) vl.classList.remove('show');
    // Les anciens liens #/fusion restent utilisables ; l'onglet visible est « Résultats ».
    $$('.sb-item').forEach(a => a.classList.toggle('active', a.dataset.route === (route === 'fusion' ? 'resultats' : route)));
    const [titre, sub] = TITRES[route] || ['Terminish École', ''];
    if ($('#page-title')) { $('#page-title').textContent = titre; $('#page-sub').textContent = sub; }

    const content = $('#content');
    content.innerHTML = `<div class="empty"><div class="big">⏳</div>Chargement des données…</div>`;
    const view = V[route];
    if (!view) { content.innerHTML = `<div class="notice err">Page introuvable.</div>`; return; }
    try {
      const html = await view.render();
      content.innerHTML = html;
      if (view.mount) await view.mount();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      if (err.status === 401) { renderLogin('Votre session a expiré, veuillez vous reconnecter.'); return; }
      content.innerHTML = `<div class="notice err"><b>Erreur :</b> ${esc(err.message || 'impossible de charger la page')}
        <div style="margin-top:8px"><button class="btn btn-sm btn-ghost" onclick="location.reload()">Réessayer</button></div></div>`;
    }
  }

  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#/reinitialiser/')) { renderReinitialisation(); return; }
    if (!S.me) {
      if (location.hash.replace(/^#\/?/, '').startsWith('inscription')) renderInscription();
      else renderLogin();
      return;
    }
    renderRoute();
  });

  /* ---------------------------------------------------------------- */
  /* Fragments réutilisables                                          */
  /* ---------------------------------------------------------------- */
  const optionClasses = (sel, { tous = false, vide = 'Sélectionner une classe' } = {}) => `
    <option value="">${esc(vide)}</option>
    ${tous ? '<option value="all">Toutes les classes</option>' : ''}
    ${S.classes.map(c => `<option value="${c.id}" ${String(sel) === String(c.id) ? 'selected' : ''}>${esc(c.nom)} (${c.effectif ?? 0})</option>`).join('')}`;

  const optionMatieres = (sel, liste = S.matieres) => `
    <option value="">Sélectionner une matière</option>
    ${liste.map(m => `<option value="${m.id}" ${String(sel) === String(m.id) ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}`;

  const optionPeriodes = (sel, cycle) => {
    const list = S.periodes.filter(p => !cycle || p.cycle === cycle);
    return list.map(p => `<option value="${p.id}" ${String(sel) === String(p.id) ? 'selected' : ''}>${esc(p.libelle)}${p.statut === 'fermee' ? ' (clôturé)' : ''}</option>`).join('');
  };

  function badgeMoy(m) {
    if (m == null) return '<span class="tag gris">—</span>';
    let cls = 'rouge';
    if (m >= 14) cls = 'vert';
    else if (m >= 10) cls = 'bleu';
    else if (m >= 8) cls = 'or';
    return `<span class="tag ${cls}">${fmt(m)}</span>`;
  }
  function badgeStatut(statut) {
    const map = {
      actif: ['vert', 'Actif'], essai: ['or', 'Essai'], suspendu: ['rouge', 'Suspendu'],
      ouvert: ['vert', 'Ouverte'], fermee: ['gris', 'Clôturée'],
      prepare: ['or', 'Préparé'], en_cours: ['bleu', 'En cours'], termine: ['vert', 'Terminé'],
      nouveau: ['or', 'Nouveau'], traite: ['vert', 'Traité'], archive: ['gris', 'Archivé'],
      paye: ['vert', 'Payé']
    };
    const [c, l] = map[statut] || ['gris', statut || '—'];
    return `<span class="tag ${c}">${esc(l)}</span>`;
  }
  function barsMatieres(matieresStats) {
    if (!matieresStats || !matieresStats.length) return '<div class="empty">Aucune donnée</div>';
    return `<div class="bars">${matieresStats.map(m => {
      const v = m.moyenne;
      const pct = v == null ? 0 : Math.max(2, (v / 20) * 100);
      const cls = v == null ? '' : v < 10 ? 'bad' : v < 12 ? 'low' : '';
      return `<div class="bar-row" title="${esc(m.nom)} — moyenne ${fmt(v)}/20">
        <div class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.nom)}</div>
        <div class="track"><div class="fill ${cls}" style="width:${pct}%"></div></div>
        <div class="v">${fmt(v)}</div>
      </div>`;
    }).join('')}</div>`;
  }
  /** Répartition des moyennes de composition : « qui a 1, qui a 2, … ». */
  function histoComposition(rep) {
    const r = rep || [];
    const max = Math.max(1, ...r.map(b => b.n));
    const total = r.reduce((a, b) => a + b.n, 0);
    if (!total) return '<div class="muted small" style="padding:10px 0">Aucune composition saisie pour cette période.</div>';
    return `<div class="hist">${r.map(b => `
      <div class="col" title="${b.n} élève(s) avec ${b.note}/20">
        <div class="n">${b.n || ''}</div>
        <div class="bar" style="height:${Math.max(3, (b.n / max) * 100)}%"></div>
        <div class="lb">${b.note}</div>
      </div>`).join('')}</div>`;
  }

  function histo(buckets) {
    const max = Math.max(1, ...buckets.map(b => b.n));
    return `<div class="hist">${buckets.map(b => `
      <div class="col" title="${b.n} élève(s)">
        <div class="n">${b.n || ''}</div>
        <div class="bar" style="height:${Math.max(3, (b.n / max) * 100)}%"></div>
        <div class="lb">${esc(b.label)}</div>
      </div>`).join('')}</div>`;
  }
  function emptyState(icon, text, action = '') {
    return `<div class="empty"><div class="big">${icon}</div>${esc(text)}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Vues                                                            */
  /* ---------------------------------------------------------------- */
  const V = {};

  /* ---------------------------- DASHBOARD -------------------------- */
  V.dashboard = {
    async render() {
      const d = await api('/api/dashboard');
      const etab = d.etablissement;
      const role = S.me.role;
      const prenom = (S.me.nom || '').split(' ').slice(-1)[0];
      const joursRestants = etab.date_fin_abonnement
        ? Math.ceil((new Date(etab.date_fin_abonnement) - Date.now()) / 864e5) : null;
      const alerte = (etab.statut !== 'actif' && etab.statut !== 'suspendu' && joursRestants !== null && joursRestants <= 10)
        ? `<div class="notice warn"><b>Essai gratuit : ${Math.max(0, joursRestants)} jour(s) restant(s).</b>
            Les bulletins restent accessibles, mais pensez à activer votre abonnement. <a href="#/abonnement">Voir les formules →</a></div>` : '';

      const kpis = role === 'enseignant' ? `
        <div class="kpi accent"><div class="lbl">👩‍🏫 Mes classes</div><div class="val">${d.compteurs.classes}</div><div class="sub">classes affectées</div></div>
        <div class="kpi"><div class="lbl">👨‍🎓 Mes élèves</div><div class="val">${d.compteurs.eleves}</div><div class="sub">élèves à évaluer</div></div>
        <div class="kpi"><div class="lbl">✍️ Progression</div><div class="val">${d.progression}%</div><div class="sub">${esc(d.periode_active ? d.periode_active.libelle : '—')}</div></div>
        <div class="kpi"><div class="lbl">🎯 Examens blancs</div><div class="val">${d.examens}</div><div class="sub">planifiés</div></div>`
      : `
        <div class="kpi accent"><div class="lbl">👨‍🎓 Élèves inscrits</div><div class="val">${d.compteurs.eleves}</div><div class="sub">${d.compteurs.classes} classes</div></div>
        <div class="kpi"><div class="lbl">🏫 Classes</div><div class="val">${d.compteurs.classes}</div><div class="sub">${d.compteurs.matieres} matières</div></div>
        <div class="kpi"><div class="lbl">👩‍🏫 Enseignants</div><div class="val">${d.compteurs.enseignants}</div><div class="sub">comptes actifs</div></div>
        <div class="kpi"><div class="lbl">✍️ Saisie des notes</div><div class="val">${d.progression}%</div><div class="sub">${esc(d.periode_active ? d.periode_active.libelle : 'aucune période')}</div></div>
        ${d.compteurs.dossiers_a_completer ? `<div class="kpi vert">
          <div class="lbl">📝 Dossiers à compléter</div><div class="val">${d.compteurs.dossiers_a_completer}</div>
          <div class="sub">Renseignements facultatifs, à ajouter plus tard</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="App.ouvrirDossiersIncomplets()">Ouvrir la liste →</button>
        </div>` : ''}`;

      return `
        ${alerte}
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:16px">
          <div style="flex:1;min-width:240px">
            <h2 style="margin:0 0 3px;font-size:21px;letter-spacing:-.4px">Bonjour ${esc(prenom)} 👋</h2>
            <div class="muted small">${esc(etab.nom)} · ${esc(etab.ville || '')} · Année ${esc(etab.annee_scolaire)}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="App.go('saisie')">✍️ Saisir des notes</button>
            <button class="btn btn-ghost btn-sm" onclick="App.go('bulletins')">📄 Bulletins</button>
            <button class="btn btn-ghost btn-sm" onclick="App.go('resultats')">🏆 Résultats</button>
            ${role === 'directeur' ? `<button class="btn btn-primary btn-sm" onclick="App.nouvelEleve()">➕ Élève</button>` : ''}
          </div>
        </div>

        <div class="cards">${kpis}</div>
        ${role === 'directeur' && (d.compteurs.classes === 0 || d.compteurs.eleves === 0) ? `
          <div class="panel" style="border:1px solid #cfe6da;background:linear-gradient(135deg,#f7fbf9,#fff)">
            <div class="panel-head"><div><h2>🚀 Bien démarrer avec Terminish École</h2><div class="sub">Quelques étapes pour votre premier bulletin</div></div></div>
            <div class="steps" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
              <div class="step" style="padding:16px"><h4>1. Matières</h4><p>${d.compteurs.matieres ? d.compteurs.matieres + ' matière(s) déjà enregistrée(s).' : 'Ajoutez les disciplines de votre programme.'}</p>
                ${!d.compteurs.matieres ? '<button class="btn btn-ghost btn-sm" onclick="App.initialiserMatieres()">Créer les matières standard</button>' : ''}</div>
              <div class="step" style="padding:16px"><h4>2. Classes</h4><p>${d.compteurs.classes ? d.compteurs.classes + ' classe(s) créée(s).' : 'Créez vos classes et leurs coefficients.'}</p>
                <button class="btn btn-ghost btn-sm" onclick="App.go('classes')">Gérer les classes</button></div>
              <div class="step" style="padding:16px"><h4>3. Élèves</h4><p>${d.compteurs.eleves ? d.compteurs.eleves + ' élève(s) inscrit(s).' : 'Inscrivez ou importez vos élèves.'}</p>
                <button class="btn btn-ghost btn-sm" onclick="App.importerListePDF()">Importer une liste PDF</button></div>
              <div class="step" style="padding:16px"><h4>4. Enseignants</h4><p>${d.compteurs.enseignants ? d.compteurs.enseignants + ' enseignant(s).' : 'Donnez-leur accès à la saisie à distance.'}</p>
                <button class="btn btn-ghost btn-sm" onclick="App.go('enseignants')">Ajouter un enseignant</button></div>
            </div>
          </div>` : ''}

        <div class="two-col">
          <div>
            <div class="panel">
              <div class="panel-head">
                <div><h2>Progression de la saisie</h2><div class="sub">${esc(d.periode_active ? d.periode_active.libelle + ' · ' + (d.periode_active.cycle === 'college' ? 'Collège' : 'Lycée') : 'Aucune période ouverte')}</div></div>
                <div class="right"><span class="tag vert">${d.progression}% complété</span></div>
              </div>
              <div class="progress" style="height:12px"><i style="width:${d.progression}%"></i></div>
              <div class="muted small" style="margin-top:8px">Devoirs et compositions saisis pour l'ensemble des classes de ce cycle.</div>
              <div class="table-wrap" style="margin-top:14px">
                <table class="data">
                  <thead><tr><th>Classe</th><th class="center">Effectif</th><th class="center">Moyenne</th><th class="center">Réussite</th><th>Saisie</th><th></th></tr></thead>
                  <tbody>
                    ${d.classes.length ? d.classes.map(c => `
                      <tr>
                        <td class="strong">${esc(c.nom)} <span class="tag ${c.cycle === 'lycee' ? 'bleu' : 'gris'}" style="margin-left:4px">${c.cycle === 'lycee' ? 'Lycée' : 'Collège'}</span></td>
                        <td class="center">${c.effectif}</td>
                        <td class="center">${badgeMoy(c.moyenne)}</td>
                        <td class="center">${c.taux_reussite == null ? '—' : c.taux_reussite + ' %'}</td>
                        <td style="min-width:120px">
                          <div class="progress ${c.progression < 50 ? 'or' : ''}"><i style="width:${c.progression}%"></i></div>
                          <div class="small muted">${c.progression}%</div>
                        </td>
                        <td class="right"><button class="icon-btn" onclick="App.go('saisie',{classe_id:${c.id}})" title="Saisir les notes">✍️</button></td>
                      </tr>`).join('') : `<tr><td colspan="6">${emptyState('🏫', 'Aucune classe pour cette période.')}</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="panel">
              <div class="panel-head"><h2>Activité récente</h2><div class="right muted small">Dernières notes enregistrées</div></div>
              ${d.activite.length ? `<div class="table-wrap"><table class="data">
                <thead><tr><th>Élève</th><th>Matière</th><th>Classe</th><th class="center">Note</th><th>Par</th><th class="right">Quand</th></tr></thead>
                <tbody>${d.activite.map(a => `
                  <tr>
                    <td class="strong">${esc(a.nom)} ${esc(a.prenom)}</td>
                    <td>${esc(a.matiere)}</td>
                    <td class="muted">${esc(a.classe)}</td>
                    <td class="center">${badgeMoy(a.valeur)}</td>
                    <td class="muted small">${esc(a.enseignant || 'Direction')}</td>
                    <td class="right muted small nowrap">${dateFr(a.modifie_le, { day: '2-digit', month: 'short' })} · ${heureFr(a.modifie_le)}</td>
                  </tr>`).join('')}</tbody>
              </table></div>` : emptyState('✍️', 'Aucune note saisie pour le moment.')}
            </div>
          </div>

          <div>
            <div class="panel">
              <div class="panel-head"><h2>Meilleurs élèves</h2><div class="right"><span class="tag or">${esc(d.periode_active ? d.periode_active.libelle : '—')}</span></div></div>
              ${d.top_eleves.length ? `<div class="bars">${d.top_eleves.map((t, i) => `
                <div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed #e8efeb">
                  <div style="width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:12px;background:${i === 0 ? '#f0b429' : '#eef3f0'};color:${i === 0 ? '#3d2a00' : '#4b6459'}">${i + 1}</div>
                  <div style="flex:1;min-width:0"><div class="strong" style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.nom)}</div><div class="small muted">${esc(t.classe)}</div></div>
                  <div>${badgeMoy(t.moyenne)}</div>
                </div>`).join('')}</div>` : emptyState('📊', 'Les classements apparaîtront dès la saisie des notes.')}
            </div>

            <div class="panel">
              <div class="panel-head"><h2>Raccourcis</h2></div>
              <div style="display:grid;gap:8px">
                ${role === 'directeur' ? `
                  <button class="btn btn-ghost" style="justify-content:flex-start" onclick="App.importerListePDF()">📑 Importer une liste de classe PDF</button>
                  <button class="btn btn-ghost" style="justify-content:flex-start" onclick="App.ouvrirDossiersIncomplets()">📝 Compléter les dossiers des élèves</button>
                  <button class="btn btn-ghost" style="justify-content:flex-start" onclick="App.nouvelEleve()">👨‍🎓 Inscrire un élève</button>
                  <button class="btn btn-ghost" style="justify-content:flex-start" onclick="App.nouvelleClasse()">🏫 Créer une classe</button>
                  <button class="btn btn-ghost" style="justify-content:flex-start" onclick="App.nouvelEnseignant()">👩‍🏫 Ajouter un enseignant</button>
                  <button class="btn btn-ghost" style="justify-content:flex-start" onclick="App.creerExamen()">🎯 Planifier un examen blanc</button>` : `
                  <button class="btn btn-ghost" style="justify-content:flex-start" onclick="App.go('saisie')">✍️ Saisir mes notes</button>
                  <button class="btn btn-ghost" style="justify-content:flex-start" onclick="App.go('statistiques')">📊 Voir les statistiques</button>
                  <button class="btn btn-ghost" style="justify-content:flex-start" onclick="App.go('bulletins')">📄 Consulter les bulletins</button>`}
              </div>
              <div class="notice info" style="margin:14px 0 0">
                <b>Astuce :</b> ${role === 'enseignant'
                  ? 'vos notes sont enregistrées au fur et à mesure. Vous pouvez quitter et revenir sans rien perdre.'
                  : 'publiez les bulletins une fois la saisie terminée : chaque élève verra ses résultats dans son espace.'}
              </div>
            </div>
          </div>
        </div>`;
    }
  };

  window.App = { go: (r, q) => {
    const qs = q && Object.keys(q).length ? '?' + new URLSearchParams(q).toString() : '';
    if (location.hash === `#/${r}${qs}`) renderRoute();
    else location.hash = `#/${r}${qs}`;
  }};

  /* ---------------------------------------------------------------- */
  /* VUES SUPPLÉMENTAIRES (ajoutées ci-dessous)                       */
  /* ---------------------------------------------------------------- */

  /* ---------------------------- ÉLÈVES ----------------------------- */
  S.filtresEleves = { q: '', classe_id: '', statut: 'actif', incomplets: false };

  const sexeTag = (s) => s === 'F' ? '<span class="tag or">F</span>'
    : s === 'M' ? '<span class="tag bleu">M</span>' : '<span class="tag gris">—</span>';

  // Les renseignements sont facultatifs à l'inscription. Ce repère n'empêche
  // jamais un élève de figurer dans les classes, examens ou bulletins.
  function infosACompleter(e) {
    return [['prenom', 'Prénom(s)'], ['sexe', 'Sexe'], ['date_naissance', 'Date de naissance'],
      ['lieu_naissance', 'Lieu de naissance'], ['tuteur_nom', 'Nom du tuteur'],
      ['tuteur_tel', 'Téléphone du tuteur']]
      .filter(([champ]) => !String(e[champ] || '').trim()).map(([, libelle]) => libelle);
  }

  async function chargerEleves() {
    const f = S.filtresEleves;
    const params = new URLSearchParams();
    if (f.classe_id) params.set('classe_id', f.classe_id);
    if (f.q) params.set('q', f.q);
    const rows = await api('/api/eleves?' + params.toString());
    const avecStatut = f.statut ? rows.filter(r => r.statut === f.statut) : rows;
    const aCompleter = avecStatut.filter(r => r.statut === 'actif' && infosACompleter(r).length);
    const liste = f.incomplets ? aCompleter : avecStatut;
    S.elevesCourants = liste;
    const zone = $('#eleves-list');
    if (!zone) return;
    const compteur = $('#effectif-total');
    if (compteur) compteur.textContent = `${avecStatut.length} élève(s) · ${aCompleter.length} dossier(s) à compléter`;
    const filtre = $('#f-incomplets');
    if (filtre) {
      filtre.textContent = f.incomplets ? 'Voir tous les dossiers' : `À compléter (${aCompleter.length})`;
      filtre.setAttribute('aria-pressed', String(f.incomplets));
      filtre.classList.toggle('btn-primary', f.incomplets);
      filtre.classList.toggle('btn-ghost', !f.incomplets);
    }
    if (!liste.length) {
      zone.innerHTML = f.incomplets
        ? emptyState('✅', 'Aucun dossier à compléter dans cette sélection. Les champs restent facultatifs.',
          '<button class="btn btn-ghost btn-sm" onclick="App.voirTousLesEleves()">Voir tous les élèves</button>')
        : emptyState('👨‍🎓', 'Aucun élève ne correspond à votre recherche.',
          S.me.role === 'directeur' ? '<button class="btn btn-primary btn-sm" onclick="App.nouvelEleve()">➕ Inscrire un élève</button>' : '');
      return;
    }
    zone.innerHTML = `
      <div class="table-wrap"><table class="data">
        <thead><tr>
          <th>Matricule</th><th>Nom &amp; prénom(s)</th><th class="center">Sexe</th><th>Classe</th>
          <th>Tuteur</th><th class="center">Statut</th>${S.me.role === 'directeur' ? '<th>Dossier</th>' : ''}<th></th>
        </tr></thead>
        <tbody>${liste.map(e => `
          <tr>
            <td class="nowrap muted">${esc(e.matricule)}</td>
            <td class="strong">${esc(e.nom)} <span style="font-weight:500">${esc(e.prenom)}</span></td>
            <td class="center">${sexeTag(e.sexe)}</td>
            <td>${e.classe_nom ? `<span class="tag ${e.cycle === 'lycee' ? 'bleu' : 'gris'}">${esc(e.classe_nom)}</span>` : '<span class="muted">Non affecté</span>'}</td>
            <td class="small">${esc(e.tuteur_nom || '—')}${e.tuteur_tel ? `<div class="muted">${esc(e.tuteur_tel)}</div>` : ''}</td>
            <td class="center">${badgeStatut(e.statut)}</td>
            ${S.me.role === 'directeur' ? `<td>${e.statut !== 'actif' ? '<span class="muted">—</span>'
              : infosACompleter(e).length
                ? `<span class="tag or" title="${esc(infosACompleter(e).join(', '))}">À compléter · ${infosACompleter(e).length}</span>`
                : '<span class="tag vert">Renseigné</span>'}</td>` : ''}
            <td class="right"><div class="row-actions">
              <button class="icon-btn" title="Ouvrir le dossier" onclick="App.dossierEleve(${e.id})">📂</button>
              ${S.me.role === 'directeur' ? `
                <button class="btn btn-ghost btn-sm" title="Compléter ou modifier le dossier" onclick="App.editerEleve(${e.id})">${e.statut === 'actif' && infosACompleter(e).length ? 'Compléter' : 'Modifier'}</button>
                <button class="icon-btn danger" title="Désactiver" onclick="App.supprimerEleve(${e.id})">🗑️</button>` : ''}
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      <div class="small muted" style="margin-top:9px">${liste.length} élève(s) affiché(s)</div>`;
  }

  V.eleves = {
    async render() {
      const direction = S.me.role === 'directeur';
      return `
        <div class="panel">
          <div class="panel-head">
            <div><h2>Répertoire des élèves</h2><div class="sub">Recherche, dossiers et inscriptions</div></div>
            <div class="right">
              ${direction ? `<button class="btn btn-ghost btn-sm" onclick="App.importerListePDF()">📑 Importer une liste PDF</button>
              <button class="btn btn-ghost btn-sm" onclick="App.importerEleves()">⬆️ Coller une liste</button>
              <button class="btn btn-ghost btn-sm" onclick="App.exporterEleves()">⬇️ Export CSV</button>
              <button class="btn btn-primary btn-sm" onclick="App.nouvelEleve()">➕ Nouvel élève</button>` : ''}
            </div>
          </div>
          ${direction ? `<div class="notice info">Vous pouvez inscrire ou importer une liste PDF avec <b>nom et classe uniquement</b>.
            La naissance, le tuteur et les autres renseignements se complètent plus tard :
            utilisez <b>À compléter</b>, puis <b>Compléter</b> sur la ligne de l'élève.</div>` : ''}
          <div class="toolbar">
            <div class="field"><label>Recherche</label><input id="f-q" placeholder="Nom, prénom ou matricule" value="${esc(S.filtresEleves.q)}"></div>
            <div class="field"><label>Classe</label><select id="f-classe">${optionClasses(S.query.classe_id || S.filtresEleves.classe_id, { vide: 'Toutes les classes' })}</select></div>
            <div class="field"><label>Statut</label><select id="f-statut">
              <option value="actif" ${S.filtresEleves.statut === 'actif' ? 'selected' : ''}>Actifs</option>
              <option value="inactif" ${S.filtresEleves.statut === 'inactif' ? 'selected' : ''}>Inactifs</option>
              <option value="" ${S.filtresEleves.statut === '' ? 'selected' : ''}>Tous</option>
            </select></div>
            ${direction ? `<div class="field"><label>Suivi des dossiers</label>
              <button type="button" class="btn ${S.filtresEleves.incomplets ? 'btn-primary' : 'btn-ghost'} btn-sm" id="f-incomplets"
                aria-pressed="${S.filtresEleves.incomplets}">À compléter</button></div>` : ''}
            <div class="spacer"></div>
            <div class="muted small" id="effectif-total"></div>
          </div>
          <div id="eleves-list"></div>
        </div>`;
    },
    async mount() {
      if (S.query.classe_id) S.filtresEleves.classe_id = S.query.classe_id;
      let timer;
      $('#f-q').oninput = (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => { S.filtresEleves.q = e.target.value.trim(); chargerEleves(); }, 260);
      };
      $('#f-classe').onchange = (e) => { S.filtresEleves.classe_id = e.target.value; chargerEleves(); };
      $('#f-statut').onchange = (e) => {
        S.filtresEleves.statut = e.target.value;
        if (e.target.value !== 'actif') S.filtresEleves.incomplets = false;
        chargerEleves();
      };
      const incomplets = $('#f-incomplets');
      if (incomplets) incomplets.onclick = () => {
        S.filtresEleves.incomplets = !S.filtresEleves.incomplets;
        if (S.filtresEleves.incomplets) {
          S.filtresEleves.statut = 'actif';
          $('#f-statut').value = 'actif';
        }
        chargerEleves();
      };
      await chargerEleves();
    }
  };

  function eleveFormHtml(e = {}) {
    return `
      <div class="grid2">
        <div class="field"><label>Nom *</label><input name="nom" required value="${esc(e.nom || '')}" placeholder="ADJOVI"></div>
        <div class="field"><label>Prénom(s) (facultatif)</label><input name="prenom" value="${esc(e.prenom || '')}" placeholder="Ama"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Sexe (facultatif)</label><select name="sexe">
          <option value="" ${!e.sexe ? 'selected' : ''}>Non renseigné</option>
          <option value="M" ${e.sexe === 'M' ? 'selected' : ''}>Masculin</option>
          <option value="F" ${e.sexe === 'F' ? 'selected' : ''}>Féminin</option></select></div>
        <div class="field"><label>Classe</label><select name="classe_id">${optionClasses(e.classe_id, { vide: 'Non affecté' })}</select></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Date de naissance</label><input type="date" name="date_naissance" value="${esc(e.date_naissance || '')}"></div>
        <div class="field"><label>Lieu de naissance</label><input name="lieu_naissance" value="${esc(e.lieu_naissance || '')}" placeholder="Lomé"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Nom du tuteur</label><input name="tuteur_nom" value="${esc(e.tuteur_nom || '')}"></div>
        <div class="field"><label>Téléphone du tuteur</label><input name="tuteur_tel" value="${esc(e.tuteur_tel || '')}" placeholder="+228 ..."></div>
      </div>
      ${e.id ? `<div class="field"><label>Statut</label><select name="statut">
        <option value="actif" ${e.statut === 'actif' ? 'selected' : ''}>Actif</option>
        <option value="inactif" ${e.statut === 'inactif' ? 'selected' : ''}>Inactif (archivé)</option></select></div>
        <div class="small muted">Matricule : <b>${esc(e.matricule)}</b></div>`
        : `<div class="field"><label>Matricule</label><input name="matricule" placeholder="Généré automatiquement"><div class="hint">Laissez vide pour une génération automatique (année + numéro).</div></div>`}`;
  }

  Object.assign(window.App, {
    ouvrirDossiersIncomplets() {
      S.filtresEleves = { q: '', classe_id: '', statut: 'actif', incomplets: true };
      App.go('eleves');
    },

    voirTousLesEleves() {
      S.filtresEleves.incomplets = false;
      chargerEleves();
    },

    async nouvelEleve() {
      if (S.me.role !== 'directeur') return;
      const m = modal({
        title: 'Inscrire un nouvel élève',
        body: `<form id="eleve-form">${eleveFormHtml()}</form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-eleve">Enregistrer l'élève</button>`
      });
      m.root.querySelector('#save-eleve').onclick = async () => {
        const form = m.root.querySelector('#eleve-form');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form).entries());
        try {
          const res = await api('/api/eleves', { method: 'POST', body: data });
          toast(`Élève inscrit — matricule ${res.matricule}`);
          m.close();
          if (S.route === 'eleves') chargerEleves(); else renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },

    async editerEleve(id) {
      const rows = await api('/api/eleves');
      const e = rows.find(x => x.id === id);
      if (!e) return toast('Élève introuvable', 'err');
      const m = modal({
        title: `Compléter le dossier de ${e.nom} ${e.prenom}`,
        body: `<div class="notice info">Renseignez les informations disponibles aujourd'hui ;
          vous pourrez revenir plus tard. Aucun champ facultatif n'efface les notes existantes.</div>
          <form id="eleve-form">${eleveFormHtml(e)}</form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-eleve">Enregistrer</button>`
      });
      m.root.querySelector('#save-eleve').onclick = async () => {
        const form = m.root.querySelector('#eleve-form');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form).entries());
        try {
          await api('/api/eleves/' + id, { method: 'PUT', body: data });
          toast('Élève mis à jour');
          m.close();
          chargerEleves();
        } catch (err) { toast(err.message, 'err'); }
      };
    },

    async supprimerEleve(id) {
      const ok = await confirmer('Cet élève sera <b>archivé</b> : il quittera les listes actuelles ; ses anciens bulletins et décisions resteront consultables.', {
        titre: 'Archiver l’élève ?', danger: true, ok: 'Archiver'
      });
      if (!ok) return;
      try {
        await api('/api/eleves/' + id, { method: 'DELETE' });
        toast('Élève archivé');
        chargerEleves();
      } catch (e) { toast(e.message, 'err'); }
    },

    async dossierEleve(id) {
      const d = await api('/api/eleves/' + id);
      const e = d.eleve;
      const lignes = d.historique.filter(h => h.moyenne != null);
      const m = modal({
        title: 'Dossier de l’élève',
        size: 'large',
        body: `
          <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">
            <div class="avatar" style="width:52px;height:52px;font-size:18px">${esc(initiales(e.nom + ' ' + e.prenom))}</div>
            <div style="flex:1">
              <div style="font-size:17px;font-weight:800">${esc(e.nom)} ${esc(e.prenom)}</div>
              <div class="muted small">Matricule ${esc(e.matricule)} · ${e.classe_nom ? esc(e.classe_nom) : 'Sans classe'} · ${e.sexe === 'F' ? 'Féminin' : e.sexe === 'M' ? 'Masculin' : 'Non renseigné'}</div>
            </div>
            ${badgeStatut(e.statut)}
          </div>
          <div class="grid2" style="gap:4px 18px;font-size:13px;margin-bottom:16px">
            <div class="stat-line"><span class="muted">Date de naissance</span><b>${dateFr(e.date_naissance)}</b></div>
            <div class="stat-line"><span class="muted">Lieu de naissance</span><b>${esc(e.lieu_naissance || '—')}</b></div>
            <div class="stat-line"><span class="muted">Tuteur</span><b>${esc(e.tuteur_nom || '—')}</b></div>
            <div class="stat-line"><span class="muted">Téléphone</span><b>${esc(e.tuteur_tel || '—')}</b></div>
          </div>
          <h4 style="margin:0 0 8px">Parcours et moyennes</h4>
          ${lignes.length ? `<div class="table-wrap"><table class="data">
            <thead><tr><th>Période</th><th>Classe d’alors</th><th class="center">Moyenne</th><th class="center">Rang</th><th class="center">Mention</th><th class="right">Bulletin</th></tr></thead>
            <tbody>${d.historique.map(h => `
              <tr>
                <td class="strong">${esc(h.periode.libelle)} · ${esc(h.periode.annee_scolaire || '')}</td>
                <td>${esc(h.classe_nom || '—')}</td>
                <td class="center">${badgeMoy(h.moyenne)}</td>
                <td class="center">${h.rang ?? '—'}</td>
                <td class="center small">${esc(h.mention || '—')}</td>
                <td class="right">${h.moyenne != null ? `<button class="icon-btn" onclick="App.imprimerBulletin(${e.id},${h.periode.id})">🖨️</button>` : '—'}</td>
              </tr>`).join('')}
            </tbody></table></div>` : emptyState('📄', 'Aucune moyenne enregistrée pour cet élève.')}
        `,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Fermer</button>
          ${S.me.role === 'directeur' ? `<button class="btn btn-ghost btn-sm" onclick="App.editerEleve(${e.id})">✏️ Modifier</button>` : ''}`
      });
      return m;
    },

    importerListePDF() {
      if (S.me.role !== 'directeur') return;
      if (!S.classes.length) return toast('Créez d’abord une classe dans Scolarité → Classes.', 'err');
      const m = modal({
        title: 'Importer une liste de classe en PDF', size: 'large',
        body: `<div class="pdf-import">
          <div class="notice info">Choisissez la classe et un PDF : les noms seront affichés <b>avant</b> l’inscription.
            Corrigez chaque ligne si nécessaire. Seul le <b>nom et la classe</b> sont obligatoires ;
            prénom, date de naissance, sexe et matricule sont facultatifs. Aucune note n’est modifiée.
            Après l’import, retrouvez les élèves dans <b>À compléter</b> pour renseigner naissance et tuteur plus tard.</div>
          <div class="grid2">
            <div class="field"><label for="pdf-classe">Classe par défaut *</label>
              <select id="pdf-classe">${optionClasses(S.query.classe_id || S.filtresEleves.classe_id || '', { vide: 'Choisir une classe…' })}</select></div>
            <div class="field"><label for="pdf-fichier">Liste PDF (8 Mo maximum)</label>
              <input id="pdf-fichier" type="file" accept=".pdf,application/pdf"></div>
          </div>
          <button class="btn btn-ghost btn-sm" id="pdf-lire">📑 Lire le PDF</button>
          <div id="pdf-message" role="status" aria-live="polite" style="margin-top:12px"></div>
          <div id="pdf-suite"></div>
          <div id="pdf-apercu"></div>
        </div>`,
        footer: `<span class="muted small" id="pdf-compte" style="margin-right:auto;align-self:center">Aucun élève vérifié</span>
          <button class="btn btn-ghost btn-sm" data-close>Fermer</button>
          <button class="btn btn-primary btn-sm" id="pdf-confirmer" disabled>Confirmer l’inscription</button>`
      });
      const root = m.root;
      const message = root.querySelector('#pdf-message');
      const apercu = root.querySelector('#pdf-apercu');
      const bouton = root.querySelector('#pdf-confirmer');
      const classeDefaut = root.querySelector('#pdf-classe');
      const fichier = root.querySelector('#pdf-fichier');
      let eleves = [], verification = 0, lecture = false, confirmationEnCours = false, minuterie;
      const normaliserClasse = (s) => String(s || '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const classeReconnue = (nom) => S.classes.find(c => normaliserClasse(c.nom) === normaliserClasse(nom));
      const lignesTableau = () => $$('tr[data-index]', apercu);
      const ligneCorrigee = (tr) => Object.fromEntries(['nom', 'prenom', 'matricule', 'date_naissance', 'sexe', 'classe_id']
        .map(k => [k, tr.querySelector(`[data-field="${k}"]`).value.trim()]));
      const afficherMessage = (texte, type = 'info') => {
        message.innerHTML = `<div class="notice ${type}">${esc(texte)}</div>`;
      };
      const compter = () => {
        const n = lignesTableau().filter(tr => tr.querySelector('[data-field="inclure"]').checked).length;
        root.querySelector('#pdf-compte').textContent = `${n} élève(s) sélectionné(s) sur ${eleves.length}`;
        bouton.disabled = lecture || confirmationEnCours || !n;
        bouton.textContent = `Confirmer l’inscription (${n})`;
      };
      const verifier = async () => {
        const lignes = lignesTableau();
        if (!lignes.length) return;
        const no = ++verification;
        const d = await api('/api/eleves/import-pdf/verifier', {
          method: 'POST', body: { lignes: lignes.map(ligneCorrigee) }
        });
        if (no !== verification || !root.isConnected) return;
        d.statuts.forEach((v, i) => {
          const tr = lignes[i];
          const cocher = tr.querySelector('[data-field="inclure"]');
          if (v.etat !== 'pret') cocher.checked = false;
          tr.dataset.etat = v.etat;
          const etat = tr.querySelector('[data-etat]');
          etat.textContent = v.etat === 'pret'
            ? (eleves[i]?.incertain ? 'Nom / prénom à vérifier' : 'Prêt') : v.message;
          etat.className = v.etat === 'pret' && !eleves[i]?.incertain ? 'small muted' : 'small pdf-attention';
        });
        compter();
      };
      const demanderVerification = () => {
        clearTimeout(minuterie);
        minuterie = setTimeout(() => verifier().catch(e => afficherMessage(e.message, 'err')), 400);
      };
      const lire = async () => {
        if (lecture || confirmationEnCours) return;
        if (!classeDefaut.value) return afficherMessage('Choisissez d’abord une classe par défaut.', 'warn');
        if (!fichier.files.length) return afficherMessage('Choisissez un fichier PDF.', 'warn');
        const f = fichier.files[0];
        if (f.size > 8 * 1024 * 1024) return afficherMessage('PDF trop volumineux : 8 Mo maximum.', 'err');
        lecture = true; verification++;
        eleves = []; apercu.innerHTML = ''; compter();
        fichier.disabled = true; root.querySelector('#pdf-lire').disabled = true;
        afficherMessage('Lecture du PDF en cours… Les pages scannées peuvent prendre quelques instants.');
        try {
          const res = await fetch(lienServeur('/api/eleves/import-pdf/analyser'), {
            method: 'POST', credentials: apiBase() ? 'include' : 'same-origin',
            headers: { 'Content-Type': 'application/pdf' }, body: f
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Erreur ${res.status} pendant la lecture du PDF.`);
          eleves = data.eleves;
          const options = (sel) => optionClasses(sel, { vide: 'Choisir une classe…' });
          apercu.innerHTML = `<p class="small" style="margin:14px 0 8px"><b>${eleves.length} nom(s) extrait(s) de ${data.pages} page(s).</b>
            ${data.ocr ? 'Pages scannées lues localement par OCR : vérifiez attentivement les noms.' : 'PDF textuel.'}
            Corrigez, décochez ou choisissez la classe de chaque élève avant de confirmer.</p>
            ${data.avertissements.length ? `<div class="notice warn">${data.avertissements.slice(0, 8).map(esc).join('<br>')}</div>` : ''}
            <div class="table-wrap" aria-label="Aperçu des élèves du PDF"><table class="data">
              <thead><tr><th>Inscrire</th><th>Page</th><th>Nom *</th><th>Prénom(s)</th><th>Matricule</th><th>Classe *</th>
                <th>Sexe</th><th>Naissance</th><th>Vérification</th></tr></thead>
              <tbody>${eleves.map((e, i) => {
                const correspondance = classeReconnue(e.classe);
                return `<tr data-index="${i}" data-classe-detectee="${correspondance ? 'oui' : ''}">
                  <td><input type="checkbox" data-field="inclure" checked aria-label="Inscrire la ligne ${i + 1}"></td>
                  <td class="small muted">${esc(e.page)}</td>
                  <td><input class="pdf-input pdf-nom" data-field="nom" maxlength="110" aria-label="Nom ligne ${i + 1}" value="${esc(e.nom)}"></td>
                  <td><input class="pdf-input pdf-nom" data-field="prenom" maxlength="110" aria-label="Prénom ligne ${i + 1}" value="${esc(e.prenom)}"></td>
                  <td><input class="pdf-input pdf-mat" data-field="matricule" maxlength="24" aria-label="Matricule ligne ${i + 1}" value="${esc(e.matricule)}" placeholder="Auto"></td>
                  <td><select class="pdf-input pdf-classe" data-field="classe_id" aria-label="Classe ligne ${i + 1}">
                    ${options(correspondance?.id || classeDefaut.value)}</select>
                    ${e.classe && !correspondance ? `<span class="small pdf-attention">PDF : ${esc(e.classe)} (non trouvée)</span>` : ''}</td>
                  <td><select class="pdf-input pdf-sexe" data-field="sexe" aria-label="Sexe ligne ${i + 1}">
                    <option value="" ${!e.sexe ? 'selected' : ''}>—</option>
                    <option value="F" ${e.sexe === 'F' ? 'selected' : ''}>F</option>
                    <option value="M" ${e.sexe === 'M' ? 'selected' : ''}>M</option></select></td>
                  <td><input class="pdf-input pdf-date" type="date" data-field="date_naissance" aria-label="Naissance ligne ${i + 1}" value="${esc(e.date_naissance)}"></td>
                  <td data-etat class="small muted">À vérifier</td>
                </tr>`;
              }).join('')}</tbody></table></div>`;
          afficherMessage('Aperçu prêt. Aucune inscription n’a encore été créée.');
          await verifier();
        } catch (e) {
          eleves = []; apercu.innerHTML = ''; afficherMessage(e.message, 'err');
        } finally {
          lecture = false; fichier.disabled = false; root.querySelector('#pdf-lire').disabled = false;
          compter();
        }
      };
      root.querySelector('#pdf-lire').onclick = lire;
      fichier.onchange = () => { if (classeDefaut.value && fichier.files.length) lire(); };
      classeDefaut.onchange = () => {
        for (const tr of lignesTableau()) {
          if (!tr.dataset.classeDetectee) tr.querySelector('[data-field="classe_id"]').value = classeDefaut.value;
        }
        demanderVerification();
      };
      apercu.addEventListener('input', e => {
        if (e.target.closest('tr[data-index]')) demanderVerification();
      });
      apercu.addEventListener('change', e => {
        if (!e.target.closest('tr[data-index]')) return;
        if (e.target.matches('[data-field="inclure"]')) compter();
        else demanderVerification();
      });
      bouton.onclick = async () => {
        const avant = lignesTableau().filter(tr => tr.querySelector('[data-field="inclure"]').checked).length;
        if (!avant || lecture || confirmationEnCours) return;
        clearTimeout(minuterie);
        confirmationEnCours = true;
        bouton.disabled = true;
        try {
          await verifier();
          const trChoisis = lignesTableau().filter(tr => tr.querySelector('[data-field="inclure"]').checked);
          if (trChoisis.length !== avant || trChoisis.some(tr => tr.dataset.etat !== 'pret')) {
            return afficherMessage('Des doublons ou erreurs viennent d’être détectés. Corrigez puis cochez les lignes souhaitées.', 'warn');
          }
          const res = await api('/api/eleves/import-pdf/confirmer', {
            method: 'POST', body: { lignes: trChoisis.map(ligneCorrigee) }
          });
          afficherMessage(`${res.crees} élève(s) inscrit(s). ${res.ignores.length} ligne(s) ignorée(s) (doublon ou erreur).`
            + (res.ignores.length ? ' ' + res.ignores.slice(0, 5).map(x => x.message).join(' ; ') : '')
            + ' Vous pouvez corriger les lignes restantes ; les informations facultatives se complètent plus tard.',
          res.ignores.length || !res.crees ? 'warn' : 'ok');
          if (res.crees) {
            toast(`${res.crees} élève(s) inscrit(s)`);
            const suite = root.querySelector('#pdf-suite');
            suite.innerHTML = `<button type="button" class="btn btn-primary btn-sm" id="pdf-completer"
              style="margin-top:10px">➡️ Voir les dossiers à compléter</button>`;
            suite.querySelector('#pdf-completer').onclick = () => {
              m.close(); App.ouvrirDossiersIncomplets();
            };
            await loadRefs();
            if (S.route === 'eleves') await chargerEleves();
          }
          await verifier(); // les élèves créés apparaissent désormais comme doublons, et sont décochés
        } catch (e) { afficherMessage(e.message, 'err'); }
        finally { confirmationEnCours = false; compter(); }
      };
    },

    importerEleves() {
      if (S.me.role !== 'directeur') return;
      const m = modal({
        title: 'Importer des élèves', size: 'large',
        body: `
          <div class="notice info">Collez vos lignes au format <b>NOM ; PRÉNOM ; SEXE ; DATE DE NAISSANCE ; CLASSE ; TUTEUR ; TÉLÉPHONE</b>.<br>
          Seul le nom est obligatoire ; laissez les autres cases vides avec <code>;</code>. Une ligne par élève. Les matricules sont générés automatiquement.</div>
          <div class="field"><label>Classe par défaut (si la colonne classe est vide)</label>
            <select id="imp-classe">${optionClasses('', { vide: 'Aucune — utiliser la colonne CLASSE' })}</select></div>
          <div class="field"><label>Élèves à importer</label>
            <textarea id="imp-data" rows="9" placeholder="ADJOVI;Ama;F;2012-03-14;6ème A;ADJOVI Kossi;+228 90 00 00 00
KOUASSI;Elom;M;2011-11-02;5ème A;;"></textarea>
            <div class="hint">Exemple de date : 2012-03-14 (année-mois-jour).</div>
          </div>
          <div id="imp-result"></div>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Fermer</button><button class="btn btn-primary btn-sm" id="run-import">Importer les élèves</button>`
      });
      m.root.querySelector('#run-import').onclick = async () => {
        const brut = m.root.querySelector('#imp-data').value.trim();
        if (!brut) return toast('Collez au moins une ligne', 'err');
        const lignes = brut.split(/\r?\n/).filter(l => l.trim()).map(l => {
          const sep = l.includes(';') ? ';' : l.includes('\t') ? '\t' : ',';
          const c = l.split(sep).map(x => x.trim());
          return { nom: c[0], prenom: c[1], sexe: c[2], date_naissance: c[3], classe: c[4], tuteur_nom: c[5], tuteur_tel: c[6] };
        });
        const btn = m.root.querySelector('#run-import');
        btn.disabled = true; btn.textContent = 'Import…';
        try {
          const res = await api('/api/eleves/import', { method: 'POST', body: {
            lignes, classe_id: m.root.querySelector('#imp-classe').value || null
          }});
          m.root.querySelector('#imp-result').innerHTML = `<div class="notice ${res.erreurs.length ? 'warn' : 'ok'}">
            <b>${res.crees} élève(s) importé(s).</b>${res.erreurs.length ? '<br>' + res.erreurs.slice(0, 5).map(esc).join('<br>') : ''}</div>`;
          toast(`${res.crees} élève(s) importé(s)`);
          await chargerEleves();
        } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Importer les élèves'; }
      };
    },

    exporterEleves() {
      const rows = S.elevesCourants || [];
      if (!rows.length) return toast('Aucun élève à exporter', 'err');
      const head = 'Matricule;Nom;Prenom;Sexe;Date de naissance;Classe;Tuteur;Telephone tuteur;Statut\n';
      const body = rows.map(e => [e.matricule, e.nom, e.prenom, e.sexe, e.date_naissance, e.classe_nom, e.tuteur_nom, e.tuteur_tel, e.statut]
        .map(v => String(v ?? '').replace(/;/g, ',')).join(';')).join('\n');
      download(`eleves-${(S.etab.nom || 'ecole').replace(/\W+/g, '-')}.csv`, '\ufeff' + head + body, 'text/csv;charset=utf-8');
      toast('Export CSV téléchargé');
    },

    imprimerBulletin(eleveId, periodeId, mode) {
      const suffixe = mode === 'composition' ? '&mode=composition' : '';
      window.open(lienServeur(`/print/bulletin/${eleveId}?periode_id=${periodeId}${suffixe}`), '_blank');
    },

    /** Bulletins de composition seule pour toute la classe (téléchargement imprimable). */
    imprimerComposition(classeId, periodeId) {
      window.open(lienServeur(`/print/classe/${classeId}?periode_id=${periodeId}&mode=composition`), '_blank');
    }
  });

  /* ---------------------------- CLASSES ---------------------------- */
  V.classes = {
    async render() {
      await loadRefs();
      const direction = S.me.role === 'directeur';
      const groupes = [
        { cycle: 'college', titre: 'Collège', tag: 'Trimestres (T1 · T2 · T3)' },
        { cycle: 'lycee', titre: 'Lycée', tag: 'Semestres (S1 · S2)' }
      ];
      const cartes = (cycle) => {
        const list = S.classes.filter(c => c.cycle === cycle);
        if (!list.length) return emptyState('🏫', 'Aucune classe dans ce cycle.', direction ? `<button class="btn btn-primary btn-sm" onclick="App.nouvelleClasse('${cycle}')">➕ Créer une classe</button>` : '');
        return `<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${list.map(c => `
          <div class="kpi" style="padding:16px">
            <div style="display:flex;align-items:flex-start;gap:8px">
              <div style="flex:1">
                <div style="font-size:17px;font-weight:800;color:var(--vert-fonce)">${esc(c.nom)}</div>
                <div class="muted small">${c.serie ? 'Série ' + esc(c.serie) + ' · ' : ''}${c.effectif} élève(s)${c.titulaire ? ' · ' + esc(c.titulaire) : ''}</div>
              </div>
              <span class="tag ${c.cycle === 'lycee' ? 'bleu' : 'gris'}">${c.cycle === 'lycee' ? 'Lycée' : 'Collège'}</span>
            </div>
            <div class="chips" style="margin-top:10px">${c.matieres.slice(0, 6).map(m => `<span class="chip">${esc(m.code || m.nom)} <b>×${m.coefficient}</b></span>`).join('')}${c.matieres.length > 6 ? `<span class="chip">+${c.matieres.length - 6}</span>` : ''}</div>
            <div style="display:flex;gap:6px;margin-top:13px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" onclick="App.go('eleves',{classe_id:${c.id}})">👨‍🎓 Élèves</button>
              <button class="btn btn-ghost btn-sm" onclick="App.go('saisie',{classe_id:${c.id}})">✍️ Saisir</button>
              ${direction ? `<button class="icon-btn" title="Modifier" onclick="App.editerClasse(${c.id})">✏️</button>
              <button class="icon-btn danger" title="Supprimer" onclick="App.supprimerClasse(${c.id})">🗑️</button>` : ''}
            </div>
          </div>`).join('')}</div>`;
      };
      return `
        <div class="panel">
          <div class="panel-head">
            <div><h2>Organisation des classes</h2><div class="sub">${S.classes.length} classe(s) · ${S.classes.reduce((a, c) => a + Number(c.effectif || 0), 0)} élèves</div></div>
            <div class="right">${direction ? `<button class="btn btn-primary btn-sm" onclick="App.nouvelleClasse()">➕ Nouvelle classe</button>` : ''}</div>
          </div>
          <div class="notice info">Le collège fonctionne par <b>trimestres</b> (3 périodes) et le lycée par <b>semestres</b> (2 périodes). Les coefficients se définissent classe par classe.</div>
          <h3 style="font-size:14px;margin:16px 0 4px">${groupes[0].titre} <span class="tag gris">${groupes[0].tag}</span></h3>
          ${cartes('college')}
          <h3 style="font-size:14px;margin:24px 0 4px">${groupes[1].titre} <span class="tag bleu">${groupes[1].tag}</span></h3>
          ${cartes('lycee')}
        </div>`;
    }
  };

  /** Liste des enseignants (pour désigner le professeur titulaire). */
  async function chargerEnseignants() {
    if (S.enseignants && S.enseignants.length) return S.enseignants;
    try { S.enseignants = await api('/api/enseignants'); } catch (_) { S.enseignants = []; }
    return S.enseignants;
  }

  function classeFormHtml(c = {}, cycleDefaut = 'college') {
    const cycle = c.cycle || cycleDefaut;
    const choisis = new Map((c.matieres || []).map(m => [m.id, m.coefficient]));
    return `
      <div class="grid2">
        <div class="field"><label>Nom de la classe *</label><input name="nom" required value="${esc(c.nom || '')}" placeholder="6ème A"></div>
        <div class="field"><label>Niveau</label><input name="niveau" value="${esc(c.niveau || '')}" placeholder="6ème"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Cycle *</label><select name="cycle" id="cl-cycle">
          <option value="college" ${cycle === 'college' ? 'selected' : ''}>Collège (trimestres)</option>
          <option value="lycee" ${cycle === 'lycee' ? 'selected' : ''}>Lycée (semestres)</option>
        </select></div>
        <div class="field"><label>Série (lycée)</label><input name="serie" value="${esc(c.serie || '')}" placeholder="A, C, D..."></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Professeur titulaire de la classe (signe le bulletin)</label>
          <select name="titulaire_id" id="cl-titulaire">
            <option value="">— Aucun —</option>
            ${(S.enseignants || []).map(e => `<option value="${e.id}" ${Number(c.titulaire_id) === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}
          </select>
          <div class="hint">Sa signature apparaîtra sur les bulletins de cette classe.</div>
        </div>
        <div class="field"><label>Nom affiché (si aucun compte)</label><input name="titulaire" value="${esc(c.titulaire || '')}" placeholder="M. ..."></div>
      </div>
      <div class="field"><label>Matières &amp; coefficients</label>
        <div class="affect-grid"><table>
          <thead><tr><th>Matière</th><th>Enseignée</th><th style="width:110px">Coefficient</th></tr></thead>
          <tbody>
            ${S.matieres.length ? S.matieres.map(m => `
              <tr>
                <td>${esc(m.nom)} <span class="tag gris">${esc(m.code || '')}</span></td>
                <td><input type="checkbox" class="cm-on" data-matiere="${m.id}" ${choisis.has(m.id) ? 'checked' : ''}></td>
                <td><input type="number" class="cm-coef" data-matiere="${m.id}" min="0.5" max="20" step="0.5" value="${choisis.get(m.id) || 1}" style="width:72px;padding:4px 6px;text-align:center;border:1px solid #d7e2dc;border-radius:6px"></td>
              </tr>`).join('') : '<tr><td colspan="3" class="muted">Créez d’abord des matières.</td></tr>'}
          </tbody>
        </table></div>
        <div class="hint" style="margin-top:6px">Le coefficient sert au calcul de la moyenne générale et des points du bulletin.</div>
      </div>`;
  }

  function collecterMatieres(root) {
    return $$('.cm-on', root).filter(cb => cb.checked).map(cb => ({
      matiere_id: Number(cb.dataset.matiere),
      coefficient: Number(root.querySelector(`.cm-coef[data-matiere="${cb.dataset.matiere}"]`).value) || 1
    }));
  }

  Object.assign(window.App, {
    async nouvelleClasse(cycle = 'college') {
      if (!S.matieres.length) return toast('Créez d’abord au moins une matière.', 'err');
      await chargerEnseignants();
      const m = modal({
        title: 'Nouvelle classe', size: 'large',
        body: `<form id="classe-form">${classeFormHtml({}, cycle)}</form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-classe">Créer la classe</button>`
      });
      m.root.querySelector('#save-classe').onclick = async () => {
        const form = m.root.querySelector('#classe-form');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form).entries());
        data.matieres = collecterMatieres(m.root);
        data.titulaire_id = data.titulaire_id ? Number(data.titulaire_id) : null;
        try {
          await api('/api/classes', { method: 'POST', body: data });
          toast('Classe créée');
          m.close();
          await loadRefs();
          if (S.route === 'classes') renderRoute(); else renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },

    async editerClasse(id) {
      const c = S.classes.find(x => x.id === id);
      if (!c) return;
      await chargerEnseignants();
      const m = modal({
        title: `Modifier ${c.nom}`, size: 'large',
        body: `<form id="classe-form">${classeFormHtml(c)}</form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-classe">Enregistrer</button>`
      });
      m.root.querySelector('#save-classe').onclick = async () => {
        const form = m.root.querySelector('#classe-form');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form).entries());
        data.matieres = collecterMatieres(m.root);
        data.titulaire_id = data.titulaire_id ? Number(data.titulaire_id) : null;
        try {
          await api('/api/classes/' + id, { method: 'PUT', body: data });
          toast('Classe mise à jour');
          m.close();
          await loadRefs();
          renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },

    async supprimerClasse(id) {
      const c = S.classes.find(x => x.id === id);
      if (!c) return;
      const ok = await confirmer(`Supprimer définitivement la classe <b>${esc(c.nom)}</b> ?<br><span class="small">Seule une classe sans élève peut être supprimée.</span>`, {
        titre: 'Supprimer la classe', ok: 'Supprimer'
      });
      if (!ok) return;
      try {
        await api('/api/classes/' + id, { method: 'DELETE' });
        toast('Classe supprimée');
        await loadRefs();
        renderRoute();
      } catch (e) { toast(e.message, 'err'); }
    }
  });

  /* ---------------------------- MATIÈRES --------------------------- */
  V.matieres = {
    async render() {
      await loadRefs();
      const direction = S.me.role === 'directeur';
      const groupes = [...new Set(S.matieres.map(m => m.groupe || 'Autres'))];
      return `
        <div class="panel">
          <div class="panel-head">
            <div><h2>Matières enseignées</h2><div class="sub">${S.matieres.length} matière(s) · ${groupes.length} groupe(s)</div></div>
            <div class="right">${direction ? `<button class="btn btn-ghost btn-sm" onclick="App.initialiserMatieres()">⚡ Matières standard</button>
              <button class="btn btn-primary btn-sm" onclick="App.nouvelleMatiere()">➕ Nouvelle matière</button>` : ''}</div>
          </div>
          ${S.matieres.length ? `<div class="table-wrap"><table class="data">
            <thead><tr><th>Matière</th><th>Code</th><th>Groupe</th><th class="center">Classes</th><th></th></tr></thead>
            <tbody>${S.matieres.map(m => {
              const classes = S.classes.filter(c => c.matieres.some(x => x.id === m.id));
              return `<tr>
                <td class="strong">${esc(m.nom)}${m.nom_college ? `<div class="muted small">au collège : ${esc(m.nom_college)}</div>` : ''}</td>
                <td><span class="tag gris">${esc(m.code || '—')}</span></td>
                <td class="muted">${esc(m.groupe || '—')}</td>
                <td class="center">${classes.length}</td>
                <td class="right">${direction ? `<div class="row-actions">
                  <button class="icon-btn" onclick="App.editerMatiere(${m.id})">✏️</button>
                  <button class="icon-btn danger" onclick="App.supprimerMatiere(${m.id})">🗑️</button></div>` : ''}</td>
              </tr>`;
            }).join('')}</tbody></table></div>` : emptyState('📚', 'Aucune matière enregistrée.',
              direction ? '<button class="btn btn-primary btn-sm" onclick="App.nouvelleMatiere()">➕ Ajouter une matière</button>' : '')}
          <div class="notice info" style="margin-top:14px">Une matière rattachée à des classes ne peut pas être supprimée : retirez-la d’abord des classes concernées.</div>
        </div>`;
    }
  };

  function matiereFormHtml(m = {}) {
    return `
      <div class="field"><label>Nom de la matière *</label><input name="nom" required value="${esc(m.nom || '')}" placeholder="Mathématiques">
        <div class="hint">Nom utilisé au lycée (et partout par défaut).</div></div>
      <div class="field"><label>Nom au collège <span class="muted">(facultatif)</span></label>
        <input name="nom_college" value="${esc(m.nom_college || '')}" placeholder="Physique-Chimie et Technologie (PCT)">
        <div class="hint">Si le collège emploie un autre intitulé. Laisser vide pour garder le même nom.</div></div>
      <div class="grid2">
        <div class="field"><label>Code / abréviation</label><input name="code" value="${esc(m.code || '')}" placeholder="MATH"></div>
        <div class="field"><label>Groupe</label><select name="groupe">
          ${['Scientifique', 'Littéraire', 'Autres'].map(g => `<option ${m.groupe === g ? 'selected' : ''}>${g}</option>`).join('')}
          <option ${m.groupe && !['Scientifique', 'Littéraire', 'Autres'].includes(m.groupe) ? 'selected' : ''}>${esc(m.groupe || '')}</option>
        </select></div>
      </div>`;
  }

  Object.assign(window.App, {
    async initialiserMatieres() {
      const ok = await confirmer('Créer automatiquement les 8 matières du programme (Maths, PC, SVT, Français, Anglais, Histoire-Géo, ECM, EPS) ?<br><span class="small">Vous pourrez les modifier ou en ajouter ensuite.</span>', {
        titre: 'Matières standard', danger: false, ok: 'Créer'
      });
      if (!ok) return;
      try {
        const res = await api('/api/matieres/init', { method: 'POST' });
        toast(`${res.count} matières créées`);
        await loadRefs();
        renderRoute();
      } catch (e) { toast(e.message, 'err'); }
    },

    nouvelleMatiere() {
      const m = modal({
        title: 'Nouvelle matière',
        body: `<form id="matiere-form">${matiereFormHtml()}</form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-matiere">Ajouter</button>`
      });
      m.root.querySelector('#save-matiere').onclick = async () => {
        const form = m.root.querySelector('#matiere-form');
        if (!form.reportValidity()) return;
        try {
          await api('/api/matieres', { method: 'POST', body: Object.fromEntries(new FormData(form).entries()) });
          toast('Matière ajoutée');
          m.close(); await loadRefs(); renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },
    editerMatiere(id) {
      const mat = S.matieres.find(x => x.id === id);
      if (!mat) return;
      const m = modal({
        title: 'Modifier la matière',
        body: `<form id="matiere-form">${matiereFormHtml(mat)}</form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-matiere">Enregistrer</button>`
      });
      m.root.querySelector('#save-matiere').onclick = async () => {
        const form = m.root.querySelector('#matiere-form');
        if (!form.reportValidity()) return;
        try {
          await api('/api/matieres/' + id, { method: 'PUT', body: Object.fromEntries(new FormData(form).entries()) });
          toast('Matière mise à jour');
          m.close(); await loadRefs(); renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },
    async supprimerMatiere(id) {
      const ok = await confirmer('Supprimer cette matière ? Une matière avec des notes ne peut pas être supprimée : ses anciens résultats sont protégés.', { titre: 'Supprimer la matière', ok: 'Supprimer' });
      if (!ok) return;
      try {
        await api('/api/matieres/' + id, { method: 'DELETE' });
        toast('Matière supprimée'); await loadRefs(); renderRoute();
      } catch (e) { toast(e.message, 'err'); }
    }
  });

  /* -------------------------- ENSEIGNANTS -------------------------- */
  V.enseignants = {
    async render() {
      const list = await api('/api/enseignants');
      S.enseignants = list;
      const direction = S.me.role === 'directeur';
      let demandes = [];
      if (direction) { try { demandes = await api('/api/demandes-mdp'); } catch (_) { demandes = []; } }
      const enAttente = demandes.filter(d => d.statut === 'nouvelle');
      return `
        ${direction && enAttente.length ? `
        <div class="panel" style="border-left:4px solid var(--or)">
          <div class="panel-head">
            <div><h2>🔔 Demandes de mot de passe (${enAttente.length})</h2>
              <div class="sub">Ces personnes ne peuvent plus se connecter. Donnez-leur de nouveaux identifiants.</div></div>
          </div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Date</th><th>Personne</th><th>Précision</th><th></th></tr></thead>
            <tbody>${enAttente.map(d => `
              <tr>
                <td class="small">${dateFr(d.cree_le)} ${heureFr(d.cree_le)}</td>
                <td><div class="strong">${esc(d.nom || '—')}</div><div class="muted small">${esc(d.email)}</div></td>
                <td class="small">${esc(d.message || '—')}</td>
                <td class="right"><div class="row-actions">
                  ${d.utilisateur_id ? `<button class="btn btn-primary btn-sm" onclick="App.nouveauxIdentifiants(${d.utilisateur_id})">🔑 Nouveaux identifiants</button>` : ''}
                  <button class="icon-btn" title="Marquer comme traitée" onclick="App.traiterDemande(${d.id})">✓</button>
                </div></td>
              </tr>`).join('')}</tbody>
          </table></div>
        </div>` : ''}
        <div class="panel">
          <div class="panel-head">
            <div><h2>Corps enseignant</h2><div class="sub">${list.filter(e => e.actif).length} enseignant(s) actif(s)</div></div>
            <div class="right">${direction ? `<button class="btn btn-primary btn-sm" onclick="App.nouvelEnseignant()">➕ Ajouter un enseignant</button>` : ''}</div>
          </div>
          ${list.length ? `<div class="table-wrap"><table class="data">
            <thead><tr><th>Enseignant</th><th>Contact</th><th>Affectations</th><th class="center">État</th><th></th></tr></thead>
            <tbody>${list.map(e => `
              <tr>
                <td><div class="strong">${esc(e.nom)} ${e.signature ? '<span class="tag vert" title="Signature enregistrée">✍️ signé</span>' : '<span class="tag gris" title="Aucune signature">sans signature</span>'}</div><div class="muted small">Dernière connexion : ${e.derniere_connexion ? dateFr(e.derniere_connexion) : 'jamais'}</div></td>
                <td class="small">${esc(e.email)}${e.telephone ? `<div class="muted">${esc(e.telephone)}</div>` : ''}</td>
                <td><div class="chips" style="max-width:340px">${e.affectations.length ? e.affectations.slice(0, 4).map(a => `<span class="chip">${esc(a.classe_nom)} · ${esc(a.matiere_nom)}</span>`).join('') : '<span class="muted small">Aucune affectation</span>'}${e.affectations.length > 4 ? `<span class="chip">+${e.affectations.length - 4}</span>` : ''}</div></td>
                <td class="center">${badgeStatut(e.actif ? 'actif' : 'inactif')}</td>
                <td class="right"><div class="row-actions">
                  <button class="icon-btn" title="Modifier" onclick="App.editerEnseignant(${e.id})">✏️</button>
                  ${direction ? `<button class="icon-btn" title="Nouveaux identifiants (mot de passe perdu)" onclick="App.nouveauxIdentifiants(${e.id})">🔑</button>` : ''}
                  ${direction ? `<button class="icon-btn ${e.actif ? 'danger' : ''}" title="${e.actif ? 'Retirer l’accès' : 'Rétablir l’accès'}" onclick="App.changerAcces(${e.id}, ${e.actif ? 0 : 1})">${e.actif ? '🚫' : '✅'}</button>` : ''}
                </div></td>
              </tr>`).join('')}</tbody></table></div>` : emptyState('👩‍🏫', 'Aucun enseignant enregistré.',
              direction ? '<button class="btn btn-primary btn-sm" onclick="App.nouvelEnseignant()">➕ Ajouter un enseignant</button>' : '')}
          <div class="notice info" style="margin-top:14px">
            <b>Vous délivrez les identifiants.</b> Un enseignant a perdu son mot de passe ?
            Cliquez sur 🔑 : un nouveau mot de passe s'affiche, à lui dicter au téléphone.
            Pour lui retirer l'accès immédiatement : 🚫 (sessions fermées, affectations retirées) — ✅ pour le rétablir.
          </div>
        </div>`;
    }
  };

  /* ---------------- Signature manuscrite (import d'une photo) ----------------
     Une seule fois : on glisse une photo de la signature, elle est réduite
     puis enregistrée. Elle sera ensuite apposée sur chaque bulletin.
     Accepte : glisser-déposer, coller (Ctrl+V) et sélection de fichier. */
  function signatureHtml(url, { label = 'Signature manuscrite', id = 'sig' } = {}) {
    return `
      <div class="field">
        <label>${esc(label)}</label>
        <div class="sig-zone" id="${id}-zone" tabindex="0">
          <input type="file" accept="image/png,image/jpeg,image/webp" id="${id}-file" hidden>
          <div class="sig-apercu" id="${id}-apercu">
            ${url ? `<img src="${esc(url)}" alt="signature">` : '<div class="sig-vide-txt">Glissez ici une photo de la signature<br><span>ou cliquez pour choisir un fichier</span></div>'}
          </div>
          <div class="sig-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="${id}-choisir">📷 Importer une photo</button>
            <button type="button" class="btn btn-ghost btn-sm" id="${id}-effacer" ${url ? '' : 'style="display:none"'}>🗑️ Retirer</button>
          </div>
        </div>
        <input type="hidden" name="${id}" id="${id}-valeur" value="">
        <div class="hint">Fond blanc de préférence, cadrée serrée. La photo est réduite automatiquement ; elle apparaîtra sur les bulletins avec votre nom.</div>
      </div>`;
  }

  /** Branche la zone de signature ; renvoie une fonction qui donne la valeur actuelle. */
  function monterSignature(root, id = 'sig', initiale = null) {
    const zone = root.querySelector('#' + id + '-zone');
    if (!zone) return () => null;
    const fichier = root.querySelector('#' + id + '-file');
    const apercu = root.querySelector('#' + id + '-apercu');
    const valeur = root.querySelector('#' + id + '-valeur');
    const boutonEffacer = root.querySelector('#' + id + '-effacer');
    let courante = initiale || null;      // URL d'origine (déjà enregistrée)
    let nouvelle = null;                  // data URL à envoyer

    const rendre = (src) => {
      apercu.innerHTML = src
        ? `<img src="${esc(src)}" alt="signature">`
        : '<div class="sig-vide-txt">Glissez ici une photo de la signature<br><span>ou cliquez pour choisir un fichier</span></div>';
      if (boutonEffacer) boutonEffacer.style.display = src ? '' : 'none';
    };

    const prendre = async (f) => {
      if (!f) return;
      if (!/^image\//.test(f.type)) return toast('Choisissez une image (PNG, JPEG ou WebP).', 'err');
      if (f.size > 8 * 1024 * 1024) return toast('Image trop lourde (8 Mo maximum).', 'err');
      try {
        const dataUrl = await readImage(f, 600);   // réduite à 600 px de côté
        nouvelle = dataUrl;
        valeur.value = dataUrl;
        rendre(dataUrl);
        toast('Signature prête — enregistrez pour la conserver');
      } catch (_) { toast('Image illisible.', 'err'); }
    };

    zone.addEventListener('click', (e) => { if (!e.target.closest('button')) fichier.click(); });
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fichier.click(); } });
    root.querySelector('#' + id + '-choisir').addEventListener('click', (e) => { e.preventDefault(); fichier.click(); });
    fichier.addEventListener('change', (e) => prendre(e.target.files[0]));

    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, (e) => {
      e.preventDefault(); zone.classList.add('survol');
    }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, (e) => {
      e.preventDefault(); zone.classList.remove('survol');
    }));
    zone.addEventListener('drop', (e) => {
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      prendre(f);
    });
    zone.addEventListener('paste', (e) => {
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
      if (item) { e.preventDefault(); prendre(item.getAsFile()); }
    });

    if (boutonEffacer) boutonEffacer.addEventListener('click', async (e) => {
      e.preventDefault();
      const ok = await confirmer('Retirer la signature ? Elle disparaîtra des bulletins.', { titre: 'Retirer la signature', ok: 'Retirer' });
      if (!ok) return;
      nouvelle = ''; valeur.value = '__supprimer__'; courante = null; rendre(null);
    });

    /** Valeur à envoyer à l'API : undefined = ne pas toucher. */
    return () => {
      if (valeur.value === '__supprimer__') return '';
      if (nouvelle) return nouvelle;
      return undefined;
    };
  }

  function affectationGridHtml(affectations = []) {
    const set = new Set(affectations.map(a => `${a.classe_id}-${a.matiere_id}`));
    if (!S.classes.length || !S.matieres.length) return '<div class="notice warn">Créez d’abord des classes et des matières.</div>';
    return `<div class="affect-grid"><table>
      <thead><tr><th>Classe</th>${S.matieres.map(m => `<th title="${esc(m.nom)}">${esc(m.code || m.nom.slice(0, 5))}</th>`).join('')}</tr></thead>
      <tbody>${S.classes.map(c => `<tr>
        <td>${esc(c.nom)}</td>
        ${S.matieres.map(m => `<td><input type="checkbox" class="aff" data-classe="${c.id}" data-matiere="${m.id}" ${set.has(`${c.id}-${m.id}`) ? 'checked' : ''} ${c.matieres.some(x => x.id === m.id) ? '' : 'disabled title="Matière non enseignée dans cette classe"'}></td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div>`;
  }
  function collecterAffectations(root) {
    return $$('.aff', root).filter(cb => cb.checked).map(cb => ({
      classe_id: Number(cb.dataset.classe), matiere_id: Number(cb.dataset.matiere)
    }));
  }
  function enseignantFormHtml(e = {}) {
    return `
      <div class="grid2">
        <div class="field"><label>Nom complet *</label><input name="nom" required value="${esc(e.nom || '')}" placeholder="M. Komlan AGBEKO"></div>
        <div class="field"><label>Téléphone</label><input name="telephone" value="${esc(e.telephone || '')}" placeholder="+228 ..."></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Email de connexion *</label><input type="email" name="email" required value="${esc(e.email || '')}" ${e.id ? 'readonly style="background:#f6f8f7"' : ''} placeholder="prof@ecole.tg"></div>
        <div class="field"><label>${e.id ? 'Nouveau mot de passe' : 'Mot de passe *'}</label><input type="text" name="password" ${e.id ? '' : 'required minlength="6"'} placeholder="${e.id ? 'Laisser vide pour conserver' : '6 caractères minimum'}"></div>
      </div>
      ${signatureHtml(e.signature || null, { id: 'sig-ens', label: 'Signature de l’enseignant (apparaîtra sur les bulletins)' })}
      <div class="field"><label>Classes et matières affectées</label>${affectationGridHtml(e.affectations || [])}</div>`;
  }

  Object.assign(window.App, {
    nouvelEnseignant() {
      if (!S.classes.length) return toast('Créez d’abord une classe.', 'err');
      const m = modal({
        title: 'Ajouter un enseignant', size: 'large',
        body: `<form id="ens-form">${enseignantFormHtml()}</form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-ens">Créer le compte</button>`
      });
      const lireSignature = monterSignature(m.root, 'sig-ens');
      m.root.querySelector('#save-ens').onclick = async () => {
        const form = m.root.querySelector('#ens-form');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form).entries());
        delete data['sig-ens'];
        data.affectations = collecterAffectations(m.root);
        const sig = lireSignature();
        if (sig !== undefined) data.signature = sig;
        try {
          await api('/api/enseignants', { method: 'POST', body: data });
          toast('Enseignant ajouté — communiquez-lui ses identifiants');
          m.close(); renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },
    editerEnseignant(id) {
      const e = S.enseignants.find(x => x.id === id);
      if (!e) return;
      const m = modal({
        title: `Modifier ${e.nom}`, size: 'large',
        body: `<form id="ens-form">${enseignantFormHtml(e)}</form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-ens">Enregistrer</button>`
      });
      const lireSignature = monterSignature(m.root, 'sig-ens', e.signature || null);
      m.root.querySelector('#save-ens').onclick = async () => {
        const form = m.root.querySelector('#ens-form');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form).entries());
        delete data['sig-ens'];
        data.affectations = collecterAffectations(m.root);
        const sig = lireSignature();
        if (sig !== undefined) data.signature = sig;
        try {
          await api('/api/enseignants/' + id, { method: 'PUT', body: data });
          toast('Enseignant mis à jour');
          m.close(); renderRoute();
        } catch (err) { toast(err.message, 'err'); }
      };
    },
    /** Nouveaux identifiants : le mot de passe s'affiche UNE fois, à dicter. */
    async nouveauxIdentifiants(id) {
      const e = (S.enseignants || []).find(x => x.id === id);
      const m = modal({
        title: `Nouveaux identifiants — ${e ? e.nom : 'enseignant'}`,
        body: `<div class="notice warn">L'ancien mot de passe ne fonctionnera plus et
            toutes ses sessions ouvertes sont fermées.</div>
          <div class="field"><label>Mot de passe imposé (facultatif)</label>
            <input id="mdp-impose" placeholder="Laisser vide pour en générer un lisible"></div>
          <div id="mdp-resultat"></div>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Fermer</button>
                 <button class="btn btn-primary btn-sm" id="mdp-generer">🔑 Générer</button>`
      });
      m.root.querySelector('#mdp-generer').onclick = async () => {
        const impose = m.root.querySelector('#mdp-impose').value.trim();
        try {
          const res = await api(`/api/enseignants/${id}/identifiants`, {
            method: 'POST', body: impose ? { mot_de_passe: impose } : {}
          });
          const zone = m.root.querySelector('#mdp-resultat');
          zone.innerHTML = `
            <div class="notice ok" style="margin-top:10px">
              <div class="small muted">Identifiant</div>
              <div style="font-family:monospace;font-size:15px;font-weight:700">${esc(res.email)}</div>
              <div class="small muted" style="margin-top:8px">Mot de passe</div>
              <div style="font-family:monospace;font-size:19px;font-weight:800;letter-spacing:.5px">${esc(res.mot_de_passe)}</div>
              <button class="btn btn-ghost btn-sm" style="margin-top:8px" id="copier-id">📋 Copier</button>
              <div class="small" style="margin-top:8px">Notez-le maintenant : il ne sera plus affiché.</div>
            </div>`;
          zone.querySelector('#copier-id').onclick = async () => {
            try {
              await navigator.clipboard.writeText(`${res.email} / ${res.mot_de_passe}`);
              toast('Identifiants copiés');
            } catch (_) { toast('Copie impossible : notez-les à la main', 'err'); }
          };
          toast('Nouveaux identifiants générés');
          renderRoute();
        } catch (err) { toast(err.message, 'err'); }
      };
      return m;
    },

    async changerAcces(id, actif) {
      const e = (S.enseignants || []).find(x => x.id === id);
      const ok = await confirmer(actif
        ? `Rétablir l'accès de <b>${esc(e ? e.nom : '')}</b> ? Il pourra de nouveau se connecter.`
        : `Retirer l'accès de <b>${esc(e ? e.nom : '')}</b> ?<br><span class="small">Ses sessions sont fermées et ses affectations retirées. Ses notes déjà saisies sont conservées.</span>`,
        { titre: actif ? 'Rétablir l\'accès' : 'Retirer l\'accès', danger: !actif, ok: actif ? 'Rétablir' : 'Retirer' });
      if (!ok) return;
      try {
        await api(`/api/enseignants/${id}/acces`, { method: 'POST', body: { actif } });
        toast(actif ? 'Accès rétabli' : 'Accès retiré');
        renderRoute();
      } catch (err) { toast(err.message, 'err'); }
    },

    async traiterDemande(id) {
      try {
        await api(`/api/demandes-mdp/${id}/traiter`, { method: 'POST', body: { statut: 'traitee' } });
        toast('Demande marquée comme traitée');
        renderRoute();
      } catch (e) { toast(e.message, 'err'); }
    },

    async desactiverEnseignant(id) {
      const e = S.enseignants.find(x => x.id === id);
      const ok = await confirmer(`Désactiver le compte de <b>${esc(e.nom)}</b> ? Il ne pourra plus se connecter et ses affectations seront retirées.`, {
        titre: 'Désactiver le compte', ok: 'Désactiver'
      });
      if (!ok) return;
      try {
        await api('/api/enseignants/' + id, { method: 'DELETE' });
        toast('Compte désactivé'); renderRoute();
      } catch (err) { toast(err.message, 'err'); }
    }
  });

  /* ---------------------------- SAISIE ----------------------------- */
  /* Journal de saisie : qui a touché quelle note (visible par la direction) */
  async function journalSaisieHtml(classeId, periodeId) {
    let rows = [];
    try {
      rows = await api(`/api/journal-notes?classe_id=${classeId}&periode_id=${periodeId}&limite=25`);
    } catch (_) { return ''; }
    if (!Array.isArray(rows) || !rows.length) return '';
    const typeFr = t => t === 'composition' ? 'Composition' : (t === 'devoir1' ? 'Devoir 1' : (t === 'devoir2' ? 'Devoir 2' : 'Évaluation'));
    return `
      <div class="panel" style="margin-top:18px">
        <div class="panel-head">
          <div><h2>Journal de saisie</h2>
            <div class="sub">Qui a enregistré ou modifié chaque note, et quand. Réservé à la direction.</div></div>
        </div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Quand</th><th>Enseignant</th><th>Élève</th><th>Matière</th><th>Évaluation</th><th class="right">Note</th></tr></thead>
          <tbody>${rows.map(r => `
            <tr>
              <td class="muted small">${esc(dateFr(r.modifie_le))} ${esc(heureFr(r.modifie_le))}</td>
              <td>${esc(r.enseignant || '—')}</td>
              <td>${esc(r.nom)} ${esc(r.prenom)}<div class="muted small">${esc(r.matricule || '')}</div></td>
              <td>${esc(r.matiere)}</td>
              <td>${esc(typeFr(r.type))}</td>
              <td class="right">${r.absent ? '<span class="tag">Absent</span>' : (r.valeur == null ? '—' : fmt(r.valeur))}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;
  }

  V.saisie = {
    async render() {
      await loadRefs();
      const q = S.query;
      const mode = (q.epreuve_id || q.mode === 'epreuve') ? 'epreuve' : 'periode';
      const examens = mode === 'epreuve' ? await api('/api/examens') : [];
      const epreuves = examens.flatMap(ex => (ex.epreuves || []).map(ep => ({ ...ep, examen_nom: ex.nom })));
      let epreuve = null;
      let data = null;

      let classeId = Number(q.classe_id) || (S.classes[0] && S.classes[0].id);
      let matiereId = Number(q.matiere_id);
      let periodeId = Number(q.periode_id);

      // Un professeur ne choisit que dans SES matières (affectations décidées
      // par la direction). Le serveur refuse de toute façon tout le reste.
      const mesAff = Array.isArray(S.affectations) ? S.affectations : [];
      const matieresDe = (classe) => {
        const liste = classe ? (classe.matieres || []) : [];
        if (S.me.role !== 'enseignant') return liste;
        return liste.filter(m => mesAff.some(a =>
          Number(a.classe_id) === Number(classe.id) && Number(a.matiere_id) === Number(m.id)));
      };

      if (mode === 'epreuve') {
        const epId = Number(q.epreuve_id);
        epreuve = epreuves.find(e => e.id === epId) || null;
        if (epreuve) {
          classeId = epreuve.classe_id; matiereId = epreuve.matiere_id; periodeId = epreuve.periode_id;
          data = await api('/api/examens/epreuve/' + epId);
        }
      } else {
        const classe = S.classes.find(c => c.id === classeId);
        if (classe) {
          const dispo = matieresDe(classe);
          if (!matiereId || !dispo.some(m => m.id === matiereId)) matiereId = dispo[0] ? dispo[0].id : null;
          const periods = S.periodes.filter(p => p.cycle === classe.cycle);
          if (!periodeId || !periods.some(p => p.id === periodeId)) periodeId = (periods.find(p => p.statut === 'ouverte') || periods[0] || {}).id;
        }
        if (classeId && matiereId && periodeId) {
          data = await api(`/api/notes/grille?classe_id=${classeId}&matiere_id=${matiereId}&periode_id=${periodeId}`);
        }
      }

      const classesDispo = S.classes;
      const classe = classesDispo.find(c => c.id === classeId);
      const matieresClasse = matieresDe(classe);
      const periodesDispo = classe ? S.periodes.filter(p => p.cycle === classe.cycle) : S.periodes;
      const periode = S.periodes.find(p => p.id === Number(periodeId));
      const verrou = periode && periode.statut === 'fermee' && S.me.role !== 'directeur' && S.me.role !== 'super_admin';

      const barre = `
        <div class="toolbar">
          <div class="field" style="min-width:190px"><label>Mode de saisie</label>
            <select id="s-mode">
              <option value="periode" ${mode === 'periode' ? 'selected' : ''}>Devoirs &amp; composition</option>
              <option value="epreuve" ${mode === 'epreuve' ? 'selected' : ''}>Examen blanc</option>
            </select>
          </div>
          ${mode === 'epreuve' ? `
            <div class="field" style="min-width:330px"><label>Épreuve blanche</label>
              <select id="s-epreuve">
                <option value="">Choisir une épreuve…</option>
                ${epreuves.map(ep => `<option value="${ep.id}" ${ep.id === Number(q.epreuve_id) ? 'selected' : ''}>${esc(ep.examen_nom)} — ${esc(ep.classe_nom)} · ${esc(ep.matiere_nom)}</option>`).join('')}
              </select>
            </div>` : `
            <div class="field" style="min-width:170px"><label>Classe</label><select id="s-classe">${optionClasses(classeId, { vide: 'Choisir…' })}</select></div>
            <div class="field" style="min-width:200px"><label>Matière</label><select id="s-matiere">
              <option value="">Choisir…</option>
              ${matieresClasse.map(m => `<option value="${m.id}" ${m.id === Number(matiereId) ? 'selected' : ''}>${esc(m.nom)} (coef. ${m.coefficient})</option>`).join('')}
            </select></div>
            <div class="field" style="min-width:160px"><label>Période</label><select id="s-periode">
              ${periodesDispo.map(p => `<option value="${p.id}" ${p.id === Number(periodeId) ? 'selected' : ''}>${esc(p.libelle)}${p.statut === 'fermee' ? ' (clôturé)' : ''}</option>`).join('')}
            </select></div>`}
          <div class="spacer"></div>
          ${data ? `<div class="muted small" style="text-align:right;line-height:1.5">
            <b>${esc((data.classe || data.epreuve).nom || data.epreuve.classe_nom)}</b>
            ${mode === 'periode' ? ' · ' + esc(data.matiere.nom) + '<br>' + esc(data.periode.libelle) : ' · ' + esc(data.epreuve.matiere_nom) + '<br>' + dateFr(data.epreuve.date_epreuve) + ' · ' + esc(data.epreuve.heure || '')}
          </div>` : ''}
        </div>`;

      let corps = '';
      if (!classesDispo.length) {
        corps = emptyState('🏫', 'Aucune classe ne vous est affectée.', S.me.role === 'directeur' ? '<button class="btn btn-primary btn-sm" onclick="App.go(\'classes\')">Créer une classe</button>' : 'Contactez la direction.');
      } else if (mode === 'epreuve' && !epreuve) {
        corps = epreuves.length
          ? emptyState('🎯', 'Sélectionnez une épreuve blanche pour saisir les notes.')
          : emptyState('🎯', 'Aucune épreuve blanche planifiée.', S.me.role === 'directeur' ? '<button class="btn btn-primary btn-sm" onclick="App.creerExamen()">Planifier un examen blanc</button>' : '');
      } else if (!mode.includes('epreuve') && (!classeId || !matiereId || !periodeId)) {
        corps = emptyState('✍️', 'Sélectionnez une classe, une matière et une période.');
      } else if (!data) {
        corps = emptyState('🔎', 'Aucune donnée disponible pour cette sélection.');
      } else {
        corps = grilleHtml(data, mode, verrou);
      }

      const journal = (S.me.role === 'directeur' && mode === 'periode' && classeId && periodeId)
        ? await journalSaisieHtml(classeId, periodeId) : '';

      return `
        <div class="panel">
          <div class="panel-head">
            <div><h2>Saisie des notes</h2><div class="sub">Les notes sont calculées et enregistrées automatiquement pour les bulletins.</div></div>
            <div class="right">
              <span class="tag vert" id="saisie-progress">—</span>
              ${S.me.role === 'directeur' ? `<button class="btn btn-ghost btn-sm" onclick="App.go('parametres')">🔒 Périodes</button>` : ''}
            </div>
          </div>
          ${barre}
          ${verrou ? '<div class="notice warn">Cette période est <b>clôturée</b> : la saisie est verrouillée. Contactez la direction pour la réouvrir.</div>' : ''}
          ${corps}
        </div>
        ${journal}`;
    },

    async mount() {
      const q = S.query;
      const mode = (q.epreuve_id || q.mode === 'epreuve') ? 'epreuve' : 'periode';
      const navigate = (params) => {
        const base = {};
        Object.entries(params).forEach(([k, v]) => { if (v) base[k] = v; else delete base[k]; });
        App.go('saisie', base);
      };
      if ($('#s-mode')) $('#s-mode').onchange = (e) => {
        if (e.target.value === 'epreuve') App.go('saisie', { mode: 'epreuve' });
        else App.go('saisie', {});
      };
      if ($('#s-epreuve')) $('#s-epreuve').onchange = (e) => navigate({ epreuve_id: e.target.value });
      if ($('#s-classe')) $('#s-classe').onchange = (e) => navigate({ classe_id: e.target.value });
      if ($('#s-matiere')) $('#s-matiere').onchange = (e) => navigate({ classe_id: $('#s-classe').value, matiere_id: e.target.value, periode_id: $('#s-periode').value });
      if ($('#s-periode')) $('#s-periode').onchange = (e) => navigate({ classe_id: $('#s-classe').value, matiere_id: $('#s-matiere') ? $('#s-matiere').value : '', periode_id: e.target.value });

      const grid = $('#grille-notes');
      if (grid) {
        const verrou = grid.dataset.verrou === '1';
        if (verrou) $$('input.note', grid).forEach(i => i.disabled = true);
        grid.addEventListener('input', (e) => {
          if (!e.target.classList.contains('note')) return;
          const row = e.target.closest('tr');
          const v = e.target.value.replace(',', '.');
          e.target.classList.toggle('error', v !== '' && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 20));
          e.target.classList.toggle('filled', v !== '');
          majLigne(row);
          majProgression();
        });
        grid.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' || !e.target.classList.contains('note')) return;
          e.preventDefault();
          const inputs = $$('input.note', grid);
          const i = inputs.indexOf(e.target);
          if (inputs[i + 1]) { inputs[i + 1].focus(); inputs[i + 1].select(); }
        });
        $$('input.note', grid).forEach(inp => inp.addEventListener('focus', () => inp.select()));
        $$('tr', grid).forEach(majLigne);
        majProgression();
        const save = $('#btn-save-notes');
        if (save) save.onclick = () => enregistrerNotes(grid, mode);
        document.addEventListener('keydown', function onCtrlS(ev) {
          if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
            ev.preventDefault();
            if (document.body.contains(grid)) enregistrerNotes(grid, mode);
            else document.removeEventListener('keydown', onCtrlS);
          }
        });
      }
    }
  };

  function grilleHtml(data, mode, verrou) {
    const formule = (S.etab && S.etab.formule_moyenne) || 'co2';
    const header = mode === 'epreuve'
      ? `<th>Élève</th><th>Note /${fmt(data.epreuve.bareme, 0)}</th><th>Absent</th><th>Appréciation</th>`
      : `<th style="min-width:210px">Élève</th><th>Devoir 1</th><th>Devoir 2</th><th>Composition</th><th>Moyenne</th><th>Appréciation</th>`;
    const evalIds = {};
    if (mode === 'periode') data.evaluations.forEach(ev => evalIds[ev.type] = ev.id);

    const rows = data.eleves.map(e => {
      if (mode === 'epreuve') {
        const n = data.notes[e.id] || {};
        return `<tr data-eleve="${e.id}">
          <td>${esc(e.nom)} ${esc(e.prenom)}<div class="muted small">${esc(e.matricule)}</div></td>
          <td><input class="note" data-eleve="${e.id}" data-eval="${data.evaluation ? data.evaluation.id : ''}" inputmode="decimal" value="${n.valeur ?? ''}" placeholder="—"></td>
          <td><input type="checkbox" class="abs" data-eleve="${e.id}" ${n.absent ? 'checked' : ''}></td>
          <td class="appr-cell small muted">${n.valeur != null ? appreciationTexte(n.valeur) : '—'}</td>
        </tr>`;
      }
      const get = (type) => {
        const evId = evalIds[type];
        const n = evId ? (data.notes[evId] || {})[e.id] : null;
        return n && n.valeur != null ? n.valeur : '';
      };
      const absent = (type) => {
        const evId = evalIds[type];
        const n = evId ? (data.notes[evId] || {})[e.id] : null;
        return n && n.absent ? ' checked' : '';
      };
      return `<tr data-eleve="${e.id}">
        <td>${esc(e.nom)} ${esc(e.prenom)}<div class="muted small">${esc(e.matricule)}${absent('devoir1') || absent('devoir2') || absent('composition') ? ' · <span class="tag or">absent</span>' : ''}</div></td>
        <td><input class="note" data-eleve="${e.id}" data-type="devoir1" data-eval="${evalIds.devoir1 || ''}" inputmode="decimal" value="${get('devoir1')}" placeholder="—"><div class="small"><label class="switch" style="font-size:10px"><input type="checkbox" class="abs" data-type="devoir1"${absent('devoir1')}> abs.</label></div></td>
        <td><input class="note" data-eleve="${e.id}" data-type="devoir2" data-eval="${evalIds.devoir2 || ''}" inputmode="decimal" value="${get('devoir2')}" placeholder="—"><div class="small"><label class="switch" style="font-size:10px"><input type="checkbox" class="abs" data-type="devoir2"${absent('devoir2')}> abs.</label></div></td>
        <td><input class="note" data-eleve="${e.id}" data-type="composition" data-eval="${evalIds.composition || ''}" inputmode="decimal" value="${get('composition')}" placeholder="—"><div class="small"><label class="switch" style="font-size:10px"><input type="checkbox" class="abs" data-type="composition"${absent('composition')}> abs.</label></div></td>
        <td class="calc">—</td>
        <td class="appr-cell small muted">—</td>
      </tr>`;
    }).join('');

    return `
      ${data.eleves.length ? '' : '<div class="notice warn">Aucun élève actif dans cette classe.</div>'}
      <div class="table-wrap" style="max-height:66vh;overflow:auto">
        <table class="grille" id="grille-notes" data-verrou="${verrou ? 1 : 0}" data-formule="${formule}" data-mode="${mode}"
          data-classe="${data.classe ? data.classe.id : (data.epreuve ? data.epreuve.classe_id : '')}"
          data-matiere="${data.matiere ? data.matiere.id : (data.epreuve ? data.epreuve.matiere_id : '')}"
          data-periode="${data.periode ? data.periode.id : (data.epreuve ? data.epreuve.periode_id || '' : '')}">
          <thead><tr>${header}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="sticky-save">
        <button class="btn btn-primary btn-sm" id="btn-save-notes" ${verrou || !data.eleves.length ? 'disabled' : ''}>💾 Enregistrer les notes</button>
        <span class="muted small">Entrée = case suivante · Ctrl+S = enregistrer</span>
        <span class="keystat" id="saisie-stat"></span>
      </div>
      <div class="notice info" style="margin-top:12px">
        <b>Calcul :</b> ${formule === 'moy_co'
          ? 'moyenne de la matière = (moyenne des devoirs + composition) ÷ 2'
          : 'moyenne de la matière = (moyenne des devoirs + 2 × composition) ÷ 3'}.
        Une absence est exclue du calcul. La note est facultative : seules les notes saisies comptent.
      </div>`;
  }

  function appreciationTexte(v) {
    const n = Number(v);
    if (isNaN(n)) return '—';
    if (n < 6) return 'Très faible';
    if (n < 8) return 'Faible';
    if (n < 10) return 'Insuffisant';
    if (n < 12) return 'Passable';
    if (n < 14) return 'Assez bien';
    if (n < 16) return 'Bien';
    return 'Très bien';
  }

  function majLigne(row) {
    if (!row) return;
    const mode = row.closest('#grille-notes')?.dataset.mode;
    const notes = $$('input.note', row).map(i => {
      const abs = i.parentElement.querySelector('.abs');
      return abs && abs.checked ? null : i.value;
    });
    const calc = row.querySelector('.calc');
    const appr = row.querySelector('.appr-cell');
    if (mode === 'epreuve') {
      const v = notes[0];
      if (calc) calc.textContent = v === '' || v == null ? '—' : fmt(Number(String(v).replace(',', '.')));
      if (appr) appr.textContent = v === '' || v == null ? '—' : appreciationTexte(String(v).replace(',', '.'));
      return;
    }
    const m = moyenneCalc(notes);
    if (calc) {
      calc.textContent = m == null ? '—' : fmt(m);
      calc.style.color = m == null ? '' : m < 10 ? '#dc2626' : m < 12 ? '#d97706' : '#0b6b4a';
    }
    if (appr) appr.textContent = m == null ? '—' : appreciationTexte(m);
  }

  function majProgression() {
    const grid = $('#grille-notes');
    if (!grid) return;
    const total = $$('input.note', grid).length;
    const faites = $$('input.note', grid).filter(i => i.value.trim() !== '').length;
    const pct = total ? Math.round((faites / total) * 100) : 0;
    const badge = $('#saisie-progress');
    if (badge) badge.textContent = `${faites}/${total} notes · ${pct}%`;
    const stat = $('#saisie-stat');
    if (stat) stat.textContent = `${faites} note(s) sur ${total} · ${pct}% complété`;
  }

  async function enregistrerNotes(grid, mode) {
    const btn = $('#btn-save-notes');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
    try {
      if (mode === 'epreuve') {
        const q = S.query;
        const notes = $$('tr[data-eleve]', grid).map(tr => {
          const inp = tr.querySelector('input.note');
          const abs = tr.querySelector('.abs');
          return { eleve_id: Number(tr.dataset.eleve), valeur: abs.checked ? null : inp.value.trim(), absent: abs.checked };
        });
        const res = await api('/api/notes/saisie', { method: 'POST', body: { epreuve_id: Number(q.epreuve_id), notes } });
        toast(`${res.saved} note(s) enregistrée(s)`);
      } else {
        const types = ['devoir1', 'devoir2', 'composition'];
        const existantes = new Set($$('input.note', grid).map(i => i.dataset.type ? (i.dataset.eval ? i.dataset.type : null) : null).filter(Boolean));
        let total = 0;
        for (const type of types) {
          const inputs = $$(`input.note[data-type="${type}"]`, grid);
          const notes = inputs.map(inp => {
            const tr = inp.closest('tr');
            const abs = tr.querySelector(`.abs[data-type="${type}"]`);
            return { eleve_id: Number(tr.dataset.eleve), valeur: abs.checked ? null : inp.value.trim(), absent: abs.checked };
          });
          const rempli = notes.some(n => n.absent || (n.valeur !== '' && n.valeur !== null));
          if (!rempli && !existantes.has(type)) continue;
          const res = await api('/api/notes/saisie', {
            method: 'POST',
            body: { classe_id: Number(grid.dataset.classe), matiere_id: Number(grid.dataset.matiere), periode_id: Number(grid.dataset.periode), type, notes }
          });
          total += res.saved;
        }
        toast(`${total} note(s) enregistrée(s)`);
      }
      await renderRoute();
    } catch (e) {
      toast(e.message, 'err');
      if (btn) { btn.disabled = false; btn.textContent = '💾 Enregistrer les notes'; }
    }
  }

  /* --------------------------- BULLETINS --------------------------- */
  V.bulletins = {
    async render() {
      await loadRefs();
      const q = S.query;
      const examenMode = !!q.examen_id;
      const toutesPeriodes = await api('/api/periodes?historique=1');
      const examens = await api('/api/examens?historique=1');
      const examen = examens.find(e => e.id === Number(q.examen_id));

      let classeId = Number(q.classe_id) || (S.classes[0] && S.classes[0].id);
      const classe = S.classes.find(c => c.id === classeId);
      const periodes = toutesPeriodes.filter(p => !classe || p.cycle === classe.cycle);
      let periodeId = Number(q.periode_id) || (
        periodes.find(p => p.annee_scolaire === S.etab.annee_scolaire && p.statut === 'ouverte') ||
        periodes.find(p => p.annee_scolaire === S.etab.annee_scolaire) || periodes[0] || {}).id;
      const periode = toutesPeriodes.find(p => p.id === periodeId);

      const direction = S.me.role === 'directeur';
      const compoSeule = q.mode === 'composition' && !examenMode;
      let promo = null;
      if (classe && (examenMode ? q.examen_id : periodeId)) {
        const params = new URLSearchParams({ classe_id: classe.id });
        if (examenMode) params.set('examen_id', q.examen_id); else params.set('periode_id', periodeId);
        if (compoSeule) params.set('mode', 'composition');
        promo = await api('/api/bulletins/classe?' + params.toString());
      }

      const toolbar = `
        <div class="toolbar">
          <div class="field" style="min-width:190px"><label>Classe</label>
            <select id="b-classe">${optionClasses(classeId, { vide: 'Choisir une classe…' })}</select>
          </div>
          <div class="field" style="min-width:190px"><label>Source</label>
            <select id="b-source">
              <optgroup label="Bulletins de période">
                ${periodes.map(p => {
                  const cible = !examenMode && p.id === periodeId;
                  return `<option value="p:${p.id}" ${cible ? 'selected' : ''}>${esc(p.libelle)} · ${esc(p.annee_scolaire)}</option>`;
                }).join('')}
              </optgroup>
              ${examens.length ? `<optgroup label="Résultats d'examens blancs">
                ${examens.map(e => `<option value="e:${e.id}" ${examenMode && e.id === Number(q.examen_id) ? 'selected' : ''}>${esc(e.nom)} · ${esc(e.annee_scolaire)}</option>`).join('')}
              </optgroup>` : ''}
            </select>
          </div>
          ${!examenMode ? `<div class="field" style="min-width:170px"><label>Type de bulletin</label>
            <select id="b-mode">
              <option value="complet" ${!compoSeule ? 'selected' : ''}>Toutes les notes</option>
              <option value="composition" ${compoSeule ? 'selected' : ''}>Composition seule</option>
            </select></div>` : ''}
          <div class="spacer"></div>
          ${promo ? `
            <button class="btn btn-ghost btn-sm" onclick="App.exporterBulletins()">⬇️ CSV</button>
            ${examenMode
              ? `<button class="btn btn-ghost btn-sm" onclick="App.imprimerExamen(${q.examen_id},${classe.id})">🖨️ Relevé de la classe</button>`
              : `<button class="btn ${compoSeule ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="App.imprimerClasse(${classe.id},${periodeId},'${compoSeule ? 'composition' : 'complet'}')">🖨️ ${compoSeule ? 'Bulletins de composition' : 'Imprimer la classe'}</button>`}
            ${direction && !examenMode ? `<button class="btn btn-primary btn-sm" id="btn-publier">${promo.resultats.some(r => r.bulletin && r.bulletin.publie) ? '🔓 Dépublier' : '📢 Publier les bulletins'}</button>` : ''}
          ` : ''}
        </div>`;

      if (!promo) {
        return `<div class="panel"><div class="panel-head"><h2>Bulletins</h2></div>${toolbar}
          ${S.classes.length ? emptyState('📄', 'Sélectionnez une classe et une période pour calculer les bulletins.') : emptyState('🏫', 'Aucune classe disponible.', direction ? '<button class="btn btn-primary btn-sm" onclick="App.go(\'classes\')">Créer une classe</button>' : '')}
        </div>`;
      }

      S.promoCourante = promo;
      const stat = promo.stats;
      const publies = promo.resultats.filter(r => r.bulletin && r.bulletin.publie).length;
      const nonNotes = promo.resultats.filter(r => r.moyenne == null).length;
      const evalMode = examenMode;
      const libelleSource = examenMode
        ? `${examen.nom} · ${examen.annee_scolaire}` : `${periode.libelle} · ${periode.annee_scolaire}`;

      return `
        <div class="panel">
          <div class="panel-head">
            <div><h2>${esc(classe.nom)} — ${esc(libelleSource)}${compoSeule ? ' · composition' : ''}</h2>
              <div class="sub">${examenMode ? 'Simulation de résultats type examen blanc' : (compoSeule ? 'Bulletins de composition seule (moyennes calculées sur la composition)' : 'Bulletins officiels de la période')} · ${stat.effectif_classe} élève(s) · ${promo.matieres.length} matières</div></div>
          </div>
          ${toolbar}
          ${!examenMode && nonNotes ? `<div class="notice warn"><b>${nonNotes} élève(s)</b> n'ont pas encore de moyenne complète. Les bulletins restent imprimables mais seront incomplets.</div>` : ''}
          ${!examenMode && direction && publies > 0 ? `<div class="notice ok"><b>${publies} bulletin(s) publié(s).</b> Les familles y ont accès depuis leur espace personnel.</div>` : ''}

          <div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
            <div class="kpi"><div class="lbl">Moyenne de classe</div><div class="val" style="font-size:22px">${fmt(stat.moyenne)}</div><div class="sub">sur 20</div></div>
            <div class="kpi"><div class="lbl">Taux de réussite</div><div class="val" style="font-size:22px">${stat.taux_reussite == null ? '—' : stat.taux_reussite + '%'}</div><div class="sub">notes ≥ 10</div></div>
            <div class="kpi"><div class="lbl">Plus forte moyenne</div><div class="val" style="font-size:22px">${fmt(stat.max)}</div><div class="sub">plus faible : ${fmt(stat.min)}</div></div>
            <div class="kpi"><div class="lbl">Médiane</div><div class="val" style="font-size:22px">${fmt(stat.mediane)}</div><div class="sub">écart-type ${fmt(stat.ecart_type)}</div></div>
            <div class="kpi"><div class="lbl">Évalués</div><div class="val" style="font-size:22px">${promo.resultats.filter(r => r.moyenne != null).length}/${promo.resultats.length}</div><div class="sub">élèves avec moyenne</div></div>
          </div>

          <div class="table-wrap"><table class="data">
            <thead><tr>
              <th class="center">Rang</th><th>Élève</th><th class="center">Moyenne</th>${compoSeule ? '' : '<th class="center">Compo.</th>'}<th>Mention</th>
              <th class="center">Matières</th><th>Appréciation</th>
              ${!examenMode ? '<th class="center">Publication</th>' : ''}
              <th></th>
            </tr></thead>
            <tbody>${promo.resultats.slice().sort((a, b) => (a.rang || 999) - (b.rang || 999)).map(r => `
              <tr>
                <td class="center"><b>${r.rang ?? '—'}</b></td>
                <td><div class="strong">${esc(r.eleve.nom)} ${esc(r.eleve.prenom)}</div><div class="muted small">${esc(r.eleve.matricule)}</div></td>
                <td class="center">${badgeMoy(r.moyenne)}</td>
                ${compoSeule ? '' : `<td class="center small">${r.moyenne_composition == null ? '—' : fmt(r.moyenne_composition)}</td>`}
                <td class="small">${esc(r.mention)}</td>
                <td class="center small">${r.matieres_evaluees}/${r.matieres_total}</td>
                <td class="small" style="max-width:280px">${esc((r.bulletin && r.bulletin.appreciation) || r.appreciation)}
                  ${direction && !examenMode ? `<button class="icon-btn" style="padding:1px 6px;margin-left:4px" title="Modifier l'appréciation" onclick="App.appreciation(${r.eleve.id},${periodeId})">✏️</button>` : ''}</td>
                ${!examenMode ? `<td class="center">${r.bulletin && r.bulletin.publie ? '<span class="tag vert">Publié</span>' : '<span class="tag gris">Brouillon</span>'}</td>` : ''}
                <td class="right"><div class="row-actions">
                  ${!examenMode ? `<button class="icon-btn" title="Bulletin imprimable" onclick="App.imprimerBulletin(${r.eleve.id},${periodeId},'${compoSeule ? 'composition' : 'complet'}')">🖨️</button>` : ''}
                  <button class="icon-btn" title="Détail des notes" onclick="App.detailEleve(${r.eleve.id})">👁️</button>
                </div></td>
              </tr>`).join('')}</tbody>
          </table></div>
          <div class="small muted" style="margin-top:10px">
            ${compoSeule ? 'Moyenne de chaque matière = note de composition. La moyenne générale est la moyenne des compositions pondérée par les coefficients.'
              : `Formule appliquée : ${(promo.classe.formule_moyenne || S.etab.formule_moyenne) === 'moy_co' ? 'moyenne des devoirs et composition à parts égales' : '(moyenne des devoirs + 2 × composition) ÷ 3'}.`}
            Moyenne générale = Σ (moyenne × coefficient) ÷ Σ coefficients.
          </div>
        </div>`;
    },

    async mount() {
      const q = S.query;
      const navigate = (params) => App.go('bulletins', params);
      const classValue = () => $('#b-classe').value;
      const modeValue = () => ($('#b-mode') && $('#b-mode').value === 'composition') ? 'composition' : null;
      const avecMode = (params) => {
        const m = modeValue();
        if (m && !params.examen_id) params.mode = m;
        return params;
      };
      $('#b-classe').onchange = () => navigate(avecMode({ classe_id: classValue() }));
      $('#b-source').onchange = (e) => {
        const [type, id] = e.target.value.split(':');
        if (type === 'p') navigate({ classe_id: classValue(), periode_id: id, ...(modeValue() ? { mode: modeValue() } : {}) });
        else navigate({ classe_id: classValue(), examen_id: id });
      };
      if ($('#b-mode')) $('#b-mode').onchange = () => navigate(avecMode({ classe_id: classValue(), periode_id: q.periode_id }));
      const btn = $('#btn-publier');
      if (btn) btn.onclick = async () => {
        const promo = S.promoCourante;
        const tousPublies = promo.resultats.length && promo.resultats.every(r => r.bulletin && r.bulletin.publie);
        const ok = await confirmer(tousPublies
          ? 'Les bulletins ne seront plus visibles par les élèves et parents.'
          : `Publier les bulletins de <b>${esc(promo.classe.nom)}</b> — ${esc(promo.periode.libelle)} ?<br><span class="small">Chaque famille pourra consulter les résultats depuis son espace.</span>`,
          { titre: tousPublies ? 'Dépublier les bulletins' : 'Publier les bulletins', danger: tousPublies, ok: tousPublies ? 'Dépublier' : 'Publier' });
        if (!ok) return;
        try {
          await api('/api/bulletins/publier', { method: 'POST', body: { classe_id: promo.classe.id, periode_id: promo.periode.id, publie: !tousPublies } });
          toast(tousPublies ? 'Bulletins dépubliés' : 'Bulletins publiés');
          renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    }
  };

  Object.assign(window.App, {
    /** « Sur quelle base suis-je ? » — dossier, fichier, contenu, mode. */
    async voirBase() {
      let b;
      try { b = await api('/api/base'); } catch (e) { toast(e.message, 'err'); return; }
      const lignes = [
        ['Dossier du site', b.dossier],
        ['Fichier de données', b.fichier],
        ['Taille', b.taille == null ? '—' : (b.taille > 1048576 ? (b.taille / 1048576).toFixed(1) + ' Mo' : Math.round(b.taille / 1024) + ' Ko')],
        ['Dernière écriture', b.modifie_le ? dateFr(b.modifie_le) + ' ' + heureFr(b.modifie_le) : '—'],
        ['Port d\'écoute', String(b.port)],
        ['Mode', b.mode === 'demo' ? 'Démonstration (données fictives)' : 'Production']
      ].map(([k, v]) => `<div class="kv" style="display:flex;justify-content:space-between;gap:14px;padding:4px 0;border-bottom:1px solid #eef2f0">
          <span class="muted small">${esc(k)}</span>
          <span class="small" style="font-family:monospace;text-align:right;word-break:break-all">${esc(v)}</span>
        </div>`).join('');

      const compteurs = Object.entries(b.compteurs || {})
        .map(([k, v]) => `<span class="chip">${esc({
          etablissements: 'établissements', eleves: 'élèves', classes: 'classes',
          notes: 'notes', bulletins: 'bulletins', enseignants: 'enseignants'
        }[k] || k)} <b>${v == null ? '—' : v}</b></span>`).join('');

      const ecoles = (b.etablissements || []).map(e =>
        `<li><b>${esc(e.nom)}</b> — ${esc(e.ville || '')} · ${esc(e.annee_scolaire || '')}</li>`).join('');

      modal({
        title: 'Base de données utilisée',
        size: 'large',
        body: `
          ${b.mode === 'demo' ? `<div class="notice warn"><b>C'est une base de démonstration.</b>
            Les écoles, élèves et notes sont fictifs (jeu d'exemple). Pour travailler en réel, démarrez
            avec <code>TERMINISH_SEED=prod</code>.</div>` : `<div class="notice ok">Base de production.</div>`}
          <div class="small">Tout ce que vous saisissez vit dans <b>un seul fichier</b>, celui-ci. Le
            nom du dossier affiché ci-dessous doit correspondre à celui depuis lequel le site a été lancé.</div>
          <div style="margin:10px 0">${lignes}</div>
          <div class="small muted" style="margin-top:8px">Contenu réel :</div>
          <div class="chips" style="margin:6px 0 10px">${compteurs}</div>
          ${ecoles ? `<div class="small muted">Établissements présents :</div><ul class="small" style="margin:4px 0 0 18px">${ecoles}</ul>` : '<div class="small muted">Aucun établissement dans cette base.</div>'}
          <div class="notice info" style="margin-top:12px">
            Deux dossiers « TERMINISH ECOLE » = deux bases différentes. C'est le dossier de lancement qui
            décide, pas l'adresse web. Contrôle en terminal : <code>npm run base</code>. Sauvegarde :
            <code>npm run backup</code>.
          </div>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Fermer</button>
                 <button class="btn btn-primary btn-sm" id="btn-copier-base">📋 Copier le chemin</button>`
      });
      const copier = document.querySelector('#btn-copier-base');
      if (copier) copier.onclick = async () => {
        try { await navigator.clipboard.writeText(b.fichier); toast('Chemin copié'); }
        catch (_) { toast('Copie impossible', 'err'); }
      };
    },

    imprimerClasse(classeId, periodeId, mode) {
      const suffixe = mode === 'composition' ? '&mode=composition' : '';
      window.open(lienServeur(`/print/classe/${classeId}?periode_id=${periodeId}${suffixe}`), '_blank');
    },

    telechargerRecu(paiementId) {
      window.open(lienServeur(`/api/paiements/${paiementId}/recu.pdf`), '_blank');
    },

    imprimerExamen(examenId, classeId) {
      window.open(lienServeur(`/print/examen/${examenId}?classe_id=${classeId}`), '_blank');
    },

    async appreciation(eleveId, periodeId) {
      const promo = S.promoCourante;
      const r = promo.resultats.find(x => x.eleve.id === eleveId);
      if (!r) return;
      const actuelle = (r.bulletin && r.bulletin.appreciation) || '';
      const decision = (r.bulletin && r.bulletin.decision) || (r.moyenne >= 10 ? 'Admis(e)' : 'Doit se rattraper');
      const m = modal({
        title: `Appréciation — ${r.eleve.nom} ${r.eleve.prenom}`,
        body: `
          <div class="notice info">Moyenne : <b>${fmt(r.moyenne)}/20</b> · Rang : <b>${r.rang ?? '—'}</b>/${promo.resultats.length} · Mention : <b>${esc(r.mention)}</b></div>
          <div class="field"><label>Appréciation du conseil de classe</label>
            <textarea id="appr-text" rows="4" placeholder="${esc(defaultAppreciationClient(r.moyenne, r.rang, promo.resultats.length))}">${esc(actuelle)}</textarea>
            <div class="hint">Laissez vide pour utiliser l'appréciation automatique.</div>
          </div>
          <div class="field"><label>Décision</label>
            <select id="appr-decision">
              ${['Admis(e)', 'Doit se rattraper', 'Redouble', 'Félicitations', 'Encouragements', 'Tableau d’honneur', 'Avertissement travail'].map(d => `<option ${d === decision ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-appr">Enregistrer</button>`
      });
      m.root.querySelector('#save-appr').onclick = async () => {
        try {
          await api(`/api/bulletins/${eleveId}/${periodeId}`, { method: 'PUT', body: {
            appreciation: m.root.querySelector('#appr-text').value,
            decision: m.root.querySelector('#appr-decision').value
          }});
          toast('Appréciation enregistrée');
          m.close(); renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },

    async detailEleve(eleveId) {
      const promo = S.promoCourante;
      const r = promo.resultats.find(x => x.eleve.id === eleveId);
      if (!r) return;
      modal({
        title: `${r.eleve.nom} ${r.eleve.prenom} — détail des notes`,
        size: 'large',
        body: `
          <div class="notice info">Moyenne générale <b>${fmt(r.moyenne)}/20</b> · Rang <b>${r.rang ?? '—'}</b>/${promo.resultats.length} · Mention <b>${esc(r.mention)}</b></div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Matière</th><th class="center">Devoir 1</th><th class="center">Devoir 2</th><th class="center">Composition</th><th class="center">Moyenne</th><th class="center">Coef.</th><th class="center">Points</th><th class="center">Rang</th><th>Appréciation</th></tr></thead>
            <tbody>${r.lignes.map(l => `
              <tr>
                <td class="strong">${esc(l.nom)}</td>
                ${['devoir1', 'devoir2', 'composition'].map(t => `<td class="center">${l.detail[t] == null ? '<span class="muted">—</span>' : fmt(l.detail[t])}</td>`).join('')}
                <td class="center">${badgeMoy(l.moyenne)}</td>
                <td class="center">${l.coefficient}</td>
                <td class="center">${fmt(l.points)}</td>
                <td class="center">${l.rang ?? '—'}</td>
                <td class="small muted">${esc(l.appreciation)}</td>
              </tr>`).join('')}</tbody>
            <tfoot><tr style="background:#f7faf8"><td class="strong">TOTAL</td><td colspan="3"></td><td class="center strong">${fmt(r.moyenne)}</td><td class="center strong">${fmt(r.total_coef)}</td><td class="center strong">${fmt(r.total_points)}</td><td colspan="2"></td></tr></tfoot>
          </table></div>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Fermer</button>`
      });
    },

    exporterBulletins() {
      const promo = S.promoCourante;
      if (!promo) return;
      const head = 'Rang;Matricule;Nom;Prenom;Classe;Periode;Moyenne;Mention;Appreciation\n';
      const body = promo.resultats.map(r => [r.rang, r.eleve.matricule, r.eleve.nom, r.eleve.prenom, promo.classe.nom,
        promo.examen ? promo.examen.nom : promo.periode.libelle, r.moyenne, r.mention,
        (r.bulletin && r.bulletin.appreciation) || r.appreciation]
        .map(v => String(v ?? '').replace(/;/g, ',')).join(';')).join('\n');
      download(`resultats-${promo.classe.nom.replace(/\W+/g, '-')}.csv`, '\ufeff' + head + body, 'text/csv;charset=utf-8');
      toast('Résultats exportés');
    }
  });

  function defaultAppreciationClient(moy, rang, effectif) {
    if (moy == null) return "Élève non évalué pour cette période.";
    const pos = rang && effectif ? `Il/elle occupe la ${rang}e place sur ${effectif} élèves. ` : '';
    if (moy >= 16) return `Excellent trimestre, travail remarquable et régulier. ${pos}Continuez ainsi !`;
    if (moy >= 14) return `Bon ensemble, résultats solides. ${pos}Un effort supplémentaire dans les matières faibles permettra de viser l'excellence.`;
    if (moy >= 12) return `Trimestre satisfaisant. ${pos}Le travail est régulier mais doit être approfondi.`;
    if (moy >= 10) return `Résultats passables. ${pos}Des efforts plus soutenus sont attendus.`;
    return `Résultats insuffisants ce trimestre. ${pos}Un travail sérieux et un suivi rapproché sont indispensables.`;
  }

  /* ------------------------- STATISTIQUES -------------------------- */
  V.statistiques = {
    async render() {
      await loadRefs();
      const q = S.query;
      const vue = q.vue === 'etab' ? 'etab' : 'classe';
      const classes = S.classes;
      const classesCollege = classes.filter(c => c.cycle === 'college');
      const classesLycee = classes.filter(c => c.cycle === 'lycee');

      const onglets = `
        <div class="toolbar" style="margin-bottom:6px">
          <button class="btn ${vue === 'classe' ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="App.go('statistiques')">📚 Par classe</button>
          <button class="btn ${vue === 'etab' ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="App.go('statistiques',{vue:'etab'})">🏫 Établissement</button>
          <button class="btn btn-ghost btn-sm" onclick="App.go('resultats')">🏆 Résultats · fusionner les classes</button>
        </div>`;

      if (vue === 'etab') {
        let periodeId = Number(q.periode_id);
        if (!periodeId) {
          const active = S.periodes.find(p => p.statut === 'ouverte') || S.periodes[0];
          periodeId = active && active.id;
        }
        const d = periodeId ? await api('/api/stats/etablissement?periode_id=' + periodeId) : null;
        return `
          <div class="panel">
            <div class="panel-head"><div><h2>Vue d'ensemble de l'établissement</h2><div class="sub">Comparaison automatique des classes</div></div>
              <div class="right"><select id="st-periode" style="min-width:180px">
                ${S.periodes.map(p => `<option value="${p.id}" ${p.id === periodeId ? 'selected' : ''}>${esc(p.libelle)} — ${p.cycle === 'college' ? 'Collège' : 'Lycée'}</option>`).join('')}
              </select></div>
            </div>
            ${onglets}
            ${!d ? '<div class="notice warn">Aucune période disponible.</div>' : `
              <div class="cards" style="margin-top:10px">
                <div class="kpi accent"><div class="lbl">Moyenne générale</div><div class="val">${fmt(d.global.moyenne)}</div><div class="sub">${esc(d.periode.libelle)}</div></div>
                <div class="kpi"><div class="lbl">Taux de réussite</div><div class="val">${d.global.taux_reussite == null ? '—' : d.global.taux_reussite + '%'}</div><div class="sub">moyennes ≥ 10</div></div>
                <div class="kpi"><div class="lbl">Effectif évalué</div><div class="val">${d.global.effectif}</div><div class="sub">élèves actifs</div></div>
                <div class="kpi"><div class="lbl">Meilleure classe</div><div class="val" style="font-size:18px">${esc(d.global.meilleure_classe ? d.global.meilleure_classe.classe.nom : '—')}</div><div class="sub">${d.global.meilleure_classe ? fmt(d.global.meilleure_classe.moyenne) + '/20' : ''}</div></div>
              </div>
              <div class="table-wrap"><table class="data">
                <thead><tr><th>Classe</th><th class="center">Effectif</th><th class="center">Moyenne</th><th class="center">Min</th><th class="center">Max</th><th class="center">Réussite</th><th>Niveau relatif</th><th class="center">Non notés</th><th></th></tr></thead>
                <tbody>${d.classes.map(l => `
                  <tr>
                    <td class="strong">${esc(l.classe.nom)} <span class="tag ${l.classe.cycle === 'lycee' ? 'bleu' : 'gris'}">${l.classe.cycle === 'lycee' ? 'Lycée' : 'Collège'}</span></td>
                    <td class="center">${l.effectif}</td>
                    <td class="center">${badgeMoy(l.moyenne)}</td>
                    <td class="center small">${fmt(l.min)}</td>
                    <td class="center small">${fmt(l.max)}</td>
                    <td class="center">${l.taux_reussite == null ? '—' : l.taux_reussite + '%'}</td>
                    <td style="min-width:130px"><div class="progress"><i style="width:${l.moyenne == null ? 0 : (l.moyenne / 20) * 100}%"></i></div></td>
                    <td class="center small">${l.non_notes}</td>
                    <td class="right"><button class="icon-btn" onclick="App.go('statistiques',{classe_id:${l.classe.id},periode_id:${periodeId}})" title="Détail">📊</button></td>
                  </tr>`).join('') || `<tr><td colspan="9">${emptyState('🏫', 'Aucune classe pour cette période.')}</td></tr>`}
                </tbody>
              </table></div>
              <div class="small muted" style="margin-top:10px">Les statistiques se recalculent automatiquement à chaque note enregistrée.</div>
            `}
          </div>`;
      }

      // --- Vue par classe ---
      let classeId = Number(q.classe_id) || (classes[0] && classes[0].id);
      const classe = classes.find(c => c.id === classeId);
      const periodes = classe ? S.periodes.filter(p => p.cycle === classe.cycle) : S.periodes;
      let periodeId = Number(q.periode_id);
      if (!periodeId || !periodes.some(p => p.id === periodeId)) {
        periodeId = (periodes.find(p => p.statut === 'ouverte') || periodes[0] || {}).id;
      }
      const d = classe && periodeId ? await api(`/api/stats/classe?classe_id=${classeId}&periode_id=${periodeId}`) : null;

      if (!d) {
        return `<div class="panel"><div class="panel-head"><h2>Statistiques</h2></div>${onglets}
          ${emptyState('📊', 'Sélectionnez une classe pour afficher les statistiques.')}</div>`;
      }

      const stat = d.stats;
      return `
        <div class="panel">
          <div class="panel-head">
            <div><h2>Analyse — ${esc(classe.nom)}</h2><div class="sub">${esc(d.periode.libelle)} · ${stat.effectif_classe} élèves · ${d.matieres.length} matières</div></div>
            <div class="right">
              <select id="st-classe" style="min-width:150px">${optionClasses(classeId, { vide: 'Classe' })}</select>
              <select id="st-periode" style="min-width:160px">${optionPeriodes(periodeId, classe.cycle)}</select>
            </div>
          </div>
          ${onglets}
          <div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(135px,1fr));margin-top:10px">
            <div class="kpi accent"><div class="lbl">Moyenne</div><div class="val" style="font-size:23px">${fmt(stat.moyenne)}</div><div class="sub">sur 20</div></div>
            <div class="kpi"><div class="lbl">Réussite</div><div class="val" style="font-size:23px">${stat.taux_reussite == null ? '—' : stat.taux_reussite + '%'}</div><div class="sub">≥ 10/20</div></div>
            <div class="kpi"><div class="lbl">Minimum</div><div class="val" style="font-size:23px">${fmt(stat.min)}</div><div class="sub">plus faible</div></div>
            <div class="kpi"><div class="lbl">Maximum</div><div class="val" style="font-size:23px">${fmt(stat.max)}</div><div class="sub">plus forte</div></div>
            <div class="kpi"><div class="lbl">Écart-type</div><div class="val" style="font-size:23px">${fmt(stat.ecart_type)}</div><div class="sub">dispersion</div></div>
            <div class="kpi"><div class="lbl">Médiane</div><div class="val" style="font-size:23px">${fmt(stat.mediane)}</div><div class="sub">50% au-dessus</div></div>
          </div>

          ${stat.composition ? `
          <div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
            <div class="kpi accent"><div class="lbl">Moyenne en composition</div><div class="val" style="font-size:23px">${fmt(stat.composition.moyenne)}</div><div class="sub">sur 20 · ${stat.composition.effectif} élève(s) noté(s)</div></div>
            <div class="kpi vert"><div class="lbl">Ont la moyenne en composition</div><div class="val" style="font-size:23px">${stat.composition.reussite}</div><div class="sub">≥ 10/20${stat.composition.taux_reussite == null ? '' : ' · ' + stat.composition.taux_reussite + '%'}</div></div>
            <div class="kpi"><div class="lbl">N'ont pas la moyenne</div><div class="val" style="font-size:23px">${stat.composition.echec}</div><div class="sub">&lt; 10/20</div></div>
            <div class="kpi"><div class="lbl">Non notés en composition</div><div class="val" style="font-size:23px">${stat.composition.non_notes}</div><div class="sub">aucune composition saisie</div></div>
          </div>

          <div class="two-col">
            <div class="panel" style="box-shadow:none;margin:0">
              <div class="panel-head"><div><h2>Répartition des compositions</h2>
                <div class="sub">Combien d'élèves ont 1, 2, 3… sur 20</div></div>
                <div class="right"><button class="btn btn-ghost btn-sm" onclick="App.imprimerComposition(${classe.id},${periodeId})">🖨️ Bulletins de composition</button></div>
              </div>
              ${histoComposition(stat.repartition_composition)}
              <div class="table-wrap" style="margin-top:10px"><table class="data">
                <thead><tr><th>Moyenne de composition</th>${(stat.repartition_composition || []).map(b => `<th class="center">${b.note}</th>`).join('')}</tr></thead>
                <tbody><tr><td class="strong">Nombre d'élèves</td>${(stat.repartition_composition || []).map(b => `<td class="center ${b.n ? 'strong' : 'muted'}">${b.n || '·'}</td>`).join('')}</tr></tbody>
              </table></div>
            </div>
            <div class="panel" style="box-shadow:none;margin:0">
              <div class="panel-head"><div><h2>Composition par matière</h2>
                <div class="sub">Moyenne des compositions, réussite et échec</div></div></div>
              <div class="table-wrap"><table class="data">
                <thead><tr><th>Matière</th><th class="center">Notes</th><th class="center">Moyenne</th><th class="center">≥ 10</th><th class="center">&lt; 10</th></tr></thead>
                <tbody>${(stat.composition_par_matiere || []).map(m => `
                  <tr>
                    <td class="strong">${esc(m.nom)}${m.nom_college ? `<div class="muted small">au collège : ${esc(m.nom_college)}</div>` : ''}</td>
                    <td class="center small">${m.saisies}</td>
                    <td class="center">${badgeMoy(m.moyenne)}</td>
                    <td class="center small">${m.reussite}</td>
                    <td class="center small">${m.echec}</td>
                  </tr>`).join('') || `<tr><td colspan="5">${emptyState('📝', 'Aucune composition saisie.')}</td></tr>`}</tbody>
              </table></div>
            </div>
          </div>` : ''}

          <div class="two-col">
            <div class="panel" style="box-shadow:none;margin:0">
              <div class="panel-head"><h2>Moyennes par matière</h2><div class="right muted small">sur 20</div></div>
              ${barsMatieres(d.matieres_stats)}
            </div>
            <div class="panel" style="box-shadow:none;margin:0">
              <div class="panel-head"><h2>Répartition des moyennes</h2><div class="right muted small">nombre d'élèves</div></div>
              ${histo(stat.buckets)}
              <div class="chips" style="margin-top:10px">
                ${Object.entries(stat.mentions || {}).map(([m, n]) => `<span class="chip">${esc(m)} <b>${n}</b></span>`).join('') || '<span class="muted small">Aucune mention calculée</span>'}
              </div>
            </div>
          </div>

          <div class="panel" style="box-shadow:none">
            <div class="panel-head"><h2>Détail par matière</h2><div class="right muted small">coefficients et performances</div></div>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>Matière</th><th class="center">Coef.</th><th class="center">Moyenne</th><th class="center">Min</th><th class="center">Max</th><th class="center">Écart-type</th><th class="center">Réussite</th><th>Niveau</th></tr></thead>
              <tbody>${d.matieres_stats.map(m => `
                <tr>
                  <td class="strong">${esc(m.nom)}${m.nom_college ? `<div class="muted small">au collège : ${esc(m.nom_college)}</div>` : ''}</td>
                  <td class="center">${m.coefficient}</td>
                  <td class="center">${badgeMoy(m.moyenne)}</td>
                  <td class="center small">${fmt(m.min)}</td>
                  <td class="center small">${fmt(m.max)}</td>
                  <td class="center small">${fmt(m.ecart_type)}</td>
                  <td class="center">${m.taux_reussite == null ? '—' : m.taux_reussite + '%'}</td>
                  <td style="min-width:120px"><div class="progress"><i style="width:${m.moyenne == null ? 0 : (m.moyenne / 20) * 100}%"></i></div></td>
                </tr>`).join('')}</tbody>
            </table></div>
          </div>

          <div class="panel" style="box-shadow:none;margin-bottom:0">
            <div class="panel-head"><h2>Classement de la classe</h2><div class="right muted small">${esc(d.periode.libelle)}</div></div>
            <div class="table-wrap"><table class="data">
              <thead><tr><th class="center">Rang</th><th>Élève</th><th class="center">Moyenne</th><th>Mention</th><th class="center">Matières évaluées</th><th>Positionnement</th></tr></thead>
              <tbody>${d.classement.map(r => `
                <tr>
                  <td class="center strong">${r.rang}</td>
                  <td>${esc(r.eleve.nom)} ${esc(r.eleve.prenom)}</td>
                  <td class="center">${badgeMoy(r.moyenne)}</td>
                  <td class="small">${esc(r.mention)}</td>
                  <td class="center small">${r.matieres_evaluees}/${r.matieres_total}</td>
                  <td style="min-width:150px"><div class="progress ${r.moyenne < 10 ? 'or' : ''}"><i style="width:${(r.moyenne / 20) * 100}%"></i></div></td>
                </tr>`).join('') || `<tr><td colspan="6">${emptyState('📊', 'Aucune moyenne disponible.')}</td></tr>`}
              </tbody>
            </table></div>
          </div>
        </div>`;
    },
    async mount() {
      if ($('#st-classe')) $('#st-classe').onchange = (e) => App.go('statistiques', { classe_id: e.target.value, periode_id: $('#st-periode').value });
      if ($('#st-periode')) $('#st-periode').onchange = (e) => App.go('statistiques', {
        ...( $('#st-classe') ? { classe_id: $('#st-classe').value } : { vue: 'etab' }),
        periode_id: e.target.value
      });
    }
  };

  /* ---------------------- FUSION DE CLASSES ------------------------ */
  /** Regroupe les classes par cycle puis par niveau (« 6ème », « Terminale »…). */
  function groupesNiveaux(classes) {
    const out = [];
    classes.forEach(c => {
      const niveau = c.niveau || c.nom;
      let g = out.find(x => x.cycle === c.cycle && x.niveau === niveau);
      if (!g) { g = { cycle: c.cycle, niveau, classes: [] }; out.push(g); }
      g.classes.push(c);
    });
    return out;
  }
  const nomComplet = (e) => `${e.nom} ${e.prenom || ''}`.trim();

  /** Histogramme « combien ont 1, combien ont 2… » (0 à 20). */
  function histoNotes(rep, vide) {
    const r = rep || [];
    const total = r.reduce((a, b) => a + b.n, 0);
    if (!total) return `<div class="muted small" style="padding:10px 0">${esc(vide || 'Aucune note saisie.')}</div>`;
    const max = Math.max(1, ...r.map(b => b.n));
    return `<div class="hist">${r.map(b => `
      <div class="col" title="${b.n} élève(s) avec ${b.note}/20">
        <div class="n">${b.n || ''}</div>
        <div class="bar" style="height:${Math.max(3, (b.n / max) * 100)}%"></div>
        <div class="lb">${b.note}</div>
      </div>`).join('')}</div>`;
  }

  /** Tableau note par note : une ligne = « note », une ligne = effectif. */
  function tableNotes(rep) {
    const r = rep || [];
    return `<div class="table-wrap" style="margin-top:10px"><table class="data">
      <thead><tr><th>Note sur 20</th>${r.map(b => `<th class="center">${b.note}</th>`).join('')}</tr></thead>
      <tbody><tr><td class="strong">Nombre d'élèves</td>${r.map(b => `<td class="center ${b.n ? 'strong' : 'muted'}">${b.n || '·'}</td>`).join('')}</tr></tbody>
    </table></div>`;
  }

  V.fusion = {
    async render() {
      await loadRefs();
      const q = S.query;
      const classes = S.classes;
      S.fusionCourante = null;
      if (!classes.length) {
        return `<div class="panel"><div class="panel-head"><h2>Résultats · fusion de classes</h2></div>
          ${emptyState('🏫', 'Aucune classe disponible pour fusionner les résultats.')}</div>`;
      }
      let examens = [], toutesPeriodes = S.periodes;
      try {
        [examens, toutesPeriodes] = await Promise.all([
          api('/api/examens?historique=1'), api('/api/periodes?historique=1')
        ]);
      } catch (_) { examens = []; }

      const groupes = groupesNiveaux(classes);
      let sel = String(q.classes || '').split(',').map(v => Number(v)).filter(n => classes.some(c => c.id === n));
      if (!sel.length) {
        const g = groupes.find(x => x.classes.length > 1) || groupes[0];
        sel = g.classes.map(c => c.id);
      }
      const selClasses = classes.filter(c => sel.includes(c.id));
      const cycle = (selClasses[0] || classes[0]).cycle;
      const periodes = toutesPeriodes.filter(p => p.cycle === cycle);
      const periodeDefaut = (periodes.find(p => p.annee_scolaire === S.etab.annee_scolaire && p.statut === 'ouverte') ||
        periodes.find(p => p.annee_scolaire === S.etab.annee_scolaire) || periodes[0] || {}).id;
      const choixScope = q.examen_id ? `examen:${q.examen_id}` : `periode:${q.periode_id || periodeDefaut}`;
      // Un examen programmé utilise ses propres épreuves : jamais les compositions du trimestre.
      const modeComposition = !q.examen_id && q.mode === 'composition';
      const [scopeType, scopeVal] = choixScope.split(':');

      const params = new URLSearchParams({ classe_ids: sel.join(',') });
      if (scopeType === 'examen') params.set('examen_id', scopeVal); else params.set('periode_id', scopeVal);
      if (modeComposition) params.set('mode', 'composition');
      let d = null, erreur = null;
      try { d = await api('/api/fusion?' + params.toString()); } catch (e) { erreur = e; }

      const selecteur = `
        <div class="panel" style="box-shadow:none">
          <div class="panel-head">
            <div><h2>🔗 Fusionner les classes</h2><div class="sub">Cochez les classes d'un même niveau (6ème A, B et C), choisissez la période, puis cliquez sur Fusionner.</div></div>
            <div class="right">
              <button class="btn btn-ghost btn-sm" onclick="App.go('bulletins')">📄 Résultats d'une classe</button>
              ${S.me.role === 'directeur' ? `<button class="btn btn-ghost btn-sm" onclick="App.go('passage')">🎓 Décision finale</button>` : ''}
              <button class="btn btn-primary btn-sm" id="fu-lancer">🔗 Fusionner</button>
            </div>
          </div>
          ${groupes.map(g => `
            <div style="margin-bottom:10px">
              <div class="small muted" style="margin-bottom:4px">
                <span class="tag ${g.cycle === 'lycee' ? 'bleu' : 'gris'}">${g.cycle === 'lycee' ? 'Lycée' : 'Collège'}</span>
                <b>${esc(g.niveau)}</b> · ${g.classes.length} classe(s)
                ${g.classes.length > 1 ? `<button class="btn btn-ghost btn-sm fu-groupe" data-ids="${g.classes.map(c => c.id).join(',')}">Tout cocher ce niveau</button>` : ''}
              </div>
              <div class="chips">
                ${g.classes.map(c => `<label class="chip" style="cursor:pointer">
                  <input type="checkbox" class="fu-classe" value="${c.id}" ${sel.includes(c.id) ? 'checked' : ''}>
                  ${esc(c.nom)} <b>${c.effectif ?? 0}</b></label>`).join('')}
              </div>
            </div>`).join('')}
          <div class="toolbar" style="margin-top:10px;gap:10px;flex-wrap:wrap;align-items:center">
            <div class="field" style="min-width:250px;margin:0">
              <label for="fu-scope">Source des résultats</label>
              <select id="fu-scope" style="min-width:250px">
                <optgroup label="Périodes (compositions ou toutes les notes)">
                  ${periodes.map(p => `<option value="periode:${p.id}" ${choixScope === 'periode:' + p.id ? 'selected' : ''}>📄 ${esc(p.libelle)} · ${esc(p.annee_scolaire)}${p.statut === 'fermee' ? ' (clôturé)' : ''}</option>`).join('')}
                </optgroup>
                ${examens.length ? `<optgroup label="Examens blancs programmés">
                  ${examens.map(ex => `<option value="examen:${ex.id}" ${choixScope === 'examen:' + ex.id ? 'selected' : ''}>🎯 ${esc(ex.nom)} · ${esc(ex.annee_scolaire)}</option>`).join('')}
                </optgroup>` : ''}
              </select>
            </div>
            ${scopeType !== 'examen' ? `<label class="chip" style="cursor:pointer"><input type="checkbox" id="fu-mode" ${modeComposition ? 'checked' : ''}> Compositions seules (sans devoirs)</label>` : ''}
            ${S.me.role === 'directeur' ? `<button class="btn btn-ghost btn-sm" onclick="App.go('examens')">🎯 Programmer un examen blanc</button>` : ''}
          </div>
          <div class="small muted">${scopeType === 'examen'
            ? 'Source : épreuves de l’examen programmé (et non compositions du trimestre).'
            : 'Pour proclamer un examen blanc avec les notes du trimestre, cochez « Compositions seules » puis téléchargez le PDF de proclamation. Aucune note n’est modifiée.'}</div>
        </div>`;

      if (erreur) {
        return `<div class="panel"><div class="panel-head"><div><h2>Fusion de classes</h2>
          <div class="sub">Résultats de plusieurs divisions réunis</div></div></div>
          ${selecteur}
          <div class="notice err" style="margin-top:12px"><b>Impossible de fusionner :</b> ${esc(erreur.message || 'erreur inconnue')}</div>
        </div>`;
      }
      if (!d) {
        return `<div class="panel"><div class="panel-head"><h2>Fusion de classes</h2></div>
          ${selecteur}${emptyState('🔗', 'Choisissez au moins deux classes pour fusionner leurs résultats.')}</div>`;
      }

      S.fusionCourante = d;
      const st = d.stats;
      const premier = d.classement[0] || null;
      const libelle = d.examen ? d.examen.nom : (d.periode ? d.periode.libelle : '');
      const maths = d.matieres.find(m => /math/i.test(m.nom)) || d.matieres[0];
      const nomNiveau = selClasses.length === 1 ? selClasses[0].nom : [...new Set(selClasses.map(c => c.niveau || c.nom))].join(' + ');
      const totalNotes = d.classement.length;

      return `
        <div class="panel">
          <div class="panel-head">
            <div><h2>Résultats réunis — ${esc(nomNiveau)}</h2>
              <div class="sub">${esc(libelle)} · ${d.classes.length} classe${d.classes.length > 1 ? 's' : ''} · ${st.effectif_total} élève${st.effectif_total > 1 ? 's' : ''}${modeComposition ? ' · composition seule' : ''}</div></div>
            <div class="right">
              <button class="btn btn-ghost btn-sm" onclick="App.exporterFusion()">⬇️ CSV</button>
              <button class="btn btn-primary btn-sm" onclick="App.exporterFusionPDF()" ${!totalNotes ? 'disabled' : ''}>⬇️ PDF : tableau des matières</button>
              ${S.me.role === 'directeur' && modeComposition && totalNotes
                ? `<button class="btn btn-ghost btn-sm" onclick="App.exporterFusionPDF('examen-blanc')">🏆 PDF de proclamation (examen blanc)</button>` : ''}
            </div>
          </div>
          ${selecteur}
          ${!totalNotes ? `<div class="notice warn">Aucune moyenne disponible pour cette source : le PDF sera disponible après la saisie des notes.</div>` : ''}
          ${d.examen ? `<div class="notice info">Résultats de l’examen blanc programmé « ${esc(d.examen.nom)} » : seules les épreuves de cet examen sont utilisées.</div>`
            : modeComposition ? `<div class="notice info">Composition seule : les devoirs sont exclus. La direction peut télécharger le PDF de proclamation pour présenter ces résultats comme examen blanc. Cela ne crée pas d’épreuve et ne publie rien aux familles.</div>` : ''}

          <div class="cards" style="margin-top:12px">
            <div class="kpi accent"><div class="lbl">Élèves réunis</div><div class="val">${st.effectif_total}</div><div class="sub">${d.classes.length} classe${d.classes.length > 1 ? 's' : ''}</div></div>
            <div class="kpi"><div class="lbl">Moyenne du niveau</div><div class="val">${fmt(st.moyenne)}</div><div class="sub">médiane ${fmt(st.mediane)}</div></div>
            <div class="kpi"><div class="lbl">Taux de réussite</div><div class="val">${st.taux_reussite == null ? '—' : st.taux_reussite + '%'}</div><div class="sub">moyennes ≥ 10/20</div></div>
            <div class="kpi vert"><div class="lbl">Premier du niveau</div><div class="val" style="font-size:16px;line-height:1.25">${premier ? esc(nomComplet(premier.eleve)) : '—'}</div><div class="sub">${premier ? esc(premier.classe_nom) + ' · ' + fmt(premier.moyenne) + '/20' : 'aucune moyenne'}</div></div>
          </div>

          ${premier ? `<div class="notice ok" style="margin-top:12px">
            🏆 <b>${d.classes.length > 1 ? `Premier de tous les élèves de ${esc(nomNiveau)} réunis` : `Premier de ${esc(nomNiveau)}`} :</b> ${esc(nomComplet(premier.eleve))}
            (${esc(premier.classe_nom)}) avec <b>${fmt(premier.moyenne)}/20</b> — rang 1 sur ${totalNotes} élèves.
          </div>` : ''}
          ${maths && maths.plus_faible ? `<div class="notice warn">
            ⚠️ <b>Plus faible note en ${esc(maths.nom.toLowerCase())} :</b> ${esc(nomComplet(maths.plus_faible))}
            (${esc(maths.plus_faible.classe_nom)}) avec <b>${fmt(maths.plus_faible.valeur, 1)}/20</b>.
            Meilleure note : ${esc(nomComplet(maths.meilleur))} (${esc(maths.meilleur.classe_nom)}) — ${fmt(maths.meilleur.valeur, 1)}/20.
          </div>` : ''}

          <div class="panel" style="box-shadow:none">
            <div class="panel-head"><div><h2>Meilleure et plus faible note par matière</h2>
              <div class="sub">Toutes classes réunies, pour ${esc(libelle)}</div></div></div>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>Matière</th><th class="center">Coef.</th><th class="center">Moyenne</th><th>Meilleure note</th><th>Plus faible note</th><th class="center">Ont ≥ 10</th><th class="center">Non notés</th></tr></thead>
              <tbody>${d.matieres.map(m => `
                <tr>
                  <td class="strong">${esc(m.nom)}</td>
                  <td class="center small">${m.coefficients.join(' / ')}</td>
                  <td class="center">${badgeMoy(m.stats.moyenne)}</td>
                  <td class="small">${m.meilleur ? `<b>${fmt(m.meilleur.valeur, 1)}</b> — ${esc(nomComplet(m.meilleur))} <span class="muted">(${esc(m.meilleur.classe_nom)})</span>` : '<span class="muted">—</span>'}</td>
                  <td class="small">${m.plus_faible ? `<b>${fmt(m.plus_faible.valeur, 1)}</b> — ${esc(nomComplet(m.plus_faible))} <span class="muted">(${esc(m.plus_faible.classe_nom)})</span>` : '<span class="muted">—</span>'}</td>
                  <td class="center small">${m.notees ? `${m.participants.filter(p => p.valeur >= 10).length} / ${m.notees}` : '—'}</td>
                  <td class="center small">${m.non_notes}</td>
                </tr>`).join('') || `<tr><td colspan="7">${emptyState('📚', 'Aucune matière évaluée pour cette période.')}</td></tr>`}
              </tbody>
            </table></div>
          </div>

          <div class="panel" style="box-shadow:none">
            <div class="panel-head">
              <div><h2>Répartition note par note, matière par matière</h2>
                <div class="sub">Combien d'élèves ont 1, puis 2, puis 3… sur 20</div></div>
              <div class="right"><select id="fu-matiere" style="min-width:190px">
                ${d.matieres.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('')}
              </select></div>
            </div>
            ${d.matieres.map(m => `
              <div class="fu-hist" data-matiere="${m.id}" style="display:none">
                ${histoNotes(m.repartition, 'Aucune note saisie pour cette matière.')}
                ${tableNotes(m.repartition)}
                <div class="chips" style="margin-top:8px">
                  ${m.repartition.filter(b => b.n).map(b => `<span class="chip">${b.note}/20 <b>${b.n}</b></span>`).join('') || '<span class="muted small">Aucune note.</span>'}
                </div>
                <div class="small muted" style="margin-top:8px">Notes arrondies à l'entier le plus proche · ${m.notees} élève(s) noté(s)${m.non_notes ? ` · ${m.non_notes} non noté(s)` : ''}.</div>
              </div>`).join('')}
          </div>

          <div class="two-col">
            <div class="panel" style="box-shadow:none;margin:0">
              <div class="panel-head"><div><h2>Répartition des moyennes</h2>
                <div class="sub">Combien d'élèves ont 10, 11, 12… de moyenne</div></div></div>
              ${histoNotes(st.repartition, 'Aucune moyenne disponible.')}
              ${tableNotes(st.repartition)}
            </div>
            <div class="panel" style="box-shadow:none;margin:0">
              <div class="panel-head"><h2>Par tranche de moyenne</h2><div class="right muted small">nombre d'élèves</div></div>
              ${histo(st.buckets)}
              <div class="chips" style="margin-top:10px">
                ${Object.entries(st.mentions || {}).map(([m, n]) => `<span class="chip">${esc(m)} <b>${n}</b></span>`).join('') || '<span class="muted small">Aucune mention calculée</span>'}
              </div>
            </div>
          </div>

          <div class="panel" style="box-shadow:none">
            <div class="panel-head"><div><h2>Classement fusionné — ${esc(nomNiveau)}</h2>
              <div class="sub">Les rangs sont recalculés sur l'ensemble des classes</div></div>
              <div class="right"><button class="btn btn-ghost btn-sm" onclick="App.exporterFusion()">⬇️ CSV</button></div></div>
            <div class="table-wrap"><table class="data">
              <thead><tr><th class="center">Rang</th><th>Élève</th><th>Classe</th><th class="center">Moyenne</th><th>Mention</th><th class="center">Matières évaluées</th></tr></thead>
              <tbody>${d.classement.map(r => `
                <tr>
                  <td class="center strong">${r.rang}</td>
                  <td><b>${esc(r.eleve.nom)}</b> ${esc(r.eleve.prenom)}<div class="muted small">${esc(r.eleve.matricule || '')}</div></td>
                  <td><span class="tag gris">${esc(r.classe_nom)}</span></td>
                  <td class="center">${badgeMoy(r.moyenne)}</td>
                  <td class="small">${esc(r.mention)}</td>
                  <td class="center small">${r.matieres_evaluees}/${r.matieres_total}</td>
                </tr>`).join('') || `<tr><td colspan="6">${emptyState('📊', 'Aucune moyenne disponible pour cette période.')}</td></tr>`}
              </tbody>
            </table></div>
          </div>

          <div class="panel" style="box-shadow:none;margin-bottom:0">
            <div class="panel-head"><h2>Chaque classe dans le niveau</h2><div class="right muted small">repères</div></div>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>Classe</th><th class="center">Effectif</th><th class="center">Moyenne</th><th class="center">Réussite</th><th>Premier de la classe</th><th class="center">Rang dans le niveau</th></tr></thead>
              <tbody>${d.par_classe.map(c => `
                <tr>
                  <td class="strong">${esc(c.nom)}</td>
                  <td class="center">${c.effectif}</td>
                  <td class="center">${badgeMoy(c.stats.moyenne)}</td>
                  <td class="center small">${c.stats.taux_reussite == null ? '—' : c.stats.taux_reussite + '%'}</td>
                  <td class="small">${c.premier ? `${esc(c.premier.nom)} — ${fmt(c.premier.moyenne)}/20` : '<span class="muted">—</span>'}</td>
                  <td class="center strong">${c.premier ? c.premier.rang + ' / ' + totalNotes : '—'}</td>
                </tr>`).join('')}</tbody>
            </table></div>
            <div class="small muted" style="margin-top:10px">La fusion ne modifie aucune note : elle recalcule seulement un classement et des statistiques communs.</div>
          </div>
        </div>`;
    },

    async mount() {
      const lireSelection = () => $$('.fu-classe:checked').map(i => Number(i.value));
      const lancer = () => {
        const liste = lireSelection();
        if (!liste.length) return toast('Cochez au moins une classe', 'err');
        const [type, valeur] = ($('#fu-scope') ? $('#fu-scope').value : 'periode:').split(':');
        const q = { classes: liste.join(',') };
        if (type === 'examen') q.examen_id = valeur; else q.periode_id = valeur;
        if (type !== 'examen' && $('#fu-mode') && $('#fu-mode').checked) q.mode = 'composition';
        App.go('resultats', q);
      };
      // Changer de niveau remplace la sélection précédente (sinon 6e + 5e se mélangent).
      $$('.fu-groupe').forEach(b => b.onclick = () => {
        const q = { classes: b.dataset.ids };
        if (!S.query.examen_id && $('#fu-mode')?.checked) q.mode = 'composition';
        App.go('resultats', q); // la période se réajuste au cycle du nouveau niveau
      });
      if ($('#fu-lancer')) $('#fu-lancer').onclick = lancer;
      if ($('#fu-scope')) $('#fu-scope').onchange = lancer;
      if ($('#fu-mode')) $('#fu-mode').onchange = lancer;
      const selMat = $('#fu-matiere');
      if (selMat) {
        const basculer = () => $$('.fu-hist').forEach(el => {
          el.style.display = el.dataset.matiere === selMat.value ? '' : 'none';
        });
        selMat.onchange = basculer;
        basculer();
      }
    }
  };

  // Nouvelle adresse visible #/resultats ; conserver #/fusion pour les anciens favoris.
  V.resultats = V.fusion;

  // Un PDF serveur (téléchargement direct), avec le classement exactement affiché.
  window.App.exporterFusionPDF = (presentation) => {
    const d = S.fusionCourante;
    if (!d || !d.classement.length) return toast('Aucune moyenne à imprimer', 'err');
    if (presentation === 'examen-blanc' && !(S.me.role === 'directeur' && d.periode && d.stats.mode === 'composition')) {
      return toast('La proclamation nécessite les compositions seules et un compte de direction', 'err');
    }
    const p = new URLSearchParams({ classe_ids: d.classes.map(c => c.id).join(',') });
    if (d.examen) p.set('examen_id', d.examen.id);
    else if (d.periode) p.set('periode_id', d.periode.id);
    if (d.periode && d.stats.mode === 'composition') p.set('mode', 'composition');
    if (presentation === 'examen-blanc') p.set('presentation', 'examen-blanc');
    window.open(lienServeur('/api/fusion/pdf?' + p.toString()), '_blank');
  };

  window.App.exporterFusion = () => {
    const d = S.fusionCourante;
    if (!d) return;
    const nom = d.classes.map(c => c.nom).join('-').replace(/\W+/g, '-');
    const libelle = d.examen ? d.examen.nom : (d.periode ? d.periode.libelle : '');
    const head = 'Rang;Matricule;Nom;Prenom;Classe;Periode;Moyenne;Mention\n';
    const body = d.classement.map(r => [r.rang, r.eleve.matricule, r.eleve.nom, r.eleve.prenom,
      r.classe_nom, libelle, r.moyenne, r.mention]
      .map(v => String(v ?? '').replace(/;/g, ',')).join(';')).join('\n');
    const lignes = d.matieres.map(m => [m.nom, m.stats.moyenne, m.notees, m.non_notes,
      m.meilleur ? `${nomComplet(m.meilleur)} (${m.meilleur.classe_nom}) ${fmt(m.meilleur.valeur, 1)}` : '',
      m.plus_faible ? `${nomComplet(m.plus_faible)} (${m.plus_faible.classe_nom}) ${fmt(m.plus_faible.valeur, 1)}` : '']
      .map(v => String(v ?? '').replace(/;/g, ',')).join(';'));
    const headM = '\n\nMatiere;Moyenne;Notes saisies;Non notes;Meilleure note;Plus faible note\n';
    const rep = '\n\nRepartition des moyennes generales\nNote;Nombre d eleves\n'
      + d.stats.repartition.map(b => `${b.note};${b.n}`).join('\n');
    download(`fusion-${nom}.csv`, '\ufeff' + head + body + headM + lignes.join('\n') + rep, 'text/csv;charset=utf-8');
    toast('Classement fusionné exporté');
  };

  /* ---------------------- DÉCISION FINALE -------------------------- */
  V.passage = {
    async render() {
      const options = await api('/api/passages/options');
      S.optionsPassage = options;
      S.passageApercu = null;
      S.passageDestinations = {};
      S.passageSeq = (S.passageSeq || 0) + 1;
      const source = options.sources.find(c => c.id === Number(S.query.classe_id)) ||
        options.sources.find(c => c.effectif && !c.valides) || options.sources[0];
      const histoireAnnee = S.query.histoire || '';
      const histoire = histoireAnnee
        ? await api('/api/passages/historique?annee_scolaire=' + encodeURIComponent(histoireAnnee)) : null;
      const pret = !options.periodes_ouvertes.length &&
        options.sources.every(c => !c.effectif || c.valides === c.effectif);
      const libelle = { admis: 'Admis(e)', maintenu: 'Maintenu(e)', incomplet: 'Période manquante' };
      return `
        <div class="panel">
          <div class="panel-head"><div><h2>🎓 Décision finale · ${esc(options.annee_scolaire)}</h2>
            <div class="sub">6ème → 5ème · 5ème → 4ème · 4ème → 3ème · 2nde → 1ère</div></div>
            <button class="btn btn-ghost btn-sm" onclick="App.go('resultats')">← Résultats</button></div>
          <div class="notice info">La moyenne annuelle est la <b>moyenne des 3 trimestres au collège</b> ou des
            <b>2 semestres au lycée</b> (devoirs et compositions). Si une période n’a pas de moyenne,
            l’élève reste dans sa classe. Fixez le seuil et la division par défaut, puis vérifiez l’aperçu.
            Vous pouvez choisir une autre division ou série pour chaque admis.</div>
          ${options.periodes_ouvertes.length ? `<div class="notice warn">Vous pouvez consulter l’aperçu, mais pour confirmer,
            fermez d’abord les périodes : ${options.periodes_ouvertes.map(esc).join(', ')} dans
            <a href="#/parametres">Paramètres → Périodes &amp; verrouillage</a>.</div>` : ''}
          ${options.sources.length ? `
            <div class="toolbar" style="gap:12px;flex-wrap:wrap;align-items:end;margin:16px 0">
              <div class="field" style="margin:0;min-width:180px;flex:1"><label for="pa-source">Classe à traiter</label>
                <select id="pa-source" onchange="App.choisirPassageClasse(this.value)">
                  ${options.sources.map(c => `<option value="${c.id}" ${c.id === source.id ? 'selected' : ''}>${esc(c.nom)} (${c.effectif} élèves)${c.valides ? ' — validé' : ''}</option>`).join('')}
                </select></div>
              ${source.valides ? `<div class="notice ok" style="margin:0;flex:2">Décision enregistrée le ${dateFr(source.valide_le)} :
                <b>${source.admis} admis sur ${source.valides}</b> · seuil ${fmt(source.seuil_valide)}/20.
                <button class="btn btn-ghost btn-sm" onclick="App.annulerPassage(${source.id})">Annuler cette décision</button></div>` : `
                <div class="field" style="margin:0;min-width:180px;flex:1"><label for="pa-cible">Classe supérieure</label>
                  <select id="pa-cible" onchange="App.effacerApercuPassage()">
                    ${source.cibles.map(c => `<option value="${c.id}">${esc(c.nom)}</option>`).join('')}
                  </select></div>
                <div class="field" style="margin:0;min-width:140px;flex:1"><label for="pa-seuil">Seuil de passage /20</label>
                  <input id="pa-seuil" type="number" min="0" max="20" step="0.01"
                    value="${esc(S.seuilPassage ?? '10')}" oninput="App.effacerApercuPassage()"></div>
                <button class="btn btn-primary" onclick="App.apercuPassage()" ${!source.cibles.length || !source.effectif ? 'disabled' : ''}>👁 Voir l’aperçu</button>`}
            </div>
            ${!source.cibles.length ? `<div class="notice warn">Créez une classe supérieure pour ${esc(source.nom)} dans <b>Classes</b>, puis revenez ici.</div>` : ''}
            <div id="pa-apercu-resultat" aria-live="polite"></div>
            <div class="table-wrap" style="margin-top:18px"><table class="data">
              <thead><tr><th>Classe</th><th>Destination(s)</th><th class="center">Effectif</th><th>État</th></tr></thead>
              <tbody>${options.sources.map(c => `<tr><td class="strong">${esc(c.nom)}</td>
                <td>${c.cibles.map(x => esc(x.nom)).join(', ') || 'À créer'}</td><td class="center">${c.effectif}</td>
                <td>${c.valides ? `<span class="tag vert">${c.admis} admis · validé</span>` : c.effectif
                  ? '<span class="tag or">À décider</span>' : '<span class="tag gris">Classe vide</span>'}</td></tr>`).join('')}</tbody></table></div>`
            : `<div class="notice warn">Aucune 6ème, 5ème, 4ème ou 2nde ici. Créez vos classes dans le menu <b>Classes</b>.</div>`}
        </div>
        <div class="panel"><div class="panel-head"><div><h2>Nouvelle année scolaire</h2>
          <div class="sub">${esc(options.annee_scolaire)} → ${esc(options.prochaine_annee)}</div></div></div>
          <div class="small muted">Après les décisions et la clôture des périodes, ouvrez la nouvelle année.
            De nouveaux trimestres/semestres sont créés ; anciens résultats et décisions restent consultables.</div>
          ${!pret ? `<div class="notice warn" style="margin-top:10px">À terminer :
            ${options.sources.filter(c => c.effectif && c.valides !== c.effectif).map(c => esc(c.nom)).join(', ') || 'clôturer les périodes'}.</div>` : ''}
          <button class="btn btn-primary" style="margin-top:12px" onclick="App.ouvrirAnneePassage()" ${!pret ? 'disabled' : ''}>
            📅 Ouvrir ${esc(options.prochaine_annee)}</button></div>
        <div class="panel"><div class="panel-head"><div><h2>Décisions enregistrées</h2>
          <div class="sub">Consultez les moyennes et décisions conservées après le passage.</div></div></div>
          ${options.annees_archivees.length ? `<div class="field" style="max-width:240px"><label for="pa-histoire">Année à consulter</label>
            <select id="pa-histoire" onchange="App.consulterPassages(this.value)">
              <option value="">Choisir une année</option>
              ${options.annees_archivees.map(a => `<option value="${esc(a)}" ${a === histoireAnnee ? 'selected' : ''}>${esc(a)}</option>`).join('')}
            </select></div>
            ${histoire ? `<div class="table-wrap"><table class="data"><thead><tr>
              <th>Élève</th><th>Classe d’origine</th><th>Moyennes des périodes</th><th class="center">Annuelle</th>
              <th class="center">Seuil</th><th>Décision</th>
            </tr></thead><tbody>${histoire.map(l => {
              let valeurs = [];
              try { valeurs = JSON.parse(l.detail_periodes || '[]'); } catch (_) { /* Ancienne donnée */ }
              return `<tr><td><b>${esc(l.nom)} ${esc(l.prenom)}</b><div class="muted small">${esc(l.matricule || '')}</div></td>
                <td>${esc(l.classe_origine_nom)}</td><td>${Array.isArray(valeurs) ? valeurs.map(n => fmt(n)).join(' · ') : '—'}</td>
                <td class="center">${fmt(l.moyenne_annuelle)}</td><td class="center">${fmt(l.seuil)}</td>
                <td><span class="tag ${l.decision === 'admis' ? 'vert' : l.decision === 'incomplet' ? 'or' : 'gris'}">
                  ${esc(libelle[l.decision] || l.decision)}</span>${l.classe_cible_nom ? ' → ' + esc(l.classe_cible_nom) : ''}</td></tr>`;
            }).join('') || '<tr><td colspan="6">Aucune décision cette année.</td></tr>'}</tbody></table></div>` : ''}`
            : '<div class="small muted">Aucune décision enregistrée pour le moment.</div>'}</div>`;
    }
  };

  App.choisirPassageClasse = id => {
    S.seuilPassage = $('#pa-seuil')?.value ?? S.seuilPassage;
    App.go('passage', { classe_id: id });
  };
  App.effacerApercuPassage = () => {
    S.passageApercu = null;
    S.passageDestinations = {};
    S.passageSeq = (S.passageSeq || 0) + 1;
    const zone = $('#pa-apercu-resultat');
    if (zone) zone.innerHTML = '';
  };
  App.apercuPassage = async (conserverDestinations = false) => {
    const classe = Number($('#pa-source')?.value), cible = Number($('#pa-cible')?.value);
    const champ = $('#pa-seuil');
    if (!classe || !cible || !champ?.reportValidity()) return toast('Choisissez une classe supérieure et un seuil entre 0 et 20.', 'err');
    const seuil = champ.value;
    const affectations = conserverDestinations ? { ...S.passageDestinations } : {};
    S.seuilPassage = seuil;
    const zone = $('#pa-apercu-resultat');
    if (!conserverDestinations) App.effacerApercuPassage();
    else { S.passageApercu = null; S.passageSeq = (S.passageSeq || 0) + 1; }
    const sequence = S.passageSeq;
    zone.innerHTML = '<div class="notice info">Calcul des moyennes annuelles…</div>';
    try {
      const d = await api('/api/passages/apercu', { method: 'POST', body: {
        classe_id: classe, cible_id: cible, seuil, affectations
      } });
      // Une sélection changée pendant le calcul invalide l'aperçu.
      if (sequence !== S.passageSeq || classe !== Number($('#pa-source')?.value) ||
          cible !== Number($('#pa-cible')?.value) || seuil !== $('#pa-seuil')?.value) return;
      S.passageDestinations = d.affectations;
      S.passageApercu = d;
      const fermees = d.periodes.every(p => p.statut === 'fermee');
      const libelle = { admis: 'Admis(e)', maintenu: 'Maintenu(e)', incomplet: 'Période manquante' };
      zone.innerHTML = `<div class="panel" style="border:1px solid var(--bord);box-shadow:none">
        <div class="panel-head"><div><h3 style="margin:0">Aperçu · ${esc(d.classe.nom)} → ${esc(d.cible.nom)}</h3>
          <div class="sub">Seuil : ${fmt(d.seuil)}/20 · ${d.lignes.length} élève(s) ·
            ${d.stats.admis} admis · ${d.stats.maintenus} maintenu(s) · ${d.stats.incomplets} incomplet(s)</div></div>
          <button class="btn btn-primary" onclick="App.validerPassage()" ${!fermees || !d.lignes.length ? 'disabled' : ''}>✅ Confirmer le passage</button></div>
        ${!fermees ? '<div class="notice warn">Clôturez toutes les périodes avant de confirmer.</div>' : ''}
        <div class="small muted" style="margin-bottom:8px">Choisissez une autre division ou série pour un admis si nécessaire ;
          la confirmation utilisera exactement ces destinations.</div>
        <div class="table-wrap"><table class="data"><thead><tr><th>Élève</th>
          ${d.periodes.map(p => `<th class="center">${esc(p.libelle)}</th>`).join('')}
          <th class="center">Annuelle</th><th>Décision</th><th>Classe supérieure</th></tr></thead><tbody>
          ${d.lignes.map(l => `<tr><td><b>${esc(l.nom)} ${esc(l.prenom)}</b><div class="small muted">${esc(l.matricule || '')}</div></td>
            ${l.moyennes.map(n => `<td class="center">${fmt(n)}</td>`).join('')}
            <td class="center strong">${fmt(l.moyenne_annuelle)}</td>
            <td><span class="tag ${l.decision === 'admis' ? 'vert' : l.decision === 'incomplet' ? 'or' : 'gris'}">
              ${esc(libelle[l.decision])}</span></td>
            <td>${l.decision === 'admis' ? `<select class="pa-affectation" data-eleve="${l.eleve_id}"
              aria-label="Classe supérieure de ${esc(l.nom)} ${esc(l.prenom)}" onchange="App.choisirDestinationPassage()">
              ${d.cibles.map(c => `<option value="${c.id}" ${c.id === l.cible_id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}
            </select>` : '—'}</td></tr>`).join('')}
        </tbody></table></div></div>`;
      if (!conserverDestinations) zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      if (sequence === S.passageSeq) {
        S.passageDestinations = {};
        zone.innerHTML = `<div class="notice err">${esc(e.message)}</div>`;
      }
    }
  };
  App.choisirDestinationPassage = () => {
    S.passageDestinations = Object.fromEntries($$('.pa-affectation').map(i => [i.dataset.eleve, Number(i.value)]));
    App.apercuPassage(true);
  };
  App.validerPassage = async () => {
    const d = S.passageApercu;
    if (!d || S.passageEnCours) return;
    const destinations = d.cibles.map(c => {
      const n = d.lignes.filter(l => l.cible_id === c.id).length;
      return n ? `${n} en ${c.nom}` : null;
    }).filter(Boolean).join(', ');
    const oui = await confirmer(`Confirmer les décisions pour <b>${esc(d.classe.nom)}</b> ?<br>
      ${esc(destinations || 'Aucun admis')} ; ${d.stats.incomplets} élève(s) avec une période manquante resteront dans leur classe.<br>
      Les anciennes notes et décisions seront conservées.`,
    { titre: 'Décision finale', danger: false, ok: 'Confirmer le passage' });
    if (!oui) return;
    S.passageEnCours = true;
    try {
      await api('/api/passages/valider', { method: 'POST', body: {
        classe_id: d.classe.id, cible_id: d.cible.id, seuil: d.seuil,
        affectations: d.affectations, empreinte: d.empreinte
      }});
      S.passageApercu = null;
      await renderRoute();
      toast('Décision validée. Les admis ont rejoint la classe supérieure.');
    } catch (e) { toast(e.message, 'err', 8000); }
    finally { S.passageEnCours = false; }
  };
  App.annulerPassage = async id => {
    const oui = await confirmer('Annuler la décision et remettre les élèves dans leur classe d’origine ?',
      { titre: 'Annuler la décision finale', ok: 'Annuler la décision' });
    if (!oui) return;
    try {
      await api('/api/passages/annuler', { method: 'POST', body: { classe_id: id } });
      await renderRoute();
      toast('Décision annulée ; les élèves ont retrouvé leur classe d’origine.');
    } catch (e) { toast(e.message, 'err', 8000); }
  };
  App.ouvrirAnneePassage = async () => {
    const annee = S.optionsPassage?.prochaine_annee;
    if (!annee) return;
    const oui = await confirmer(`Ouvrir l’année scolaire <b>${esc(annee)}</b> ?<br>
      Les anciens trimestres/semestres, bulletins et décisions restent archivés.`,
    { titre: 'Nouvelle année', danger: false, ok: 'Ouvrir la nouvelle année' });
    if (!oui) return;
    try {
      await api('/api/passages/annee-suivante', { method: 'POST', body: { annee_scolaire: annee } });
      await boot();
      toast(`Année ${annee} ouverte : nouvelles périodes créées.`);
    } catch (e) { toast(e.message, 'err', 8000); }
  };
  App.consulterPassages = annee => App.go('passage', {
    ...(S.query.classe_id ? { classe_id: S.query.classe_id } : {}),
    ...(annee ? { histoire: annee } : {})
  });

  /* --------------------------- EXAMENS ----------------------------- */
  V.examens = {
    async render() {
      await loadRefs();
      const examens = await api('/api/examens');
      const direction = S.me.role === 'directeur';
      const fmtStatut = { prepare: 'Préparé', en_cours: 'En cours', termine: 'Terminé' };
      return `
        <div class="panel">
          <div class="panel-head">
            <div><h2>Examens blancs</h2><div class="sub">Simulez les conditions du BEPC et du BAC</div></div>
            <div class="right">${direction ? `<button class="btn btn-ghost btn-sm" onclick="App.importerListePDF()">📑 Importer une liste PDF</button>
            <button class="btn btn-primary btn-sm" onclick="App.creerExamen()">➕ Nouvel examen blanc</button>` : ''}</div>
          </div>
          <div class="notice info">Planifiez les épreuves (matière, coefficient, durée, salle), faites saisir les notes par les enseignants, puis comparez les résultats aux bulletins de période.</div>

          ${!examens.length ? emptyState('🎯', 'Aucun examen blanc planifié.',
            direction ? '<button class="btn btn-primary btn-sm" onclick="App.creerExamen()">➕ Planifier un examen</button>' : '') :
            examens.map(ex => {
              const classes = [...new Set(ex.epreuves.map(e => e.classe_nom))];
              const totalCoef = ex.epreuves.reduce((a, e) => a + Number(e.coefficient || 0), 0);
              return `<div class="panel" style="border:1px solid var(--bord);box-shadow:none;background:#fbfdfc">
                <div class="panel-head" style="margin-bottom:8px">
                  <div style="flex:1">
                    <h3 style="margin:0;font-size:16px">${esc(ex.nom)} ${badgeStatut(ex.statut)}
                      <span class="tag gris">${ex.epreuves.length} épreuve(s)</span></h3>
                    <div class="muted small">${dateFr(ex.date_debut)} → ${dateFr(ex.date_fin)}${ex.periode ? ' · ' + esc(ex.periode.libelle) : ''}${classes.length ? ' · ' + classes.map(esc).join(', ') : ''}</div>
                  </div>
                  <div class="row-actions">
                    ${direction ? `<select class="icon-btn" onchange="App.changerStatutExamen(${ex.id}, this.value)">
                      ${Object.entries(fmtStatut).map(([k, v]) => `<option value="${k}" ${ex.statut === k ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>` : ''}
                    <button class="icon-btn" title="Résultats" onclick="App.resultatsExamen(${ex.id})">📊</button>
                    ${direction ? `<button class="icon-btn danger" title="Supprimer" onclick="App.supprimerExamen(${ex.id})">🗑️</button>` : ''}
                  </div>
                </div>
                ${ex.epreuves.length ? `<div class="table-wrap"><table class="data">
                  <thead><tr><th>Matière</th><th>Classe</th><th>Date</th><th class="center">Heure</th><th class="center">Durée</th><th class="center">Coef.</th><th>Salle</th><th></th></tr></thead>
                  <tbody>${ex.epreuves.map(ep => `
                    <tr>
                      <td class="strong">${esc(ep.matiere_nom)}</td>
                      <td>${esc(ep.classe_nom)}</td>
                      <td class="small">${dateFr(ep.date_epreuve)}</td>
                      <td class="center small">${esc(ep.heure || '—')}</td>
                      <td class="center small">${ep.duree} min</td>
                      <td class="center">${ep.coefficient}</td>
                      <td class="small">${esc(ep.salle || '—')}</td>
                      <td class="right"><div class="row-actions">
                        <button class="icon-btn" title="Saisir les notes" onclick="App.go('saisie',{epreuve_id:${ep.id}})">✍️</button>
                        ${direction ? `<button class="icon-btn danger" title="Retirer" onclick="App.supprimerEpreuve(${ex.id},${ep.id})">✕</button>` : ''}
                      </div></td>
                    </tr>`).join('')}</tbody>
                </table></div>` : '<div class="notice warn" style="margin:0">Aucune épreuve planifiée pour cet examen.</div>'}
                <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                  ${direction ? `<button class="btn btn-ghost btn-sm" onclick="App.ajouterEpreuve(${ex.id})">➕ Ajouter une épreuve</button>` : ''}
                  <button class="btn btn-ghost btn-sm" onclick="App.resultatsExamen(${ex.id})">📊 Voir les résultats</button>
                  <span class="muted small" style="margin-left:auto;align-self:center">Total coefficients : <b>${totalCoef}</b></span>
                </div>
              </div>`;
            }).join('')}
        </div>`;
    }
  };

  Object.assign(window.App, {
    creerExamen() {
      if (S.me.role !== 'directeur') return;
      const m = modal({
        title: 'Planifier un examen blanc',
        body: `<form id="ex-form">
          <div class="field"><label>Nom de l'examen *</label><input name="nom" required placeholder="Examen blanc n°1 — Tle D"></div>
          <div class="field"><label>Période de rattachement</label><select name="periode_id">
            <option value="">Aucune</option>
            ${S.periodes.map(p => `<option value="${p.id}">${esc(p.libelle)} (${p.cycle === 'college' ? 'Collège' : 'Lycée'})</option>`).join('')}
          </select></div>
          <div class="grid2">
            <div class="field"><label>Début</label><input type="date" name="date_debut" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="field"><label>Fin</label><input type="date" name="date_fin" value="${new Date().toISOString().slice(0, 10)}"></div>
          </div>
        </form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-ex">Créer l'examen</button>`
      });
      m.root.querySelector('#save-ex').onclick = async () => {
        const form = m.root.querySelector('#ex-form');
        if (!form.reportValidity()) return;
        try {
          await api('/api/examens', { method: 'POST', body: Object.fromEntries(new FormData(form).entries()) });
          toast('Examen créé'); m.close(); renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },

    async ajouterEpreuve(examenId) {
      if (!S.classes.length) return toast('Créez d’abord une classe.', 'err');
      const m = modal({
        title: 'Ajouter une épreuve',
        body: `<form id="ep-form">
          <div class="grid2">
            <div class="field"><label>Classe *</label><select name="classe_id" id="ep-classe" required>${optionClasses('', { vide: 'Choisir…' })}</select></div>
            <div class="field"><label>Matière *</label><select name="matiere_id" id="ep-matiere" required><option value="">Choisir une classe d'abord</option></select></div>
          </div>
          <div class="grid2">
            <div class="field"><label>Date</label><input type="date" name="date_epreuve" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="field"><label>Heure</label><input type="time" name="heure" value="08:00"></div>
          </div>
          <div class="grid2">
            <div class="field"><label>Durée (minutes)</label><input type="number" name="duree" value="120" min="15" step="15"></div>
            <div class="field"><label>Coefficient</label><input type="number" name="coefficient" value="1" min="1" max="20" step="1"></div>
          </div>
          <div class="field"><label>Salle</label><input name="salle" placeholder="Salle A1"></div>
        </form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-ep">Ajouter l'épreuve</button>`
      });
      const selectClasse = m.root.querySelector('#ep-classe');
      const selectMat = m.root.querySelector('#ep-matiere');
      const remplir = () => {
        const c = S.classes.find(x => x.id === Number(selectClasse.value));
        selectMat.innerHTML = c ? c.matieres.map(mm => `<option value="${mm.id}">${esc(mm.nom)} (coef. ${mm.coefficient})</option>`).join('')
          : '<option value="">Choisir une classe d\'abord</option>';
        const cm = c && c.matieres.find(mm => mm.id === Number(selectMat.value));
        if (cm) m.root.querySelector('[name=coefficient]').value = cm.coefficient;
      };
      selectClasse.onchange = remplir;
      selectMat.onchange = () => {
        const c = S.classes.find(x => x.id === Number(selectClasse.value));
        const mm = c && c.matieres.find(x => x.id === Number(selectMat.value));
        if (mm) m.root.querySelector('[name=coefficient]').value = mm.coefficient;
      };
      m.root.querySelector('#save-ep').onclick = async () => {
        const form = m.root.querySelector('#ep-form');
        if (!form.reportValidity() || !selectClasse.value || !selectMat.value) return toast('Choisissez une classe et une matière', 'err');
        try {
          await api(`/api/examens/${examenId}/epreuves`, { method: 'POST', body: Object.fromEntries(new FormData(form).entries()) });
          toast('Épreuve ajoutée'); m.close(); renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },

    async supprimerEpreuve(examenId, epreuveId) {
      const ok = await confirmer('Retirer cette épreuve de l’examen ? Les notes déjà saisies pour cette épreuve seront supprimées.', { titre: 'Retirer l’épreuve', ok: 'Retirer' });
      if (!ok) return;
      try {
        await api(`/api/examens/${examenId}/epreuves/${epreuveId}`, { method: 'DELETE' });
        toast('Épreuve retirée'); renderRoute();
      } catch (e) { toast(e.message, 'err'); }
    },

    async changerStatutExamen(id, statut) {
      try {
        await api('/api/examens/' + id, { method: 'PATCH', body: { statut } });
        toast('Statut mis à jour'); renderRoute();
      } catch (e) { toast(e.message, 'err'); }
    },

    async supprimerExamen(id) {
      const ok = await confirmer('Supprimer cet examen blanc et toutes ses épreuves ? Cette action est irréversible.', { titre: 'Supprimer l’examen', ok: 'Supprimer' });
      if (!ok) return;
      try {
        await api('/api/examens/' + id, { method: 'DELETE' });
        toast('Examen supprimé'); renderRoute();
      } catch (e) { toast(e.message, 'err'); }
    },

    async resultatsExamen(id) {
      const examens = await api('/api/examens');
      const ex = examens.find(e => e.id === id);
      if (!ex) return;
      const classes = [...new Set(ex.epreuves.map(e => ({ id: e.classe_id, nom: e.classe_nom })).map(c => c.id))]
        .map(cid => ex.epreuves.find(e => e.classe_id === cid));
      if (!classes.length) return toast('Ajoutez des épreuves pour voir les résultats.', 'err');
      const m = modal({
        title: `Résultats — ${ex.nom}`,
        body: `<div class="notice info">Choisissez la classe dont vous souhaitez consulter les résultats.</div>
          <div style="display:grid;gap:8px">${classes.map(c => `
            <button class="btn btn-ghost" style="justify-content:space-between" onclick="App.go('bulletins',{classe_id:${c.classe_id},examen_id:${ex.id}});document.querySelector('.modal-back').remove()">
              <span>${esc(c.classe_nom)}</span><span class="tag gris">📊 Voir</span>
            </button>`).join('')}</div>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Fermer</button>`
      });
      return m;
    }
  });

  /* -------------------------- PARAMÈTRES --------------------------- */
  V.parametres = {
    async render() {
      const e = await api('/api/etablissement');
      S.etab = e;
      const logo = e.logo || '';
      return `
        <form id="etab-form">
        <div class="two-col">
          <div>
            <div class="panel">
              <div class="panel-head"><div><h2>Identité de l'établissement</h2><div class="sub">Ces informations apparaissent sur les bulletins</div></div></div>
              <div class="grid2">
                <div class="field" style="grid-column:1/-1">
                  <label>En-tête officiel (ministère, tutelle)</label>
                  <input name="tutelle" value="${esc(e.tutelle == null ? 'République Togolaise · Ministère des Enseignements' : e.tutelle)}" placeholder="République Togolaise · Ministère des Enseignements">
                  <div class="hint">Première ligne du bulletin. Écrivez ce qui vous convient (votre pays, votre ministère, votre devise…). Videz le champ pour ne rien afficher.</div>
                </div>
                <div class="field" style="grid-column:1/-1"><label>Nom de l'établissement *</label><input name="nom" required value="${esc(e.nom)}"></div>
                <div class="field"><label>Type</label><select name="type">
                  ${[['mixte', 'Collège + Lycée'], ['college', 'Collège'], ['lycee', 'Lycée']].map(([v, l]) => `<option value="${v}" ${e.type === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select></div>
                <div class="field"><label>Ville</label><input name="ville" value="${esc(e.ville || '')}"></div>
                <div class="field"><label>Adresse</label><input name="adresse" value="${esc(e.adresse || '')}"></div>
                <div class="field"><label>Boîte postale</label><input name="bp" value="${esc(e.bp || '')}"></div>
                <div class="field"><label>Téléphone</label><input name="telephone" value="${esc(e.telephone || '')}"></div>
                <div class="field"><label>Email</label><input name="email" value="${esc(e.email || '')}"></div>
                <div class="field"><label>Devise</label><input name="devise" value="${esc(e.devise || 'FCFA')}"></div>
                <div class="field"><label>Année scolaire</label><input name="annee_scolaire" value="${esc(e.annee_scolaire || '')}" placeholder="2025-2026"></div>
                <div class="field"><label>Nom du chef d'établissement</label><input name="chef_nom" value="${esc(e.chef_nom || '')}"></div>
                <div class="field"><label>Titre / fonction</label><input name="chef_titre" value="${esc(e.chef_titre || "Le Chef d'Établissement")}"></div>
              </div>
            </div>

            <div class="panel">
              <div class="panel-head"><div><h2>Calcul des moyennes</h2><div class="sub">Formule appliquée aux bulletins de toutes les classes</div></div></div>
              <input type="hidden" name="formule_moyenne" id="formule-input" value="${esc(e.formule_moyenne || 'co2')}">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <label class="plan" style="padding:14px;cursor:pointer;border-color:${(e.formule_moyenne || 'co2') === 'co2' ? 'var(--vert)' : 'var(--bord)'}" data-formule-card="co2">
                  <div style="display:flex;gap:8px;align-items:center"><input type="radio" name="fm" value="co2" ${(e.formule_moyenne || 'co2') === 'co2' ? 'checked' : ''}><b style="font-size:13.5px">Devoirs + 2 × Composition</b></div>
                  <div class="small muted" style="margin-top:6px;padding-left:22px">Moyenne = (moyenne des devoirs + 2 × composition) ÷ 3. Formule classique la plus répandue.</div>
                </label>
                <label class="plan" style="padding:14px;cursor:pointer;border-color:${e.formule_moyenne === 'moy_co' ? 'var(--vert)' : 'var(--bord)'}" data-formule-card="moy_co">
                  <div style="display:flex;gap:8px;align-items:center"><input type="radio" name="fm" value="moy_co" ${e.formule_moyenne === 'moy_co' ? 'checked' : ''}><b style="font-size:13.5px">Moyenne + Composition</b></div>
                  <div class="small muted" style="margin-top:6px;padding-left:22px">Moyenne = (moyenne des devoirs + composition) ÷ 2. Utilisée dans plusieurs établissements.</div>
                </label>
              </div>
            </div>
          </div>

          <div>
            <div class="panel">
              <div class="panel-head"><div><h2>Logo &amp; signature</h2><div class="sub">Affiché en tête de chaque bulletin</div></div></div>
              <div style="display:flex;gap:14px;align-items:center">
                <div class="logo-preview" id="logo-preview">${logo ? `<img src="${logo}" alt="logo">` : '<span class="muted small">Aucun logo</span>'}</div>
                <div style="flex:1">
                  <input type="hidden" name="logo" id="logo-data" value="${esc(logo)}">
                  <input type="file" id="logo-file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none">
                  <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('logo-file').click()">📤 Importer un logo</button>
                  ${logo ? '<button type="button" class="btn btn-sm btn-danger" id="logo-remove" style="margin-top:6px">Retirer</button>' : ''}
                  <div class="hint" style="margin-top:6px">PNG, JPG ou SVG. L'image est redimensionnée automatiquement.</div>
                </div>
              </div>
              <div class="notice info" style="margin:12px 0 0">Le logo et les informations de l'établissement sont imprimés sur chaque bulletin, y compris lors de l'impression en lot.</div>

              <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--bord)">
                ${signatureHtml(S.signature || null, { id: 'sig-chef', label: "Signature du chef d'établissement (imprimée sur les bulletins)" })}
                <button type="button" class="btn btn-ghost btn-sm" id="btn-sig-chef">✍️ Enregistrer ma signature</button>
              </div>
            </div>

            <div class="panel">
              <div class="panel-head"><div><h2>Mon compte</h2><div class="sub">Sécurité de la direction</div></div></div>
              <div class="small" style="margin-bottom:10px"><b>${esc(S.me.nom)}</b><br><span class="muted">${esc(S.me.email)}</span></div>
              <div class="field"><label>Mot de passe actuel</label><input type="password" id="pw-old" autocomplete="current-password"></div>
              <div class="field"><label>Nouveau mot de passe</label><input type="password" id="pw-new" autocomplete="new-password" minlength="6"></div>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-password">🔐 Changer le mot de passe</button>
            </div>

            <div class="panel">
              <div class="panel-head"><div><h2>Abonnement</h2></div>
                <div class="right">${badgeStatut(e.statut)}</div></div>
              <div class="plan-current">
                <div class="small muted">Formule actuelle</div>
                <div style="font-size:19px;font-weight:800;text-transform:capitalize">${esc(e.plan)}</div>
                <div class="small muted" style="margin-top:4px">Valable jusqu'au <b>${dateFr(e.date_fin_abonnement)}</b></div>
              </div>
              <a class="btn btn-gold btn-block" href="#/abonnement" style="margin-top:10px">Voir les formules</a>
            </div>
          </div>
        </div>
        <div class="sticky-save" style="border-radius:12px;margin-top:4px">
          <button class="btn btn-primary btn-sm" type="submit">💾 Enregistrer les paramètres</button>
          <span class="muted small">Les modifications s'appliquent immédiatement aux bulletins.</span>
        </div>
        </form>

        <div class="panel" style="margin-top:16px">
          <div class="panel-head"><div><h2>Périodes &amp; verrouillage</h2><div class="sub">Ouvrez ou clôturez les trimestres et semestres</div></div></div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Période</th><th>Cycle</th><th>Début</th><th>Fin</th><th>Statut</th></tr></thead>
            <tbody>${S.periodes.map(p => `
              <tr data-periode="${p.id}">
                <td class="strong">${esc(p.libelle)}</td>
                <td>${p.cycle === 'lycee' ? '<span class="tag bleu">Lycée</span>' : '<span class="tag gris">Collège</span>'}</td>
                <td><input type="date" class="p-debut" value="${esc(p.date_debut || '')}" style="padding:5px 7px;border:1px solid #d7e2dc;border-radius:7px"></td>
                <td><input type="date" class="p-fin" value="${esc(p.date_fin || '')}" style="padding:5px 7px;border:1px solid #d7e2dc;border-radius:7px"></td>
                <td><select class="p-statut" style="padding:5px 7px;border:1px solid #d7e2dc;border-radius:7px">
                  <option value="ouverte" ${p.statut === 'ouverte' ? 'selected' : ''}>Ouverte (saisie libre)</option>
                  <option value="fermee" ${p.statut === 'fermee' ? 'selected' : ''}>Clôturée (verrouillée)</option>
                </select></td>
              </tr>`).join('')}</tbody>
          </table></div>
          <div style="display:flex;gap:8px;margin-top:12px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" id="btn-periodes">💾 Enregistrer les périodes</button>
            <span class="muted small">Une période clôturée empêche les enseignants de modifier les notes.</span>
          </div>
        </div>`;
    },

    async mount() {
      $$('input[name=fm]').forEach(radio => {
        radio.onchange = () => {
          $('#formule-input').value = radio.value;
          $$('[data-formule-card]').forEach(c => c.style.borderColor = c.dataset.formuleCard === radio.value ? 'var(--vert)' : 'var(--bord)');
        };
      });
      const file = $('#logo-file');
      file.onchange = async () => {
        const f = file.files[0];
        if (!f) return;
        if (f.size > 4 * 1024 * 1024) return toast('Image trop volumineuse (4 Mo maximum)', 'err');
        try {
          const data = await readImage(f, 400);
          $('#logo-data').value = data;
          $('#logo-preview').innerHTML = `<img src="${data}" alt="logo">`;
          toast('Logo prêt — n’oubliez pas d’enregistrer');
        } catch { toast('Impossible de lire cette image', 'err'); }
      };
      const rm = $('#logo-remove');
      if (rm) rm.onclick = () => {
        $('#logo-data').value = '';
        $('#logo-preview').innerHTML = '<span class="muted small">Aucun logo</span>';
        rm.remove();
      };

      // Signature du chef d'établissement : importée une fois, apposée ensuite
      // automatiquement sur chaque bulletin.
      const lireSigChef = monterSignature(document, 'sig-chef', S.signature || null);
      const btnSig = $('#btn-sig-chef');
      if (btnSig) btnSig.onclick = async () => {
        const valeur = lireSigChef();
        if (valeur === undefined) return toast('Choisissez d’abord une image de signature.', 'err');
        try {
          const res = await api('/api/moi/signature', { method: 'PUT', body: { signature: valeur } });
          S.signature = res.signature || null;
          toast(valeur ? 'Signature enregistrée — elle apparaîtra sur les bulletins' : 'Signature retirée');
        } catch (err) { toast(err.message, 'err'); }
      };

      $('#etab-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        delete data.fm;
        delete data['sig-chef'];
        try {
          const res = await api('/api/etablissement', { method: 'PUT', body: data });
          S.etab = res.etablissement;
          toast('Paramètres enregistrés');
          buildShell();
          renderRoute();
        } catch (err) { toast(err.message, 'err'); }
      };

      $('#btn-password').onclick = async () => {
        const ancien = $('#pw-old').value, nouveau = $('#pw-new').value;
        if (!ancien || !nouveau) return toast('Renseignez les deux champs', 'err');
        if (nouveau.length < 6) return toast('6 caractères minimum', 'err');
        try {
          await api('/api/auth/password', { method: 'POST', body: { ancien, nouveau } });
          $('#pw-old').value = ''; $('#pw-new').value = '';
          toast('Mot de passe modifié');
        } catch (e) { toast(e.message, 'err'); }
      };

      $('#btn-periodes').onclick = async () => {
        const btn = $('#btn-periodes');
        btn.disabled = true;
        try {
          for (const tr of $$('tr[data-periode]')) {
            await api('/api/periodes/' + tr.dataset.periode, { method: 'PUT', body: {
              date_debut: tr.querySelector('.p-debut').value,
              date_fin: tr.querySelector('.p-fin').value,
              statut: tr.querySelector('.p-statut').value
            }});
          }
          await loadRefs();
          toast('Périodes mises à jour');
          renderRoute();
        } catch (e) { toast(e.message, 'err'); }
        finally { btn.disabled = false; }
      };
    }
  };

  /* -------------------------- ABONNEMENT --------------------------- */
  const PLANS = {
    essai: { nom: 'Essai gratuit', prix: 0, desc: '30 jours pour découvrir la plateforme.' },
    essentiel: { nom: 'Essentiel', prix: 15000, desc: 'Jusqu’à 300 élèves, 3 enseignants, bulletins et statistiques.' },
    standard: { nom: 'Standard', prix: 25000, desc: 'Élèves et enseignants illimités, examens blancs, espace familles.' },
    reseau: { nom: 'Réseau', prix: null, desc: 'Plusieurs établissements, console centrale et accompagnement.' }
  };

  const OP_STYLE = {
    mixx: { bg: '#fdecef', border: '#f7c9d2', color: '#b3122e', short: 'MIX' },
    moov: { bg: '#eaf1fa', border: '#c6d9f0', color: '#00508f', short: 'MOOV' },
    manuel: { bg: '#f1f4f3', border: '#dde6e1', color: '#4b6459', short: 'CASH' },
    cinetpay: { bg: '#fdf6e7', border: '#f3e3bb', color: '#8a5a05', short: 'CP' },
    paydunya: { bg: '#fff1e6', border: '#f8d3b6', color: '#9a4b00', short: 'PD' }
  };
  const OP_LABELS = {
    mixx: 'Mixx by Yas', moov: 'Moov Money', cinetpay: 'CinetPay',
    paydunya: 'PayDunya', manuel: 'Espèces / virement'
  };
  function badgeOperateur(op) {
    const st = OP_STYLE[op] || OP_STYLE.manuel;
    const label = OP_LABELS[op] || (op ? esc(op) : '—');
    return `<span class="tag" style="background:${st.bg};border:1px solid ${st.border};color:${st.color};font-weight:700">${label}</span>`;
  }
  function badgePaiementStatut(statut) {
    const map = {
      paye: ['vert', 'Payé'], en_attente: ['or', 'À vérifier'],
      rejete: ['rouge', 'Rejeté'], annule: ['gris', 'Annulé'], echoue: ['rouge', 'Échoué']
    };
    const [c, l] = map[statut] || ['gris', statut || '—'];
    return `<span class="tag ${c}">${esc(l)}</span>`;
  }

  V.abonnement = {
    async render() {
      const [e, options, paiements, contact] = await Promise.all([
        api('/api/etablissement'),
        api('/api/paiement/options'),
        api('/api/paiements'),
        api('/api/public/contact').catch(() => ({ whatsapp: '' }))
      ]);
      S.etab = e;
      S.payOpts = options;
      S.payForm = S.payForm || { plan: e.plan === 'essentiel' ? 'essentiel' : 'standard', mois: 12, operateur: 'mixx' };
      const f = S.payForm;
      const plan = options.plans.find(x => x.code === f.plan) || options.plans.find(x => !x.sur_devis) || options.plans[0];
      const dureeChoisie = plan.montants.find(m => m.mois === Number(f.mois)) || plan.montants[0];
      const montant = dureeChoisie ? dureeChoisie.montant : 0;
      const jours = e.date_fin_abonnement ? Math.ceil((new Date(e.date_fin_abonnement) - Date.now()) / 864e5) : null;
      const enAttente = paiements.filter(p => p.statut === 'en_attente');
      const operateursDispo = options.operateurs.filter(o => o.actif);
      const aucunOperateur = operateursDispo.length === 0;

      const cartesFormules = options.plans.map(p => {
        const mensuel = p.sur_devis ? 'Sur devis' : (p.prix_mensuel ? money(p.prix_mensuel) + ' / mois' : 'Prix à définir');
        return `<button type="button" class="plan-select ${p.code === f.plan ? 'on' : ''} ${p.sur_devis ? 'devis' : ''}"
            data-plan="${p.code}" ${p.sur_devis ? 'disabled' : ''}>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <b>${esc(p.nom)}</b>${p.code === e.plan ? '<span class="tag vert">Actuelle</span>' : ''}
          </div>
          <div class="small muted" style="margin-top:2px">${esc((PLANS[p.code] || {}).desc || '')}</div>
          <div style="margin-top:7px;font-weight:800;color:var(--vert-fonce);font-size:15px">${mensuel}</div>
          ${p.sur_devis ? '<div class="small muted" style="margin-top:4px">Nous contacter</div>' : ''}
        </button>`;
      }).join('');

      const cartesDuree = plan.montants.map(m => `
        <button type="button" class="duree-select ${Number(f.mois) === m.mois ? 'on' : ''}" data-mois="${m.mois}">
          <b>${esc(m.libelle)}</b>
          <div class="small muted">${money(m.montant)}</div>
          ${m.remise ? '<span class="tag or" style="margin-top:3px">2 mois offerts</span>' : ''}
        </button>`).join('');

      const cartesOperateur = options.operateurs.map(o => {
        const st = OP_STYLE[o.code] || OP_STYLE.manuel;
        return `<button type="button" class="op-select ${o.code === f.operateur ? 'on' : ''}" data-op="${o.code}"
            ${o.actif ? '' : 'disabled title="Opérateur non configuré"'}>
          <span class="op-logo" style="background:${st.bg};color:${st.color};border-color:${st.border}">${st.short}</span>
          <span style="flex:1;text-align:left">
            <b>${esc(o.nom)}</b>
            <div class="small muted">${esc(o.ancien)}</div>
          </span>
          ${o.actif ? '' : '<span class="tag gris">Indisponible</span>'}
        </button>`;
      }).join('');

      const opSel = options.operateurs.find(o => o.code === f.operateur) || operateursDispo[0] || null;

      return `
        <div class="two-col">
          <div class="panel">
            <div class="panel-head"><div><h2>Votre formule</h2><div class="sub">Abonnement de ${esc(e.nom)}</div></div>
              <div class="right">${badgeStatut(e.statut)}</div></div>
            <div class="plan-current" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
              <div style="flex:1">
                <div class="small muted">Formule actuelle</div>
                <div style="font-size:22px;font-weight:800;color:var(--vert-fonce)">${esc((PLANS[e.plan] || {}).nom || e.plan)}</div>
                <div class="small muted">${jours == null ? '' : jours >= 0 ? `${jours} jour(s) restant(s)` : '<span style="color:#b91c1c">Abonnement expiré</span>'}</div>
              </div>
              <div style="text-align:right"><div class="small muted">Échéance</div><div style="font-weight:700">${dateFr(e.date_fin_abonnement)}</div></div>
            </div>
            ${enAttente.length ? `<div class="notice warn" style="margin-top:12px">
              <b>${enAttente.length} paiement(s) en attente de vérification.</b>
              Référence : ${enAttente.map(p => `<b>${esc(p.reference)}</b>`).join(', ')}. L’activation est automatique dès validation par l’éditeur.
            </div>` : ''}
            <div class="notice ${jours !== null && jours <= 10 ? 'warn' : 'info'}" style="margin-top:12px">
              ${jours !== null && jours <= 10
                ? '<b>Votre échéance approche.</b> Réglez par Mixx by Yas ou Moov Money : l’activation suit la vérification du paiement.'
                : 'Payez par <b>Mixx by Yas</b> ou <b>Moov Money</b>. L’abonnement est prolongé dès la validation du paiement.'}
            </div>
            ${String(contact.whatsapp || '').replace(/\D/g, '') ? `<a class="btn btn-ghost btn-sm" href="https://wa.me/${String(contact.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour, abonnement Terminish École — ' + e.nom)}" target="_blank" rel="noopener" style="margin-top:4px">💬 Une question ? WhatsApp</a>` : ''}
          </div>

          <div class="panel">
            <div class="panel-head"><div><h2>Historique des paiements</h2><div class="sub">${paiements.length} opération(s)</div></div></div>
            ${paiements.length ? `<div class="table-wrap"><table class="data">
              <thead><tr><th>Date</th><th>Formule</th><th>Moyen</th><th class="right">Montant</th><th class="center">Statut</th><th></th></tr></thead>
              <tbody>${paiements.map(p => `<tr>
                <td class="small nowrap">${dateFr(p.cree_le)}</td>
                <td class="small" style="text-transform:capitalize">${esc(p.plan || '—')}${p.mois ? ` · ${p.mois} mois` : ''}</td>
                <td class="small">${badgeOperateur(p.operateur || (p.canal === 'cinetpay' || p.canal === 'paydunya' ? p.canal : 'manuel'))}</td>
                <td class="right strong">${money(p.montant, p.devise)}</td>
                <td class="center">${badgePaiementStatut(p.statut)}</td>
                <td class="right">${p.statut === 'paye'
                  ? `<button class="icon-btn" title="Télécharger le reçu PDF" onclick="App.telechargerRecu(${p.id})">📄</button>` : ''}</td>
              </tr>`).join('')}</tbody>
            </table></div>` : emptyState('💳', 'Aucun paiement enregistré pour le moment.')}
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <div><h2>💳 Payer mon abonnement</h2><div class="sub">Mixx by Yas · Moov Money${options.cinetpay.actif ? ' · CinetPay' : ''}</div></div>
            <div class="right"><span class="tag vert">Paiement sécurisé</span></div>
          </div>

          <div class="grid2" style="gap:0 18px">
            <div>
              <div class="field"><label>1. Formule souhaitée</label>
                <div class="plan-selects">${cartesFormules}</div>
              </div>
              <div class="field"><label>2. Durée</label>
                <div class="duree-selects">${cartesDuree}</div>
              </div>
              <div class="field"><label>3. Moyen de paiement</label>
                <div class="op-selects">${cartesOperateur}</div>
                ${aucunOperateur ? '<div class="notice warn" style="margin-top:8px">Les numéros marchands ne sont pas encore configurés par l’éditeur. Contactez-le pour activer le paiement.</div>' : ''}
              </div>
            </div>

            <div>
              <div class="pay-total">
                <div class="small muted">Montant à payer</div>
                <div class="amount" id="pay-amount">${money(montant)}</div>
                <div class="small muted" id="pay-detail">${esc(plan.nom)} · ${esc(dureeChoisie ? dureeChoisie.libelle : '')}${dureeChoisie && dureeChoisie.remise ? ' (2 mois offerts)' : ''}</div>
                ${(options.passerelles || []).filter(p => p.actif).map(g => `
                  <button class="btn btn-gold btn-block" data-gateway="${g.code}" style="margin-top:12px">Payer en ligne — ${esc(g.nom)}</button>
                  <div class="small muted center" style="margin-top:5px">${esc(g.description)}${g.mode === 'test' ? ' · mode test' : ''}</div>`).join('')}
              </div>

              ${opSel && opSel.actif ? `
                <div class="pay-instructions" data-op="${opSel.code}">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    ${badgeOperateur(opSel.code)}
                    <span class="small muted">Numéro marchand</span>
                  </div>
                  <div class="merchant-line">
                    <span class="merchant-num" id="merchant-num">${esc(opSel.numero || '—')}</span>
                    <button class="icon-btn" type="button" data-copy="${esc(opSel.numero || '')}" title="Copier">📋</button>
                  </div>
                  ${opSel.nom_marchand ? `<div class="small muted">Bénéficiaire : <b>${esc(opSel.nom_marchand)}</b></div>` : ''}
                  <div class="ussd-line"><span>Code USSD</span><b>${esc(opSel.ussd_paiement)}</b></div>
                  <div class="small" style="margin-top:8px;line-height:1.55">${opSel.comment_payer}</div>
                  <div class="small" style="margin-top:8px"><b>Montant exact : ${money(montant)}</b> — ajoutez la référence <b>${esc(e.nom).slice(0, 18)}</b> si l’opérateur la demande.</div>
                </div>

                <form id="pay-form" style="margin-top:12px">
                  <div class="field"><label>Numéro utilisé pour payer *</label>
                    <input name="telephone_payeur" required placeholder="+228 90 12 34 56" value="${esc(e.telephone || '')}"></div>
                  <div class="field"><label>ID / référence de la transaction *</label>
                    <input name="transaction_ref" required minlength="4" placeholder="Ex. MP260521.1042.C12345">
                    <div class="hint">Copiez l’identifiant reçu par SMS après le paiement.</div></div>
                  <div class="field"><label>Note (facultatif)</label>
                    <input name="note" placeholder="Paiement du 1er trimestre"></div>
                  <button class="btn btn-primary btn-block" type="submit" id="btn-declarer">✅ J’ai payé — déclarer mon paiement</button>
                </form>` : `
                <div class="notice info" style="margin-top:10px">Sélectionnez un moyen de paiement disponible à gauche.</div>`}
            </div>
          </div>

          <div class="notice info" style="margin-top:14px">
            <b>Comment ça marche ?</b> Vous payez par Mobile Money vers le numéro marchand, puis vous déclarez ici l’identifiant
            de la transaction. L’éditeur vérifie et votre abonnement est prolongé automatiquement. Aucun numéro de carte n’est demandé.
            ${options.cinetpay.actif ? 'Le paiement CinetPay, lui, est confirmé automatiquement en quelques secondes.' : ''}
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><div><h2>Formules disponibles</h2><div class="sub">Tarifs en francs CFA · 2 mois offerts sur 12 mois</div></div></div>
          <div class="plans" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
            ${options.plans.filter(p => !p.sur_devis).map(p => `
              <div class="plan ${p.code === e.plan ? 'pop' : ''}">
                ${p.code === 'standard' ? '<span class="tag">Le plus choisi</span>' : ''}
                <h3>${esc(p.nom)}</h3>
                <div class="desc">${esc((PLANS[p.code] || {}).desc || '')}</div>
                <div class="price">${p.prix_mensuel ? p.prix_mensuel.toLocaleString('fr-FR') + ' F<small> / mois</small>' : 'Sur devis'}</div>
                <ul>
                  ${p.code === 'essentiel' ? '<li>Jusqu’à 300 élèves</li><li>Bulletins &amp; statistiques</li><li>3 enseignants</li><li>Logo de l’école</li><li class="off">Examens blancs</li>'
                    : '<li>Élèves illimités</li><li>Enseignants illimités</li><li>Examens blancs</li><li>Espace familles</li><li>Support prioritaire</li>'}
                </ul>
                <button class="btn ${p.code === f.plan ? 'btn-primary' : 'btn-ghost'} btn-block" data-plan-choose="${p.code}" ${p.code === f.plan ? 'disabled' : ''}>
                  ${p.code === f.plan ? 'Formule sélectionnée' : 'Choisir cette formule'}
                </button>
              </div>`).join('')}
          </div>
        </div>`;
    },

    async mount() {
      const options = S.payOpts || await api('/api/paiement/options');
      const f = S.payForm;
      const recalcul = () => {
        const plan = options.plans.find(x => x.code === f.plan) || options.plans[0];
        const d = plan.montants.find(m => m.mois === Number(f.mois)) || plan.montants[0];
        const amt = document.getElementById('pay-amount');
        if (amt) amt.textContent = money(d ? d.montant : 0);
        const det = document.getElementById('pay-detail');
        if (det) det.textContent = `${plan.nom} · ${d ? d.libelle : ''}${d && d.remise ? ' (2 mois offerts)' : ''}`;
      };
      $$('[data-plan]').forEach(b => b.onclick = () => {
        f.plan = b.dataset.plan;
        S.payForm = f;
        renderRoute();
      });
      $$('[data-plan-choose]').forEach(b => b.onclick = () => {
        f.plan = b.dataset.planChoose;
        S.payForm = f;
        renderRoute();
      });
      $$('[data-mois]').forEach(b => b.onclick = () => {
        f.mois = Number(b.dataset.mois);
        S.payForm = f;
        renderRoute();
      });
      $$('[data-op]').forEach(b => b.onclick = () => {
        f.operateur = b.dataset.op;
        S.payForm = f;
        renderRoute();
      });
      $$('[data-copy]').forEach(b => b.onclick = async () => {
        try { await navigator.clipboard.writeText(b.dataset.copy); toast('Numéro copié'); }
        catch { toast('Copie impossible : notez le numéro affiché', 'err'); }
      });

      const form = document.getElementById('pay-form');
      if (form) form.onsubmit = async (ev) => {
        ev.preventDefault();
        const btn = document.getElementById('btn-declarer');
        const data = Object.fromEntries(new FormData(form).entries());
        btn.disabled = true; btn.textContent = 'Enregistrement…';
        try {
          const res = await api('/api/paiement/declarer', { method: 'POST', body: {
            plan: f.plan, mois: f.mois, operateur: f.operateur,
            telephone_payeur: data.telephone_payeur, transaction_ref: data.transaction_ref, note: data.note
          }});
          toast(`Paiement déclaré — réf. ${res.reference}. Activation après vérification.`);
          renderRoute();
        } catch (e) {
          toast(e.message, 'err');
          btn.disabled = false; btn.textContent = '✅ J’ai payé — déclarer mon paiement';
        }
      };

      $$('[data-gateway]').forEach(btn => btn.onclick = async () => {
        const g = btn.dataset.gateway;
        const libelle = btn.textContent;
        btn.disabled = true; btn.textContent = 'Connexion à ' + (g === 'paydunya' ? 'PayDunya' : 'CinetPay') + '…';
        try {
          const res = await api(`/api/paiement/${g}/initier`, { method: 'POST', body: { plan: f.plan, mois: f.mois } });
          window.location.href = res.url;
        } catch (e) {
          toast(e.message, 'err');
          btn.disabled = false; btn.textContent = libelle;
        }
      });

      const ref = new URLSearchParams(location.hash.split('?')[1] || '').get('paiement');
      if (ref) {
        const paiements = await api('/api/paiements');
        const p = paiements.find(x => x.reference === ref);
        if (p && p.statut === 'paye') toast('Paiement confirmé — abonnement activé ✅');
        else if (p) toast('Paiement en cours de vérification par l’éditeur.');
      }
    }
  };

  Object.assign(window.App, {
    async demanderActivation(plan) {
      const e = S.etab;
      const p = plan && PLANS[plan] ? PLANS[plan].nom : (PLANS[e.plan] || {}).nom || e.plan;
      try {
        await api('/api/demandes', { method: 'POST', body: {
          nom: S.me.nom, etablissement: e.nom, ville: e.ville, email: S.me.email,
          telephone: e.telephone, effectif: '',
          message: `Demande d'activation — formule ${p}. Établissement : ${e.nom} (${e.ville || ''}). Client existant.`
        }});
        toast('Demande envoyée. Notre équipe vous contacte sous 24 h.');
      } catch (err) { toast(err.message, 'err'); }
    }
  });

  /* -------------------------- ESPACE ÉLÈVE ------------------------- */
  V.espace = {
    async render() {
      const d = await api('/api/eleve/espace');
      const e = d.eleve, etab = d.etablissement;
      const publies = d.periodes.filter(p => p.publie);
      return `
        <div class="panel" style="background:linear-gradient(135deg,#0b3d2e,#0f7d58);border:0;color:#fff">
          <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            ${etab.logo ? `<img src="${etab.logo}" alt="logo" style="width:64px;height:64px;border-radius:14px;background:#fff;object-fit:contain;padding:4px">`
              : `<div style="width:64px;height:64px;border-radius:14px;background:rgba(255,255,255,.12);display:grid;place-items:center;font-size:24px">🎓</div>`}
            <div style="flex:1;min-width:200px">
              <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#a7c8ba">${esc(etab.nom)} · ${esc(etab.annee_scolaire)}</div>
              <h2 style="color:#fff;margin:4px 0 2px;font-size:22px">${esc(e.nom)} ${esc(e.prenom)}</h2>
              <div style="color:#cfe5da;font-size:13px">${esc(e.classe_nom || 'Sans classe')} · Matricule ${esc(e.matricule)} · ${e.cycle === 'lycee' ? 'Lycée (semestres)' : 'Collège (trimestres)'}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;color:#a7c8ba;text-transform:uppercase;letter-spacing:1px">Bulletins publiés</div>
              <div style="font-size:28px;font-weight:800">${publies.length}<span style="font-size:14px;font-weight:500;color:#cfe5da">/${d.periodes.length}</span></div>
            </div>
          </div>
        </div>

        ${!d.estPublie ? `<div class="notice info">Aucun bulletin n'est encore publié. Dès que la direction publie les résultats de la période, ils apparaîtront ici automatiquement.</div>` : ''}

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px">
          ${d.periodes.map(p => `
            <div class="panel" style="margin:0;${p.publie ? '' : 'opacity:.85'}">
              <div class="panel-head" style="margin-bottom:10px">
                <div><h2 style="font-size:15px">${esc(p.periode.libelle)} · ${esc(p.periode.annee_scolaire || etab.annee_scolaire)}</h2>
                  <div class="sub">${esc(p.classe_nom || e.classe_nom || '—')} · ${p.periode.cycle === 'lycee' ? 'Semestre' : 'Trimestre'}${p.periode.date_fin ? ' · Clôturé le ' + dateFr(p.periode.date_fin) : ''}</div></div>
                <div class="right">${p.publie ? '<span class="tag vert">Publié</span>' : '<span class="tag gris">En attente</span>'}</div>
              </div>
              ${p.publie ? `
                <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
                  <div>
                    <div class="small muted">Moyenne générale</div>
                    <div style="font-size:30px;font-weight:800;color:var(--vert-fonce);line-height:1.1">${fmt(p.moyenne)}<span style="font-size:14px;color:var(--muted)">/20</span></div>
                  </div>
                  <div style="border-left:1px solid var(--bord);padding-left:14px">
                    <div class="small muted">Rang</div>
                    <div style="font-size:20px;font-weight:800">${p.rang ?? '—'}<span style="font-size:12px;color:var(--muted)">/${p.effectif}</span></div>
                  </div>
                  <div style="border-left:1px solid var(--bord);padding-left:14px">
                    <div class="small muted">Mention</div>
                    <div class="mention" style="display:inline-block;padding:2px 9px;border-radius:999px;background:#e8f5ef;color:#0b6b4a;font-weight:700;font-size:11.5px;margin-top:3px">${esc(p.mention)}</div>
                  </div>
                </div>
                <div class="table-wrap"><table class="data" style="font-size:12px">
                  <thead><tr><th>Matière</th><th class="center">Coef.</th><th class="center">Moyenne</th><th class="center">Rang</th></tr></thead>
                  <tbody>${(p.lignes || []).map(l => `<tr>
                    <td>${esc(l.nom)}</td><td class="center">${l.coefficient}</td>
                    <td class="center">${badgeMoy(l.moyenne)}</td><td class="center">${l.rang ?? '—'}</td>
                  </tr>`).join('')}</tbody>
                </table></div>
                ${p.appreciation ? `<div class="appr" style="margin-top:10px;background:#f7faf8;border-left:3px solid #f0b429;padding:7px 10px;font-size:12px;font-style:italic;border-radius:0 6px 6px 0">${esc(p.appreciation)}</div>` : ''}
                <button class="btn btn-ghost btn-sm btn-block" style="margin-top:10px" onclick="App.imprimerBulletin(${e.id},${p.periode.id})">🖨️ Télécharger / imprimer le bulletin</button>
              ` : `<div class="empty" style="padding:22px 8px"><div class="big">🔒</div>
                  <div class="small">Les résultats de cette période ne sont pas encore publiés.<br>La direction les validera prochainement.</div></div>`}
            </div>`).join('')}
        </div>

        <div class="panel" style="margin-top:16px">
          <div class="panel-head"><h2>Informations utiles</h2></div>
          <div class="grid2" style="font-size:13px">
            <div class="stat-line"><span class="muted">Établissement</span><b>${esc(etab.nom)}</b></div>
            <div class="stat-line"><span class="muted">Téléphone</span><b>${esc(etab.telephone || '—')}</b></div>
            <div class="stat-line"><span class="muted">Classe</span><b>${esc(e.classe_nom || '—')}</b></div>
            <div class="stat-line"><span class="muted">Tuteur</span><b>${esc(e.tuteur_nom || '—')}</b></div>
          </div>
          <div class="notice info" style="margin-top:12px">Pour toute contestation de note, adressez-vous à la direction de l'établissement. Les bulletins officiels restent la propriété de l'école.</div>
        </div>`;
    }
  };

  /* --------------------------- CONSOLE SAAS ------------------------ */
  V.admin = {
    async render() {
      const [st, ecoles] = await Promise.all([api('/api/admin/statistiques'), api('/api/admin/etablissements')]);
      return `
        ${st.paiementsEnAttente ? `<div class="notice warn" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <span style="flex:1"><b>${st.paiementsEnAttente} paiement(s) Mobile Money à vérifier.</b> Validez-les pour activer les abonnements correspondants.</span>
          <button class="btn btn-primary btn-sm" onclick="App.go('admin-paiements')">Vérifier maintenant →</button>
        </div>` : ''}
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
          <div style="flex:1"><h2 style="margin:0 0 3px;font-size:21px">Console de la plateforme</h2>
            <div class="muted small">Pilotage des établissements clients et des revenus</div></div>
          <button class="btn btn-primary btn-sm" onclick="App.creerEcoleAdmin()">➕ Nouvel établissement</button>
        </div>
        <div class="cards">
          <div class="kpi accent"><div class="lbl">Établissements</div><div class="val">${st.nbEcoles}</div><div class="sub">${st.actives} actifs · ${st.essais} en essai</div></div>
          <div class="kpi"><div class="lbl">Élèves gérés</div><div class="val">${st.eleves}</div><div class="sub">toutes écoles confondues</div></div>
          <div class="kpi"><div class="lbl">Revenus encaissés</div><div class="val" style="font-size:21px">${money(st.revenus)}</div><div class="sub">paiements enregistrés</div></div>
          <div class="kpi"><div class="lbl">Demandes</div><div class="val">${st.leads}</div><div class="sub">nouvelles à traiter</div></div>
        </div>

        <div class="two-col">
          <div class="panel">
            <div class="panel-head"><div><h2>Établissements récents</h2></div>
              <div class="right"><button class="btn btn-ghost btn-sm" onclick="App.go('admin-ecoles')">Tout voir →</button></div></div>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>Établissement</th><th class="center">Élèves</th><th>Formule</th><th class="center">Statut</th><th class="right">Revenus</th></tr></thead>
              <tbody>${ecoles.slice(0, 6).map(e => `<tr>
                <td><div class="strong">${esc(e.nom)}</div><div class="muted small">${esc(e.ville || '')} · ${esc(e.type)}</div></td>
                <td class="center">${e.eleves}</td>
                <td class="small" style="text-transform:capitalize">${esc(e.plan)}</td>
                <td class="center">${badgeStatut(e.expire ? 'suspendu' : e.statut)}</td>
                <td class="right small">${money(e.revenus)}</td>
              </tr>`).join('') || '<tr><td colspan="5">Aucun client.</td></tr>'}</tbody>
            </table></div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><h2>Derniers paiements</h2></div></div>
            ${st.paiements.length ? st.paiements.slice(0, 6).map(p => `
              <div class="stat-line"><span><b>${esc(p.ecole_nom)}</b><br><span class="muted small">${dateFr(p.cree_le)} · ${esc(p.plan || '')} · ${esc(p.operateur || p.canal || '')}</span></span>
                <b>${money(p.montant, p.devise)}</b></div>`).join('')
              : emptyState('💳', 'Aucun paiement enregistré.')}
            <div class="notice info" style="margin-top:12px">Les abonnements se renouvellent manuellement après réception du paiement (mobile money, virement ou espèces).</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><div><h2>Modèle économique</h2><div class="sub">Vos repères pour la commercialisation</div></div></div>
          <div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:0">
            <div class="kpi"><div class="lbl">Panier moyen</div><div class="val" style="font-size:21px">${money(st.paiements.length ? Math.round(st.paiements.reduce((a, p) => a + Number(p.montant || 0), 0) / st.paiements.length) : 0)}</div><div class="sub">par paiement</div></div>
            <div class="kpi"><div class="lbl">Revenu / élève</div><div class="val" style="font-size:21px">${money(st.eleves ? Math.round(st.revenus / st.eleves) : 0)}</div><div class="sub">cumulé</div></div>
            <div class="kpi"><div class="lbl">Taux de conversion essai</div><div class="val" style="font-size:21px">${st.nbEcoles ? Math.round((st.actives / st.nbEcoles) * 100) : 0}%</div><div class="sub">essai → payant</div></div>
            <div class="kpi"><div class="lbl">Clients à relancer</div><div class="val" style="font-size:21px">${ecoles.filter(e => e.statut === 'essai').length}</div><div class="sub">écoles en essai</div></div>
          </div>
        </div>`;
    }
  };

  V['admin-ecoles'] = {
    async render() {
      const ecoles = await api('/api/admin/etablissements');
      return `
        <div class="panel">
          <div class="panel-head">
            <div><h2>Établissements clients</h2><div class="sub">${ecoles.length} établissement(s) sur la plateforme</div></div>
            <div class="right"><button class="btn btn-primary btn-sm" onclick="App.creerEcoleAdmin()">➕ Nouvel établissement</button></div>
          </div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Établissement</th><th>Contact</th><th class="center">Effectifs</th><th>Formule</th><th>Statut</th><th>Échéance</th><th class="right">Revenus</th><th></th></tr></thead>
            <tbody>${ecoles.map(e => `
              <tr>
                <td><div class="strong">${esc(e.nom)}</div><div class="muted small">${esc(e.ville || '—')} · ${esc(e.type)}</div></td>
                <td class="small">${esc(e.chef_nom || '—')}<div class="muted">${esc(e.email || e.telephone || '')}</div></td>
                <td class="center small">${e.eleves} élèves<div class="muted">${e.classes} classes · ${e.profs} profs</div></td>
                <td><select class="icon-btn" onchange="App.majEcole(${e.id},{plan:this.value})">
                  ${['essai', 'essentiel', 'standard', 'reseau'].map(p => `<option value="${p}" ${e.plan === p ? 'selected' : ''}>${esc(PLANS[p] ? PLANS[p].nom : p)}</option>`).join('')}
                </select></td>
                <td><select class="icon-btn" onchange="App.majEcole(${e.id},{statut:this.value})">
                  ${[['actif', 'Actif'], ['essai', 'Essai'], ['suspendu', 'Suspendu']].map(([v, l]) => `<option value="${v}" ${e.statut === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select></td>
                <td class="small ${e.expire ? '' : 'muted'}" style="${e.expire ? 'color:#b91c1c;font-weight:700' : ''}">${dateFr(e.date_fin_abonnement)}</td>
                <td class="right small">${money(e.revenus)}</td>
                <td class="right"><button class="icon-btn" title="Enregistrer un paiement" onclick="App.paiementEcole(${e.id})">💳</button></td>
              </tr>`).join('') || `<tr><td colspan="8">${emptyState('🏫', 'Aucun établissement.')}</td></tr>`}</tbody>
          </table></div>
        </div>`;
    }
  };

  V['admin-demandes'] = {
    async render() {
      const demandes = await api('/api/admin/demandes');
      return `
        <div class="panel">
          <div class="panel-head"><div><h2>Demandes entrantes</h2><div class="sub">${demandes.filter(d => d.statut === 'nouveau').length} nouvelle(s)</div></div></div>
          ${demandes.length ? `<div class="table-wrap"><table class="data">
            <thead><tr><th>Date</th><th>Contact</th><th>Établissement</th><th>Effectif</th><th>Message</th><th class="center">Statut</th><th></th></tr></thead>
            <tbody>${demandes.map(d => `
              <tr>
                <td class="small muted nowrap">${dateFr(d.cree_le)}</td>
                <td class="small"><b>${esc(d.nom)}</b><br><span class="muted">${esc(d.telephone)}</span><br><span class="muted">${esc(d.email || '')}</span></td>
                <td class="small">${esc(d.etablissement)}<div class="muted">${esc(d.ville || '')}</div></td>
                <td class="center small">${esc(d.effectif || '—')}</td>
                <td class="small" style="max-width:260px">${esc(d.message || '—')}</td>
                <td class="center">${badgeStatut(d.statut)}</td>
                <td class="right">${d.statut === 'nouveau' ? `<button class="icon-btn" onclick="App.traiterDemande(${d.id})">✓ Traiter</button>` : ''}</td>
              </tr>`).join('')}</tbody>
          </table></div>` : emptyState('📥', 'Aucune demande pour le moment.')}
        </div>`;
    }
  };

  V['admin-paiements'] = {
    async render() {
      const [d, ecoles, reg] = await Promise.all([
        api('/api/admin/paiements'),
        api('/api/admin/etablissements'),
        api('/api/admin/reglages')
      ]);
      S.adminReglages = reg;
      // L'état du stockage externe est facultatif : s'il n'est pas disponible
      // (version antérieure du serveur), la page continue de s'afficher.
      const stock = await api('/api/stockage/etat').catch(() => null);
      const rows = d.paiements;
      const attente = rows.filter(p => p.statut === 'en_attente');
      const parOperateur = rows.filter(p => p.statut === 'paye').reduce((a, p) => {
        const k = p.operateur || (p.canal === 'cinetpay' ? 'cinetpay' : 'manuel');
        a[k] = (a[k] || 0) + Number(p.montant || 0);
        return a;
      }, {});
      return `
        <div class="cards">
          <div class="kpi accent"><div class="lbl">Encaissé</div><div class="val" style="font-size:22px">${money(d.encaisse)}</div><div class="sub">paiements validés</div></div>
          <div class="kpi"><div class="lbl">À vérifier</div><div class="val" style="font-size:22px">${d.en_attente}</div><div class="sub">déclarations Mobile Money</div></div>
          <div class="kpi"><div class="lbl">Mixx by Yas</div><div class="val" style="font-size:19px">${money(parOperateur.mixx || 0)}</div><div class="sub">encaissé</div></div>
          <div class="kpi"><div class="lbl">Moov Money</div><div class="val" style="font-size:19px">${money(parOperateur.moov || 0)}</div><div class="sub">encaissé</div></div>
          <div class="kpi"><div class="lbl">CinetPay</div><div class="val" style="font-size:19px">${money(parOperateur.cinetpay || 0)}</div><div class="sub">${reg.cinetpay.actif ? 'en ligne actif' : 'non activé'}</div></div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <div><h2>Demandes de paiement</h2><div class="sub">Vérifiez la transaction dans votre relevé Mobile Money avant de valider</div></div>
            <div class="right"><button class="btn btn-primary btn-sm" onclick="App.paiementEcole()">➕ Encaisser manuellement</button></div>
          </div>
          ${attente.length ? `<div class="notice warn"><b>${attente.length} paiement(s) en attente.</b> La validation prolonge automatiquement l’abonnement de l’établissement.</div>` : ''}
          ${rows.length ? `<div class="table-wrap"><table class="data">
            <thead><tr><th>Date</th><th>Établissement</th><th>Formule</th><th>Moyen</th><th>Transaction</th><th class="right">Montant</th><th class="center">Statut</th><th>Actions</th></tr></thead>
            <tbody>${rows.map(p => `
              <tr>
                <td class="small nowrap">${dateFr(p.cree_le)}<div class="muted">${heureFr(p.cree_le)}</div></td>
                <td><div class="strong small">${esc(p.ecole_nom)}</div><div class="muted small">${esc(p.ecole_ville || '')}${p.demandeur ? ' · ' + esc(p.demandeur) : ''}</div></td>
                <td class="small" style="text-transform:capitalize">${esc(p.plan || '—')}<div class="muted">${p.mois || 1} mois</div></td>
                <td class="small">${badgeOperateur(p.operateur || (p.canal === 'cinetpay' ? 'cinetpay' : 'manuel'))}
                  ${p.telephone_payeur ? `<div class="muted" style="font-size:11px">${esc(p.telephone_payeur)}</div>` : ''}</td>
                <td class="small" style="max-width:180px">
                  <div style="font-family:monospace;font-size:11.5px">${esc(p.transaction_ref || '—')}</div>
                  <div class="muted" style="font-size:10.5px">${esc(p.reference || '')}</div>
                  ${p.note ? `<div class="muted" style="font-size:10.5px;font-style:italic">${esc(p.note)}</div>` : ''}
                </td>
                <td class="right strong nowrap">${money(p.montant, p.devise)}</td>
                <td class="center">${badgePaiementStatut(p.statut)}
                  ${p.valide_le ? `<div class="muted" style="font-size:10px">${dateFr(p.valide_le)}</div>` : ''}</td>
                <td class="right"><div class="row-actions">
                  ${p.statut === 'en_attente' ? `
                    <button class="btn btn-primary btn-sm" onclick="App.validerPaiement(${p.id})">✓ Valider</button>
                    <button class="btn btn-danger btn-sm" onclick="App.rejeterPaiement(${p.id})">✗</button>` : `
                    <span class="small muted">${esc(p.valideur || '')}</span>`}
                  ${p.statut === 'paye' ? `<button class="icon-btn" title="Reçu PDF" onclick="window.open(lienServeur('/api/admin/paiements/${p.id}/recu.pdf'),'_blank')">📄</button>` : ''}
                </div></td>
              </tr>`).join('')}</tbody>
          </table></div>` : emptyState('💳', 'Aucun paiement enregistré.')}
          <div class="notice info" style="margin-top:14px"><b>Bon réflexe :</b> comparez la référence de transaction avec le SMS reçu
            sur le compte marchand et le montant exact. En cas de doute, rejetez avec une note.</div>
        </div>

        <div class="two-col">
          <div class="panel">
            <div class="panel-head"><div><h2>Numéros marchands</h2><div class="sub">Affichés aux établissements sur la page d’abonnement</div></div></div>
            <form id="mm-form">
              <h4 style="margin:0 0 8px;font-size:13px">🔴 Mixx by Yas <span class="tag gris">ex T-Money · *145*5#</span></h4>
              <div class="grid2">
                <div class="field"><label>Numéro marchand Mixx</label><input name="mixx_numero" value="${esc(reg.mixx_numero)}" placeholder="+228 93 15 01 78"></div>
                <div class="field"><label>Nom du bénéficiaire</label><input name="mixx_nom" value="${esc(reg.mixx_nom)}" placeholder="TERMINISH ECOLE"></div>
              </div>
              <label class="switch" style="margin-bottom:14px"><input type="checkbox" name="mixx_actif" ${reg.mixx_actif ? 'checked' : ''}> Accepter les paiements Mixx by Yas</label>

              <h4 style="margin:6px 0 8px;font-size:13px">🔵 Moov Money <span class="tag gris">Flooz · *155*2*2#</span></h4>
              <div class="grid2">
                <div class="field"><label>Numéro marchand Moov</label><input name="moov_numero" value="${esc(reg.moov_numero)}" placeholder="+228 91 00 00 00"></div>
                <div class="field"><label>Nom du bénéficiaire</label><input name="moov_nom" value="${esc(reg.moov_nom)}" placeholder="TERMINISH ECOLE"></div>
              </div>
              <label class="switch" style="margin-bottom:14px"><input type="checkbox" name="moov_actif" ${reg.moov_actif ? 'checked' : ''}> Accepter les paiements Moov Money</label>

              <h4 style="margin:6px 0 8px;font-size:13px">💰 Tarifs mensuels</h4>
              <div class="grid2">
                <div class="field"><label>Essentiel (FCFA / mois)</label><input type="number" name="prix_essentiel" min="0" step="500" value="${reg.prix_essentiel}"></div>
                <div class="field"><label>Standard (FCFA / mois)</label><input type="number" name="prix_standard" min="0" step="500" value="${reg.prix_standard}"></div>
              </div>
              <div class="field"><label>Autoriser le paiement en ligne CinetPay</label>
                <select name="cinetpay_mode">
                  <option value="test" ${reg.cinetpay.mode === 'test' ? 'selected' : ''}>Mode test</option>
                  <option value="live" ${reg.cinetpay.mode === 'live' ? 'selected' : ''}>Mode production</option>
                </select>
                <div class="hint">Les clés CinetPay se configurent par variables d’environnement <code>CINETPAY_APIKEY</code> et <code>CINETPAY_SITE_ID</code>, ou ci-dessous.</div>
              </div>
              <div class="grid2">
                <div class="field"><label>Clé API CinetPay</label><input name="cinetpay_apikey" placeholder="${reg.cinetpay.actif ? '•••• (déjà configurée)' : 'non configurée'}" autocomplete="off"></div>
                <div class="field"><label>Site ID CinetPay</label><input name="cinetpay_site_id" placeholder="${reg.cinetpay.site_id || 'non configuré'}" autocomplete="off"></div>
              </div>

              <h4 style="margin:14px 0 8px;font-size:13px">🟠 PayDunya <span class="tag gris">T-Money · Flooz · cartes</span></h4>
              <div class="grid2">
                <div class="field"><label>Master key</label><input name="paydunya_master_key" placeholder="${reg.paydunya.actif ? '•••• (déjà configurée)' : 'non configurée'}" autocomplete="off"></div>
                <div class="field"><label>Private key</label><input name="paydunya_private_key" placeholder="${reg.paydunya.actif ? '•••• (déjà configurée)' : 'non configurée'}" autocomplete="off"></div>
              </div>
              <div class="grid2">
                <div class="field"><label>Token</label><input name="paydunya_token" placeholder="${reg.paydunya.token || 'non configuré'}" autocomplete="off"></div>
                <div class="field"><label>Mode PayDunya</label><select name="paydunya_mode">
                  <option value="test" ${reg.paydunya.mode === 'test' ? 'selected' : ''}>Test (sandbox)</option>
                  <option value="live" ${reg.paydunya.mode === 'live' ? 'selected' : ''}>Production</option>
                </select></div>
              </div>

              <h4 style="margin:14px 0 8px;font-size:13px">🗄️ Stockage externe <span class="tag gris">MEGA · Cloudinary · Google Drive</span></h4>
              ${vueStockage(stock)}
              <div class="notice info" style="margin:10px 0 0">
                <b>Ce qui part à l’extérieur :</b> signatures, logos et pièces jointes.<br>
                <b>Ce qui ne sort jamais :</b> notes, élèves, bulletins — ils restent dans la base SQLite de l’établissement.<br>
                Le disque du serveur garde toujours une copie de secours : si MEGA tombe, le site continue de fonctionner.
              </div>

              <h4 style="margin:14px 0 8px;font-size:13px">🧾 Identité sur les reçus</h4>
              <div class="grid2">
                <div class="field"><label>Nom commercial</label><input name="editeur_nom" value="${esc(reg.editeur.nom)}" placeholder="Terminish École"></div>
                <div class="field"><label>Ville</label><input name="editeur_ville" value="${esc(reg.editeur.ville)}" placeholder="Lomé, Togo"></div>
              </div>
              <div class="field"><label>Sous-titre</label><input name="editeur_sous_titre" value="${esc(reg.editeur.sous_titre)}"></div>
              <div class="grid2">
                <div class="field"><label>Téléphone</label><input name="editeur_telephone" value="${esc(reg.editeur.telephone)}"></div>
                <div class="field"><label>Email</label><input name="editeur_email" value="${esc(reg.editeur.email)}"></div>
              </div>
              <div class="field"><label>WhatsApp (indicatif + numéro, sans espace)</label><input name="editeur_whatsapp" value="${esc(reg.editeur.whatsapp || '')}" placeholder="22890112233" inputmode="numeric"></div>
              <div class="small muted" style="margin:-4px 0 10px">Utilisé pour le bouton « Une question ? WhatsApp » de l’espace abonnement.</div>

              <button class="btn btn-primary btn-sm" type="submit">💾 Enregistrer la configuration</button>
            </form>
          </div>

          <div class="panel">
            <div class="panel-head"><div><h2>État de la configuration</h2></div></div>
            <div class="stat-line"><span class="muted">Mixx by Yas</span>${reg.mixx_numero ? `<b>${esc(reg.mixx_numero)}</b>` : '<span class="tag or">Numéro manquant</span>'}</div>
            <div class="stat-line"><span class="muted">Moov Money</span>${reg.moov_numero ? `<b>${esc(reg.moov_numero)}</b>` : '<span class="tag or">Numéro manquant</span>'}</div>
            <div class="stat-line"><span class="muted">CinetPay</span>${reg.cinetpay.actif
              ? `<span class="tag vert">Actif (${esc(reg.cinetpay.mode)})</span>`
              : '<span class="tag gris">Non configuré</span>'}</div>
            <div class="stat-line"><span class="muted">PayDunya</span>${reg.paydunya.actif
              ? `<span class="tag vert">Actif (${esc(reg.paydunya.mode)})</span>`
              : '<span class="tag gris">Non configuré</span>'}</div>
            <div class="stat-line"><span class="muted">Source des clés</span><b class="small">CinetPay : ${esc(reg.cinetpay.source)} · PayDunya : ${esc(reg.paydunya.source)}</b></div>
            <div class="notice info" style="margin-top:12px">
              <b>Pour passer en automatique :</b> ouvrez un compte marchand CinetPay (Tmoney &amp; Flooz du Togo), puis renseignez
              les clés. Les paiements seront confirmés en quelques secondes, sans vérification manuelle.
            </div>
            <div class="notice warn" style="margin-top:8px">
              <b>Devenir marchand :</b> un numéro marchand s’obtient auprès de Yas (Mixx) et de Moov Africa avec une carte d’opérateur
              économique, une pièce d’identité et un contrat marchand. L’éditeur peut aussi encaisser sur son compte personnel au démarrage.
            </div>
            <div class="notice" style="margin-top:8px;background:#f4f7f5;color:#41584e;border:1px solid #e2ebe6">
              ℹ️ Aucun frais de plateforme n’est prélevé : le montant payé par l’école arrive directement sur le compte marchand.
            </div>
          </div>
        </div>`;
    },

    async mount() {
      const form = document.getElementById('mm-form');
      if (!form) return;
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const body = {
          mixx_numero: fd.get('mixx_numero'), mixx_nom: fd.get('mixx_nom'), mixx_actif: !!fd.get('mixx_actif'),
          moov_numero: fd.get('moov_numero'), moov_nom: fd.get('moov_nom'), moov_actif: !!fd.get('moov_actif'),
          prix_essentiel: fd.get('prix_essentiel'), prix_standard: fd.get('prix_standard'),
          cinetpay_mode: fd.get('cinetpay_mode')
        };
        if (fd.get('cinetpay_apikey')) body.cinetpay_apikey = fd.get('cinetpay_apikey');
        if (fd.get('cinetpay_site_id')) body.cinetpay_site_id = fd.get('cinetpay_site_id');
        if (fd.get('paydunya_master_key')) body.paydunya_master_key = fd.get('paydunya_master_key');
        if (fd.get('paydunya_private_key')) body.paydunya_private_key = fd.get('paydunya_private_key');
        if (fd.get('paydunya_token')) body.paydunya_token = fd.get('paydunya_token');
        body.paydunya_mode = fd.get('paydunya_mode');
        ['editeur_nom', 'editeur_ville', 'editeur_sous_titre', 'editeur_telephone', 'editeur_email', 'editeur_whatsapp']
          .forEach(k => { if (fd.get(k) !== null) body[k] = fd.get(k); });
        try {
          await api('/api/admin/reglages', { method: 'PUT', body });
          toast('Configuration enregistrée');
          renderRoute();
        } catch (err) { toast(err.message, 'err'); }
      };
    }
  };

  /** Ligne d'état d'un fournisseur de stockage. */
  function vueStockage(st) {
    if (!st) return '<div class="notice warn">État du stockage indisponible : redémarrez le serveur après la mise à jour.</div>';
    const etat = (actif, texte) => actif
      ? `<span class="tag vert">Actif</span> <span class="small muted">${texte}</span>`
      : `<span class="tag gris">Non configuré</span>`;
    const ordre = (st.ordre || []).join(' → ');
    const ligne = (cle, nom, icone, actif, texte, config) => `
      <div class="stat-line" style="align-items:flex-start;gap:10px">
        <span style="min-width:150px"><b>${icone} ${nom}</b><div class="muted" style="font-size:11px">${config}</div></span>
        <span style="flex:1;text-align:right">
          ${etat(actif, texte)}
          ${actif ? `<button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="App.testerStockage('${cle}')">Tester</button>` : ''}
        </span>
      </div>`;
    const mega = st.mega || {};
    const megaPret = Boolean(mega.configure && mega.rclone && mega.rclone.present);
    return `
      <div class="grid" style="gap:6px">
        ${ligne('mega', 'MEGA', '🟥', megaPret,
          megaPret ? `dossier <code>${esc(mega.dossier || '')}</code> · rclone ${esc((mega.rclone && mega.rclone.version) || '')}` : '',
          mega.configure
            ? (mega.rclone && mega.rclone.present ? '25 Go gratuits · rclone détecté' : 'rclone introuvable — lancez deploy/alwaysdata/rclone.sh --installer')
            : '25 Go gratuits · email + mot de passe MEGA, via rclone')}
        ${ligne('cloudinary', 'Cloudinary', '🟦', Boolean(st.cloudinary && st.cloudinary.configure),
          st.cloudinary && st.cloudinary.configure ? `compte ${esc((st.cloudinary.comptes || []).join(', '))}` : '',
          'images · cloud name, API key, secret')}
        ${ligne('drive', 'Google Drive', '🟨', Boolean(st.drive && st.drive.configure), '',
          'compte de service Google + identifiant de dossier')}
        ${ligne('local', 'Stockage local', '💾', true, 'toujours disponible (secours)', esc((st.local && st.local.dossier) || ''))}
      </div>
      <div class="small muted" style="margin-top:8px">Ordre d’essai actuel : <b>${esc(ordre || '—')}</b>
        — réglable par la variable <code>STORAGE_PROVIDERS</code> (ex. <code>mega,local</code>).</div>
      <div id="stockage-resultat" class="small" style="margin-top:8px"></div>`;
  }

  Object.assign(window.App, {
    async testerStockage(fournisseur) {
      const zone = document.getElementById('stockage-resultat');
      if (zone) zone.innerHTML = '<span class="muted">Envoi d’un fichier de test…</span>';
      try {
        const r = await api('/api/stockage/tester', { method: 'POST', body: { fournisseur } });
        const res = (r.resultats || [])[0] || {};
        if (zone) {
          zone.innerHTML = res.ok
            ? `<span class="tag vert">Réussi</span> ${esc(fournisseur)} : fichier envoyé (${esc(res.url || '')})`
            : `<span class="tag or">Échec</span> ${esc(fournisseur)} : ${esc(res.detail || 'raison inconnue')}`;
        }
      } catch (e) {
        if (zone) zone.innerHTML = `<span class="tag or">Échec</span> ${esc(e.message)}`;
      }
    },

    async validerPaiement(id) {
      const ok = await confirmer('Confirmer que le paiement a bien été reçu ?<br><span class="small">L’abonnement de l’établissement sera prolongé automatiquement.</span>', {
        titre: 'Valider le paiement', danger: false, ok: 'Valider et activer'
      });
      if (!ok) return;
      try {
        const r = await api('/api/admin/paiements/' + id, { method: 'PATCH', body: { action: 'valider' } });
        toast(`Paiement validé — abonnement jusqu’au ${dateFr(r.date_fin_abonnement)}`);
        renderRoute();
      } catch (e) { toast(e.message, 'err'); }
    },

    async rejeterPaiement(id) {
      const raison = prompt('Motif du rejet (visible par l’établissement) :', 'Transaction introuvable sur le relevé');
      if (raison === null) return;
      try {
        await api('/api/admin/paiements/' + id, { method: 'PATCH', body: { action: 'rejeter', note: raison } });
        toast('Paiement rejeté');
        renderRoute();
      } catch (e) { toast(e.message, 'err'); }
    }
  });

  Object.assign(window.App, {
    creerEcoleAdmin() {
      const m = modal({
        title: 'Nouvel établissement client', size: 'large',
        body: `<form id="ae-form">
          <div class="grid2">
            <div class="field"><label>Nom de l'établissement *</label><input name="nom" required placeholder="Collège ..."></div>
            <div class="field"><label>Type</label><select name="type">
              <option value="mixte">Collège + Lycée</option><option value="college">Collège</option><option value="lycee">Lycée</option>
            </select></div>
          </div>
          <div class="grid2">
            <div class="field"><label>Ville</label><input name="ville" placeholder="Lomé"></div>
            <div class="field"><label>Téléphone</label><input name="telephone" placeholder="+228 ..."></div>
          </div>
          <div class="field"><label>Email de l'établissement</label><input name="email" type="email"></div>
          <hr style="border:0;border-top:1px dashed var(--bord);margin:14px 0">
          <div class="grid2">
            <div class="field"><label>Nom du chef d'établissement *</label><input name="chef_nom" required></div>
            <div class="field"><label>Email de connexion du chef *</label><input name="chef_email" type="email" required></div>
          </div>
          <div class="grid2">
            <div class="field"><label>Mot de passe provisoire *</label><input name="chef_password" required minlength="6" value="Ecole${Math.floor(1000 + Math.random() * 9000)}"></div>
            <div class="field"><label>Durée de l'essai (jours)</label><input name="duree_jours" type="number" value="30" min="1"></div>
          </div>
          <div class="field"><label>Formule</label><select name="plan">
            <option value="essai">Essai gratuit</option><option value="essentiel">Essentiel</option><option value="standard">Standard</option><option value="reseau">Réseau</option>
          </select></div>
        </form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-ae">Créer l'établissement</button>`
      });
      m.root.querySelector('#save-ae').onclick = async () => {
        const form = m.root.querySelector('#ae-form');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form).entries());
        data.statut = data.plan === 'essai' ? 'essai' : 'actif';
        try {
          await api('/api/admin/etablissements', { method: 'POST', body: data });
          toast('Établissement créé');
          m.close(); renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },

    async majEcole(id, body) {
      try {
        await api('/api/admin/etablissements/' + id, { method: 'PATCH', body });
        toast('Établissement mis à jour');
      } catch (e) { toast(e.message, 'err'); renderRoute(); }
    },

    async paiementEcole(ecoleId) {
      const ecoles = await api('/api/admin/etablissements');
      const m = modal({
        title: 'Enregistrer un paiement',
        body: `<form id="pay-form">
          <div class="field"><label>Établissement *</label><select name="ecole_id" required>
            <option value="">Choisir…</option>
            ${ecoles.map(e => `<option value="${e.id}" ${e.id === ecoleId ? 'selected' : ''}>${esc(e.nom)} — ${e.statut}</option>`).join('')}
          </select></div>
          <div class="grid2">
            <div class="field"><label>Formule</label><select name="plan">
              <option value="essentiel">Essentiel — 15 000 F/mois</option>
              <option value="standard" selected>Standard — 25 000 F/mois</option>
              <option value="reseau">Réseau — sur devis</option>
            </select></div>
            <div class="field"><label>Montant encaissé (FCFA)</label><input type="number" name="montant" value="300000" min="0"></div>
          </div>
          <div class="grid2">
            <div class="field"><label>Durée (jours)</label><input type="number" name="duree_jours" value="365" min="1"></div>
            <div class="field"><label>Référence</label><input name="reference" placeholder="MM-2026-001"></div>
          </div>
          <div class="notice info">Le paiement active automatiquement l'établissement et prolonge son échéance.</div>
        </form>`,
        footer: `<button class="btn btn-ghost btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="save-pay">Enregistrer</button>`
      });
      m.root.querySelector('#save-pay').onclick = async () => {
        const form = m.root.querySelector('#pay-form');
        if (!form.reportValidity()) return;
        try {
          await api('/api/admin/paiements', { method: 'POST', body: Object.fromEntries(new FormData(form).entries()) });
          toast('Paiement enregistré — abonnement activé');
          m.close(); renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      };
    },

    async traiterDemande(id) {
      try {
        await api('/api/admin/demandes/' + id, { method: 'PATCH', body: { statut: 'traite' } });
        toast('Demande marquée comme traitée');
        renderRoute();
      } catch (e) { toast(e.message, 'err'); }
    }
  });

  /* ---------------------------------------------------------------- */
  /* Démarrage                                                        */
  /* ---------------------------------------------------------------- */
  (async function start() {
    const h = location.hash.replace(/^#\/?/, '');
    if (h.startsWith('reinitialiser/')) { await renderReinitialisation(); return; }
    if (h.startsWith('inscription')) { renderInscription(); return; }
    try {
      await boot();
      if (location.hash) await renderRoute();
    } catch (err) {
      if (err.status === 401) renderLogin();
      else renderLogin(err.message);
    }
  })();

  window.__S = S;
})();
