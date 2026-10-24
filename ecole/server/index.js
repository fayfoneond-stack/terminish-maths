'use strict';
// Lecture facultative du fichier .env (voir server/env.js), AVANT tous les autres
// modules : c'est ce qui permet à TERMINISH_DATA_DIR, CORS_ORIGIN, COOKIE_SECURE…
// d'être connus dès la construction de la base.
require('./env').chargerEnv();
const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');

const { db, hashPassword, verifyPassword, createEtablissement, createUser, now, today, addDays } = require('./db');
const { computeClasse, bulletinData } = require('./stats');
const stockage = require('./storage');
const P = require('./paiements');
const { genererRecuPDF } = require('./recu');
const cloudinary = require('./cloudinary');
const { renderBulletin, renderBulletinBatch, renderExamen } = require('./print');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', true);
app.use(express.json({ limit: '6mb' }));

/**
 * CORS optionnel — utile quand l'interface est servie par un hébergement
 * statique (Firebase Hosting, par exemple) et que l'API tourne ailleurs.
 *   CORS_ORIGIN=https://mon-ecole.web.app,https://mon-ecole.firebaseapp.com
 * Rien n'est ouvert si la variable est absente (cas normal : même origine).
 */
const ORIGINES = String(process.env.CORS_ORIGIN || '')
  .split(',').map(o => o.trim().replace(/\/+$/, '')).filter(Boolean);
app.use((req, res, next) => {
  const origine = req.headers.origin;
  if (origine && ORIGINES.includes(origine.replace(/\/+$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origine);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */
const COOKIE = 'tsession';
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
// Mettre COOKIE_SECURE=1 derrière HTTPS (obligatoire en production)
const COOKIE_SECURE = process.env.COOKIE_SECURE === '1' || process.env.COOKIE_SECURE === 'true';
/**
 * Même origine (cas normal) : SameSite=Lax.
 * Interface servie par un autre domaine (Firebase Hosting + API ailleurs) :
 * SameSite=None; Secure — imposé par les navigateurs, et Secure exige HTTPS
 * côté API (Tailscale Funnel le fournit).
 */
const SAME_SITE = String(process.env.CORS_ORIGIN || '').trim() ? 'None' : 'Lax';
function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=${SAME_SITE}${(COOKIE_SECURE || SAME_SITE === 'None') ? '; Secure' : ''}; Max-Age=${60 * 60 * 24 * 30}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=${SAME_SITE}${(COOKIE_SECURE || SAME_SITE === 'None') ? '; Secure' : ''}; Max-Age=0`);
}
function auth(req, res, next) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  const row = db.prepare(`
    SELECT s.token, s.expire_le, u.id, u.nom, u.email, u.role, u.ecole_id, u.actif FROM sessions s
    JOIN utilisateurs u ON u.id = s.user_id WHERE s.token = ?`).get(token);
  if (!row || row.expire_le < now() || !row.actif) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
  }
  req.user = row;
  req.token = token;
  req.ecoleId = row.ecole_id;
  next();
}
function roles(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Accès non autorisé pour ce profil' });
    next();
  };
}
function staffOnly(req, res, next) {
  if (!['directeur', 'enseignant', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Accès réservé au personnel' });
  next();
}
function directionOnly(req, res, next) {
  if (!['directeur', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Action réservée à la direction' });
  next();
}
const ecole = (req) => Number(req.user.ecole_id || req.query.ecole_id || 0);
function ecoleOf(req, res) {
  const id = ecole(req);
  if (!id) { res.status(400).json({ error: 'Établissement introuvable' }); return null; }
  return id;
}
function baseUrl(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${req.get('host')}`;
}

/** Enregistre une signature (data URL) et renvoie { url, provider } ou null. */
async function enregistrerSignature(dataUrl, ecoleId) {
  const brut = String(dataUrl || '').trim();
  if (!brut) return null;                                  // signature retirée
  if (brut.length < 60) throw new Error('Image de signature invalide');
  const resultat = await stockage.enregistrer(brut, { categorie: 'signatures', ecoleId });
  return { url: resultat.url, provider: resultat.provider };
}

const canSaisir = (req, classeId, matiereId) => {
  if (req.user.role !== 'enseignant') return true;
  return !!db.prepare('SELECT 1 FROM affectations WHERE enseignant_id = ? AND classe_id = ? AND matiere_id = ?')
    .get(req.user.id, Number(classeId), Number(matiereId));
};
const canAccessClasse = (req, classeId) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(classeId);
  if (!c) return false;
  if (req.user.role !== 'super_admin' && c.ecole_id !== req.user.ecole_id) return false;
  if (req.user.role === 'enseignant') {
    return !!db.prepare('SELECT 1 FROM affectations WHERE enseignant_id = ? AND classe_id = ?').get(req.user.id, classeId);
  }
  return true;
};

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  const user = db.prepare('SELECT * FROM utilisateurs WHERE email = ?').get(String(email).trim().toLowerCase());
  if (!user || !verifyPassword(password, user.mot_de_passe)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  if (!user.actif) return res.status(403).json({ error: 'Ce compte est désactivé. Contactez votre établissement.' });
  db.prepare('UPDATE utilisateurs SET derniere_connexion = ? WHERE id = ?').run(now(), user.id);
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expire_le) VALUES (?,?,?)').run(token, user.id, addDays(30));
  setSessionCookie(res, token);
  const etab = user.ecole_id ? db.prepare('SELECT * FROM etablissements WHERE id = ?').get(user.ecole_id) : null;
  res.json({
    user: { id: user.id, nom: user.nom, email: user.email, role: user.role, ecole_id: user.ecole_id },
    etablissement: etab || null
  });
});

app.post('/api/auth/logout', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  const etab = req.user.ecole_id ? db.prepare('SELECT * FROM etablissements WHERE id = ?').get(req.user.ecole_id) : null;
  let eleve = null;
  if (req.user.role === 'eleve') {
    eleve = db.prepare('SELECT * FROM eleves WHERE user_id = ?').get(req.user.id) || null;
  }
  // Un enseignant ne doit voir que les matières qui lui sont affectées :
  // on les transmet au client pour que les menus ne proposent rien d'autre.
  const affectations = req.user.role === 'enseignant'
    ? db.prepare('SELECT classe_id, matiere_id FROM affectations WHERE enseignant_id = ?').all(req.user.id)
    : [];
  const moi = db.prepare('SELECT signature FROM utilisateurs WHERE id = ?').get(req.user.id);
  res.json({
    user: { id: req.user.id, nom: req.user.nom, email: req.user.email, role: req.user.role, ecole_id: req.user.ecole_id },
    etablissement: etab || null,
    eleve,
    affectations,
    signature: moi ? moi.signature : null
  });
});

/**
 * Signature manuscrite de l'utilisateur connecté (chef d'établissement,
 * professeur principal…). Importée une seule fois : elle est ensuite apposée
 * automatiquement sur les bulletins.
 *   PUT /api/moi/signature   { signature: "data:image/png;base64,…" }  → enregistre
 *   PUT /api/moi/signature   { signature: "" }                         → retire
 */
app.put('/api/moi/signature', auth, staffOnly, async (req, res) => {
  const { signature } = req.body || {};
  if (signature === undefined) return res.status(400).json({ error: 'Signature manquante' });
  try {
    const sig = await enregistrerSignature(signature, req.user.ecole_id || 'global');
    if (!sig) {
      db.prepare('UPDATE utilisateurs SET signature = NULL, signature_provider = NULL WHERE id = ?').run(req.user.id);
      return res.json({ ok: true, signature: null });
    }
    db.prepare('UPDATE utilisateurs SET signature = ?, signature_provider = ? WHERE id = ?')
      .run(sig.url, sig.provider, req.user.id);
    res.json({ ok: true, signature: sig.url, provider: sig.provider });
  } catch (err) {
    res.status(400).json({ error: `Signature non enregistrée : ${err.message}` });
  }
});

/** Diagnostic du stockage externe (direction) : quels fournisseurs sont prêts ? */
app.get('/api/stockage/etat', auth, directionOnly, (req, res) => {
  res.json(stockage.etat());
});

/**
 * Test réel du stockage : envoie une image minuscule et indique, fournisseur
 * par fournisseur, ce qui fonctionne. Sert à vérifier MEGA / Cloudinary / Drive
 * sans passer par le terminal.
 *   POST /api/stockage/tester            → teste les fournisseurs configurés
 *   POST /api/stockage/tester {fournisseur:'mega'} → un seul
 */
app.post('/api/stockage/tester', auth, directionOnly, async (req, res) => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const etat = stockage.etat();
  const demandes = {
    local: true,
    cloudinary: etat.cloudinary.configure,
    drive: etat.drive.configure,
    mega: etat.mega.configure && etat.mega.rclone && etat.mega.rclone.present
  };
  const cible = String((req.body && req.body.fournisseur) || '').toLowerCase();
  const aTester = cible ? [cible] : Object.keys(demandes).filter(n => demandes[n]);
  const resultats = [];
  for (const nom of aTester) {
    if (!(nom in demandes)) { resultats.push({ fournisseur: nom, ok: false, detail: 'inconnu' }); continue; }
    if (!demandes[nom]) {
      resultats.push({ fournisseur: nom, ok: false, detail: 'non configuré' });
      continue;
    }
    try {
      // « seulement » évite tout repli silencieux : on veut savoir si CE
      // fournisseur marche vraiment, pas si le disque local a pris le relais.
      const r = await stockage.enregistrer(PNG, { categorie: 'test', ecoleId: 'diagnostic', seulement: [nom] });
      resultats.push({ fournisseur: nom, ok: true, provider: r.provider, url: r.url });
    } catch (err) {
      resultats.push({ fournisseur: nom, ok: false, detail: err.message });
    }
  }
  res.json({ ordre: etat.ordre, resultats });
});

/* Inscription self-service d'un établissement (essai gratuit 30 jours) */
app.post('/api/inscription', (req, res) => {
  const { etablissement, nom, email, password, telephone, ville, type } = req.body || {};
  if (!etablissement || !nom || !email || !password) return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
  // Le nom de l'établissement doit être un texte (un objet envoyé par erreur
  // provoquerait une erreur 500 de la base, visible par le visiteur).
  if (typeof etablissement !== 'string' || typeof nom !== 'string' || typeof email !== 'string') {
    return res.status(400).json({ error: 'Nom d’établissement, nom et email doivent être des textes' });
  }
  if (String(password).length < 6) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  const exists = db.prepare('SELECT id FROM utilisateurs WHERE email = ?').get(String(email).trim().toLowerCase());
  if (exists) return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
  const ecoleId = createEtablissement({
    nom: etablissement, type: type || 'mixte', ville, telephone, email,
    chef_nom: nom, plan: 'essai', statut: 'essai', date_fin_abonnement: addDays(30)
  });
  const uid = createUser({ ecole_id: ecoleId, nom, email, password, role: 'directeur', telephone });
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expire_le) VALUES (?,?,?)').run(token, uid, addDays(30));
  setSessionCookie(res, token);
  res.json({ ok: true, ecole_id: ecoleId });
});

// Coordonnées publiques de l'éditeur (page d'accueil, pied de page)
app.get('/api/public/contact', (req, res) => {
  const r = P.lireReglages(db);
  res.json({
    nom: r.editeur_nom || 'Terminish École',
    telephone: r.editeur_telephone || '',
    whatsapp: String(r.editeur_whatsapp || '').replace(/\D/g, ''),
    email: r.editeur_email || '',
    ville: r.editeur_ville || ''
  });
});

app.post('/api/demandes', (req, res) => {
  const { nom, etablissement, ville, email, telephone, effectif, message } = req.body || {};
  if (!nom || !etablissement || !telephone) return res.status(400).json({ error: 'Nom, établissement et téléphone sont requis' });
  db.prepare(`INSERT INTO demandes (nom, etablissement, ville, email, telephone, effectif, message, statut, cree_le)
    VALUES (?,?,?,?,?,?,?, 'nouveau', ?)`).run(nom, etablissement, ville || '', email || '', telephone, effectif || '', message || '', now());
  res.json({ ok: true, message: 'Votre demande a bien été enregistrée. Notre équipe vous contacte sous 24 h.' });
});

/* ------------------------------------------------------------------ */
/* Paramètres de l'établissement                                       */
/* ------------------------------------------------------------------ */
app.get('/api/etablissement', auth, (req, res) => {
  if (req.user.role === 'super_admin') {
    const id = Number(req.query.ecole_id);
    const etab = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(id);
    return etab ? res.json(etab) : res.status(404).json({ error: 'Introuvable' });
  }
  const etab = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(req.user.ecole_id);
  if (!etab) return res.status(404).json({ error: 'Établissement introuvable' });
  res.json(etab);
});

