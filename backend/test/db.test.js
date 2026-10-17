const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { SCHEMA_SQL } = require("../src/schema");

// node:sqlite (natif Node 22+) est utilisé ici uniquement pour les tests, afin
// de vérifier le VRAI schéma SQL sans avoir à installer better-sqlite3.
// Les deux sont des moteurs SQLite standards : le SQL testé ici est identique
// à celui exécuté en production.

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

function seedClientAndRouter(db) {
  db.prepare("INSERT INTO clients (name, phone, password_hash) VALUES (?, ?, ?)").run("Nadège", "+24100000000", "hash");
  db.prepare(
    "INSERT INTO routers (client_id, vpn_ip, admin_password, model, label) VALUES (1, '10.8.0.14', 'admin123', 'W154R Plus', 'Boulevard')"
  ).run();
}

test("schéma — toutes les tables se créent sans erreur", () => {
  assert.doesNotThrow(() => freshDb());
});

test("known_devices — l'upsert (ON CONFLICT) utilisé par le kick manuel fonctionne", () => {
  const db = freshDb();
  seedClientAndRouter(db);

  // Reproduit exactement la requête de devices.js (route /kick)
  const upsert = () =>
    db
      .prepare(
        `INSERT INTO known_devices (router_id, mac, blocked, block_reason)
         VALUES (1, 'AA:BB:CC:DD:EE:FF', 1, 'manual')
         ON CONFLICT(router_id, mac) DO UPDATE SET blocked = 1, block_reason = 'manual'`
      )
      .run();

  assert.doesNotThrow(upsert, "premier appel (insertion)");
  assert.doesNotThrow(upsert, "second appel (mise à jour, pas de doublon)");

  const rows = db.prepare("SELECT * FROM known_devices WHERE router_id = 1").all();
  assert.equal(rows.length, 1, "un seul enregistrement malgré les deux appels");
  assert.equal(rows[0].blocked, 1);
  assert.equal(rows[0].block_reason, "manual");
});

test("known_devices — la contrainte UNIQUE(router_id, mac) empêche les doublons via un simple INSERT", () => {
  const db = freshDb();
  seedClientAndRouter(db);
  db.prepare("INSERT INTO known_devices (router_id, mac) VALUES (1, 'AA:BB:CC:DD:EE:FF')").run();
  assert.throws(() => db.prepare("INSERT INTO known_devices (router_id, mac) VALUES (1, 'AA:BB:CC:DD:EE:FF')").run());
});

test("devices — le retrait de la liste (DELETE route) upsert bien un hidden=1", () => {
  const db = freshDb();
  seedClientAndRouter(db);

  // Cas 1 : l'appareil n'existe pas encore en base (jamais vu via GET /devices)
  const existing = db.prepare("SELECT * FROM known_devices WHERE router_id = ? AND mac = ?").get(1, "11:22:33:44:55:66");
  assert.equal(existing, undefined);
  db.prepare("INSERT INTO known_devices (router_id, mac, hidden) VALUES (?, ?, 1)").run(1, "11:22:33:44:55:66");

  const row = db.prepare("SELECT * FROM known_devices WHERE router_id = ? AND mac = ?").get(1, "11:22:33:44:55:66");
  assert.equal(row.hidden, 1);
});

test("schedules — insertion et lecture par routeur", () => {
  const db = freshDb();
  seedClientAndRouter(db);
  db.prepare(
    "INSERT INTO schedules (router_id, label, days, start_time, end_time, enabled) VALUES (1, 'Nuit', 'MON,TUE', '22:00', '06:00', 1)"
  ).run();
  const schedules = db.prepare("SELECT * FROM schedules WHERE router_id = ?").all(1);
  assert.equal(schedules.length, 1);
  assert.equal(schedules[0].label, "Nuit");
});

test("support_contacts — le schéma accepte les valeurs de départ (202 + horaires)", () => {
  const db = freshDb();
  db.prepare("INSERT INTO support_contacts (label, value, description, sort_order) VALUES (?, ?, ?, ?)").run(
    "Assistance RTL Gabon",
    "202",
    "Numéro à joindre en cas de problème avec votre wifi",
    1
  );
  const contacts = db.prepare("SELECT * FROM support_contacts ORDER BY sort_order").all();
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].value, "202");
});

test("routers — vpn_ip est bien unique (deux routeurs ne peuvent pas partager la même IP VPN)", () => {
  const db = freshDb();
  seedClientAndRouter(db);
  assert.throws(() =>
    db
      .prepare("INSERT INTO routers (client_id, vpn_ip, admin_password) VALUES (1, '10.8.0.14', 'autre')")
      .run()
  );
});
