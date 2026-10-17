const jwt = require("jsonwebtoken");
const db = require("../db");
const { licenseRequired } = require("../config");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentification requise" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
  req.client = payload;

  if (licenseRequired()) {
    const lic = db
      .prepare("SELECT id, device_id FROM licenses WHERE client_id = ? AND status = 'active'")
      .get(payload.id);
    if (!lic) {
      return res.status(403).json({ error: "Licence inactive ou absente", code: "LICENSE_REQUIRED" });
    }
    const dev = String(req.headers["x-device-id"] || "");
    if (!dev || (lic.device_id && lic.device_id !== dev)) {
      return res.status(403).json({ error: "Licence liée à un autre téléphone", code: "DEVICE_MISMATCH" });
    }
    if (!lic.device_id) db.prepare("UPDATE licenses SET device_id = ? WHERE id = ?").run(dev, lic.id);
  }
  next();
}

module.exports = { requireAuth };