app.put('/api/etablissement', auth, directionOnly, async (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const allowed = ['nom', 'type', 'ville', 'adresse', 'bp', 'telephone', 'email', 'devise', 'logo',
    'chef_nom', 'chef_titre', 'annee_scolaire', 'formule_moyenne', 'tutelle'];
  const sets = [], vals = [];
  allowed.forEach(k => {
    if (req.body[k] !== undefined) { sets.push(`${k} = ?`); vals.push(req.body[k]); }
  });

  // Miroir Cloudinary (facultatif) : la data URL reste enregistrée en base,
  // l'URL du CDN n'est qu'un bonus pour l'affichage. Tout échec est silencieux.
  let avertissement = null;
  if (req.body.logo !== undefined) {
    const logo = String(req.body.logo || '');
    if (!logo) {
      sets.push('logo_url = ?', 'logo_public_id = ?'); vals.push(null, null);
    } else if (cloudinary.config().actif) {
      try {
        const envoye = await cloudinary.envoyerLogo(logo, `ecole-${id}`);
        sets.push('logo_url = ?', 'logo_public_id = ?');
        vals.push(envoye ? envoye.url : null, envoye ? envoye.publicId : null);
      } catch (err) {
        console.warn(`Cloudinary (école ${id}) : ${err.message}`);
        // On oublie l'ancienne URL : elle pointerait vers le logo précédent.
        sets.push('logo_url = ?', 'logo_public_id = ?'); vals.push(null, null);
        avertissement = 'Logo enregistré, mais la copie sur le CDN a échoué (le logo local reste utilisé).';
      }
    }
  }

  if (!sets.length) return res.json({ ok: true });
  db.prepare(`UPDATE etablissements SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  res.json({
    ok: true,
    avertissement,
    cloudinary: cloudinary.config().actif,
    etablissement: db.prepare('SELECT * FROM etablissements WHERE id = ?').get(id)
  });
});

/* ------------------------------------------------------------------ */
/* Périodes                                                            */
/* ------------------------------------------------------------------ */
app.get('/api/periodes', auth, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  res.json(db.prepare('SELECT * FROM periodes WHERE ecole_id = ? ORDER BY cycle DESC, ordre').all(id));
});
app.put('/api/periodes/:id', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const p = db.prepare('SELECT * FROM periodes WHERE id = ? AND ecole_id = ?').get(req.params.id, id);
  if (!p) return res.status(404).json({ error: 'Période introuvable' });
  const { statut, date_debut, date_fin, libelle } = req.body || {};
  db.prepare('UPDATE periodes SET statut = ?, date_debut = ?, date_fin = ?, libelle = ? WHERE id = ?')
    .run(statut ?? p.statut, date_debut ?? p.date_debut, date_fin ?? p.date_fin, libelle ?? p.libelle, p.id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Matières                                                            */
/* ------------------------------------------------------------------ */
app.get('/api/matieres', auth, staffOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  res.json(db.prepare('SELECT * FROM matieres WHERE ecole_id = ? ORDER BY groupe, nom').all(id));
});
app.post('/api/matieres/init', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const existantes = db.prepare('SELECT COUNT(*) AS n FROM matieres WHERE ecole_id = ?').get(id).n;
  if (existantes > 0) return res.status(400).json({ error: 'Des matières existent déjà dans cet établissement' });
  const modele = [
    ['Mathématiques', 'MATH', 'Scientifique'],
    ['Physique-Chimie', 'PC', 'Scientifique'],
    ['Sciences de la Vie et de la Terre', 'SVT', 'Scientifique'],
    ['Français', 'FR', 'Littéraire'],
    ['Anglais', 'ANG', 'Littéraire'],
    ['Histoire-Géographie', 'HG', 'Littéraire'],
    ['Éducation Civique et Morale', 'ECM', 'Autres'],
    ['Éducation Physique et Sportive', 'EPS', 'Autres']
  ];
  const insert = db.prepare('INSERT INTO matieres (ecole_id, nom, code, groupe) VALUES (?,?,?,?)');
  modele.forEach(m => insert.run(id, m[0], m[1], m[2]));
  res.json({ ok: true, count: modele.length });
});

app.post('/api/matieres', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const { nom, code, groupe } = req.body || {};
  if (!nom) return res.status(400).json({ error: 'Le nom est requis' });
  const info = db.prepare('INSERT INTO matieres (ecole_id, nom, code, groupe) VALUES (?,?,?,?)')
    .run(id, nom, code || '', groupe || 'Autres');
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});
app.put('/api/matieres/:id', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const m = db.prepare('SELECT * FROM matieres WHERE id = ? AND ecole_id = ?').get(req.params.id, id);
  if (!m) return res.status(404).json({ error: 'Matière introuvable' });
  const { nom, code, groupe } = req.body || {};
  db.prepare('UPDATE matieres SET nom = ?, code = ?, groupe = ? WHERE id = ?')
    .run(nom ?? m.nom, code ?? m.code, groupe ?? m.groupe, m.id);
  res.json({ ok: true });
});
app.delete('/api/matieres/:id', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  db.prepare('DELETE FROM matieres WHERE id = ? AND ecole_id = ?').run(req.params.id, id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Classes                                                             */
/* ------------------------------------------------------------------ */
function classeWithMatieres(ecoleId, c) {
  const matieres = db.prepare(`
    SELECT m.id, m.nom, m.code, m.groupe, cm.coefficient FROM classe_matieres cm
    JOIN matieres m ON m.id = cm.matiere_id WHERE cm.classe_id = ? ORDER BY m.groupe, m.nom`).all(c.id);
  const effectif = db.prepare("SELECT COUNT(*) AS n FROM eleves WHERE classe_id = ? AND statut = 'actif'").get(c.id).n;
  // Professeur principal : c'est lui qui signe le bulletin.
  const prof = c.titulaire_id
    ? db.prepare("SELECT id, nom, signature FROM utilisateurs WHERE id = ? AND ecole_id = ? AND role = 'enseignant'").get(c.titulaire_id, ecoleId)
    : null;
  return {
    ...c, matieres, effectif,
    professeur_principal: prof ? { id: prof.id, nom: prof.nom, signature: prof.signature || null } : null
  };
}
/** Un professeur principal doit être un enseignant de la même école. */
function verifierTitulaire(ecoleId, valeur) {
  if (valeur === null || valeur === '' || valeur === 0) return null;   // « aucun »
  const u = db.prepare("SELECT id FROM utilisateurs WHERE id = ? AND ecole_id = ? AND role = 'enseignant'").get(Number(valeur), ecoleId);
  return u ? u.id : null;
}

app.get('/api/classes', auth, staffOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  let classes = db.prepare('SELECT * FROM classes WHERE ecole_id = ? ORDER BY cycle DESC, niveau, nom').all(id);
  if (req.user.role === 'enseignant') {
    const ids = new Set(db.prepare('SELECT DISTINCT classe_id FROM affectations WHERE enseignant_id = ?').all(req.user.id).map(r => r.classe_id));
    classes = classes.filter(c => ids.has(c.id));
  }
  res.json(classes.map(c => classeWithMatieres(id, c)));
});
app.post('/api/classes', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const { nom, niveau, cycle, serie, titulaire, titulaire_id, matieres } = req.body || {};
  if (!nom) return res.status(400).json({ error: 'Le nom de la classe est requis' });
  const profId = titulaire_id === undefined ? null : verifierTitulaire(id, titulaire_id);
  const info = db.prepare('INSERT INTO classes (ecole_id, nom, niveau, cycle, serie, annee, titulaire, titulaire_id) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, nom, niveau || nom, cycle || 'college', serie || '', db.prepare('SELECT annee_scolaire FROM etablissements WHERE id = ?').get(id).annee_scolaire, titulaire || '', profId);
  const classeId = Number(info.lastInsertRowid);
  (matieres || []).forEach(m => {
    db.prepare('INSERT OR IGNORE INTO classe_matieres (classe_id, matiere_id, coefficient) VALUES (?,?,?)')
      .run(classeId, m.matiere_id, m.coefficient || 1);
  });
  res.json({ ok: true, id: classeId });
});
app.put('/api/classes/:id', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const c = db.prepare('SELECT * FROM classes WHERE id = ? AND ecole_id = ?').get(req.params.id, id);
  if (!c) return res.status(404).json({ error: 'Classe introuvable' });
  const { nom, niveau, cycle, serie, titulaire, titulaire_id, matieres } = req.body || {};
  const profId = titulaire_id === undefined ? undefined : verifierTitulaire(id, titulaire_id);
  db.prepare('UPDATE classes SET nom = ?, niveau = ?, cycle = ?, serie = ?, titulaire = ?, titulaire_id = ? WHERE id = ?')
    .run(nom ?? c.nom, niveau ?? c.niveau, cycle ?? c.cycle, serie ?? c.serie, titulaire ?? c.titulaire,
      profId === undefined ? c.titulaire_id : profId, c.id);
  if (Array.isArray(matieres)) {
    db.prepare('DELETE FROM classe_matieres WHERE classe_id = ?').run(c.id);
    matieres.forEach(m => db.prepare('INSERT OR IGNORE INTO classe_matieres (classe_id, matiere_id, coefficient) VALUES (?,?,?)')
      .run(c.id, m.matiere_id, m.coefficient || 1));
  }
  res.json({ ok: true });
});
app.delete('/api/classes/:id', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const c = db.prepare('SELECT * FROM classes WHERE id = ? AND ecole_id = ?').get(req.params.id, id);
  if (!c) return res.status(404).json({ error: 'Classe introuvable' });
  const eff = db.prepare('SELECT COUNT(*) AS n FROM eleves WHERE classe_id = ?').get(c.id).n;
  if (eff > 0) return res.status(400).json({ error: `Impossible : ${eff} élève(s) inscrit(s) dans cette classe.` });
  db.prepare('DELETE FROM classes WHERE id = ?').run(c.id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Élèves                                                              */
/* ------------------------------------------------------------------ */
app.get('/api/eleves', auth, staffOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  let rows = db.prepare(`
    SELECT el.*, c.nom AS classe_nom, c.cycle FROM eleves el LEFT JOIN classes c ON c.id = el.classe_id
    WHERE el.ecole_id = ? ORDER BY el.nom, el.prenom`).all(id);
  if (req.query.classe_id) rows = rows.filter(r => r.classe_id === Number(req.query.classe_id));
  if (req.query.statut) rows = rows.filter(r => r.statut === req.query.statut);
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase();
    rows = rows.filter(r => `${r.nom} ${r.prenom} ${r.matricule}`.toLowerCase().includes(q));
  }
  if (req.user.role === 'enseignant') {
    const ids = new Set(db.prepare('SELECT DISTINCT classe_id FROM affectations WHERE enseignant_id = ?').all(req.user.id).map(r => r.classe_id));
    rows = rows.filter(r => ids.has(r.classe_id));
  }
  res.json(rows);
});
app.post('/api/eleves', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const { nom, prenom, sexe, date_naissance, lieu_naissance, classe_id, tuteur_nom, tuteur_tel, matricule } = req.body || {};
  if (!nom || !prenom) return res.status(400).json({ error: 'Nom et prénom sont requis' });
  if (classe_id && !db.prepare('SELECT 1 FROM classes WHERE id = ? AND ecole_id = ?').get(classe_id, id)) {
    return res.status(400).json({ error: 'Classe invalide' });
  }
  let mat = matricule;
  if (!mat) {
    const annee = (db.prepare('SELECT annee_scolaire FROM etablissements WHERE id = ?').get(id).annee_scolaire || '2025').slice(0, 4);
    const last = db.prepare("SELECT matricule FROM eleves WHERE ecole_id = ? AND matricule LIKE ? ORDER BY matricule DESC LIMIT 1").get(id, `${annee}%`);
    const num = last ? Number(last.matricule.slice(4)) + 1 : 1;
    mat = `${annee}${String(num).padStart(4, '0')}`;
  }
  try {
    const info = db.prepare(`INSERT INTO eleves (ecole_id, matricule, nom, prenom, sexe, date_naissance, lieu_naissance,
      classe_id, tuteur_nom, tuteur_tel, statut, cree_le) VALUES (?,?,?,?,?,?,?,?,?,?, 'actif', ?)`)
      .run(id, mat, String(nom).toUpperCase(), prenom, sexe || 'M', date_naissance || '', lieu_naissance || '',
        classe_id ? Number(classe_id) : null, tuteur_nom || '', tuteur_tel || '', now());
    res.json({ ok: true, id: Number(info.lastInsertRowid), matricule: mat });
  } catch (e) {
    res.status(400).json({ error: 'Matricule déjà utilisé dans cet établissement' });
  }
});
app.put('/api/eleves/:id', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const el = db.prepare('SELECT * FROM eleves WHERE id = ? AND ecole_id = ?').get(req.params.id, id);
  if (!el) return res.status(404).json({ error: 'Élève introuvable' });
  const b = req.body || {};
  const classeCible = b.classe_id === '' || b.classe_id === undefined ? (b.classe_id === '' ? null : el.classe_id) : Number(b.classe_id) || null;
  db.prepare(`UPDATE eleves SET nom = ?, prenom = ?, sexe = ?, date_naissance = ?, lieu_naissance = ?, classe_id = ?,
    tuteur_nom = ?, tuteur_tel = ?, statut = ? WHERE id = ?`).run(
    (b.nom ?? el.nom).toUpperCase(), b.prenom ?? el.prenom, b.sexe ?? el.sexe, b.date_naissance ?? el.date_naissance,
    b.lieu_naissance ?? el.lieu_naissance, classeCible, b.tuteur_nom ?? el.tuteur_nom,
    b.tuteur_tel ?? el.tuteur_tel, b.statut ?? el.statut, el.id);
  res.json({ ok: true });
});
app.delete('/api/eleves/:id', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const el = db.prepare('SELECT * FROM eleves WHERE id = ? AND ecole_id = ?').get(req.params.id, id);
  if (!el) return res.status(404).json({ error: 'Élève introuvable' });
  if (req.query.definitif === '1') db.prepare('DELETE FROM eleves WHERE id = ?').run(el.id);
  else db.prepare("UPDATE eleves SET statut = 'inactif' WHERE id = ?").run(el.id);
  res.json({ ok: true });
});
app.post('/api/eleves/import', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const { lignes, classe_id } = req.body || {};
  if (!Array.isArray(lignes) || !lignes.length) return res.status(400).json({ error: 'Aucune ligne à importer' });
  const annee = (db.prepare('SELECT annee_scolaire FROM etablissements WHERE id = ?').get(ecoleId).annee_scolaire || '2025').slice(0, 4);
  let last = db.prepare("SELECT matricule FROM eleves WHERE ecole_id = ? AND matricule LIKE ? ORDER BY matricule DESC LIMIT 1").get(ecoleId, `${annee}%`);
  let num = last ? Number(last.matricule.slice(4)) || 0 : 0;
  const crees = [], erreurs = [];
  lignes.forEach((l, i) => {
    const nom = String(l.nom || '').trim().toUpperCase();
    const prenom = String(l.prenom || '').trim();
    if (!nom || !prenom) { erreurs.push(`Ligne ${i + 1} : nom ou prénom manquant`); return; }
    try {
      let classeCible = l.classe_id || classe_id || null;
      if (!classeCible && l.classe) {
        const c = db.prepare('SELECT id FROM classes WHERE ecole_id = ? AND lower(nom) = lower(?)').get(ecoleId, String(l.classe).trim());
        classeCible = c ? c.id : null;
      }
      num++;
      const matricule = `${annee}${String(num).padStart(4, '0')}`;
      db.prepare(`INSERT INTO eleves (ecole_id, matricule, nom, prenom, sexe, date_naissance, lieu_naissance,
        classe_id, tuteur_nom, tuteur_tel, statut, cree_le) VALUES (?,?,?,?,?,?,?,?,?,?, 'actif', ?)`)
        .run(ecoleId, matricule, nom, prenom, /^f/i.test(l.sexe || '') ? 'F' : 'M', l.date_naissance || '',
          l.lieu_naissance || '', classeCible ? Number(classeCible) : null,
          l.tuteur_nom || `${prenom.toUpperCase()} ${nom}`, l.tuteur_tel || '', now());
      crees.push({ nom, prenom, matricule });
    } catch (e) {
      erreurs.push(`Ligne ${i + 1} : ${e.message}`);
    }
  });
  res.json({ ok: true, crees: crees.length, erreurs, eleves: crees });
});

app.get('/api/eleves/:id', auth, staffOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const el = db.prepare('SELECT el.*, c.nom AS classe_nom FROM eleves el LEFT JOIN classes c ON c.id = el.classe_id WHERE el.id = ? AND el.ecole_id = ?').get(req.params.id, id);
  if (!el) return res.status(404).json({ error: 'Élève introuvable' });
  const periodes = db.prepare('SELECT * FROM periodes WHERE ecole_id = ? ORDER BY cycle DESC, ordre').all(id);
  const historique = periodes.map(p => {
    const b = bulletinData(db, id, el.id, p.id);
    const ligne = b && b.ligne;
    return { periode: p, moyenne: ligne ? ligne.moyenne : null, rang: ligne ? ligne.rang : null, mention: ligne ? ligne.mention : null };
  });
  res.json({ eleve: el, historique });
});

/* ------------------------------------------------------------------ */
/* Enseignants                                                         */
/* ------------------------------------------------------------------ */
// La liste des collègues (e-mails compris) ne regarde que la direction.
app.get('/api/enseignants', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const users = db.prepare("SELECT id, nom, email, telephone, actif, derniere_connexion, signature FROM utilisateurs WHERE ecole_id = ? AND role = 'enseignant' ORDER BY nom").all(id);
  const out = users.map(u => {
    const aff = db.prepare(`SELECT a.id, a.classe_id, a.matiere_id, c.nom AS classe_nom, m.nom AS matiere_nom
      FROM affectations a JOIN classes c ON c.id = a.classe_id JOIN matieres m ON m.id = a.matiere_id
      WHERE a.enseignant_id = ? ORDER BY c.nom, m.nom`).all(u.id);
    return { ...u, affectations: aff };
  });
  res.json(out);
});
app.post('/api/enseignants', auth, directionOnly, async (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const { nom, email, password, telephone, affectations, signature } = req.body || {};
  if (!nom || !email || !password) return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
  if (db.prepare('SELECT id FROM utilisateurs WHERE email = ?').get(String(email).toLowerCase())) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  }
  let sig = null;
  if (signature) {
    try { sig = await enregistrerSignature(signature, id); }
    catch (err) { return res.status(400).json({ error: `Signature non enregistrée : ${err.message}` }); }
  }
  const uid = createUser({ ecole_id: id, nom, email, password, role: 'enseignant', telephone });
  if (sig) db.prepare('UPDATE utilisateurs SET signature = ?, signature_provider = ? WHERE id = ?').run(sig.url, sig.provider, uid);
  (affectations || []).forEach(a => {
    const classeId = Number(a && a.classe_id);
    const matiereId = Number(a && a.matiere_id);
    if (!classeId || !matiereId) return;
    if (!db.prepare('SELECT 1 FROM classes WHERE id = ? AND ecole_id = ?').get(classeId, id)) return;
    if (!db.prepare('SELECT 1 FROM matieres WHERE id = ? AND ecole_id = ?').get(matiereId, id)) return;
    db.prepare('INSERT OR IGNORE INTO affectations (ecole_id, enseignant_id, classe_id, matiere_id) VALUES (?,?,?,?)')
      .run(id, uid, classeId, matiereId);
  });
  res.json({ ok: true, id: uid });
});
app.put('/api/enseignants/:id', auth, directionOnly, async (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  const u = db.prepare("SELECT * FROM utilisateurs WHERE id = ? AND ecole_id = ? AND role = 'enseignant'").get(req.params.id, id);
  if (!u) return res.status(404).json({ error: 'Enseignant introuvable' });
  const { nom, telephone, actif, password, affectations, signature } = req.body || {};
  if (signature !== undefined) {
    if (!signature) {
      db.prepare('UPDATE utilisateurs SET signature = NULL, signature_provider = NULL WHERE id = ?').run(u.id);
    } else {
      try {
        const sig = await enregistrerSignature(signature, id);
        db.prepare('UPDATE utilisateurs SET signature = ?, signature_provider = ? WHERE id = ?').run(sig.url, sig.provider, u.id);
      } catch (err) {
        return res.status(400).json({ error: `Signature non enregistrée : ${err.message}` });
      }
    }
  }
  db.prepare('UPDATE utilisateurs SET nom = ?, telephone = ?, actif = ? WHERE id = ?')
    .run(nom ?? u.nom, telephone ?? u.telephone, actif === undefined ? u.actif : (actif ? 1 : 0), u.id);
  if (password) db.prepare('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?').run(hashPassword(password), u.id);
  if (Array.isArray(affectations)) {
    db.prepare('DELETE FROM affectations WHERE enseignant_id = ?').run(u.id);
    affectations.forEach(a => {
      if (!db.prepare('SELECT 1 FROM classes WHERE id = ? AND ecole_id = ?').get(a.classe_id, id)) return;
      db.prepare('INSERT OR IGNORE INTO affectations (ecole_id, enseignant_id, classe_id, matiere_id) VALUES (?,?,?,?)')
        .run(id, u.id, a.classe_id, a.matiere_id);
    });
  }
  res.json({ ok: true });
});
app.delete('/api/enseignants/:id', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  db.prepare("UPDATE utilisateurs SET actif = 0 WHERE id = ? AND ecole_id = ? AND role = 'enseignant'").run(req.params.id, id);
  db.prepare('DELETE FROM affectations WHERE enseignant_id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Saisie des notes                                                    */
/* ------------------------------------------------------------------ */
function getOrCreateEvaluation(ecoleId, classeId, matiereId, periodeId, type, libelle) {
  let ev = db.prepare(`SELECT * FROM evaluations WHERE ecole_id = ? AND classe_id = ? AND matiere_id = ?
    AND periode_id = ? AND type = ? AND epreuve_id IS NULL`).get(ecoleId, classeId, matiereId, periodeId, type);
  if (!ev) {
    const info = db.prepare(`INSERT INTO evaluations (ecole_id, classe_id, matiere_id, periode_id, type, libelle, bareme, cree_le)
      VALUES (?,?,?,?,?,?,20,?)`).run(ecoleId, classeId, matiereId, periodeId, type, libelle, now());
    ev = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(Number(info.lastInsertRowid));
  }
  return ev;
}
function grilleData(ecoleId, classeId, matiereId, periodeId) {
  const classe = db.prepare('SELECT * FROM classes WHERE id = ? AND ecole_id = ?').get(classeId, ecoleId);
  if (!classe) return null;
  const matiere = db.prepare('SELECT * FROM matieres WHERE id = ? AND ecole_id = ?').get(matiereId, ecoleId);
  const cm = db.prepare('SELECT * FROM classe_matieres WHERE classe_id = ? AND matiere_id = ?').get(classeId, matiereId);
  const periode = db.prepare('SELECT * FROM periodes WHERE id = ? AND ecole_id = ?').get(periodeId, ecoleId);
  const evals = db.prepare(`SELECT * FROM evaluations WHERE ecole_id = ? AND classe_id = ? AND matiere_id = ?
    AND periode_id = ? AND epreuve_id IS NULL ORDER BY CASE type WHEN 'devoir1' THEN 1 WHEN 'devoir2' THEN 2 ELSE 3 END`)
    .all(ecoleId, classeId, matiereId, periodeId);
  const eleves = db.prepare("SELECT id, matricule, nom, prenom, sexe FROM eleves WHERE classe_id = ? AND statut = 'actif' ORDER BY nom, prenom").all(classeId);
  const notes = {};
  evals.forEach(ev => {
    const rows = db.prepare('SELECT eleve_id, valeur, absent, modifie_le FROM notes WHERE evaluation_id = ?').all(ev.id);
    notes[ev.id] = Object.fromEntries(rows.map(r => [r.eleve_id, r]));
  });
  return { classe, matiere: { ...matiere, coefficient: cm ? cm.coefficient : 1 }, periode, evaluations: evals, eleves, notes };
}
app.get('/api/notes/grille', auth, staffOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const { classe_id, matiere_id, periode_id } = req.query;
  if (!classe_id || !matiere_id || !periode_id) return res.status(400).json({ error: 'Classe, matière et période requises' });
  if (!canAccessClasse(req, Number(classe_id))) return res.status(403).json({ error: 'Cette classe ne vous est pas affectée' });
  if (!canSaisir(req, classe_id, matiere_id)) return res.status(403).json({ error: 'Cette matière ne vous est pas affectée' });
  const g = grilleData(ecoleId, Number(classe_id), Number(matiere_id), Number(periode_id));
  if (!g) return res.status(404).json({ error: 'Données introuvables' });
  res.json(g);
});
app.post('/api/notes/saisie', auth, staffOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const { classe_id, matiere_id, periode_id, type, notes, epreuve_id } = req.body || {};
  if (!Array.isArray(notes)) return res.status(400).json({ error: 'Aucune note fournie' });

  let evaluation;
  if (epreuve_id) {
    const ep = db.prepare('SELECT * FROM epreuves WHERE id = ? AND ecole_id = ?').get(epreuve_id, ecoleId);
    if (!ep) return res.status(404).json({ error: 'Épreuve introuvable' });
    if (!canAccessClasse(req, ep.classe_id)) return res.status(403).json({ error: 'Classe non affectée' });
    if (!canSaisir(req, ep.classe_id, ep.matiere_id)) return res.status(403).json({ error: 'Matière non affectée' });
    evaluation = db.prepare('SELECT * FROM evaluations WHERE epreuve_id = ?').get(ep.id);
    if (!evaluation) return res.status(404).json({ error: 'Évaluation de l’épreuve introuvable' });
  } else {
    if (!['devoir1', 'devoir2', 'composition'].includes(type)) return res.status(400).json({ error: 'Type d’évaluation invalide' });
    if (!canAccessClasse(req, Number(classe_id))) return res.status(403).json({ error: 'Cette classe ne vous est pas affectée' });
    if (!canSaisir(req, classe_id, matiere_id)) return res.status(403).json({ error: 'Cette matière ne vous est pas affectée' });
    const periode = db.prepare('SELECT * FROM periodes WHERE id = ? AND ecole_id = ?').get(periode_id, ecoleId);
    if (!periode) return res.status(404).json({ error: 'Période introuvable' });
    if (periode.statut === 'fermee' && req.user.role !== 'directeur' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Cette période est clôturée : la saisie est verrouillée' });
    }
    const classeNote = db.prepare('SELECT * FROM classes WHERE id = ? AND ecole_id = ?').get(classe_id, ecoleId);
    if (!classeNote || classeNote.cycle !== periode.cycle) return res.status(400).json({ error: 'La période ne correspond pas au cycle de la classe' });
    if (!db.prepare('SELECT 1 FROM classe_matieres WHERE classe_id = ? AND matiere_id = ?').get(classe_id, matiere_id)) {
      return res.status(400).json({ error: 'Cette matière n’est pas enseignée dans cette classe' });
    }
    const libelle = type === 'composition' ? 'Composition' : (type === 'devoir1' ? 'Devoir 1' : 'Devoir 2');
    evaluation = getOrCreateEvaluation(ecoleId, Number(classe_id), Number(matiere_id), Number(periode_id), type, libelle);
  }

  const upsert = db.prepare(`INSERT INTO notes (evaluation_id, eleve_id, valeur, absent, saisi_par, modifie_le)
    VALUES (?,?,?,?,?,?) ON CONFLICT(evaluation_id, eleve_id) DO UPDATE SET
    valeur = excluded.valeur, absent = excluded.absent, saisi_par = excluded.saisi_par, modifie_le = excluded.modifie_le`);
  // La classe concernée par l'évaluation : elle sert à refuser toute note
  // visant un élève d'une autre classe (erreur de saisie ou tentative de bricolage).
  const evalRow = db.prepare('SELECT classe_id FROM evaluations WHERE id = ?').get(evaluation.id);
  const classeCible = evalRow ? Number(evalRow.classe_id) : null;

  let saved = 0;
  notes.forEach(n => {
    const eleve = db.prepare('SELECT id, classe_id FROM eleves WHERE id = ? AND ecole_id = ?').get(n.eleve_id, ecoleId);
    if (!eleve) return;
    if (classeCible && Number(eleve.classe_id) !== classeCible) return;
    const absent = n.absent ? 1 : 0;
    let valeur = n.valeur;
    if (valeur === '' || valeur === null || valeur === undefined) valeur = null;
    if (valeur !== null) {
      valeur = Number(String(valeur).replace(',', '.'));
      if (Number.isNaN(valeur) || valeur < 0 || valeur > 20) return;
    }
    if (valeur === null && !absent) {
      db.prepare('DELETE FROM notes WHERE evaluation_id = ? AND eleve_id = ?').run(evaluation.id, eleve.id);
      return;
    }
    upsert.run(evaluation.id, eleve.id, valeur, absent, req.user.id, now());
    saved++;
  });
  res.json({ ok: true, evaluation_id: evaluation.id, saved });
});

/* Grille d'une épreuve d'examen blanc */
app.get('/api/examens/epreuve/:id', auth, staffOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const ep = db.prepare(`SELECT ep.*, c.nom AS classe_nom, m.nom AS matiere_nom FROM epreuves ep
    JOIN classes c ON c.id = ep.classe_id JOIN matieres m ON m.id = ep.matiere_id
    WHERE ep.id = ? AND ep.ecole_id = ?`).get(req.params.id, ecoleId);
  if (!ep) return res.status(404).json({ error: 'Épreuve introuvable' });
  if (!canAccessClasse(req, ep.classe_id)) return res.status(403).json({ error: 'Classe non affectée' });
  const ev = db.prepare('SELECT * FROM evaluations WHERE epreuve_id = ?').get(ep.id);
  const eleves = db.prepare("SELECT id, matricule, nom, prenom, sexe FROM eleves WHERE classe_id = ? AND statut = 'actif' ORDER BY nom, prenom").all(ep.classe_id);
  const rows = ev ? db.prepare('SELECT eleve_id, valeur, absent FROM notes WHERE evaluation_id = ?').all(ev.id) : [];
  res.json({ epreuve: ep, evaluation: ev, eleves, notes: Object.fromEntries(rows.map(r => [r.eleve_id, r])) });
});

/* ------------------------------------------------------------------ */
/* Bulletins                                                           */
/* ------------------------------------------------------------------ */
app.get('/api/bulletins/classe', auth, staffOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const classeId = Number(req.query.classe_id);
  const periodeId = req.query.periode_id ? Number(req.query.periode_id) : null;
  const examenId = req.query.examen_id ? Number(req.query.examen_id) : null;
  if (!classeId) return res.status(400).json({ error: 'Classe requise' });
  if (!canAccessClasse(req, classeId)) return res.status(403).json({ error: 'Classe non affectée' });
  if (!periodeId && !examenId) return res.status(400).json({ error: 'Période ou examen requis' });
  const promo = computeClasse(db, ecoleId, {
    classe_id: classeId,
    ...(req.query.mode === 'composition' ? { mode: 'composition' } : {}),
    ...(examenId ? { examen_id: examenId } : { periode_id: periodeId })
  });
  if (!promo) return res.status(404).json({ error: 'Classe introuvable' });
  if (periodeId) {
    promo.resultats.forEach(r => {
      r.bulletin = db.prepare('SELECT * FROM bulletins WHERE eleve_id = ? AND periode_id = ?').get(r.eleve.id, periodeId) || null;
    });
  }
  res.json(promo);
});
app.put('/api/bulletins/:eleveId/:periodeId', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const el = db.prepare('SELECT * FROM eleves WHERE id = ? AND ecole_id = ?').get(req.params.eleveId, ecoleId);
  if (!el) return res.status(404).json({ error: 'Élève introuvable' });
  const { appreciation, decision } = req.body || {};
  db.prepare(`INSERT INTO bulletins (ecole_id, eleve_id, periode_id, appreciation, decision, publie, publie_le)
    VALUES (?,?,?,?,?,0,NULL)
    ON CONFLICT(eleve_id, periode_id) DO UPDATE SET appreciation = excluded.appreciation, decision = excluded.decision`)
    .run(ecoleId, el.id, req.params.periodeId, appreciation || '', decision || '');
  res.json({ ok: true });
});
app.post('/api/bulletins/publier', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const { classe_id, periode_id, publie } = req.body || {};
  if (!db.prepare('SELECT 1 FROM classes WHERE id = ? AND ecole_id = ?').get(classe_id, ecoleId)) {
    return res.status(400).json({ error: 'Classe invalide' });
  }
  const classePub = db.prepare('SELECT * FROM classes WHERE id = ? AND ecole_id = ?').get(classe_id, ecoleId);
  if (!classePub) return res.status(400).json({ error: 'Classe invalide' });
  const periodePub = db.prepare('SELECT * FROM periodes WHERE id = ? AND ecole_id = ?').get(periode_id, ecoleId);
  if (!periodePub) return res.status(400).json({ error: 'Période invalide' });
  if (periodePub.cycle !== classePub.cycle) return res.status(400).json({ error: 'La période ne correspond pas au cycle de la classe' });
  const eleves = db.prepare("SELECT id FROM eleves WHERE classe_id = ? AND ecole_id = ? AND statut = 'actif'").all(classe_id, ecoleId);
  const upsert = db.prepare(`INSERT INTO bulletins (ecole_id, eleve_id, periode_id, publie, publie_le, appreciation, decision)
    VALUES (?,?,?,?,?, '', '') ON CONFLICT(eleve_id, periode_id) DO UPDATE SET publie = excluded.publie, publie_le = excluded.publie_le`);
  eleves.forEach(e => upsert.run(ecoleId, e.id, periode_id, publie ? 1 : 0, publie ? now() : null));
  res.json({ ok: true, count: eleves.length });
});

/* ------------------------------------------------------------------ */
/* Statistiques                                                        */
/* ------------------------------------------------------------------ */
app.get('/api/stats/classe', auth, staffOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const classeId = Number(req.query.classe_id);
  if (!canAccessClasse(req, classeId)) return res.status(403).json({ error: 'Classe non affectée' });
  const promo = computeClasse(db, ecoleId, {
    classe_id: classeId,
    ...(req.query.mode === 'composition' ? { mode: 'composition' } : {}),
    ...(req.query.examen_id ? { examen_id: Number(req.query.examen_id) } : { periode_id: Number(req.query.periode_id) })
  });
  if (!promo) return res.status(404).json({ error: 'Introuvable' });
  res.json(promo);
});
app.get('/api/stats/etablissement', auth, staffOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const periodeId = Number(req.query.periode_id);
  const periodes = db.prepare('SELECT * FROM periodes WHERE ecole_id = ? ORDER BY cycle DESC, ordre').all(ecoleId);
  const periode = periodes.find(p => p.id === periodeId);
  if (!periode) return res.status(400).json({ error: 'Période invalide' });
  let classes = db.prepare('SELECT * FROM classes WHERE ecole_id = ? AND cycle = ? ORDER BY niveau, nom').all(ecoleId, periode.cycle);
  if (req.user.role === 'enseignant') {
    const ids = new Set(db.prepare('SELECT DISTINCT classe_id FROM affectations WHERE enseignant_id = ?').all(req.user.id).map(r => r.classe_id));
    classes = classes.filter(c => ids.has(c.id));
  }
  const mode = req.query.mode === 'composition' ? 'composition' : undefined;
  const lignes = classes.map(c => {
    const promo = computeClasse(db, ecoleId, { classe_id: c.id, periode_id: periodeId, ...(mode ? { mode } : {}) });
    const absents = promo.resultats.filter(r => r.moyenne == null).length;
    return {
      classe: c,
      effectif: promo.stats.effectif_classe,
      moyenne: promo.stats.moyenne,
      min: promo.stats.min, max: promo.stats.max,
      taux_reussite: promo.stats.taux_reussite,
      non_notes: absents,
      composition: promo.stats.composition,
      meilleur: promo.classement[0] ? {
        nom: `${promo.classement[0].eleve.nom} ${promo.classement[0].eleve.prenom}`,
        moyenne: promo.classement[0].moyenne
      } : null
    };
  });
  const globalMoy = lignes.filter(l => l.moyenne != null);
  res.json({
    periode,
    classes: lignes,
    global: {
      effectif: lignes.reduce((a, l) => a + l.effectif, 0),
      moyenne: globalMoy.length ? Math.round((globalMoy.reduce((a, l) => a + l.moyenne, 0) / globalMoy.length) * 100) / 100 : null,
      taux_reussite: globalMoy.length ? Math.round((globalMoy.reduce((a, l) => a + (l.taux_reussite || 0), 0) / globalMoy.length) * 10) / 10 : null,
      meilleure_classe: globalMoy.slice().sort((a, b) => b.moyenne - a.moyenne)[0] || null
    }
  });
});

/* ------------------------------------------------------------------ */
/* Examens blancs                                                      */
/* ------------------------------------------------------------------ */
app.get('/api/examens', auth, staffOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const rows = db.prepare('SELECT * FROM examens WHERE ecole_id = ? ORDER BY cree_le DESC').all(ecoleId);
  const isProf = req.user.role === 'enseignant';
  const mesAff = isProf
    ? db.prepare('SELECT classe_id, matiere_id FROM affectations WHERE enseignant_id = ?').all(req.user.id)
    : [];
  res.json(rows.map(e => {
    const epreuves = db.prepare(`SELECT ep.*, c.nom AS classe_nom, m.nom AS matiere_nom FROM epreuves ep
      JOIN classes c ON c.id = ep.classe_id JOIN matieres m ON m.id = ep.matiere_id
      WHERE ep.examen_id = ? ORDER BY ep.date_epreuve, ep.heure`).all(e.id)
      .filter(ep => !isProf || mesAff.some(a => a.classe_id === ep.classe_id && a.matiere_id === ep.matiere_id));
    const periode = e.periode_id ? db.prepare('SELECT * FROM periodes WHERE id = ?').get(e.periode_id) : null;
    return { ...e, periode, epreuves };
  }));
});
app.post('/api/examens', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const { nom, periode_id, date_debut, date_fin } = req.body || {};
  if (!nom) return res.status(400).json({ error: 'Le nom de l’examen est requis' });
  const info = db.prepare('INSERT INTO examens (ecole_id, nom, periode_id, date_debut, date_fin, statut, cree_le) VALUES (?,?,?,?,?,?,?)')
    .run(ecoleId, nom, periode_id || null, date_debut || today(), date_fin || today(), 'prepare', now());
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});
app.patch('/api/examens/:id', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const ex = db.prepare('SELECT * FROM examens WHERE id = ? AND ecole_id = ?').get(req.params.id, ecoleId);
  if (!ex) return res.status(404).json({ error: 'Examen introuvable' });
  const { statut, nom } = req.body || {};
  db.prepare('UPDATE examens SET statut = ?, nom = ? WHERE id = ?').run(statut ?? ex.statut, nom ?? ex.nom, ex.id);
  res.json({ ok: true });
});
app.delete('/api/examens/:id', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  db.prepare('DELETE FROM examens WHERE id = ? AND ecole_id = ?').run(req.params.id, ecoleId);
  res.json({ ok: true });
});
app.post('/api/examens/:id/epreuves', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const ex = db.prepare('SELECT * FROM examens WHERE id = ? AND ecole_id = ?').get(req.params.id, ecoleId);
  if (!ex) return res.status(404).json({ error: 'Examen introuvable' });
  const { classe_id, matiere_id, date_epreuve, heure, duree, coefficient, salle } = req.body || {};
  if (!classe_id || !matiere_id) return res.status(400).json({ error: 'Classe et matière requises' });
  if (!db.prepare('SELECT 1 FROM classes WHERE id = ? AND ecole_id = ?').get(classe_id, ecoleId)) return res.status(400).json({ error: 'Classe invalide' });
  const info = db.prepare(`INSERT INTO epreuves (ecole_id, examen_id, classe_id, matiere_id, date_epreuve, heure, duree, coefficient, bareme, salle)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(ecoleId, ex.id, classe_id, matiere_id, date_epreuve || today(), heure || '08:00',
    duree || 120, coefficient || 1, 20, salle || '');
  const epId = Number(info.lastInsertRowid);
  db.prepare(`INSERT INTO evaluations (ecole_id, classe_id, matiere_id, periode_id, epreuve_id, type, libelle, bareme, cree_le)
    VALUES (?,?,?,?,?, 'blanc', ?,20,?)`).run(ecoleId, classe_id, matiere_id, ex.periode_id || null, epId,
    `Épreuve ${db.prepare('SELECT nom FROM matieres WHERE id = ?').get(matiere_id).nom}`, now());
  res.json({ ok: true, id: epId });
});
app.delete('/api/examens/:id/epreuves/:epreuveId', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  db.prepare('DELETE FROM epreuves WHERE id = ? AND examen_id = ? AND ecole_id = ?').run(req.params.epreuveId, req.params.id, ecoleId);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Journal de saisie (direction)                                       */
/* ------------------------------------------------------------------ */
// Trace de qui a enregistré ou modifié chaque note : la direction peut
// vérifier en un coup d'œil qu'un collègue n'a pas touché une matière qui
// ne lui est pas affectée (et revenir sur une note litigieuse).
app.get('/api/journal-notes', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const limite = Math.min(Number(req.query.limite) || 40, 200);
  const filtres = [];
  const params = [ecoleId];
  if (req.query.classe_id) { filtres.push('ev.classe_id = ?'); params.push(Number(req.query.classe_id)); }
  if (req.query.periode_id) { filtres.push('ev.periode_id = ?'); params.push(Number(req.query.periode_id)); }
  if (req.query.enseignant_id) {
    filtres.push("n.saisi_par IN (SELECT id FROM utilisateurs WHERE id = ? AND ecole_id = ?)");
    params.push(Number(req.query.enseignant_id), ecoleId);
  }
  const rows = db.prepare(`
    SELECT n.modifie_le, n.valeur, n.absent, n.saisi_par,
           el.nom, el.prenom, el.matricule,
           m.nom AS matiere, c.nom AS classe,
           ev.type, ev.libelle,
           u.nom AS enseignant
    FROM notes n
    JOIN eleves el ON el.id = n.eleve_id
    JOIN evaluations ev ON ev.id = n.evaluation_id
    JOIN matieres m ON m.id = ev.matiere_id
    JOIN classes c ON c.id = ev.classe_id
    LEFT JOIN utilisateurs u ON u.id = n.saisi_par
    WHERE ev.ecole_id = ? ${filtres.length ? 'AND ' + filtres.join(' AND ') : ''}
    ORDER BY n.modifie_le DESC
    LIMIT ${limite}`).all(...params);
  res.json(rows);
});

/* ------------------------------------------------------------------ */
/* Tableau de bord                                                     */
/* ------------------------------------------------------------------ */
app.get('/api/dashboard', auth, staffOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const etab = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(ecoleId);
  const isProf = req.user.role === 'enseignant';
  const mesClasses = isProf
    ? new Set(db.prepare('SELECT DISTINCT classe_id FROM affectations WHERE enseignant_id = ?').all(req.user.id).map(r => r.classe_id))
    : null;
  const mesMatieres = isProf
    ? new Set(db.prepare('SELECT DISTINCT matiere_id FROM affectations WHERE enseignant_id = ?').all(req.user.id).map(r => r.matiere_id))
    : null;
  let nbEleves = db.prepare("SELECT COUNT(*) AS n FROM eleves WHERE ecole_id = ? AND statut = 'actif'").get(ecoleId).n;
  let nbClasses = db.prepare('SELECT COUNT(*) AS n FROM classes WHERE ecole_id = ?').get(ecoleId).n;
  const nbProfs = db.prepare("SELECT COUNT(*) AS n FROM utilisateurs WHERE ecole_id = ? AND role = 'enseignant' AND actif = 1").get(ecoleId).n;
  let nbMatieres = db.prepare('SELECT COUNT(*) AS n FROM matieres WHERE ecole_id = ?').get(ecoleId).n;
  if (isProf) {
    const ids = [...mesClasses];
    nbEleves = ids.length
      ? db.prepare(`SELECT COUNT(*) AS n FROM eleves WHERE ecole_id = ? AND statut = 'actif' AND classe_id IN (${ids.join(',')})`).get(ecoleId).n
      : 0;
    nbClasses = mesClasses.size;
    nbMatieres = mesMatieres.size;
  }

  const periodes = db.prepare('SELECT * FROM periodes WHERE ecole_id = ? ORDER BY cycle DESC, ordre').all(ecoleId);
  const periodeActive = periodes.find(p => p.statut === 'ouverte') || periodes[0];
  let progression = 0;
  let statsParClasse = [];
  if (periodeActive) {
    statsParClasse = db.prepare('SELECT * FROM classes WHERE ecole_id = ? AND cycle = ? ORDER BY niveau, nom').all(ecoleId, periodeActive.cycle)
      .filter(c => !isProf || mesClasses.has(c.id))
      .map(c => {
        const promo = computeClasse(db, ecoleId, { classe_id: c.id, periode_id: periodeActive.id });
        const attendu = promo.resultats.length * promo.matieres.length * 3;
        const saisies = promo.resultats.reduce((a, r) => a + r.lignes.reduce((b, l) => b + Object.values(l.detail).filter(v => v != null).length, 0), 0);
        return {
          id: c.id, nom: c.nom, cycle: c.cycle, effectif: promo.stats.effectif_classe,
          moyenne: promo.stats.moyenne, taux_reussite: promo.stats.taux_reussite,
          progression: attendu ? Math.round((saisies / attendu) * 100) : 0
        };
      });
    const total = statsParClasse.reduce((a, c) => a + c.progression, 0);
    progression = statsParClasse.length ? Math.round(total / statsParClasse.length) : 0;
  }

  const recent = db.prepare(`
    SELECT n.modifie_le, n.valeur, el.nom, el.prenom, m.nom AS matiere, c.nom AS classe, u.nom AS enseignant
    FROM notes n JOIN eleves el ON el.id = n.eleve_id
    JOIN evaluations e ON e.id = n.evaluation_id JOIN matieres m ON m.id = e.matiere_id
    JOIN classes c ON c.id = e.classe_id LEFT JOIN utilisateurs u ON u.id = n.saisi_par
    WHERE e.ecole_id = ? ${isProf ? 'AND n.saisi_par = ' + Number(req.user.id) : ''}
    ORDER BY n.modifie_le DESC LIMIT 8`).all(ecoleId);

  const top = periodeActive ? db.prepare('SELECT * FROM classes WHERE ecole_id = ? AND cycle = ?').all(ecoleId, periodeActive.cycle)
    .filter(c => !isProf || mesClasses.has(c.id))
    .flatMap(c => {
      const promo = computeClasse(db, ecoleId, { classe_id: c.id, periode_id: periodeActive.id });
      return promo.classement.slice(0, 2).map(r => ({
        nom: `${r.eleve.nom} ${r.eleve.prenom}`, classe: c.nom, moyenne: r.moyenne, rang: r.rang
      }));
    }).sort((a, b) => b.moyenne - a.moyenne).slice(0, 5) : [];

  res.json({
    etablissement: etab,
    compteurs: { eleves: nbEleves, classes: nbClasses, enseignants: nbProfs, matieres: nbMatieres },
    periode_active: periodeActive,
    periodes,
    progression,
    classes: statsParClasse,
    top_eleves: top,
    activite: recent,
    examens: db.prepare('SELECT COUNT(*) AS n FROM examens WHERE ecole_id = ?').get(ecoleId).n
  });
});

