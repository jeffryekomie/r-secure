const crypto = require("crypto");
const { limits, clientIp, tooMany } = require("./rateLimit");

// Clé admin : comparaison en temps constant, et blocage après 10 clés fausses en 15 minutes par IP.
function requireAdmin(req, res, next) {
  const ip = clientIp(req);
  const st = limits.adminFail.status(ip);
  if (st.blocked) return tooMany(res, st.retryAfter);

  const key = process.env.ADMIN_KEY || "";
  const given = req.headers["x-admin-key"];
  const a = Buffer.from(key);
  const b = Buffer.from(typeof given === "string" ? given : "");
  if (!key || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    limits.adminFail.hit(ip);
    return res.status(403).json({ error: "Accès refusé" });
  }
  next();
}

module.exports = { requireAdmin };
