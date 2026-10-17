const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { normalize, createLicense } = require("../services/licenses");

const { settlePayment } = require("../services/settle");

const router = express.Router();

const { requireAdmin } = require("../middleware/admin");
router.use(requireAdmin);

router.post("/licenses", (req, res) => {
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 1, 1), 50);
  const { referralCode, amountPaid } = req.body;
  const licenses = [];
  for (let i = 0; i < count; i++) licenses.push(createLicense({ referralCode, amountPaid }));
  res.status(201).json({ licenses });
});

function update(sql) {
  return (req, res) => {
    const r = db.prepare(sql).run(normalize(req.params.code));
    if (!r.changes) return res.status(404).json({ error: "Licence introuvable" });
    res.json({ ok: true });
  };
}
router.post("/licenses/:code/reset-device", update("UPDATE licenses SET device_id = NULL WHERE code = ?"));
router.post("/licenses/:code/revoke", update("UPDATE licenses SET status = 'revoked' WHERE code = ?"));
router.post("/licenses/:code/commission-paid", (req, res) => {
  const code = normalize(req.params.code);
  const license = db.prepare(
    "SELECT id, referrer_client_id, commission_amount, commission_paid FROM licenses WHERE code = ?"
  ).get(code);

  if (!license) {
    return res.status(404).json({ error: "Licence introuvable" });
  }

  if (license.commission_amount <= license.commission_paid) {
    return res.status(409).json({
      error: "Cette commission est déjà marquée comme payée."
    });
  }

  if (license.referrer_client_id != null) {
    const withdrawal = db.prepare(
      "SELECT id, status FROM withdrawal_requests WHERE client_id = ? LIMIT 1"
    ).get(license.referrer_client_id);

    if (withdrawal) {
      return res.status(409).json({
        error: "Ce parrain possède un historique de retraits. Utilisez le système de retraits pour éviter un double paiement."
      });
    }
  }

  const result = db.prepare(
    "UPDATE licenses SET commission_paid = commission_amount WHERE id = ? AND commission_paid < commission_amount"
  ).run(license.id);

  if (!result.changes) {
    return res.status(409).json({ error: "Commission déjà traitée ou modifiée." });
  }

  return res.json({ ok: true });
});



router.get("/licenses", (req, res) => {
  res.json(db.prepare("SELECT code, status, client_id, device_id IS NOT NULL AS lie, referrer_client_id AS parrain, commission_amount AS commission, commission_paid AS versee, activated_at FROM licenses ORDER BY id DESC LIMIT 100").all());
});

router.get("/payments", (req, res) => {
  res.json(db.prepare("SELECT reference, amount, provider, status, phone, receipt_confirmed_at, verification_ref, admin_note, referral_code, created_at, paid_at FROM payments ORDER BY id DESC LIMIT 50").all());
});

// Enregistrement des informations administratives d'une demande manuelle.
router.post("/payments/:reference/metadata", (req, res) => {
  const verificationRef = String(req.body.verificationRef || "").trim();
  const adminNote = String(req.body.adminNote || "").trim();

  if (verificationRef.length > 100 || adminNote.length > 500) {
    return res.status(400).json({
      error: "Référence limitée à 100 caractères et note à 500 caractères."
    });
  }

  const result = db.prepare(`
    UPDATE payments
    SET verification_ref = ?, admin_note = ?
    WHERE reference = ?
      AND provider = 'airtel_money_manual'
      AND status = 'pending'
  `).run(
    verificationRef || null,
    adminNote || null,
    req.params.reference
  );

  if (!result.changes) {
    return res.status(409).json({
      error: "Demande introuvable, non manuelle ou déjà traitée."
    });
  }

  res.json({ ok: true, reference: req.params.reference });
});

// À appeler uniquement après vérification réelle du transfert Airtel Money.
router.post("/payments/:reference/confirm-receipt", (req, res) => {
  const result = db.prepare(`
    UPDATE payments
    SET receipt_confirmed_at = CURRENT_TIMESTAMP
    WHERE reference = ?
      AND provider = 'airtel_money_manual'
      AND status = 'pending'
      AND receipt_confirmed_at IS NULL
  `).run(req.params.reference);

  if (!result.changes) {
    return res.status(409).json({
      error: "Paiement non admissible à la confirmation. Vérifiez sa référence et son statut."
    });
  }

  res.json({ ok: true, reference: req.params.reference, receiptConfirmed: true });
});

router.post("/payments/:reference/approve", (req, res) => {
  const payment = db.prepare(
    "SELECT status, receipt_confirmed_at FROM payments WHERE reference = ?"
  ).get(req.params.reference);

  if (!payment) {
    return res.status(404).json({ error: "Paiement introuvable" });
  }

  if (payment.status !== "paid" && !payment.receipt_confirmed_at) {
    return res.status(409).json({
      error: "Réception des fonds non confirmée. Aucun code délivré."
    });
  }

  const code = settlePayment(req.params.reference);
  if (!code) {
    return res.status(409).json({ error: "Paiement non approuvé" });
  }

  res.json({ code });
});


/* Historique des licences : consultation uniquement. */
router.get("/licenses/history", (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    const pattern = "%" + q + "%";

    const rows = db.prepare(`
      SELECT
        l.code,
        l.status AS license_status,
        l.client_id,
        l.created_at AS license_created_at,
        l.activated_at,
        c.name AS client_name,
        c.phone AS client_phone,
        p.reference AS payment_reference,
        p.provider AS payment_provider,
        p.amount AS payment_amount,
        p.currency AS payment_currency,
        p.status AS payment_status,
        p.created_at AS payment_created_at,
        p.paid_at AS payment_paid_at
      FROM licenses l
      LEFT JOIN clients c ON c.id = l.client_id
      LEFT JOIN payments p ON p.id = (
        SELECT p2.id
        FROM payments p2
        WHERE p2.license_id = l.id
        ORDER BY p2.id DESC
        LIMIT 1
      )
      WHERE (
        ? = ''
        OR l.code LIKE ?
        OR EXISTS (
          SELECT 1
          FROM payments px
          WHERE px.license_id = l.id
            AND px.reference LIKE ?
        )
      )
      ORDER BY l.id DESC
      LIMIT 100
    `).all(q, pattern, pattern);

    res.json(rows);
  } catch (error) {
    console.error("Erreur historique licences :", error.message);
    res.status(500).json({ error: "Impossible de consulter l'historique." });
  }
});

module.exports = router;