/* ------------------------------------------------------------------ */
/* Espace élève / parent                                               */
/* ------------------------------------------------------------------ */
app.get('/api/eleve/espace', auth, roles('eleve'), (req, res) => {
  const el = db.prepare('SELECT el.*, c.nom AS classe_nom, c.cycle FROM eleves el LEFT JOIN classes c ON c.id = el.classe_id WHERE el.user_id = ?').get(req.user.id);
  if (!el) return res.status(404).json({ error: 'Aucun dossier élève associé à ce compte' });
  const etab = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(el.ecole_id);
  const periodes = db.prepare('SELECT * FROM periodes WHERE ecole_id = ? AND cycle = ? ORDER BY ordre').all(el.ecole_id, el.cycle);
  const resultats = periodes.map(p => {
    const data = bulletinData(db, el.ecole_id, el.id, p.id);
    if (!data) return { periode: p, publie: false, ligne: null };
    const publie = !!(data.bulletin && data.bulletin.publie);
    return {
      periode: p, publie,
      moyenne: publie && data.ligne ? data.ligne.moyenne : null,
      rang: publie && data.ligne ? data.ligne.rang : null,
      effectif: data.promo.resultats.length,
      mention: publie && data.ligne ? data.ligne.mention : null,
      appreciation: data.bulletin ? data.bulletin.appreciation : null,
      lignes: publie && data.ligne ? data.ligne.lignes : []
    };
  });
  res.json({ eleve: el, etablissement: etab, periodes: resultats, estPublie: resultats.some(r => r.publie) });
});

