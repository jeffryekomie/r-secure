const crypto = require("crypto");
const db = require("../db");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function chunk(n) {
  const b = crypto.randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

const normalize = (c) => String(c || "").trim().toUpperCase();

function getOrCreateReferralCode(clientId) {
  const get = () => db.prepare("SELECT code FROM referral_codes WHERE client_id = ?").get(clientId);
  const row = get();
  if (row) return row.code;
  for (let i = 0; i < 5; i++) {
    const code = "P" + chunk(6);
    try {
      db.prepare("INSERT INTO referral_codes (client_id, code) VALUES (?, ?)").run(clientId, code);
      return code;
    } catch (e) {
      const again = get();
      if (again) return again.code;
    }
  }
  throw new Error("Impossible de générer un code de parrainage");
}

// Appelée après un paiement confirmé (et par l'admin pour les tests).
// Le parrain doit lui-même avoir une licence active.
function createLicense({ referralCode = null, amountPaid = 0 } = {}) {
  let referrerId = null;
  if (referralCode) {
    const r = db
      .prepare(
        `SELECT rc.client_id FROM referral_codes rc
         JOIN licenses l ON l.client_id = rc.client_id AND l.status = 'active'
         WHERE rc.code = ?`
      )
      .get(normalize(referralCode));
    if (r) referrerId = r.client_id;
  }
  const percent = Number(process.env.COMMISSION_PERCENT || 0);
  const commission = referrerId ? Math.round((Number(amountPaid) * percent) / 100) : 0;

  for (let i = 0; i < 5; i++) {
    const code = `RTL-${chunk(4)}-${chunk(4)}`;
    try {
      const info = db
        .prepare("INSERT INTO licenses (code, referrer_client_id, commission_amount) VALUES (?, ?, ?)")
        .run(code, referrerId, commission);
      return { id: info.lastInsertRowid, code, referrerId, commission };
    } catch (e) {
      /* collision de code : on réessaie */
    }
  }
  throw new Error("Impossible de générer une licence");
}

module.exports = { normalize, getOrCreateReferralCode, createLicense };
