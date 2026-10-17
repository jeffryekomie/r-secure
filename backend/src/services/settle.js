const db = require("../db");
const { createLicense } = require("./licenses");

// Marque un paiement comme payé et crée la licence (une seule fois).
function settlePayment(reference) {
  return db.transaction(() => {
    const p = db.prepare("SELECT * FROM payments WHERE reference = ?").get(reference);
    if (!p) return null;
    if (p.status !== "paid") {
      // Aucun code avant confirmation manuelle de la réception.
      if (!p.receipt_confirmed_at) return null;
      const lic = createLicense({ referralCode: p.referral_code, amountPaid: p.amount });
      db.prepare("UPDATE payments SET status = 'paid', paid_at = CURRENT_TIMESTAMP, license_id = ? WHERE reference = ?")
        .run(lic.id, reference);
      return lic.code;
    }
    const existing = p.license_id
      ? db.prepare("SELECT code FROM licenses WHERE id = ?").get(p.license_id)
      : null;
    return existing ? existing.code : null;
  })();
}

module.exports = { settlePayment };