/* ------------------------------------------------------------------ */
/* Console super-administrateur (SaaS)                                 */
/* ------------------------------------------------------------------ */
app.get('/api/admin/etablissements', auth, roles('super_admin'), (req, res) => {
  const rows = db.prepare('SELECT * FROM etablissements ORDER BY created_at DESC').all();
  const out = rows.map(e => {
    const eleves = db.prepare("SELECT COUNT(*) AS n FROM eleves WHERE ecole_id = ? AND statut = 'actif'").get(e.id).n;
    const classes = db.prepare('SELECT COUNT(*) AS n FROM classes WHERE ecole_id = ?').get(e.id).n;
    const profs = db.prepare("SELECT COUNT(*) AS n FROM utilisateurs WHERE ecole_id = ? AND role = 'enseignant'").get(e.id).n;
    const revenus = db.prepare("SELECT COALESCE(SUM(montant),0) AS s FROM paiements WHERE ecole_id = ? AND statut = 'paye'").get(e.id).s;
    const expire = e.date_fin_abonnement ? new Date(e.date_fin_abonnement).getTime() < Date.now() : false;
    return { ...e, eleves, classes, profs, revenus, expire };
  });
  res.json(out);
});
app.post('/api/admin/etablissements', auth, roles('super_admin'), (req, res) => {
  const { nom, type, ville, telephone, email, chef_nom, chef_email, chef_password, plan, statut, duree_jours } = req.body || {};
  if (!nom || !chef_nom || !chef_email || !chef_password) return res.status(400).json({ error: 'Établissement, directeur et identifiants requis' });
  if (db.prepare('SELECT id FROM utilisateurs WHERE email = ?').get(String(chef_email).toLowerCase())) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  }
  const ecoleId = createEtablissement({
    nom, type: type || 'mixte', ville, telephone, email, chef_nom,
    plan: plan || 'essai', statut: statut || 'essai',
    date_fin_abonnement: addDays(Number(duree_jours) || 30)
  });
  createUser({ ecole_id: ecoleId, nom: chef_nom, email: chef_email, password: chef_password, role: 'directeur' });
  res.json({ ok: true, id: ecoleId });
});
app.patch('/api/admin/etablissements/:id', auth, roles('super_admin'), (req, res) => {
  const e = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Introuvable' });
  const { statut, plan, date_fin_abonnement, nom } = req.body || {};
  db.prepare('UPDATE etablissements SET statut = ?, plan = ?, date_fin_abonnement = ?, nom = ? WHERE id = ?')
    .run(statut ?? e.statut, plan ?? e.plan, date_fin_abonnement ?? e.date_fin_abonnement, nom ?? e.nom, e.id);
  res.json({ ok: true });
});
app.post('/api/admin/paiements', auth, roles('super_admin'), (req, res) => {
  const { ecole_id, montant, plan, reference, duree_jours } = req.body || {};
  const e = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(ecole_id);
  if (!e) return res.status(404).json({ error: 'Établissement introuvable' });
  const fin = addDays(Number(duree_jours) || 365);
  db.prepare(`INSERT INTO paiements (ecole_id, montant, devise, plan, reference, statut, periode_debut, periode_fin,
    operateur, canal, mois, valide_par, valide_le, cree_le)
    VALUES (?,?,?,?,?, 'paye', ?,?,?,?,?,?,?,?)`).run(ecole_id, montant || 0, 'FCFA', plan || e.plan,
    reference || `PAY-${Date.now()}`, today(), fin.slice(0, 10), req.body.operateur || 'manuel', 'manuel',
    Math.max(1, Math.round((Number(duree_jours) || 365) / 30)), req.user.id, now(), now());
  db.prepare("UPDATE etablissements SET statut = 'actif', plan = ?, date_fin_abonnement = ? WHERE id = ?").run(plan || e.plan, fin, e.id);
  res.json({ ok: true });
});
app.get('/api/admin/demandes', auth, roles('super_admin'), (req, res) => {
  res.json(db.prepare('SELECT * FROM demandes ORDER BY cree_le DESC').all());
});
app.patch('/api/admin/demandes/:id', auth, roles('super_admin'), (req, res) => {
  db.prepare('UPDATE demandes SET statut = ? WHERE id = ?').run(req.body.statut || 'traite', req.params.id);
  res.json({ ok: true });
});
app.get('/api/admin/statistiques', auth, roles('super_admin'), (req, res) => {
  const nbEcoles = db.prepare('SELECT COUNT(*) AS n FROM etablissements').get().n;
  const actives = db.prepare("SELECT COUNT(*) AS n FROM etablissements WHERE statut = 'actif'").get().n;
  const essais = db.prepare("SELECT COUNT(*) AS n FROM etablissements WHERE statut = 'essai'").get().n;
  const eleves = db.prepare("SELECT COUNT(*) AS n FROM eleves WHERE statut = 'actif'").get().n;
  const revenus = db.prepare("SELECT COALESCE(SUM(montant),0) AS s FROM paiements WHERE statut = 'paye'").get().s;
  const leads = db.prepare("SELECT COUNT(*) AS n FROM demandes WHERE statut = 'nouveau'").get().n;
  const paiements = db.prepare(`SELECT p.*, e.nom AS ecole_nom FROM paiements p JOIN etablissements e ON e.id = p.ecole_id ORDER BY p.cree_le DESC LIMIT 20`).all();
  const paiementsEnAttente = db.prepare("SELECT COUNT(*) AS n FROM paiements WHERE statut = 'en_attente'").get().n;
  res.json({ nbEcoles, actives, essais, eleves, revenus, leads, paiements, paiementsEnAttente });
});


