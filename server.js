const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'colosseum-dev-secret';
const JWT_EXPIRY = '30d';

// --- Database setup ---

const db = new Database(path.join(__dirname, 'colosseum.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    coins INTEGER NOT NULL DEFAULT 100,
    icon TEXT NOT NULL DEFAULT '@',
    icon_color TEXT NOT NULL DEFAULT '#e8e8e8',
    icon_bg_color TEXT NOT NULL DEFAULT '#222222',
    team_name TEXT,
    daily_claimed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fighters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    class TEXT NOT NULL,
    icon TEXT NOT NULL,
    atk INTEGER NOT NULL,
    defense INTEGER NOT NULL,
    spd INTEGER NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ready',
    atk_xp INTEGER NOT NULL DEFAULT 0,
    def_xp INTEGER NOT NULL DEFAULT 0,
    spd_xp INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS fights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    opponent TEXT NOT NULL,
    entry INTEGER NOT NULL,
    prize INTEGER NOT NULL,
    starts_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Add equipment columns to fighters table if they don't exist yet
['equip_armor', 'equip_weapon', 'equip_shield'].forEach(col => {
  try { db.exec(`ALTER TABLE fighters ADD COLUMN ${col} TEXT`); } catch (_) {}
});

// --- Middleware ---

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Auth middleware — attaches req.user if valid Bearer token present
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Auth routes ---

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const clean = username.trim();
  const hash = bcrypt.hashSync(password, 10);

  try {
    const stmt = db.prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    );
    const result = stmt.run(clean, hash);
    const token = jwt.sign({ id: result.lastInsertRowid, username: clean }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    return res.json({ token, username: clean });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  return res.json({ token, username: user.username });
});

// --- Profile routes ---

// GET /api/me
app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, coins, icon, icon_color, icon_bg_color, team_name, daily_claimed_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  const fighters = db.prepare('SELECT * FROM fighters WHERE user_id = ?').all(req.user.id);

  return res.json({ ...user, fighters });
});

// PUT /api/me
app.put('/api/me', requireAuth, (req, res) => {
  const allowed = ['coins', 'icon', 'icon_color', 'icon_bg_color', 'team_name', 'daily_claimed_at'];
  const updates = {};

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      updates[key] = req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.json({ ok: true });
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), req.user.id];

  db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...values);
  return res.json({ ok: true });
});

// PUT /api/me/fighters
app.put('/api/me/fighters', requireAuth, (req, res) => {
  const { fighters } = req.body || {};
  if (!Array.isArray(fighters)) {
    return res.status(400).json({ error: 'fighters must be an array' });
  }

  // Replace all fighters for this user
  const deleteStmt = db.prepare('DELETE FROM fighters WHERE user_id = ?');
  const insertStmt = db.prepare(
    'INSERT INTO fighters (user_id, name, class, icon, atk, defense, spd, wins, losses, status, atk_xp, def_xp, spd_xp, equip_armor, equip_weapon, equip_shield) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const replaceFighters = db.transaction((userId, list) => {
    deleteStmt.run(userId);
    for (const f of list) {
      insertStmt.run(
        userId,
        f.name || '',
        f.class || '',
        f.icon || '',
        f.atk || 0,
        f.defense !== undefined ? f.defense : (f.def || 0),
        f.spd || 0,
        f.wins || 0,
        f.losses || 0,
        f.status || 'ready',
        f.atk_xp || 50,
        f.def_xp || 50,
        f.spd_xp || 50,
        f.equipment?.armor?.id || null,
        f.equipment?.weapon?.id || null,
        f.equipment?.shield?.id || null
      );
    }
  });

  replaceFighters(req.user.id, fighters);
  return res.json({ ok: true });
});

// --- Fight routes ---

const ARENAS = [
  { name: 'The Rust Cage', entry: 50,   prize: 200  },
  { name: 'The Pit',       entry: 150,  prize: 600  },
  { name: 'The Street',    entry: 300,  prize: 1500 },
  { name: 'The Gallows',   entry: 1000, prize: 5000 },
];

const FIGHT_OPPONENTS = [
  'Shadow Fang', 'The Iron Golem', 'Void Reaper', 'The Crimson Knight',
  'Stoneback', 'Ironjaw', 'The Pale Striker', 'Dusk Runner',
  'Cinder Brute', 'The Wailing Axe',
];

function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// GET /api/upcoming-fights
app.get('/api/upcoming-fights', (req, res) => {
  const fights = db.prepare(
    "SELECT * FROM fights WHERE starts_at > datetime('now') ORDER BY starts_at ASC LIMIT 4"
  ).all();
  return res.json(fights);
});

// POST /api/upcoming-fights/generate
app.post('/api/upcoming-fights/generate', requireAuth, (req, res) => {
  const now = Date.now();
  const offsets = [3 * 60 * 1000, 4 * 60 * 1000, 4.5 * 60 * 1000, 5 * 60 * 1000];

  const opponents = pickRandom(FIGHT_OPPONENTS, 4);

  const del    = db.prepare("DELETE FROM fights WHERE starts_at > datetime('now')");
  const insert = db.prepare('INSERT INTO fights (name, opponent, entry, prize, starts_at) VALUES (?, ?, ?, ?, ?)');

  db.transaction(() => {
    del.run();
    for (let i = 0; i < 4; i++) {
      const arena = ARENAS[i];
      insert.run(arena.name, opponents[i], arena.entry, arena.prize, new Date(now + offsets[i]).toISOString());
    }
  })();

  const fights = db.prepare(
    "SELECT * FROM fights WHERE starts_at > datetime('now') ORDER BY starts_at ASC"
  ).all();
  return res.json(fights);
});

// POST /api/upcoming-fights/refresh-arena  (no auth — system triggered when a live fight ends)
app.post('/api/upcoming-fights/refresh-arena', (req, res) => {
  const { arena } = req.body || {};
  const arenaData = ARENAS.find(a => a.name === arena);
  if (!arenaData) return res.status(400).json({ error: 'Unknown arena' });

  const offsetMs = (Math.floor(Math.random() * 3) + 3) * 60 * 1000; // 3–5 min
  const startsAt = new Date(Date.now() + offsetMs).toISOString();
  const opponent = pickRandom(FIGHT_OPPONENTS, 1)[0];

  db.prepare("DELETE FROM fights WHERE name = ? AND starts_at > datetime('now')").run(arenaData.name);
  db.prepare('INSERT INTO fights (name, opponent, entry, prize, starts_at) VALUES (?, ?, ?, ?, ?)')
    .run(arenaData.name, opponent, arenaData.entry, arenaData.prize, startsAt);

  const fight = db.prepare('SELECT * FROM fights WHERE name = ? ORDER BY id DESC LIMIT 1').get(arenaData.name);
  return res.json(fight);
});

// GET /api/leaderboard
app.get('/api/leaderboard', (req, res) => {
  const rows = db.prepare(`
    SELECT f.name, f.class, f.icon, f.atk, f.defense, f.spd,
           f.wins, f.losses,
           u.username, u.team_name,
           u.icon AS user_icon, u.icon_color, u.icon_bg_color
    FROM fighters f
    JOIN users u ON f.user_id = u.id
    WHERE f.wins > 0
    ORDER BY f.wins DESC,
             CAST(f.wins AS REAL) / (f.wins + f.losses) DESC
    LIMIT 25
  `).all();
  return res.json(rows);
});

// --- Start server ---

app.listen(PORT, () => {
  console.log(`Pinkle Colosseum server running at http://localhost:${PORT}`);
});
