const express = require("express");
const db = require("../db");
const { normalize } = require("../services/licenses");
const { limits, clientIp, tooMany } = require("../middleware/rateLimit");

const router = express.Router();

// Réponse volontairement identique pour un code inconnu, révoqué ou utilisé ailleurs,
// pour qu'on ne puisse pas deviner quels codes existent.
router.post("/check", (req, res) => {
  const ip = clientIp(req);
  const st = limits.licenseFail.status(ip);
  if (st.blocked) return tooMany(res, st.retryAfter);

  const code = normalize(req.body.licenseCode);
  const deviceId = String(req.body.deviceId || "");
  const lic = db.prepare("SELECT status, device_id FROM licenses WHERE code = ?").get(code);
  const usable =
    lic &&
    (lic.status === "unused" ||
      (lic.status === "active" && (!lic.device_id || lic.device_id === deviceId)));
  if (!usable) {
    limits.licenseFail.hit(ip);
    return res.status(404).json({ error: "Code invalide ou indisponible" });
  }
  res.json({ ok: true });
});

module.exports = router;
