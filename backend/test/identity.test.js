const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { normalizePhone, migrateClientPhones } = require("../src/services/identity");

test("un même numéro tapé de plusieurs façons donne la même forme", () => {
  const variantes = ["077123456", "077 12 34 56", "077-12-34-56", "+241077123456", "+241 077 12 34 56", "00241077123456", "241077123456"];
  for (const v of variantes) assert.equal(normalizePhone(v), "077123456", v);
});

test("le zéro initial est conservé tel que saisi", () => {
  assert.equal(normalizePhone("06123456"), "06123456");
  assert.equal(normalizePhone("+241 06 12 34 56"), "06123456");
  assert.notEqual(normalizePhone("77123456"), normalizePhone("077123456"));
});

test("un numéro étranger garde son indicatif avec +", () => {
  assert.equal(normalizePhone("+33 6 12 34 56 78"), "+33612345678");
  assert.equal(normalizePhone("0033612345678"), "+33612345678");
});

test("les numéros invalides sont refusés", () => {
  for (const v of ["", "   ", "abc", "12", "0771-ABC", "+", "123456789012345678", null, undefined]) {
    assert.equal(normalizePhone(v), null, String(v));
  }
});

function makeDb(phones) {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE clients (id INTEGER PRIMARY KEY, phone TEXT UNIQUE NOT NULL)");
  const ins = db.prepare("INSERT INTO clients (phone) VALUES (?)");
  phones.forEach((p) => ins.run(p));
  return db;
}
const quiet = { log() {}, warn() {} };

test("la migration convertit les anciens numéros", () => {
  const db = makeDb(["+241077123456", "077999888", "00241066111222"]);
  const r = migrateClientPhones(db, quiet);
  assert.deepEqual(r, { changed: 2, skipped: 0 });
  const phones = db.prepare("SELECT phone FROM clients ORDER BY id").all().map((x) => x.phone);
  assert.deepEqual(phones, ["077123456", "077999888", "066111222"]);
});

test("la migration ne touche pas un numéro qui entrerait en collision", () => {
  const db = makeDb(["077123456", "+241077123456"]);
  const r = migrateClientPhones(db, quiet);
  assert.deepEqual(r, { changed: 0, skipped: 1 });
  const phones = db.prepare("SELECT phone FROM clients ORDER BY id").all().map((x) => x.phone);
  assert.deepEqual(phones, ["077123456", "+241077123456"]);
});

test("la migration est sans effet la deuxième fois", () => {
  const db = makeDb(["+241077123456"]);
  migrateClientPhones(db, quiet);
  assert.deepEqual(migrateClientPhones(db, quiet), { changed: 0, skipped: 0 });
});
