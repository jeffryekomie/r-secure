const test = require("node:test");
const assert = require("node:assert/strict");
const { licenseRequired, validateEnv } = require("../src/config");

const quiet = { error() {}, warn() {} };
const ok = { JWT_SECRET: "x".repeat(32), ADMIN_KEY: "k".repeat(20), APP_PRICE: "910" };

test("le verrou de licence est actif quand la variable est absente", () => {
  delete process.env.LICENSE_REQUIRED;
  assert.equal(licenseRequired(), true);
});

test("le verrou de licence ne se désactive qu'avec la valeur exacte false", () => {
  process.env.LICENSE_REQUIRED = "false";
  assert.equal(licenseRequired(), false);
  process.env.LICENSE_REQUIRED = "0";
  assert.equal(licenseRequired(), true);
  process.env.LICENSE_REQUIRED = "true";
  assert.equal(licenseRequired(), true);
  delete process.env.LICENSE_REQUIRED;
});

test("démarrage refusé si une variable critique manque", () => {
  for (const key of ["JWT_SECRET", "ADMIN_KEY", "APP_PRICE"]) {
    let code = null;
    const env = { ...ok, [key]: "" };
    validateEnv(env, quiet, (c) => { code = c; });
    assert.equal(code, 1, key);
  }
});

test("démarrage refusé si APP_PRICE est invalide", () => {
  for (const price of ["abc", "0", "-5"]) {
    let code = null;
    validateEnv({ ...ok, APP_PRICE: price }, quiet, (c) => { code = c; });
    assert.equal(code, 1, price);
  }
});

test("démarrage accepté avec une configuration complète", () => {
  let code = null;
  assert.equal(validateEnv({ ...ok, COMMISSION_PERCENT: "20" }, quiet, (c) => { code = c; }), true);
  assert.equal(code, null);
});