/* ------------------------------------------------------------------ */
/* Paiements Mobile Money (Mixx by Yas, Moov Money) & CinetPay         */
/* ------------------------------------------------------------------ */
function prolonger(ecoleId, mois, plan) {
  const e = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(ecoleId);
  if (!e) return null;
  const actuel = e.date_fin_abonnement ? new Date(e.date_fin_abonnement) : null;
  const base = actuel && actuel.getTime() > Date.now() ? actuel : new Date();
  const fin = new Date(base.getTime() + Math.max(1, Number(mois) || 1) * 30 * 864e5);
  db.prepare("UPDATE etablissements SET statut = 'actif', plan = ?, date_fin_abonnement = ? WHERE id = ?")
    .run(plan || e.plan, fin.toISOString(), e.id);
  return fin.toISOString();
}

function validerPaiement(paiement, validePar) {
  db.prepare(`UPDATE paiements SET statut = 'paye', valide_par = ?, valide_le = ? WHERE id = ?`)
    .run(validePar, now(), paiement.id);
  const fin = prolonger(paiement.ecole_id, paiement.mois, paiement.plan);
  return fin;
}

app.get('/api/paiements', auth, directionOnly, (req, res) => {
  const id = ecoleOf(req, res); if (!id) return;
  res.json(db.prepare('SELECT * FROM paiements WHERE ecole_id = ? ORDER BY cree_le DESC').all(id));
});

