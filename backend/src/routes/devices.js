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

function upsertKnownDevice(routerId, device) {
  const existing = db
    .prepare("SELECT * FROM known_devices WHERE router_id = ? AND mac = ?")
    .get(routerId, device.mac);
  if (existing) {
    db.prepare("UPDATE known_devices SET hostname = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?").run(
      device.hostname,
      existing.id
    );
    return { ...existing, hostname: device.hostname };
  }
  const result = db
    .prepare(
      "INSERT INTO known_devices (router_id, mac, hostname, last_seen) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
    )
    .run(routerId, device.mac, device.hostname);
  return db.prepare("SELECT * FROM known_devices WHERE id = ?").get(result.lastInsertRowid);
}

// Liste des appareils connectés, enrichie avec l'historique (limite du jour, masqués exclus)
router.get("/:routerId/devices", async (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  try {
    const live = await acs.listConnectedDevices(r);
    const merged = live
      .map((d) => {
        const known = upsertKnownDevice(r.id, d);
        return {
          mac: d.mac,
          ip: d.ip,
          hostname: known.hostname || d.hostname,
          daily_limit_minutes: known.daily_limit_minutes,
          minutes_used_today: known.minutes_used_today,
          blocked: !!known.blocked,
          hidden: !!known.hidden,
        };
      })
      .filter((d) => !d.hidden);
    res.json(merged);
  } catch (e) {
    res.status(502).json({ error: "Impossible de joindre le routeur", detail: e.message });
  }
});

// Déconnecter un appareil précis maintenant (blocage MAC côté routeur)
router.post("/:routerId/devices/:mac/kick", async (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  try {
    await acs.blockDeviceByMac(r, req.params.mac);
    db.prepare(
      `INSERT INTO known_devices (router_id, mac, blocked, block_reason)
       VALUES (?, ?, 1, 'manual')
       ON CONFLICT(router_id, mac) DO UPDATE SET blocked = 1, block_reason = 'manual'`
    ).run(r.id, req.params.mac);
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "Impossible de joindre le routeur", detail: e.message });
  }
});

// Réautoriser un appareil précédemment déconnecté manuellement
router.post("/:routerId/devices/:mac/unblock", async (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  try {
    await acs.unblockDeviceByMac(r, req.params.mac);
    db.prepare(
      "UPDATE known_devices SET blocked = 0, block_reason = NULL WHERE router_id = ? AND mac = ?"
    ).run(r.id, req.params.mac);
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "Impossible de joindre le routeur", detail: e.message });
  }
});

// Retirer un appareil de la liste/historique affiché au client (pas de blocage réseau)
router.delete("/:routerId/devices/:mac", (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  const existing = db.prepare("SELECT * FROM known_devices WHERE router_id = ? AND mac = ?").get(r.id, req.params.mac);
  if (existing) {
    db.prepare("UPDATE known_devices SET hidden = 1 WHERE id = ?").run(existing.id);
  } else {
    db.prepare("INSERT INTO known_devices (router_id, mac, hidden) VALUES (?, ?, 1)").run(r.id, req.params.mac);
  }
  res.json({ ok: true });
});

// Définir (ou retirer) une limite de connexion quotidienne pour un appareil
router.patch("/:routerId/devices/:mac", async (req, res) => {
  const r = getOwnedRouterOr404(req, res);
  if (!r) return;
  const { daily_limit_minutes } = req.body;

  const existing = db.prepare("SELECT * FROM known_devices WHERE router_id = ? AND mac = ?").get(r.id, req.params.mac);
  if (existing) {
    db.prepare("UPDATE known_devices SET daily_limit_minutes = ? WHERE id = ?").run(
      daily_limit_minutes || null,
      existing.id
    );
  } else {
    db.prepare("INSERT INTO known_devices (router_id, mac, daily_limit_minutes) VALUES (?, ?, ?)").run(
      r.id,
      req.params.mac,
      daily_limit_minutes || null
    );
  }

  // Si on retire la limite et que l'appareil était bloqué À CAUSE DE CETTE LIMITE
  // (jamais pour un kick manuel — voir block_reason), on le débloque.
  if (!daily_limit_minutes && existing?.blocked && existing?.block_reason === "limit") {
    try {
      await acs.unblockDeviceByMac(r, req.params.mac);
      db.prepare("UPDATE known_devices SET blocked = 0, block_reason = NULL WHERE router_id = ? AND mac = ?").run(
        r.id,
        req.params.mac
      );
    } catch (e) {
      return res.status(502).json({ error: "Limite enregistrée mais déblocage impossible", detail: e.message });
    }
  }

  res.json({ ok: true });
});

module.exports = router;
