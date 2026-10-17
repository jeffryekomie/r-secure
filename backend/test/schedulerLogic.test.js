const test = require("node:test");
const assert = require("node:assert/strict");
const logic = require("../src/jobs/schedulerLogic");

test("créneau horaire — coupe le wifi au bon jour et à la bonne minute", () => {
  const schedule = { enabled: 1, days: "MON,TUE,WED,THU,FRI", start_time: "22:00", end_time: "06:00" };
  assert.equal(logic.scheduleShouldTurnOff(schedule, "MON", "22:00"), true);
  assert.equal(logic.scheduleShouldTurnOn(schedule, "MON", "06:00"), true);
});

test("créneau horaire — ne se déclenche pas un jour non concerné", () => {
  const schedule = { enabled: 1, days: "MON,TUE,WED,THU,FRI", start_time: "22:00", end_time: "06:00" };
  assert.equal(logic.scheduleShouldTurnOff(schedule, "SAT", "22:00"), false);
  assert.equal(logic.scheduleShouldTurnOn(schedule, "SUN", "06:00"), false);
});

test("créneau horaire — ne se déclenche pas à une autre minute", () => {
  const schedule = { enabled: 1, days: "MON", start_time: "22:00", end_time: "06:00" };
  assert.equal(logic.scheduleShouldTurnOff(schedule, "MON", "22:01"), false);
  assert.equal(logic.scheduleShouldTurnOff(schedule, "MON", "21:59"), false);
});

test("créneau horaire — désactivé ne se déclenche jamais", () => {
  const schedule = { enabled: 0, days: "MON", start_time: "22:00", end_time: "06:00" };
  assert.equal(logic.scheduleShouldTurnOff(schedule, "MON", "22:00"), false);
});

test("minuteur — se déclenche une fois l'échéance passée", () => {
  assert.equal(logic.isTimerDue("2026-10-01T10:00:00.000Z", "2026-10-01T10:00:00.000Z"), true);
  assert.equal(logic.isTimerDue("2026-10-01T10:00:00.000Z", "2026-10-01T10:00:01.000Z"), true);
  assert.equal(logic.isTimerDue("2026-10-01T10:00:00.000Z", "2026-10-01T09:59:59.000Z"), false);
});

test("minuteur — ne se déclenche jamais si absent", () => {
  assert.equal(logic.isTimerDue(null, "2026-10-01T10:00:00.000Z"), false);
});

test("limite quotidienne — incrémente normalement sous la limite", () => {
  const device = { usage_date: "2026-10-01", minutes_used_today: 10, daily_limit_minutes: 60 };
  const { minutesUsed, limitReached } = logic.computeUsageIncrement(device, "2026-10-01");
  assert.equal(minutesUsed, 11);
  assert.equal(limitReached, false);
});

test("limite quotidienne — déclenche le blocage pile à la limite", () => {
  const device = { usage_date: "2026-10-01", minutes_used_today: 59, daily_limit_minutes: 60 };
  const { minutesUsed, limitReached } = logic.computeUsageIncrement(device, "2026-10-01");
  assert.equal(minutesUsed, 60);
  assert.equal(limitReached, true);
});

test("limite quotidienne — repart de zéro si la date stockée n'est pas aujourd'hui", () => {
  const device = { usage_date: "2026-09-30", minutes_used_today: 59, daily_limit_minutes: 60 };
  const { minutesUsed, limitReached } = logic.computeUsageIncrement(device, "2026-10-01");
  assert.equal(minutesUsed, 1);
  assert.equal(limitReached, false);
});

test("limite quotidienne — un appareil jamais vu (usage_date null) part de zéro", () => {
  const device = { usage_date: null, minutes_used_today: 0, daily_limit_minutes: 30 };
  const { minutesUsed } = logic.computeUsageIncrement(device, "2026-10-01");
  assert.equal(minutesUsed, 1);
});

test("remise à zéro quotidienne — un appareil bloqué par LIMITE est débloqué au changement de jour", () => {
  const device = { usage_date: "2026-09-30", blocked: 1, block_reason: "limit" };
  assert.equal(logic.isStaleForNewDay(device, "2026-10-01"), true);
  assert.equal(logic.shouldAutoUnblockOnReset(device), true);
});

test("RÉGRESSION — un kick MANUEL n'est jamais débloqué automatiquement au changement de jour", () => {
  const device = { usage_date: "2026-09-30", blocked: 1, block_reason: "manual" };
  assert.equal(logic.isStaleForNewDay(device, "2026-10-01"), true, "le compteur est bien vu comme périmé");
  assert.equal(logic.shouldAutoUnblockOnReset(device), false, "mais le blocage manuel doit rester actif");
});

test("remise à zéro quotidienne — un appareil non bloqué n'est pas affecté par le déblocage auto", () => {
  const device = { usage_date: "2026-09-30", blocked: 0, block_reason: null };
  assert.equal(logic.shouldAutoUnblockOnReset(device), false);
});

test("remise à zéro quotidienne — même jour, pas périmé", () => {
  const device = { usage_date: "2026-10-01", blocked: 1, block_reason: "limit" };
  assert.equal(logic.isStaleForNewDay(device, "2026-10-01"), false);
});