app.post('/api/auth/password', auth, (req, res) => {
  const { ancien, nouveau } = req.body || {};
  if (!ancien || !nouveau) return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' });
  if (String(nouveau).length < 6) return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
  const user = db.prepare('SELECT * FROM utilisateurs WHERE id = ?').get(req.user.id);
  if (!verifyPassword(ancien, user.mot_de_passe)) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  db.prepare('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?').run(hashPassword(nouveau), user.id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Récupération d'identifiants                                         */
/* ------------------------------------------------------------------ */

/** Mot de passe lisible dicté au téléphone : « baobab-solide-4821 ». */
const MOTS_MDP_A = ['baobab', 'colibri', 'calebasse', 'harmattan', 'savane', 'lagune',
  'mangrove', 'fromager', 'hibiscus', 'zebu', 'mil', 'cocotier', 'flamboyant'];
const MOTS_MDP_B = ['solide', 'brillant', 'paisible', 'nouveau', 'vivant', 'clair',
  'fidele', 'ouvert', 'joyeux', 'rapide', 'tranquille'];
function motDePasseLisible() {
  const a = MOTS_MDP_A[crypto.randomInt(MOTS_MDP_A.length)];
  const b = MOTS_MDP_B[crypto.randomInt(MOTS_MDP_B.length)];
  return `${a}-${b}-${crypto.randomInt(1000, 9999)}`;
}

/**
 * MOT DE PASSE OUBLIÉ (public).
 * Sans e-mail sortant, la demande est déposée pour le chef d'établissement :
 * il la voit dans sa console et régénère les identifiants en un clic.
 * La réponse est toujours la même (on ne révèle pas si l'adresse existe).
 */
app.post('/api/auth/oubli', (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Adresse email requise' });
  const u = db.prepare('SELECT id, ecole_id, role FROM utilisateurs WHERE email = ?').get(email);
  const message = String((req.body || {}).message || '').slice(0, 400);
  if (u) {
    const deja = db.prepare("SELECT id FROM demandes_mdp WHERE email = ? AND statut = 'nouvelle'").get(email);
    if (!deja) {
      db.prepare('INSERT INTO demandes_mdp (ecole_id, email, role, message, statut, cree_le) VALUES (?,?,?,?,?,?)')
        .run(u.ecole_id || null, email, u.role, message, 'nouvelle', now());
    }
  }
  res.json({
    ok: true,
    message: "Demande enregistrée. Le chef d'établissement la verra dans sa console et vous donnera un nouveau mot de passe."
  });
});

/** Demandes en attente (chef d'établissement). */
app.get('/api/demandes-mdp', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const rows = db.prepare(`
    SELECT d.*, u.nom AS nom, u.actif, u.id AS utilisateur_id
    FROM demandes_mdp d
    LEFT JOIN utilisateurs u ON u.email = d.email
    WHERE COALESCE(d.ecole_id, u.ecole_id) = ?
    ORDER BY CASE d.statut WHEN 'nouvelle' THEN 0 ELSE 1 END, d.cree_le DESC
    LIMIT 100`).all(ecoleId);
  res.json(rows);
});

app.post('/api/demandes-mdp/:id/traiter', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const d = db.prepare('SELECT * FROM demandes_mdp WHERE id = ?').get(Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'Demande introuvable' });
  const u = db.prepare('SELECT id, ecole_id FROM utilisateurs WHERE email = ?').get(d.email);
  if (u && u.ecole_id && u.ecole_id !== ecoleId) return res.status(403).json({ error: 'Accès refusé' });
  if (!u && d.ecole_id !== ecoleId) return res.status(403).json({ error: 'Accès refusé' });
  const statut = req.body && req.body.statut === 'ignoree' ? 'ignoree' : 'traitee';
  db.prepare('UPDATE demandes_mdp SET statut = ?, traite_le = ?, traite_par = ? WHERE id = ?')
    .run(statut, now(), req.user.id, d.id);
  res.json({ ok: true });
});

/**
 * NOUVEAUX IDENTIFIANTS pour un enseignant (chef d'établissement seulement).
 * Le mot de passe est renvoyé UNE SEULE FOIS, en clair, pour être communiqué.
 * Toutes ses sessions ouvertes sont fermées : l'ancien mot de passe ne sert
 * plus à rien, même sur un appareil resté connecté.
 */
app.post('/api/enseignants/:id/identifiants', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const u = db.prepare("SELECT * FROM utilisateurs WHERE id = ? AND ecole_id = ? AND role = 'enseignant'")
    .get(Number(req.params.id), ecoleId);
  if (!u) return res.status(404).json({ error: 'Enseignant introuvable' });

  // Mot de passe imposé (facultatif) ou généré lisible
  let mdp = String((req.body || {}).mot_de_passe || '').trim();
  if (mdp && mdp.length < 6) return res.status(400).json({ error: '6 caractères minimum' });
  if (!mdp) mdp = motDePasseLisible();

  db.prepare('UPDATE utilisateurs SET mot_de_passe = ?, actif = 1 WHERE id = ?')
    .run(hashPassword(mdp), u.id);
  const fermees = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id).changes;
  db.prepare("UPDATE demandes_mdp SET statut = 'traitee', traite_le = ?, traite_par = ? WHERE email = ? AND statut = 'nouvelle'")
    .run(now(), req.user.id, u.email);

  res.json({ ok: true, email: u.email, nom: u.nom, mot_de_passe: mdp, sessions_fermees: Number(fermees) });
});

/** Retirer / rétablir l'accès d'un enseignant (immédiat). */
app.post('/api/enseignants/:id/acces', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const u = db.prepare("SELECT * FROM utilisateurs WHERE id = ? AND ecole_id = ? AND role = 'enseignant'")
    .get(Number(req.params.id), ecoleId);
  if (!u) return res.status(404).json({ error: 'Enseignant introuvable' });
  const actif = req.body && req.body.actif ? 1 : 0;
  db.prepare('UPDATE utilisateurs SET actif = ? WHERE id = ?').run(actif, u.id);
  if (!actif) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM affectations WHERE enseignant_id = ?').run(u.id);
  }
  res.json({ ok: true, actif });
});

app.get('/api/paiement/options', auth, directionOnly, (req, res) => {
  const reglages = P.lireReglages(db);
  const cp = P.cinetpayConfig(reglages);
  res.json({
    operateurs: Object.values(P.OPERATEURS).map(o => ({
      code: o.code, nom: o.nom, ancien: o.ancien, reseau: o.reseau, ussd_menu: o.ussd_menu,
      ussd_paiement: o.ussd_paiement, comment_payer: o.comment_payer, couleur: o.couleur,
      numero: o.code === 'mixx' ? reglages.mixx_numero : reglages.moov_numero,
      nom_marchand: o.code === 'mixx' ? (reglages.mixx_nom || '') : (reglages.moov_nom || ''),
      actif: (o.code === 'mixx' ? reglages.mixx_actif : reglages.moov_actif) === '1'
        && !!(o.code === 'mixx' ? reglages.mixx_numero : reglages.moov_numero)
    })),
    plans: Object.values(P.PLANS).map(p => ({
      code: p.code, nom: p.nom,
      prix_mensuel: P.prixMensuel(reglages, p.code),
      sur_devis: p.code === 'reseau',
      montants: P.DUREES.map(d => ({ mois: d.mois, libelle: d.libelle, remise: d.remise, montant: P.montantPour(reglages, p.code, d.mois) }))
    })),
    durees: P.DUREES,
    cinetpay: { actif: cp.actif, mode: cp.mode },
    passerelles: P.passerelles(reglages)
  });
});

