// Schéma SQL extrait de db.js pour pouvoir être exécuté tel quel, aussi bien
// par better-sqlite3 (en production) que par node:sqlite (dans les tests,
// sans avoir besoin d'installer de dépendance). Contenu inchangé — pur refactor.
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS routers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    vpn_ip TEXT UNIQUE NOT NULL,
    admin_user TEXT DEFAULT 'admin',
    admin_password TEXT NOT NULL,
    model TEXT,
    label TEXT,
    timer_off_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    router_id INTEGER NOT NULL REFERENCES routers(id),
    label TEXT NOT NULL,
    days TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS known_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    router_id INTEGER NOT NULL REFERENCES routers(id),
    mac TEXT NOT NULL,
    hostname TEXT,
    hidden INTEGER DEFAULT 0,
    daily_limit_minutes INTEGER,
    minutes_used_today INTEGER DEFAULT 0,
    usage_date TEXT,
    blocked INTEGER DEFAULT 0,
    block_reason TEXT,
    first_seen TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen TEXT,
    UNIQUE(router_id, mac)
  );

  CREATE TABLE IF NOT EXISTS support_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'unused',
    client_id INTEGER REFERENCES clients(id),
    device_id TEXT,
    referrer_client_id INTEGER REFERENCES clients(id),
    commission_amount INTEGER DEFAULT 0,
    commission_paid INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    activated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS referral_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER UNIQUE NOT NULL REFERENCES clients(id),
    code TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'singpay',
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'XAF',
    phone TEXT,
    referral_code TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    license_id INTEGER REFERENCES licenses(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    paid_at TEXT
  );
`;

module.exports = { SCHEMA_SQL };
