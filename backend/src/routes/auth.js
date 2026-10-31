const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { normalize } = require("../services/licenses");
const { licenseRequired, deviceRebindPolicy } = require("../config");
const { decideDeviceBinding } = require("../services/deviceBinding");
const { requireAuth } = require("../middleware/auth");
const { normalizePhone, phoneVariants } = require("../services/identity");
const { limits, clientIp, tooMany } = require("../middleware/rateLimit");

const router = express.Router();
const sign = (id, name) =>
  jwt.sign({ id, name }, process.env.JWT_SECRET, { expiresIn: "30d" });

const PASSWORD_MIN = 8;

function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < PASSWORD_MIN) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères`;
  }
  // bcrypt ignore tout ce qui dépasse 72 octets : on refuse plutôt que de tronquer en silence.
  if (Buffer.byteLength(pw, "utf8") > 72) return "Le mot de passe est trop long (72 caractères maximum)";
  return null;
}

router.post("/register", async (req, res) => {
  const ip = clientIp(req);
  const blocked = limits.registerIp.status(ip);
  if (blocked.blocked) return tooMany(res, blocked.retryAfter);
  limits.registerIp.hit(ip);

  const rawPhone = String(req.body.phone || "").trim();
  const name = String(req.body.name || "").trim();
  const password = req.body.password;
  const licenseCode = req.body.licenseCode || req.headers["x-license-code"];
  const deviceId = req.body.deviceId || req.headers["x-device-id"];

  if (!name || !rawPhone || password === undefined || password === null || password === "") {
    return res.status(400).json({ error: "name, phone et password sont requis" });
  }
  if (name.length < 2 || name.length > 60) {
    return res.status(400).json({ error: "Le nom doit contenir entre 2 et 60 caractères" });
  }
  const phone = normalizePhone(rawPhone);
  if (!phone) return res.status(400).json({ error: "Numéro de téléphone invalide" });
  const pwProblem = passwordProblem(password);
  if (pwProblem) return res.status(400).json({ error: pwProblem });

  let lic = null;
  if (licenseRequired()) {
    if (!licenseCode || !deviceId) {
      return res.status(400).json({ error: "licenseCode et deviceId sont requis" });
    }
    const lf = limits.licenseFail.status(ip);
    if (lf.blocked) return tooMany(res, lf.retryAfter);
    lic = db.prepare("SELECT id, status FROM licenses WHERE code = ?").get(normalize(licenseCode));
    if (!lic || lic.status !== "unused") {
      limits.licenseFail.hit(ip);
      return res.status(403).json({ error: "Code d'activation invalide ou déjà utilisé" });
    }
  }

  // Cherche le numéro sous toutes ses formes (avec/sans « 0 » initial, tel que saisi) pour ne pas créer de doublon.
  const forms = phoneVariants(rawPhone);
  const existing = db
    .prepare(`SELECT id FROM clients WHERE phone IN (${forms.map(() => "?").join(",")})`)
    .get(...forms);
  if (existing) return res.status(409).json({ error: "Ce numéro est déjà associé à un compte" });

  const hash = await bcrypt.hash(password, 10);
  try {
    const clientId = db.transaction(() => {
      const r = db
        .prepare("INSERT INTO clients (name, phone, password_hash) VALUES (?, ?, ?)")
        .run(name, phone, hash);
      const id = r.lastInsertRowid;
      if (lic) {
        const u = db
          .prepare(
            "UPDATE licenses SET status = 'active', client_id = ?, device_id = ?, activated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'unused'"
          )
          .run(id, String(deviceId), lic.id);
        if (u.changes !== 1) throw new Error("LICENSE_TAKEN");
      }
      return id;
    })();
    res.status(201).json({ token: sign(clientId, name) });
  } catch (e) {
    if (e.message === "LICENSE_TAKEN") {
      limits.licenseFail.hit(ip);
      return res.status(403).json({ error: "Code d'activation invalide ou déjà utilisé" });
    }
    // Deux inscriptions simultanées avec le même numéro : la base refuse la seconde.
    if (String(e.code || "").startsWith("SQLITE_CONSTRAINT")) {
      return res.status(409).json({ error: "Ce numéro est déjà associé à un compte" });
    }
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/login", async (req, res) => {
  const ip = clientIp(req);
  const rawPhone = String(req.body.phone || "").trim();
  const password = req.body.password;
  const deviceId = req.body.deviceId || req.headers["x-device-id"];
  const phone = normalizePhone(rawPhone);
  const key = phone || rawPhone;

  const byIp = limits.loginIp.status(ip);
  if (byIp.blocked) return tooMany(res, byIp.retryAfter);
  const byPhone = limits.loginPhone.status(key);
  if (byPhone.blocked) return tooMany(res, byPhone.retryAfter);

  const fail = () => {
    limits.loginIp.hit(ip);
    limits.loginPhone.hit(key);
    return res.status(401).json({ error: "Identifiants invalides" });
  };

  if (!key || typeof password !== "string" || !password) return fail();

  // Le même numéro peut avoir été enregistré avec ou sans « 0 » initial : on essaie chaque forme,
  // et le compte retenu est celui dont le mot de passe correspond.
  const forms = phoneVariants(rawPhone);
  const candidates = db
    .prepare(`SELECT * FROM clients WHERE phone IN (${forms.map(() => "?").join(",")})`)
    .all(...forms);
  if (!candidates.length) return fail();

  let c = null;
  for (const cand of candidates) {
    if (await bcrypt.compare(password, cand.password_hash)) { c = cand; break; }
  }
  if (!c) return fail();
  limits.loginPhone.reset(key);

  if (licenseRequired()) {
    const lic = db
      .prepare("SELECT id, device_id FROM licenses WHERE client_id = ? AND status = 'active'")
      .get(c.id);
    if (!lic) return res.status(403).json({ error: "Aucune licence active", code: "LICENSE_REQUIRED" });
    if (!deviceId) return res.status(400).json({ error: "deviceId requis" });

    // Mot de passe correct mais autre téléphone (app réinstallée, données effacées, téléphone changé) :
    // on autorise un nombre limité de changements, puis il faut passer par le support.
    const policy = deviceRebindPolicy();
    const { n: changes } = db
      .prepare("SELECT COUNT(*) AS n FROM license_device_changes WHERE license_id = ? AND changed_at >= datetime('now', ?)")
      .get(lic.id, `-${policy.days} days`);
    const decision = decideDeviceBinding({
      boundDeviceId: lic.device_id,
      deviceId,
      changesInWindow: changes,
      max: policy.max,
    });

    if (decision.action === "bind") {
      db.prepare("UPDATE licenses SET device_id = ? WHERE id = ?").run(String(deviceId), lic.id);
    } else if (decision.action === "rebind") {
      db.transaction(() => {
        db.prepare("UPDATE licenses SET device_id = ? WHERE id = ?").run(String(deviceId), lic.id);
        db.prepare("INSERT INTO license_device_changes (license_id, old_device_id, new_device_id) VALUES (?, ?, ?)")
          .run(lic.id, lic.device_id, String(deviceId));
      })();
    } else if (decision.action === "deny") {
      const limit = decision.reason === "REBIND_LIMIT";
      return res.status(403).json({
        error: limit
          ? "Ce compte est lié à un autre téléphone et la limite de changements est atteinte. Contactez l'assistance."
          : "Licence liée à un autre téléphone",
        code: limit ? "REBIND_LIMIT" : "DEVICE_MISMATCH",
      });
    }
  }

  res.json({ token: sign(c.id, c.name) });
});

// Vérification de session au lancement de l'app : requireAuth contrôle le jeton, la licence (active, non révoquée) et le téléphone lié.
router.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, name: req.client.name });
});

module.exports = router;