app.post('/api/paiement/declarer', auth, directionOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const { plan, mois, operateur, telephone_payeur, transaction_ref, note } = req.body || {};
  const reglages = P.lireReglages(db);
  if (!P.PLANS[plan] || plan === 'reseau') return res.status(400).json({ error: 'Formule invalide (Réseau : sur devis)' });
  if (!P.OPERATEURS[operateur]) return res.status(400).json({ error: 'Opérateur Mobile Money invalide' });
  const op = P.OPERATEURS[operateur];
  const numero = operateur === 'mixx' ? reglages.mixx_numero : reglages.moov_numero;
  const actif = (operateur === 'mixx' ? reglages.mixx_actif : reglages.moov_actif) === '1';
  if (!actif || !numero) return res.status(400).json({ error: `${op.nom} n’est pas encore configuré. Contactez l’éditeur.` });
  const montant = P.montantPour(reglages, plan, mois);
  if (montant == null || montant <= 0) return res.status(400).json({ error: 'Montant introuvable pour cette formule' });
  const ref = String(transaction_ref || '').trim();
  if (ref.length < 4) return res.status(400).json({ error: 'Indiquez l’identifiant (ID) de la transaction reçu par SMS' });
  if (!String(telephone_payeur || '').trim()) return res.status(400).json({ error: 'Indiquez le numéro de téléphone utilisé pour payer' });
  const doublon = db.prepare('SELECT id FROM paiements WHERE operateur = ? AND transaction_ref = ?').get(operateur, ref);
  if (doublon) return res.status(409).json({ error: 'Cette transaction a déjà été déclarée. Contactez l’éditeur si ce n’est pas vous.' });

  const reference = P.referencePaiement(operateur);
  const duree = P.DUREES.find(d => d.mois === Number(mois)) || P.DUREES[0];
  const info = db.prepare(`INSERT INTO paiements (ecole_id, montant, devise, plan, reference, statut,
    periode_debut, periode_fin, operateur, telephone_payeur, transaction_ref, canal, mois, note, demande_par, cree_le)
    VALUES (?,?,?,?,?, 'en_attente', ?,?,?,?,?, 'manuel', ?,?,?,?)`).run(
    ecoleId, montant, 'FCFA', plan, reference, today(),
    new Date(Date.now() + duree.mois * 30 * 864e5).toISOString().slice(0, 10),
    operateur, String(telephone_payeur).trim(), ref, duree.mois, note || '', req.user.id, now());
  res.json({
    ok: true, id: Number(info.lastInsertRowid), reference, montant, statut: 'en_attente',
    message: 'Paiement déclaré. L’éditeur vérifie la transaction et active votre abonnement (généralement sous quelques heures).'
  });
});

app.post('/api/paiement/cinetpay/initier', auth, directionOnly, async (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const { plan, mois } = req.body || {};
  const reglages = P.lireReglages(db);
  const cfg = P.cinetpayConfig(reglages);
  if (!cfg.actif) return res.status(400).json({ error: 'Le paiement en ligne CinetPay n’est pas activé. Utilisez le paiement Mobile Money manuel.' });
  if (!P.PLANS[plan] || plan === 'reseau') return res.status(400).json({ error: 'Formule invalide' });
  const montant = P.montantPour(reglages, plan, mois);
  if (!montant) return res.status(400).json({ error: 'Montant introuvable' });
  const etab = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(ecoleId);
  const duree = P.DUREES.find(d => d.mois === Number(mois)) || P.DUREES[0];
  const reference = P.referencePaiement('cinetpay');
  const info = db.prepare(`INSERT INTO paiements (ecole_id, montant, devise, plan, reference, statut,
    periode_debut, periode_fin, canal, mois, demande_par, cree_le)
    VALUES (?,?,?,?,?, 'en_attente', ?,?, 'cinetpay', ?,?,?)`).run(
    ecoleId, montant, 'FCFA', plan, reference, today(),
    new Date(Date.now() + duree.mois * 30 * 864e5).toISOString().slice(0, 10),
    duree.mois, req.user.id, now());
  const id = Number(info.lastInsertRowid);
  try {
    const { url } = await P.initierCinetPay(cfg, {
      montant, devise: 'FCFA', transactionId: reference,
      description: `Abonnement ${P.PLANS[plan].nom} — ${duree.libelle} — ${etab.nom}`,
      ecole: etab, telephone: req.body.telephone || etab.telephone, email: req.user.email,
      nom: req.user.nom, baseUrl: baseUrl(req)
    });
    res.json({ ok: true, url, reference, montant, id });
  } catch (e) {
    db.prepare("UPDATE paiements SET statut = 'rejete', note = ? WHERE id = ?").run(String(e.message).slice(0, 300), id);
    res.status(502).json({ error: e.message });
  }
});

