'use strict';
/** La production ne doit jamais publier ni créer des identifiants de démonstration par défaut. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const racine = path.join(__dirname, '..');

function initialiser(mode) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'terminish-securite-demo-'));
  try {
    const env = { ...process.env, TERMINISH_DATA_DIR: dossier,
      ADMIN_EMAIL: 'admin-securite@test.invalid', ADMIN_PASSWORD: 'test-local-unique-2026' };
    delete env.TERMINISH_SEED;
    if (mode) env.TERMINISH_SEED = mode;
    const resultat = spawnSync(process.execPath, ['-e', 'require("./server/db")'], {
      cwd: racine, env, encoding: 'utf8', timeout: 15000
    });
    assert.equal(resultat.status, 0, resultat.stderr || resultat.error?.message);
    const db = new DatabaseSync(path.join(dossier, 'terminish-ecole.db'));
    try {
      return {
        ecoles: db.prepare('SELECT COUNT(*) AS n FROM etablissements').get().n,
        demo: db.prepare("SELECT COUNT(*) AS n FROM utilisateurs WHERE email LIKE '%@demo.tg'").get().n,
        admins: db.prepare("SELECT COUNT(*) AS n FROM utilisateurs WHERE role = 'super_admin'").get().n
      };
    } finally { db.close(); }
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
}

test('Sans configuration, une base neuve ne crée ni école ni compte de démonstration', () => {
  assert.deepEqual(initialiser(), { ecoles: 0, demo: 0, admins: 1 });
});

test('Le mode de démonstration reste une option explicite pour les essais locaux', () => {
  const base = initialiser('demo');
  assert.equal(base.ecoles, 2);
  assert.ok(base.demo > 0);
  assert.equal(base.admins, 1);
});

test('Le formulaire de connexion public ne révèle pas les identifiants de démonstration', () => {
  const source = fs.readFileSync(path.join(racine, 'public/js/app.js'), 'utf8');
  assert.doesNotMatch(source, /data-demo|demo1234|prof1234|eleve1234|admin1234/);
});
