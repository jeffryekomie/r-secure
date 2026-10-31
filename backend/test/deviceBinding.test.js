const test = require("node:test");
const assert = require("node:assert/strict");
const { decideDeviceBinding: d } = require("../src/services/deviceBinding");
const { deviceRebindPolicy } = require("../src/config");

test("premier téléphone : la licence se lie", () => {
  assert.equal(d({ boundDeviceId: null, deviceId: "A", max: 2 }).action, "bind");
});

test("même téléphone : accepté sans rien consommer", () => {
  assert.equal(d({ boundDeviceId: "A", deviceId: "A", changesInWindow: 5, max: 2 }).action, "ok");
});

test("autre téléphone avec quota restant : changement autorisé", () => {
  assert.equal(d({ boundDeviceId: "A", deviceId: "B", changesInWindow: 1, max: 2 }).action, "rebind");
});

test("autre téléphone, quota épuisé : refusé avec REBIND_LIMIT", () => {
  const r = d({ boundDeviceId: "A", deviceId: "B", changesInWindow: 2, max: 2 });
  assert.deepEqual(r, { action: "deny", reason: "REBIND_LIMIT" });
});

test("quota à 0 : comportement d'origine (DEVICE_MISMATCH)", () => {
  const r = d({ boundDeviceId: "A", deviceId: "B", changesInWindow: 0, max: 0 });
  assert.deepEqual(r, { action: "deny", reason: "DEVICE_MISMATCH" });
});

test("identifiant de téléphone absent : refusé", () => {
  assert.equal(d({ boundDeviceId: "A", deviceId: "", max: 2 }).action, "deny");
});

test("réglage du quota : défauts et valeurs invalides", () => {
  assert.deepEqual(deviceRebindPolicy({}), { max: 2, days: 30 });
  assert.deepEqual(deviceRebindPolicy({ DEVICE_REBIND_MAX: "0", DEVICE_REBIND_DAYS: "7" }), { max: 0, days: 7 });
  assert.deepEqual(deviceRebindPolicy({ DEVICE_REBIND_MAX: "-1", DEVICE_REBIND_DAYS: "abc" }), { max: 2, days: 30 });
});
