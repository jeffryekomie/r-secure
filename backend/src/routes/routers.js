const express = require("express");
const db = require("../db");
const acs = require("../services/localRouterApi");
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

router.get("/", (req, res) => {
  const routers = db.prepare("SELECT * FROM routers WHERE client_id = ?").all(req.client.id);
  res.json(routers);
});

// Enregistrer un routeur nouvellement installé (voir backend/vpn/README.md)
router.post("/", (req, res) => {
  const { vpn_ip, admin_user, admin_password, model, label } = req.body;
  if (!vpn_ip || !admin_password) {
    return res.status(400).json({ error: "vpn_ip et admin_password sont requis" });
  }
  const result = db
    .prepare("INSERT INTO routers (client_id, vpn_ip, admin_user, admin_password, model, label) VALUES (?, ?, ?, ?, ?, ?)")
    .run(req.client.id, vpn_ip, admin_user || "admin", admin_password, model || "ZLT W154R Plus", label || "");
  res.status(201).json({ id: result.lastInsertRowid });
});

router.post("/:routerId/power", async (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  try {
    await acs.setWifiEnabled(r, !!req.body.enabled);
    res.json({ ok: true, enabled: !!req.body.enabled });
  } catch (e) {
    res.status(502).json({ error: "Impossible de joindre le routeur", detail: e.message });
  }
});

router.post("/:routerId/ssid", async (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  const { ssid } = req.body;
  if (!ssid || ssid.length > 32) return res.status(400).json({ error: "SSID invalide (1 à 32 caractères)" });
  try {
    await acs.setSsid(r, ssid);
    res.json({ ok: true, ssid });
  } catch (e) {
    res.status(502).json({ error: "Impossible de joindre le routeur", detail: e.message });
  }
});

router.post("/:routerId/password", async (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
  }
  try {
    await acs.setPassword(r, password);
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "Impossible de joindre le routeur", detail: e.message });
  }
});

router.post("/:routerId/visibility", async (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  try {
    await acs.setNetworkVisible(r, !!req.body.visible);
    res.json({ ok: true, visible: !!req.body.visible });
  } catch (e) {
    res.status(502).json({ error: "Impossible de joindre le routeur", detail: e.message });
  }
});

// Minuteur : coupe le wifi dans X minutes (traité par le scheduler, voir jobs/schedulerRunner.js)
router.post("/:routerId/timer", (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  const { minutes } = req.body;
  if (!minutes || minutes <= 0 || minutes > 1440) {
    return res.status(400).json({ error: "minutes doit être entre 1 et 1440" });
  }
  const offAt = new Date(Date.now() + minutes * 60_000).toISOString();
  db.prepare("UPDATE routers SET timer_off_at = ? WHERE id = ?").run(offAt, r.id);
  res.json({ ok: true, timer_off_at: offAt });
});

// Annuler le minuteur en cours
router.delete("/:routerId/timer", (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  db.prepare("UPDATE routers SET timer_off_at = NULL WHERE id = ?").run(r.id);
  res.json({ ok: true });
});

module.exports = router;
