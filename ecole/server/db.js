'use strict';
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Dossier des données (base SQLite) : surchargeable pour un volume Docker/hébergeur
const DATA_DIR = process.env.TERMINISH_DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'terminish-ecole.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS etablissements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'mixte',          -- college | lycee | mixte
  ville TEXT, adresse TEXT, bp TEXT, telephone TEXT, email TEXT,
  devise TEXT DEFAULT 'FCFA',
  logo TEXT,                                    -- data URL
  chef_nom TEXT, chef_titre TEXT DEFAULT 'Le Chef d''Établissement',
  annee_scolaire TEXT DEFAULT '2025-2026',
  formule_moyenne TEXT DEFAULT 'co2',           -- co2 | moy_co | tiers
  plan TEXT DEFAULT 'essai',                    -- essai | essentiel | standard | reseau
  statut TEXT DEFAULT 'essai',                  -- essai | actif | suspendu
  date_fin_abonnement TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS utilisateurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mot_de_passe TEXT NOT NULL,
  role TEXT NOT NULL,                           -- super_admin | directeur | enseignant | eleve
  telephone TEXT,
  actif INTEGER DEFAULT 1,
  cree_le TEXT NOT NULL,
  derniere_connexion TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  expire_le TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  niveau TEXT,
  cycle TEXT NOT NULL DEFAULT 'college',        -- college | lycee
  serie TEXT,
  annee TEXT,
  titulaire TEXT
);

CREATE TABLE IF NOT EXISTS matieres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  code TEXT,
  groupe TEXT DEFAULT 'Autres'
);

CREATE TABLE IF NOT EXISTS classe_matieres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  classe_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  matiere_id INTEGER NOT NULL REFERENCES matieres(id) ON DELETE CASCADE,
  coefficient REAL NOT NULL DEFAULT 1,
  UNIQUE(classe_id, matiere_id)
);

CREATE TABLE IF NOT EXISTS eleves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  matricule TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  sexe TEXT DEFAULT 'M',
  date_naissance TEXT,
  lieu_naissance TEXT,
  classe_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  tuteur_nom TEXT,
  tuteur_tel TEXT,
  statut TEXT DEFAULT 'actif',
  user_id INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le TEXT NOT NULL,
  UNIQUE(ecole_id, matricule)
);

CREATE TABLE IF NOT EXISTS periodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                            -- T1 | T2 | T3 | S1 | S2
  libelle TEXT NOT NULL,
  cycle TEXT NOT NULL DEFAULT 'college',         -- college | lycee
  ordre INTEGER NOT NULL,
  statut TEXT DEFAULT 'ouverte',                 -- ouverte | fermee
  date_debut TEXT, date_fin TEXT,
  UNIQUE(ecole_id, code)
);

CREATE TABLE IF NOT EXISTS affectations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  enseignant_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  classe_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  matiere_id INTEGER NOT NULL REFERENCES matieres(id) ON DELETE CASCADE,
  UNIQUE(enseignant_id, classe_id, matiere_id)
);

CREATE TABLE IF NOT EXISTS examens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  periode_id INTEGER REFERENCES periodes(id) ON DELETE SET NULL,
  date_debut TEXT, date_fin TEXT,
  statut TEXT DEFAULT 'prepare',                 -- prepare | en_cours | termine
  cree_le TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS epreuves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  examen_id INTEGER NOT NULL REFERENCES examens(id) ON DELETE CASCADE,
  classe_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  matiere_id INTEGER NOT NULL REFERENCES matieres(id) ON DELETE CASCADE,
  date_epreuve TEXT, heure TEXT, duree INTEGER DEFAULT 120,
  coefficient REAL DEFAULT 1, bareme REAL DEFAULT 20,
  salle TEXT
);

CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  classe_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  matiere_id INTEGER NOT NULL REFERENCES matieres(id) ON DELETE CASCADE,
  periode_id INTEGER REFERENCES periodes(id) ON DELETE CASCADE,
  epreuve_id INTEGER REFERENCES epreuves(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                            -- devoir1 | devoir2 | composition | blanc
  libelle TEXT,
  bareme REAL DEFAULT 20,
  cree_le TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  eleve_id INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  valeur REAL,
  absent INTEGER DEFAULT 0,
  saisi_par INTEGER,
  modifie_le TEXT NOT NULL,
  UNIQUE(evaluation_id, eleve_id)
);

CREATE TABLE IF NOT EXISTS bulletins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  eleve_id INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  periode_id INTEGER NOT NULL REFERENCES periodes(id) ON DELETE CASCADE,
  appreciation TEXT,
  decision TEXT,
  publie INTEGER DEFAULT 0,
  publie_le TEXT,
  UNIQUE(eleve_id, periode_id)
);

CREATE TABLE IF NOT EXISTS paiements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  montant REAL, devise TEXT DEFAULT 'FCFA',
  plan TEXT, reference TEXT, statut TEXT DEFAULT 'paye',
  periode_debut TEXT, periode_fin TEXT,
  cree_le TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reglages (
  cle TEXT PRIMARY KEY,
  valeur TEXT
);

CREATE TABLE IF NOT EXISTS demandes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT, etablissement TEXT, ville TEXT,
  email TEXT, telephone TEXT, effectif TEXT, message TEXT,
  statut TEXT DEFAULT 'nouveau',
  cree_le TEXT NOT NULL
);

-- Demandes de réinitialisation de mot de passe (« mot de passe oublié »).
-- Sans service d'e-mail, la demande est déposée ici : le chef d'établissement
-- la voit dans sa console et régénère les identifiants en un clic.
CREATE TABLE IF NOT EXISTS demandes_mdp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecole_id INTEGER,
  email TEXT NOT NULL,
  role TEXT,
  message TEXT,
  statut TEXT NOT NULL DEFAULT 'nouvelle',   -- nouvelle | traitee | ignoree
  cree_le TEXT NOT NULL,
  traite_le TEXT,
  traite_par INTEGER
);

