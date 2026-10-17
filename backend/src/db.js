const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const { SCHEMA_SQL } = require("./schema");

const dbPath = process.env.DB_PATH || "./data/rtlconnect.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(SCHEMA_SQL);

// Migration des demandes de retrait : sûre à rejouer.
db.exec(`
  CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    amount INTEGER NOT NULL CHECK(amount >= 2000),
    method TEXT NOT NULL CHECK(method IN ('airtel_money', 'moov_money')),
    recipient_phone TEXT NOT NULL,
    account_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'paid', 'rejected')),
    transfer_reference TEXT,
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    processed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_withdrawals_client
    ON withdrawal_requests(client_id, id DESC);

  CREATE INDEX IF NOT EXISTS idx_withdrawals_status
    ON withdrawal_requests(status, id DESC);
`);


// Migration compatible avec les bases déjà existantes.
const paymentColumns = db.pragma("table_info(payments)");
if (!paymentColumns.some((column) => column.name === "receipt_confirmed_at")) {
  db.exec("ALTER TABLE payments ADD COLUMN receipt_confirmed_at TEXT");
}

for (const [column, definition] of [
  ["verification_ref", "TEXT"],
  ["admin_note", "TEXT"]
]) {
  const columns = db.pragma("table_info(payments)");
  if (!columns.some((item) => item.name === column)) {
    db.exec("ALTER TABLE payments ADD COLUMN " + column + " " + definition);
  }
}

// Valeurs de départ pour l'onglet support, modifiables ensuite en base
const supportCount = db.prepare("SELECT COUNT(*) AS n FROM support_contacts").get().n;
if (supportCount === 0) {
  db.prepare(
    "INSERT INTO support_contacts (label, value, description, sort_order) VALUES (?, ?, ?, ?)"
  ).run("Assistance RTL Gabon", "202", "Numéro à joindre en cas de problème avec votre wifi", 1);
  db.prepare(
    "INSERT INTO support_contacts (label, value, description, sort_order) VALUES (?, ?, ?, ?)"
  ).run("Horaires du service client", "Lun–Sam, 8h–18h", null, 2);
}

module.exports = db;
