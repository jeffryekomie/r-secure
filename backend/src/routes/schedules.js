const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function getOwnedRouterOr404(req, res) {
  const r = db.prepare("SELECT * FROM routers WHERE id = ? AND client_id = ?").get(req.params.routerId, req.client.id);
  if (!r) {
    res.status(404).json({ error: "Routeur introuvable" });
    return null;
  }
  return r;
}

router.get("/:routerId/schedules", (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  res.json(db.prepare("SELECT * FROM schedules WHERE router_id = ?").all(r.id));
});

router.post("/:routerId/schedules", (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  const { label, days, start_time, end_time } = req.body;
  if (!label || !days || !start_time || !end_time) {
    return res.status(400).json({ error: "label, days, start_time et end_time sont requis" });
  }
  const result = db
    .prepare("INSERT INTO schedules (router_id, label, days, start_time, end_time, enabled) VALUES (?, ?, ?, ?, ?, 1)")
    .run(r.id, label, days, start_time, end_time);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.patch("/:routerId/schedules/:scheduleId", (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  const schedule = db.prepare("SELECT * FROM schedules WHERE id = ? AND router_id = ?").get(req.params.scheduleId, r.id);
  if (!schedule) return res.status(404).json({ error: "Créneau introuvable" });
  const enabled = req.body.enabled !== undefined ? (req.body.enabled ? 1 : 0) : schedule.enabled;
  db.prepare("UPDATE schedules SET enabled = ? WHERE id = ?").run(enabled, schedule.id);
  res.json({ ok: true });
});

router.delete("/:routerId/schedules/:scheduleId", (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  db.prepare("DELETE FROM schedules WHERE id = ? AND router_id = ?").run(req.params.scheduleId, r.id);
  res.json({ ok: true });
});

module.exports = router;