/** Notification CinetPay — on ne fait jamais confiance au corps : on interroge l'API. */
app.post('/api/webhooks/cinetpay', async (req, res) => {
  const transactionId = (req.body && (req.body.cpm_trans_id || req.body.transaction_id)) || req.query.transaction_id;
  if (!transactionId) return res.status(400).json({ error: 'transaction_id manquant' });
  const paiement = db.prepare('SELECT * FROM paiements WHERE reference = ?').get(transactionId);
  if (!paiement) return res.status(404).json({ error: 'Paiement inconnu' });
  if (paiement.statut === 'paye') return res.json({ ok: true, deja: true });
  const cfg = P.cinetpayConfig(P.lireReglages(db));
  if (!cfg.actif) return res.status(400).json({ error: 'CinetPay non configuré' });
  try {
    const etat = await P.verifierCinetPay(cfg, transactionId);
    if (etat.statut === 'ACCEPTED') {
      if (etat.montant != null && Math.round(etat.montant) < Math.round(paiement.montant)) {
        db.prepare("UPDATE paiements SET statut = 'rejete', note = ? WHERE id = ?")
          .run(`Montant reçu (${etat.montant}) inférieur au montant attendu (${paiement.montant})`, paiement.id);
        return res.status(400).json({ error: 'Montant insuffisant' });
      }
      db.prepare("UPDATE paiements SET operateur = ?, transaction_ref = ? WHERE id = ?")
        .run(etat.operateur ? String(etat.operateur).toLowerCase() : null, etat.moyen || '', paiement.id);
      validerPaiement(paiement, null);
      return res.json({ ok: true });
    }
    db.prepare("UPDATE paiements SET statut = 'rejete', note = ? WHERE id = ?")
      .run(`CinetPay : ${etat.statut}`, paiement.id);
    res.json({ ok: true, statut: etat.statut });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/** Initialisation d'un paiement PayDunya (T-Money / Flooz / carte). */
app.post('/api/paiement/paydunya/initier', auth, directionOnly, async (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const { plan, mois } = req.body || {};
  const reglages = P.lireReglages(db);
  const cfg = P.paydunyaConfig(reglages);
  if (!cfg.actif) return res.status(400).json({ error: 'PayDunya n’est pas activé. Utilisez le paiement Mobile Money manuel.' });
  if (!P.PLANS[plan] || plan === 'reseau') return res.status(400).json({ error: 'Formule invalide' });
  const montant = P.montantPour(reglages, plan, mois);
  if (!montant) return res.status(400).json({ error: 'Montant introuvable' });
  const etab = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(ecoleId);
  const duree = P.DUREES.find(d => d.mois === Number(mois)) || P.DUREES[0];
  const reference = P.referencePaiement('paydunya');
  const info = db.prepare(`INSERT INTO paiements (ecole_id, montant, devise, plan, reference, statut,
    periode_debut, periode_fin, canal, mois, telephone_payeur, demande_par, cree_le)
    VALUES (?,?,?,?,?, 'en_attente', ?,?, 'paydunya', ?,?,?,?)`).run(
    ecoleId, montant, 'FCFA', plan, reference, today(),
    new Date(Date.now() + duree.mois * 30 * 864e5).toISOString().slice(0, 10),
    duree.mois, req.body.telephone || etab.telephone || '', req.user.id, now());
  const id = Number(info.lastInsertRowid);
  try {
    const { url, token } = await P.initierPaydunya(cfg, {
      montant, description: `Abonnement ${P.PLANS[plan].nom} — ${duree.libelle} — ${etab.nom}`,
      ecole: etab, telephone: req.body.telephone || etab.telephone, email: req.user.email,
      nom: req.user.nom, baseUrl: baseUrl(req)
    });
    db.prepare('UPDATE paiements SET transaction_ref = ? WHERE id = ?').run(token, id);
    res.json({ ok: true, url, reference, token, montant, id });
  } catch (e) {
    db.prepare("UPDATE paiements SET statut = 'rejete', note = ? WHERE id = ?").run(String(e.message).slice(0, 300), id);
    res.status(502).json({ error: e.message });
  }
});

/** IPN PayDunya : on vérifie l'empreinte HMAC puis on confirme auprès de l'API. */
app.post('/api/webhooks/paydunya', async (req, res) => {
  const body = req.body || {};
  const token = (body.invoice && (body.invoice.token || body.invoice.invoice_token))
    || body.token || body.invoice_token || (req.query && req.query.token);
  if (!token) return res.status(400).json({ error: 'token manquant' });
  const paiement = db.prepare("SELECT * FROM paiements WHERE canal = 'paydunya' AND transaction_ref = ?").get(String(token));
  if (!paiement) return res.status(404).json({ error: 'Paiement inconnu' });
  if (paiement.statut === 'paye') return res.json({ ok: true, deja: true });
  const cfg = P.paydunyaConfig(P.lireReglages(db));
  if (!cfg.actif) return res.status(400).json({ error: 'PayDunya non configuré' });
  // Contrôle facultatif de l'empreinte fournie par PayDunya (SHA-512 de la master key)
  if (body.hash) {
    const attendu = crypto.createHash('sha512').update(cfg.master).digest('hex');
    if (String(body.hash).toLowerCase() !== attendu) return res.status(403).json({ error: 'Empreinte invalide' });
  }
  try {
    const etat = await P.verifierPaydunya(cfg, token);
    if (etat.statut === 'completed') {
      if (etat.montant != null && Math.round(etat.montant) < Math.round(paiement.montant)) {
        db.prepare("UPDATE paiements SET statut = 'rejete', note = ? WHERE id = ?")
          .run(`Montant reçu (${etat.montant}) inférieur au montant attendu (${paiement.montant})`, paiement.id);
        return res.status(400).json({ error: 'Montant insuffisant' });
      }
      db.prepare('UPDATE paiements SET operateur = ? WHERE id = ?')
        .run(etat.operateur || null, paiement.id);
      validerPaiement(paiement, null);
      return res.json({ ok: true });
    }
    if (etat.statut === 'canceled' || etat.statut === 'cancelled' || etat.statut === 'fail') {
      db.prepare("UPDATE paiements SET statut = 'rejete', note = ? WHERE id = ?")
        .run(`PayDunya : ${etat.statut}`, paiement.id);
    }
    res.json({ ok: true, statut: etat.statut });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/* ------------------------------- Reçus PDF ------------------------- */
function envoyerRecu(res, paiement) {
  const ecole = db.prepare('SELECT * FROM etablissements WHERE id = ?').get(paiement.ecole_id);
  if (!ecole) return res.status(404).json({ error: 'Établissement introuvable' });
  if (paiement.statut !== 'paye') return res.status(400).json({ error: 'Le reçu n’est disponible qu’après validation du paiement' });
  const r = P.lireReglages(db);
  const editeur = {
    nom: r.editeur_nom || 'Terminish École',
    sous_titre: r.editeur_sous_titre || '',
    ville: r.editeur_ville || 'Lomé, Togo',
    telephone: r.editeur_telephone || '',
    email: r.editeur_email || ''
  };
  genererRecuPDF(paiement, ecole, { editeur })
    .then(buffer => {
      const nom = `recu-${(paiement.reference || 'paiement').replace(/[^A-Za-z0-9_-]/g, '')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nom}"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    })
    .catch(e => {
      console.error('Reçu PDF :', e);
      res.status(500).json({ error: 'Impossible de générer le reçu' });
    });
}

app.get('/api/paiements/:id/recu.pdf', auth, (req, res) => {
  const paiement = db.prepare('SELECT * FROM paiements WHERE id = ?').get(req.params.id);
  if (!paiement) return res.status(404).json({ error: 'Paiement introuvable' });
  const autorise = req.user.role === 'super_admin' || Number(paiement.ecole_id) === Number(req.user.ecole_id);
  if (!autorise) return res.status(403).json({ error: 'Accès refusé' });
  envoyerRecu(res, paiement);
});

app.get('/api/admin/paiements/:id/recu.pdf', auth, roles('super_admin'), (req, res) => {
  const paiement = db.prepare('SELECT * FROM paiements WHERE id = ?').get(req.params.id);
  if (!paiement) return res.status(404).json({ error: 'Paiement introuvable' });
  envoyerRecu(res, paiement);
});

/* --------------------------- Admin : réglages & validation --------- */
app.get('/api/admin/reglages', auth, roles('super_admin'), (req, res) => {
  const r = P.lireReglages(db);
  const cfg = P.cinetpayConfig(r);
  const pd = P.paydunyaConfig(r);
  res.json({
    mixx_numero: r.mixx_numero || '', mixx_nom: r.mixx_nom || '', mixx_actif: r.mixx_actif === '1',
    moov_numero: r.moov_numero || '', moov_nom: r.moov_nom || '', moov_actif: r.moov_actif === '1',
    prix_essentiel: Number(r.prix_essentiel) || 15000,
    prix_standard: Number(r.prix_standard) || 25000,
    cinetpay: {
      actif: cfg.actif, mode: cfg.mode,
      source: process.env.CINETPAY_APIKEY ? 'variables d’environnement' : (r.cinetpay_apikey ? 'base de données' : 'non configuré'),
      site_id: cfg.actif ? cfg.siteId.replace(/^(.{2}).*(.{2})$/, '$1••••$2') : ''
    },
    paydunya: {
      actif: pd.actif, mode: pd.mode,
      source: process.env.PAYDUNYA_MASTER_KEY ? 'variables d’environnement' : (r.paydunya_master_key ? 'base de données' : 'non configuré'),
      token: pd.actif ? pd.token.replace(/^(.{2}).*(.{2})$/, '$1••••$2') : ''
    },
    passerelles: P.passerelles(r),
    cloudinary: (() => {
      const c = cloudinary.config();
      return { actif: c.actif, cloud: c.cloud, source: c.source };
    })(),
    editeur: {
      nom: r.editeur_nom || '', sous_titre: r.editeur_sous_titre || '',
      ville: r.editeur_ville || '', telephone: r.editeur_telephone || '', email: r.editeur_email || '',
      whatsapp: r.editeur_whatsapp || ''
    }
  });
});

app.put('/api/admin/reglages', auth, roles('super_admin'), (req, res) => {
  const b = req.body || {};
  const valeurs = {};
  ['mixx_numero', 'mixx_nom', 'moov_numero', 'moov_nom'].forEach(k => { if (b[k] !== undefined) valeurs[k] = String(b[k]).trim(); });
  ['mixx_actif', 'moov_actif'].forEach(k => { if (b[k] !== undefined) valeurs[k] = b[k] ? '1' : '0'; });
  if (b.prix_essentiel !== undefined) valeurs.prix_essentiel = Math.max(0, Number(b.prix_essentiel) || 0);
  if (b.prix_standard !== undefined) valeurs.prix_standard = Math.max(0, Number(b.prix_standard) || 0);
  if (b.cinetpay_apikey !== undefined) valeurs.cinetpay_apikey = String(b.cinetpay_apikey).trim();
  if (b.cinetpay_site_id !== undefined) valeurs.cinetpay_site_id = String(b.cinetpay_site_id).trim();
  if (b.cinetpay_mode !== undefined) valeurs.cinetpay_mode = b.cinetpay_mode === 'live' ? 'live' : 'test';
  if (b.paydunya_master_key !== undefined) valeurs.paydunya_master_key = String(b.paydunya_master_key).trim();
  if (b.paydunya_private_key !== undefined) valeurs.paydunya_private_key = String(b.paydunya_private_key).trim();
  if (b.paydunya_token !== undefined) valeurs.paydunya_token = String(b.paydunya_token).trim();
  if (b.paydunya_mode !== undefined) valeurs.paydunya_mode = b.paydunya_mode === 'live' ? 'live' : 'test';
  ['editeur_nom', 'editeur_sous_titre', 'editeur_ville', 'editeur_telephone', 'editeur_email'].forEach(k => {
    if (b[k] !== undefined) valeurs[k] = String(b[k]).slice(0, 200);
  });
  if (b.editeur_whatsapp !== undefined) valeurs.editeur_whatsapp = String(b.editeur_whatsapp).replace(/\D/g, '').slice(0, 15);
  P.ecrireReglages(db, valeurs);
  res.json({ ok: true, reglages: P.lireReglages(db) });
});

app.get('/api/admin/paiements', auth, roles('super_admin'), (req, res) => {
  const statut = req.query.statut;
  let rows = db.prepare(`SELECT p.*, e.nom AS ecole_nom, e.ville AS ecole_ville, e.statut AS ecole_statut,
      u.nom AS demandeur, v.nom AS valideur
    FROM paiements p JOIN etablissements e ON e.id = p.ecole_id
    LEFT JOIN utilisateurs u ON u.id = p.demande_par
    LEFT JOIN utilisateurs v ON v.id = p.valide_par
    ORDER BY CASE p.statut WHEN 'en_attente' THEN 0 ELSE 1 END, p.cree_le DESC`).all();
  if (statut) rows = rows.filter(r => r.statut === statut);
  const enAttente = db.prepare("SELECT COUNT(*) AS n FROM paiements WHERE statut = 'en_attente'").get().n;
  const encaisse = db.prepare("SELECT COALESCE(SUM(montant),0) AS s FROM paiements WHERE statut = 'paye'").get().s;
  res.json({ paiements: rows, en_attente: enAttente, encaisse });
});

app.patch('/api/admin/paiements/:id', auth, roles('super_admin'), (req, res) => {
  const p = db.prepare('SELECT * FROM paiements WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Paiement introuvable' });
  const action = (req.body && req.body.action) || '';
  if (p.statut === 'paye' && action === 'valider') return res.json({ ok: true, deja: true });
  if (action === 'valider') {
    const fin = validerPaiement(p, req.user.id);
    return res.json({ ok: true, statut: 'paye', date_fin_abonnement: fin });
  }
  if (action === 'rejeter') {
    db.prepare("UPDATE paiements SET statut = 'rejete', note = ?, valide_par = ?, valide_le = ? WHERE id = ?")
      .run(String((req.body && req.body.note) || 'Transaction non retrouvée').slice(0, 300), req.user.id, now(), p.id);
    return res.json({ ok: true, statut: 'rejete' });
  }
  res.status(400).json({ error: 'Action inconnue (valider ou rejeter)' });
});

/* ------------------------------------------------------------------ */
/* Pages imprimables (bulletins)                                       */
/* ------------------------------------------------------------------ */
app.get('/print/bulletin/:eleveId', auth, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const periodeId = Number(req.query.periode_id);
  if (!periodeId) return res.status(400).send('Période manquante');
  const mode = req.query.mode === 'composition' ? 'composition' : undefined;
  const data = bulletinData(db, ecoleId, Number(req.params.eleveId), periodeId, { mode });
  if (!data) return res.status(404).send('Élève introuvable');
  if (req.user.role === 'enseignant' && !canAccessClasse(req, data.eleve.classe_id)) return res.status(403).send('Accès refusé');
  if (req.user.role === 'eleve' && data.eleve.user_id !== req.user.id) return res.status(403).send('Accès refusé');
  if (req.user.role === 'eleve' && !(data.bulletin && data.bulletin.publie)) return res.status(403).send('Bulletin non encore publié');
  res.send(renderBulletin(data));
});
app.get('/print/classe/:classeId', auth, staffOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const classeId = Number(req.params.classeId);
  if (!canAccessClasse(req, classeId)) return res.status(403).send('Accès refusé');
  const periodeId = Number(req.query.periode_id);
  const periode = db.prepare('SELECT * FROM periodes WHERE id = ? AND ecole_id = ?').get(periodeId, ecoleId);
  if (!periode) return res.status(400).send('Période invalide');
  const mode = req.query.mode === 'composition' ? 'composition' : undefined;
  const promo = computeClasse(db, ecoleId, { classe_id: classeId, periode_id: periodeId, ...(mode ? { mode } : {}) });
  const eleves = db.prepare("SELECT id FROM eleves WHERE classe_id = ? AND statut = 'actif' ORDER BY nom, prenom").all(classeId);
  const bulletins = eleves.map(e => bulletinData(db, ecoleId, e.id, periodeId, { mode })).filter(Boolean);
  res.send(renderBulletinBatch(bulletins, periode));
});

app.get('/print/examen/:examenId', auth, staffOnly, (req, res) => {
  const ecoleId = ecoleOf(req, res); if (!ecoleId) return;
  const classeId = Number(req.query.classe_id);
  if (!classeId) return res.status(400).send('Classe manquante');
  if (!canAccessClasse(req, classeId)) return res.status(403).send('Accès refusé');
  const examen = db.prepare('SELECT * FROM examens WHERE id = ? AND ecole_id = ?').get(req.params.examenId, ecoleId);
  if (!examen) return res.status(404).send('Examen introuvable');
  const promo = computeClasse(db, ecoleId, { classe_id: classeId, examen_id: examen.id });
  if (!promo) return res.status(404).send('Introuvable');
  res.send(renderExamen(promo));
});

/* ------------------------------------------------------------------ */
/* Statique                                                            */
/* ------------------------------------------------------------------ */
// Fichiers envoyés sur le disque local (signatures, pièces jointes).
// Noms de fichiers aléatoires : un lien n'est pas devinable.
app.use(stockage.PUBLIC_PREFIX, express.static(stockage.MEDIA_DIR, {
  maxAge: '7d', fallthrough: true, index: false
}));

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('/app', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'app.html')));
app.get('/app/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'app.html')));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Sonde de santé (Docker, Render, Fly, load-balancers)
/**
 * Quelle base sert réellement ce site ? (réservé à la direction)
 * Répond à la question « suis-je sur TERMINISH ECOLE ou TERMINISH ECOLE 1 ? »
 * sans passer par le terminal.
 */
app.get('/api/base', auth, directionOnly, (req, res) => {
  const fs = require('node:fs');
  const dossier = path.join(__dirname, '..');
  const dossierDonnees = process.env.TERMINISH_DATA_DIR || path.join(dossier, 'data');
  const fichier = path.join(dossierDonnees, 'terminish-ecole.db');
  let info = { taille: null, modifie_le: null };
  try {
    const st = fs.statSync(fichier);
    info = { taille: st.size, modifie_le: st.mtime.toISOString() };
  } catch (_) { /* fichier encore absent */ }

  const compter = (table, ou = '') => {
    try { return db.prepare(`SELECT COUNT(*) AS n FROM ${table} ${ou}`).get().n; } catch { return null; }
  };
  let etablissements = [];
  try {
    etablissements = db.prepare('SELECT id, nom, ville, annee_scolaire FROM etablissements ORDER BY id').all();
  } catch (_) { /* table absente */ }

  let demo = false;
  try { demo = !!db.prepare("SELECT 1 FROM utilisateurs WHERE email LIKE '%@demo.tg' LIMIT 1").get(); } catch (_) {}
  if (!demo) demo = etablissements.some(e => /palmiers|saint-esprit|demo/i.test(e.nom || ''));

  res.json({
    dossier,
    nom_dossier: path.basename(dossier),
    dossier_donnees: dossierDonnees,
    fichier,
    ...info,
    mode: demo ? 'demo' : 'production',
    port: Number(PORT),
    compteurs: {
      etablissements: etablissements.length,
      eleves: compter('eleves'),
      classes: compter('classes'),
      notes: compter('notes'),
      bulletins: compter('bulletins'),
      enseignants: compter('utilisateurs', "WHERE role = 'enseignant'")
    },
    etablissements
  });
});

app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({
      ok: true,
      uptime: Math.round(process.uptime()),
      version: require('../package.json').version,
      // permet de vérifier en une requête QUELLE installation répond
      installation: path.basename(path.join(__dirname, '..')),
      port: Number(PORT)
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'base de données indisponible' });
  }
});

// ------------------------------------------------------------------ écoute
// Certains hébergeurs (alwaysdata, Render…) imposent l'adresse et le port :
//   $IP   l'adresse sur laquelle écouter (souvent une adresse IPv6)
//   $PORT le port attribué au site
// Si $IP est absent, on essaie « :: » (IPv6 *et* IPv4 sur la même socket),
// puis « 0.0.0.0 ». Sans cela, un proxy qui joint le site en IPv6 ne trouve
// personne et l'hébergeur affiche « Upstream not ready ».
const ADRESSES = [process.env.IP, process.env.HOST, '::', '0.0.0.0']
  .filter((a, i, liste) => a && liste.indexOf(a) === i);

let server = null;   // affecté dès que l'écoute réussit

function ecouter(i) {
  const hote = ADRESSES[i];
  if (!hote) {
    console.error(`Aucune adresse d'écoute disponible (port ${PORT}) — arrêt.`);
    process.exit(1);
  }
  const essai = app.listen(PORT, hote, () => {
    server = essai;
    console.log(`Terminish École — serveur démarré sur http://${hote}:${PORT}`);
    console.log(`Données : ${process.env.TERMINISH_DATA_DIR || path.join(__dirname, '..', 'data')}`);
  });
  essai.on('error', err => {
    console.error(`Écoute impossible sur ${hote}:${PORT} (${err.code || err.message})`);
    try { essai.close(); } catch (_) {}
    setTimeout(() => ecouter(i + 1), 50);
  });
  return essai;
}

ecouter(0);

// Arrêt propre (docker stop, systemctl stop, redéploiement)
['SIGTERM', 'SIGINT'].forEach(sig => {
  process.on(sig, () => {
    console.log(`\n${sig} reçu — arrêt du serveur...`);
    if (!server) process.exit(0);
    server.close(() => {
      try { db.close(); } catch (_) {}
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 8000).unref();
  });
});