CREATE INDEX IF NOT EXISTS idx_eleves_ecole ON eleves(ecole_id, classe_id);
CREATE INDEX IF NOT EXISTS idx_demandes_mdp ON demandes_mdp(ecole_id, statut);
CREATE INDEX IF NOT EXISTS idx_paiements_ecole ON paiements(ecole_id, cree_le);
CREATE INDEX IF NOT EXISTS idx_notes_eval ON notes(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_evals_scope ON evaluations(ecole_id, classe_id, periode_id);
CREATE INDEX IF NOT EXISTS idx_affect_ens ON affectations(enseignant_id);
`);

/* ------------------------------------------------------------------ */
/* Migrations légères (colonnes ajoutées après coup)                   */
/* ------------------------------------------------------------------ */
function ensureColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}
ensureColumn('paiements', 'operateur', 'TEXT');
ensureColumn('paiements', 'telephone_payeur', 'TEXT');
ensureColumn('paiements', 'transaction_ref', 'TEXT');
ensureColumn('paiements', 'demande_par', 'INTEGER');
ensureColumn('paiements', 'valide_par', 'INTEGER');
ensureColumn('paiements', 'valide_le', 'TEXT');
ensureColumn('paiements', 'note', 'TEXT');
ensureColumn('paiements', 'mois', 'INTEGER DEFAULT 1');
ensureColumn('paiements', 'canal', "TEXT DEFAULT 'manuel'");
// Miroir Cloudinary du logo d'établissement (facultatif) : la data URL reste
// la source de vérité, `logo_url` n'est qu'une copie optimisée sur le CDN.
ensureColumn('etablissements', 'logo_url', 'TEXT');
ensureColumn('etablissements', 'logo_public_id', 'TEXT');
// En-tête officiel du bulletin (ministère, tutelle, région…), librement rédigé
// par chaque établissement. NULL = valeur par défaut ; '' = ligne masquée.
ensureColumn('etablissements', 'tutelle', 'TEXT');

// Bulletin : signature manuscrite scannée de l'enseignant (importée une fois),
// professeur principal de la classe, et signature du chef d'établissement.
ensureColumn('utilisateurs', 'signature', 'TEXT');
ensureColumn('utilisateurs', 'signature_provider', 'TEXT');
ensureColumn('classes', 'titulaire_id', 'INTEGER');

db.prepare('CREATE INDEX IF NOT EXISTS idx_paiements_statut ON paiements(statut)').run();

/* Réglages de la plateforme (Mobile Money, tarifs, CinetPay) */
const REGLAGES_DEFAUT = {
  mixx_numero: '+228 93 15 01 78',
  mixx_nom: 'TERMINISH ÉCOLE',
  mixx_actif: '1',
  moov_numero: '+228 97 24 30 86',
  moov_nom: 'TERMINISH ÉCOLE',
  moov_actif: '1',
  prix_essentiel: '15000',
  prix_standard: '25000',
  paydunya_master_key: '',
  paydunya_private_key: '',
  paydunya_token: '',
  paydunya_mode: 'test',
  editeur_nom: 'Terminish École',
  editeur_sous_titre: 'Plateforme de gestion scolaire · Bulletins, notes et statistiques',
  editeur_ville: 'Lomé, Togo',
  editeur_telephone: '+228 93 15 01 78',
  editeur_email: 'contact@terminish-ecole.com',
  editeur_whatsapp: '22893150178'
};
const insertReglage = db.prepare('INSERT OR IGNORE INTO reglages (cle, valeur) VALUES (?,?)');
Object.entries(REGLAGES_DEFAUT).forEach(([k, v]) => insertReglage.run(k, v));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  try {
    const [, salt, hash] = String(stored).split('$');
    const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch { return false; }
}
const now = () => new Date().toISOString();
const addDays = (days) => new Date(Date.now() + days * 864e5).toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function createEtablissement(data) {
  const stmt = db.prepare(`INSERT INTO etablissements
    (nom, type, ville, adresse, bp, telephone, email, devise, logo, chef_nom, chef_titre,
     annee_scolaire, formule_moyenne, plan, statut, date_fin_abonnement, tutelle, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const info = stmt.run(
    data.nom, data.type || 'mixte', data.ville || '', data.adresse || '', data.bp || '',
    data.telephone || '', data.email || '', data.devise || 'FCFA', data.logo || null,
    data.chef_nom || '', data.chef_titre || "Le Chef d'Établissement",
    data.annee_scolaire || '2025-2026', data.formule_moyenne || 'co2',
    data.plan || 'essai', data.statut || 'essai', data.date_fin_abonnement || addDays(30),
    data.tutelle == null ? null : String(data.tutelle), now()
  );
  const ecoleId = Number(info.lastInsertRowid);
  seedPeriodes(ecoleId, data.type || 'mixte');
  return ecoleId;
}

function seedPeriodes(ecoleId, type) {
  const insert = db.prepare(`INSERT OR IGNORE INTO periodes
    (ecole_id, code, libelle, cycle, ordre, statut, date_debut, date_fin) VALUES (?,?,?,?,?,?,?,?)`);
  if (type === 'college' || type === 'mixte') {
    [['T1', '1er Trimestre', '2025-09-15', '2025-12-19'],
     ['T2', '2ème Trimestre', '2026-01-05', '2026-03-27'],
     ['T3', '3ème Trimestre', '2026-04-13', '2026-06-26']].forEach(([code, libelle, d, f], i) => {
      insert.run(ecoleId, code, libelle, 'college', i + 1, 'ouverte', d, f);
    });
  }
  if (type === 'lycee' || type === 'mixte') {
    [['S1', '1er Semestre', '2025-09-15', '2026-01-23'],
     ['S2', '2ème Semestre', '2026-02-09', '2026-06-26']].forEach(([code, libelle, d, f], i) => {
      insert.run(ecoleId, code, libelle, 'lycee', i + 1, 'ouverte', d, f);
    });
  }
}

function createUser({ ecole_id = null, nom, email, password, role, telephone = '' }) {
  const info = db.prepare(`INSERT INTO utilisateurs (ecole_id, nom, email, mot_de_passe, role, telephone, actif, cree_le)
    VALUES (?,?,?,?,?,?,1,?)`).run(ecole_id, nom, String(email).toLowerCase().trim(),
    hashPassword(password), role, telephone, now());
  return Number(info.lastInsertRowid);
}

/* ------------------------------------------------------------------ */
/* Seed de démonstration                                               */
/* ------------------------------------------------------------------ */
const DEMO_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0b3d2e"/><stop offset="1" stop-color="#1f9d6b"/></linearGradient></defs>
  <circle cx="60" cy="60" r="56" fill="url(#g)" stroke="#f0b429" stroke-width="4"/>
  <path d="M60 26 L94 42 L60 58 L26 42 Z" fill="#f0b429"/>
  <path d="M38 50 v18 c0 10 22 14 22 14 s22 -4 22 -14 V50" fill="none" stroke="#fff" stroke-width="4"/>
  <path d="M94 42 v22" stroke="#f0b429" stroke-width="3"/>
  <circle cx="94" cy="68" r="4" fill="#f0b429"/>
</svg>`)}`;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMS = ['ADJOVI', 'AGBODJAN', 'AKAKPO', 'AMOUZOU', 'ATTIOGBE', 'AYIVI', 'BALOUKI', 'DOSSEH', 'GNASSINGBE',
  'HOUNKPATI', 'JOHNSON', 'KOFFI', 'KOUASSI', 'LAWSON', 'MENSAH', 'NAPO', 'OURO-DJERI', 'SEDDOH', 'TCHALLA',
  'TOGBE', 'ZINSOU', 'ADJALLE', 'BATAKA', 'COMBEY', 'DAGBE', 'EKLOU', 'FIAWOO', 'GBAGUIDI', 'HODABALO'];
const PRENOMS_M = ['Koffi', 'Komlan', 'Yaovi', 'Kossi', 'Dodji', 'Messan', 'Kodjo', 'Elom', 'Ablavi', 'Sena',
  'Mawuli', 'Kodjo', 'Fabrice', 'Emmanuel', 'Ismaël', 'Abdoul', 'Rachidou', 'Benoît', 'Cédric', 'Hervé'];
const PRENOMS_F = ['Ama', 'Akossiwa', 'Yawa', 'Abra', 'Délali', 'Sitou', 'Afiavi', 'Eyram', 'Mawuéna', 'Kafui',
  'Adjovi', 'Gisèle', 'Christelle', 'Mariam', 'Fatou', 'Rolande', 'Sylvie', 'Akouvi', 'Eunice', 'Léa'];

function seedAdmin() {
  const deja = db.prepare("SELECT COUNT(*) AS n FROM utilisateurs WHERE role = 'super_admin'").get();
  if (Number(deja.n) > 0) return;

  const email = String(process.env.ADMIN_EMAIL || 'admin@terminish.tg').trim().toLowerCase();
  const nom = String(process.env.ADMIN_NOM || 'Administrateur Terminish').trim();
  const motDePasse = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');

  createUser({ ecole_id: null, nom, email, password: motDePasse, role: 'super_admin' });

  const ligne = '='.repeat(58);
  console.log(ligne);
  console.log('  Compte administrateur créé');
  console.log(`  Identifiant : ${email}`);
  if (process.env.ADMIN_PASSWORD) {
    console.log('  Mot de passe : celui fourni dans ADMIN_PASSWORD');
  } else {
    console.log(`  Mot de passe : ${motDePasse}`);
    console.log('  NOTE : ce mot de passe est généré une seule fois. Notez-le, puis');
    console.log('  changez-le depuis le menu « Mon compte » de la console.');
  }
  console.log(ligne);
}

function seedDemo() {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM etablissements').get();
  if (Number(existing.n) > 0) return;

  const ecoleId = createEtablissement({
    nom: 'Complexe Scolaire Les Palmiers',
    type: 'mixte',
    ville: 'Lomé', adresse: 'Rue des Palmiers, Quartier Bè-Kpota',
    bp: 'BP 8142 Lomé', telephone: '+228 22 34 56 78',
    email: 'contact@palmiers.tg', logo: DEMO_LOGO,
    chef_nom: 'M. Kodjo AMEGAN', chef_titre: "Le Chef d'Établissement",
    annee_scolaire: '2025-2026', plan: 'standard', statut: 'actif',
    date_fin_abonnement: addDays(240)
  });

  createUser({ ecole_id: ecoleId, nom: 'M. Kodjo AMEGAN', email: 'directeur@demo.tg', password: 'demo1234', role: 'directeur', telephone: '+228 90 11 22 33' });
  createUser({ ecole_id: null, nom: 'Administrateur Terminish', email: 'admin@terminish.tg', password: 'admin1234', role: 'super_admin' });

  const matieres = [
    ['Mathématiques', 'MATH', 'Scientifique'], ['Physique-Chimie', 'PC', 'Scientifique'],
    ['Sciences de la Vie et de la Terre', 'SVT', 'Scientifique'], ['Français', 'FR', 'Littéraire'],
    ['Anglais', 'ANG', 'Littéraire'], ['Histoire-Géographie', 'HG', 'Littéraire'],
    ['Éducation Civique et Morale', 'ECM', 'Autres'], ['Éducation Physique et Sportive', 'EPS', 'Autres']
  ].map(([nom, code, groupe]) => {
    const info = db.prepare('INSERT INTO matieres (ecole_id, nom, code, groupe) VALUES (?,?,?,?)').run(ecoleId, nom, code, groupe);
    return { id: Number(info.lastInsertRowid), nom, code };
  });

  const classesDef = [
    { nom: '6ème A', niveau: '6ème', cycle: 'college', coefs: [4, 2, 2, 4, 3, 2, 1, 1], titulaire: 'Mme Akossiwa DOSSEH' },
    { nom: '5ème A', niveau: '5ème', cycle: 'college', coefs: [4, 3, 2, 4, 3, 2, 1, 1], titulaire: 'M. Komlan AGBEKO' },
    { nom: '4ème A', niveau: '4ème', cycle: 'college', coefs: [4, 3, 3, 4, 3, 2, 1, 1], titulaire: 'M. Yaovi MENSAH' },
    { nom: '3ème A', niveau: '3ème', cycle: 'college', coefs: [5, 4, 3, 4, 3, 3, 2, 1], titulaire: 'Mme Eyram LAWSON' },
    { nom: '2nde A', niveau: '2nde', cycle: 'lycee', serie: 'A', coefs: [4, 2, 2, 5, 3, 3, 2, 1], titulaire: 'Mme Akossiwa DOSSEH' },
    { nom: '1ère D', niveau: '1ère', cycle: 'lycee', serie: 'D', coefs: [6, 5, 4, 3, 2, 2, 1, 1], titulaire: 'M. Komlan AGBEKO' },
    { nom: 'Tle D', niveau: 'Tle', cycle: 'lycee', serie: 'D', coefs: [7, 6, 4, 3, 2, 2, 1, 1], titulaire: 'M. Yaovi MENSAH' }
  ];
  const classes = classesDef.map(c => {
    const info = db.prepare('INSERT INTO classes (ecole_id, nom, niveau, cycle, serie, annee, titulaire) VALUES (?,?,?,?,?,?,?)')
      .run(ecoleId, c.nom, c.niveau, c.cycle, c.serie || '', '2025-2026', c.titulaire || '');
    const id = Number(info.lastInsertRowid);
    matieres.forEach((m, i) => {
      db.prepare('INSERT INTO classe_matieres (classe_id, matiere_id, coefficient) VALUES (?,?,?)').run(id, m.id, c.coefs[i]);
    });
    return { id, ...c };
  });

  // Enseignants
  const nomsEns = [
    ['M. Komlan AGBEKO', 'prof.maths@demo.tg', 'Mathématiques'],
    ['Mme Akossiwa DOSSEH', 'prof.francais@demo.tg', 'Français'],
    ['M. Yaovi MENSAH', 'prof.pc@demo.tg', 'Physique-Chimie'],
    ['Mme Eyram LAWSON', 'prof.anglais@demo.tg', 'Anglais']
  ];
  nomsEns.forEach(([nom, email, matiereNom]) => {
    const uid = createUser({ ecole_id: ecoleId, nom, email, password: 'prof1234', role: 'enseignant', telephone: '+228 91 00 00 00' });
    const m = matieres.find(x => x.nom === matiereNom);
    classes.forEach(c => {
      db.prepare('INSERT INTO affectations (ecole_id, enseignant_id, classe_id, matiere_id) VALUES (?,?,?,?)')
        .run(ecoleId, uid, c.id, m.id);
    });
  });

  // Élèves
  const rand = mulberry32(20252026);
  const eleves = [];
  let compteur = 0;
  classes.forEach((c, ci) => {
    const effectif = 18 + Math.floor(rand() * 5);
    for (let i = 0; i < effectif; i++) {
      compteur++;
      const sexe = rand() > 0.48 ? 'F' : 'M';
      const prenom = sexe === 'F' ? PRENOMS_F[Math.floor(rand() * PRENOMS_F.length)] : PRENOMS_M[Math.floor(rand() * PRENOMS_M.length)];
      const nom = NOMS[Math.floor(rand() * NOMS.length)];
      const matricule = `${2025}${String(compteur).padStart(4, '0')}`;
      const age = 11 + ci + Math.floor(rand() * 3);
      const anneeNaiss = 2025 - age;
      const info = db.prepare(`INSERT INTO eleves
        (ecole_id, matricule, nom, prenom, sexe, date_naissance, lieu_naissance, classe_id, tuteur_nom, tuteur_tel, statut, cree_le)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'actif', ?)`).run(
        ecoleId, matricule, nom, prenom, sexe,
        `${anneeNaiss}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 27)).padStart(2, '0')}`,
        'Lomé', c.id, `${prenom.toUpperCase()} ${nom}`, `+228 9${Math.floor(rand() * 9)} ${String(Math.floor(rand() * 90 + 10))} ${String(Math.floor(rand() * 90 + 10))}`,
        now()
      );
      eleves.push({ id: Number(info.lastInsertRowid), classe_id: c.id, niveau: ci, force: rand(), nom, prenom, sexe });
    }
  });

  // Un compte élève / parent de démonstration (un élève parmi les meilleurs de la 6ème A)
  const eleveDemo = eleves.filter(e => e.classe_id === classes[0].id).sort((a, b) => b.force - a.force)[0] || eleves[0];
  const uidEleve = createUser({
    ecole_id: ecoleId,
    nom: `${eleveDemo.nom} ${eleveDemo.prenom}`, email: 'eleve@demo.tg', password: 'eleve1234', role: 'eleve'
  });
  db.prepare('UPDATE eleves SET user_id = ? WHERE id = ?').run(uidEleve, eleveDemo.id);

  // Périodes
  const periodes = db.prepare('SELECT * FROM periodes WHERE ecole_id = ?').all(ecoleId);
  const pT1 = periodes.find(p => p.code === 'T1');
  const pT2 = periodes.find(p => p.code === 'T2');
  const pS1 = periodes.find(p => p.code === 'S1');
  const pS2 = periodes.find(p => p.code === 'S2');

  // Évaluations + notes
  const insertEval = db.prepare(`INSERT INTO evaluations (ecole_id, classe_id, matiere_id, periode_id, type, libelle, bareme, cree_le)
    VALUES (?,?,?,?,?,?,20,?)`);
  const insertNote = db.prepare(`INSERT INTO notes (evaluation_id, eleve_id, valeur, absent, saisi_par, modifie_le)
    VALUES (?,?,?,0,NULL,?)`);

  const scope = [
    { periode: pT1, complet: true },
    { periode: pS1, complet: true },
    { periode: pT2, complet: false },
    { periode: pS2, complet: false }
  ];

  classes.forEach((c, ci) => {
    const elevesClasse = eleves.filter(e => e.classe_id === c.id);
    scope.forEach(({ periode, complet }) => {
      if (!periode || periode.cycle !== c.cycle) return;
      const profilClasse = 11.1 + (ci % 3) * 0.5;
      matieres.forEach((m, mi) => {
        if (!complet && mi > 3) return; // saisie en cours ailleurs
        ['devoir1', 'devoir2', 'composition'].forEach((type, ti) => {
          if (!complet && mi > 2) return;
          if (!complet && ti === 2 && mi > 1) return;
          const libelle = type === 'composition' ? 'Composition' : `Devoir ${ti + 1}`;
          const evId = Number(insertEval.run(ecoleId, c.id, m.id, periode.id, type, libelle, now()).lastInsertRowid);
          elevesClasse.forEach(e => {
            const niveauEleve = profilClasse + (e.force - 0.5) * 6.5;
            const bruit = (rand() - 0.5) * 5;
            const note = Math.max(1, Math.min(20, niveauEleve + bruit + (rand() - 0.5) * 3));
            insertNote.run(evId, e.id, Math.round(note * 2) / 2, now());
          });
        });
      });
    });
  });

  // Examen blanc de démonstration (Tle D)
  const tle = classes.find(c => c.nom === 'Tle D');
  const exInfo = db.prepare(`INSERT INTO examens (ecole_id, nom, periode_id, date_debut, date_fin, statut, cree_le)
    VALUES (?,?,?,?,?,?,?)`).run(ecoleId, 'Examen Blanc n°1 — Tle D', pS1.id, today(), today(), 'termine', now());
  const examenId = Number(exInfo.lastInsertRowid);
  [0, 1, 2, 3].forEach(mi => {
    const m = matieres[mi];
    const coef = [7, 6, 4, 3][mi];
    const ep = db.prepare(`INSERT INTO epreuves (ecole_id, examen_id, classe_id, matiere_id, date_epreuve, heure, duree, coefficient, bareme, salle)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(ecoleId, examenId, tle.id, m.id, today(), '08:00', mi < 2 ? 240 : 120, coef, 20, 'Salle A1');
    const epId = Number(ep.lastInsertRowid);
    const ev = db.prepare(`INSERT INTO evaluations (ecole_id, classe_id, matiere_id, periode_id, epreuve_id, type, libelle, bareme, cree_le)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(ecoleId, tle.id, m.id, pS1.id, epId, 'blanc', `Épreuve ${m.nom}`, 20, now());
    const evId = Number(ev.lastInsertRowid);
    eleves.filter(e => e.classe_id === tle.id).forEach(e => {
      const note = Math.max(2, Math.min(20, 8.5 + (e.force - 0.5) * 6 + (rand() - 0.5) * 4));
      insertNote.run(evId, e.id, Math.round(note * 2) / 2, now());
    });
  });

  // Bulletin déjà publié pour l'élève de démonstration (visible dans son espace)
  if (pT1) {
    db.prepare(`INSERT OR IGNORE INTO bulletins (ecole_id, eleve_id, periode_id, appreciation, decision, publie, publie_le)
      VALUES (?,?,?,?,?,1,?)`).run(ecoleId, eleveDemo.id, pT1.id,
      "Élève sérieux et appliqué, très bonne progression tout au long du trimestre. Continue ainsi ! Le conseil de classe t'encourage à viser l'excellence.",
      'Encouragements', now());
  }

  // Un deuxième établissement (essai) pour la console multi-tenant
  const ecole2 = createEtablissement({
    nom: 'Collège Saint-Esprit', type: 'college', ville: 'Kpalimé',
    telephone: '+228 24 00 00 00', email: 'contact@saintesprit.tg', logo: DEMO_LOGO,
    chef_nom: 'Mme Afiavi SEDDOH', plan: 'essentiel', statut: 'essai', date_fin_abonnement: addDays(12)
  });
  createUser({ ecole_id: ecole2, nom: 'Mme Afiavi SEDDOH', email: 'direction@saintesprit.tg', password: 'demo1234', role: 'directeur' });

  // Une demande de paiement en attente de vérification (démo du module Mobile Money)
  db.prepare(`INSERT INTO paiements (ecole_id, montant, devise, plan, reference, statut, periode_debut, periode_fin,
    operateur, telephone_payeur, transaction_ref, canal, mois, note, cree_le)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(ecole2, 15000, 'FCFA', 'essentiel', 'PAY-DEMO-002', 'en_attente',
    today(), addDays(30).slice(0, 10), 'moov', '+228 91 78 22 10', 'FLOOZ-784512', 'manuel', 1,
    'Renouvellement Essentiel 1 mois', now());

  // Paiement de démonstration
  db.prepare(`INSERT INTO paiements (ecole_id, montant, devise, plan, reference, statut, periode_debut, periode_fin,
    operateur, telephone_payeur, transaction_ref, canal, mois, cree_le, valide_le)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(ecoleId, 25000, 'FCFA', 'standard', 'PAY-DEMO-001', 'paye',
    today(), addDays(240).slice(0, 10), 'mixx', '+228 90 11 22 33', 'MP251021.1432.A12345', 'manuel', 1, now(), now());

  // Numéros marchands de l'éditeur (modifiables dans la console éditeur)
  const setReg = db.prepare('UPDATE reglages SET valeur = ? WHERE cle = ?');
  setReg.run('+228 93 15 01 78', 'mixx_numero');
  setReg.run('TERMINISH ÉCOLE', 'mixx_nom');
  setReg.run('+228 97 24 30 86', 'moov_numero');
  setReg.run('TERMINISH ÉCOLE', 'moov_nom');

  // Demandes entrantes (leads)
  const leads = [
    ['M. Serge KOUDADJE', 'Lycée Moderne d\'Atakpamé', 'Atakpamé', 's.koudadje@example.tg', '+228 90 45 12 33', '850', 'Nous souhaitons informatiser les bulletins dès ce trimestre.'],
    ['Mme Délali AMOUZOU', 'Cours Privé La Colombe', 'Lomé', 'lacolombe@example.tg', '+228 91 78 22 10', '320', 'Demande de devis pour 3 cycles.'],
    ['Frère Jean ATTIOGBE', 'Collège Notre-Dame', 'Tsévié', 'nd.tsvie@example.tg', '+228 92 33 44 55', '480', 'Intéressé par l\'essai gratuit.']
  ];
  leads.forEach(l => db.prepare(`INSERT INTO demandes (nom, etablissement, ville, email, telephone, effectif, message, statut, cree_le)
    VALUES (?,?,?,?,?,?,?, 'nouveau', ?)`).run(...l, now()));
}

// Mode `demo` (défaut) : jeu de données complet pour découvrir l'application.
// Mode `prod` : aucun établissement de démonstration, seulement le compte administrateur.
const SEED_MODE = String(process.env.TERMINISH_SEED || 'demo').toLowerCase();
if (SEED_MODE === 'demo') {
  seedDemo();
} else {
  seedAdmin();
}

module.exports = { db, hashPassword, verifyPassword, createEtablissement, createUser, seedPeriodes, now, today, addDays, ensureColumn };
