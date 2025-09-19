const express = require('express');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const LOG_DIR = process.env.LOG_DIR || '/var/logs/crud';
const APP_LOG = path.join(LOG_DIR, 'app.log');

function ensureLogsDir() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    try { fs.chmodSync(LOG_DIR, 0o777); } catch(_) {}
  } catch (err) {
    console.error('Impossible de créer dossier logs:', err.message);
  }
}

function log(level, message, context = {}) {
  const entry = { timestamp: new Date().toISOString(), level, message, context };
  const line = JSON.stringify(entry) + '\n';
  try {
    fs.appendFileSync(APP_LOG, line);
  } catch (err) {
    console.error('Erreur écriture log fichier:', err.message);
  }
  console.log(`[${level}] ${message}`, context);
}

// Config DB via variables d’environnement
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crud_app',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  multipleStatements: true
};

let pool;

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL
      );
    `);

    const files = await fsp.readdir(migrationsDir).catch(() => []);
    files.sort();

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;
      const [rows] = await pool.execute('SELECT id FROM migrations WHERE id = ?', [file]);
      if (rows.length > 0) continue;

      const sql = await fsp.readFile(path.join(migrationsDir, file), 'utf8');
      log('INFO', 'Applying migration', { file });
      await pool.query(sql);
      await pool.execute('INSERT INTO migrations (id, applied_at) VALUES (?, ?)', [file, new Date()]);
      log('INFO', 'Migration applied', { file });
    }
  } catch (err) {
    log('ERROR', 'Erreur migrations', { error: err.message });
    throw err;
  }
}

async function initDatabase() {
  ensureLogsDir();
  try {
    pool = mysql.createPool(dbConfig);
    await runMigrations();
    log('INFO', 'Database initialized and migrations applied');
  } catch (err) {
    log('ERROR', 'Erreur initialisation DB', { error: err.message });
    throw err;
  }
}

function validateUser(userData) {
  const { fullname, study_level, age } = userData || {};
  if (!fullname || !study_level || age === undefined || age === null) return false;
  if (typeof age !== 'number') return false;
  if (!Number.isInteger(age) || age <= 0) return false;
  return true;
}

// Routes

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users');
    log('INFO', 'GET /api/users', { count: rows.length });
    res.status(200).json(rows);
  } catch (err) {
    log('ERROR', 'GET /api/users failed', { error: err.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/users/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const [rows] = await pool.execute('SELECT * FROM users WHERE uuid = ?', [uuid]);
    if (rows.length === 0) {
      log('WARN', 'GET /api/users/:uuid - not found', { uuid });
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    log('INFO', 'GET /api/users/:uuid - found', { uuid });
    res.status(200).json(rows[0]);
  } catch (err) {
    log('ERROR', 'GET /api/users/:uuid failed', { error: err.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { fullname, study_level, age } = req.body;
    if (!validateUser(req.body)) {
      log('WARN', 'POST /api/users - invalid data', { body: req.body });
      return res.status(400).json({ error: 'Données invalides' });
    }
    const uuid = uuidv4();
    await pool.execute(
      'INSERT INTO users (uuid, fullname, study_level, age) VALUES (?, ?, ?, ?)',
      [uuid, fullname, study_level, age]
    );
    log('INFO', 'POST /api/users - created', { uuid });
    res.status(201).json({ uuid, fullname, study_level, age });
  } catch (err) {
    log('ERROR', 'POST /api/users failed', { error: err.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/api/users/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const { fullname, study_level, age } = req.body;
    if (!validateUser(req.body)) {
      return res.status(400).json({ error: 'Données invalides' });
    }
    const [existing] = await pool.execute('SELECT * FROM users WHERE uuid = ?', [uuid]);
    if (existing.length === 0) {
      log('WARN', 'PUT /api/users/:uuid - not found', { uuid });
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    await pool.execute(
      'UPDATE users SET fullname = ?, study_level = ?, age = ? WHERE uuid = ?',
      [fullname, study_level, age, uuid]
    );
    log('INFO', 'PUT /api/users/:uuid - updated', { uuid });
    res.status(200).json({ uuid, fullname, study_level, age });
  } catch (err) {
    log('ERROR', 'PUT /api/users/:uuid failed', { error: err.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.delete('/api/users/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const [result] = await pool.execute('DELETE FROM users WHERE uuid = ?', [uuid]);
    // result.affectedRows existe dans mysql2
    if (!result || result.affectedRows === 0) {
      log('WARN', 'DELETE /api/users/:uuid - not found', { uuid });
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    log('INFO', 'DELETE /api/users/:uuid - deleted', { uuid });
    res.status(200).json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    log('ERROR', 'DELETE /api/users/:uuid failed', { error: err.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    log('INFO', '/health - OK');
    res.status(200).json({ status: 'OK', database: 'connected' });
  } catch (err) {
    log('ERROR', '/health failed', { error: err.message });
    res.status(500).json({ status: 'ERROR', database: 'disconnected' });
  }
});

app.listen(PORT, async () => {
  try {
    await initDatabase();
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`✅ Health: http://localhost:${PORT}/health`);
    console.log(`✅ API: http://localhost:${PORT}/api/users`);
  } catch (err) {
    console.error('Le serveur n’a pas pu démarrer:', err.message);
    process.exit(1);
  }
});
