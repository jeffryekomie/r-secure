const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

const { requireAdmin } = require("../middleware/admin");

router.use(requireAdmin);

router.get("/", (req, res) => {
  const status = req.query.status;
  const allowed = ["pending", "paid", "rejected"];

  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: "Statut invalide." });
  }

  const withdrawals = status
    ? db.prepare(`
        SELECT w.*, c.name AS client_name, c.phone AS client_phone
        FROM withdrawal_requests w
        JOIN clients c ON c.id = w.client_id
        WHERE w.status = ?
        ORDER BY w.id DESC LIMIT 200
      `).all(status)
    : db.prepare(`
        SELECT w.*, c.name AS client_name, c.phone AS client_phone
        FROM withdrawal_requests w
        JOIN clients c ON c.id = w.client_id
        ORDER BY w.id DESC LIMIT 200
      `).all();

  res.json({ withdrawals });
});

router.post("/:id/pay", (req, res) => {
  const id = Number(req.params.id);
  const reference = String(req.body?.transfer_reference || "").trim();
  const note = String(req.body?.admin_note || "").trim();

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }

  if (!reference || reference.length > 150) {
    return res.status(400).json({
      error: "La référence du transfert réellement effectué est obligatoire."
    });
  }

  try {
    const pay = db.transaction(() => {
      const result = db.prepare(`
        UPDATE withdrawal_requests
        SET status = 'paid',
            transfer_reference = ?,
            admin_note = ?,
            updated_at = CURRENT_TIMESTAMP,
            processed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `).run(reference, note || null, id);

      return result.changes;
    });

    if (pay.immediate() !== 1) {
      return res.status(409).json({
        error: "Demande introuvable ou déjà traitée."
      });
    }

    res.json({ ok: true, message: "Paiement enregistré." });
  } catch (error) {
    console.error("[admin-withdrawals] Paiement :", error.message);
    res.status(500).json({ error: "Erreur lors du traitement." });
  }
});

router.post("/:id/reject", (req, res) => {
  const id = Number(req.params.id);
  const note = String(req.body?.admin_note || "").trim();

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }

  try {
    const reject = db.transaction(() => {
      return db.prepare(`
        UPDATE withdrawal_requests
        SET status = 'rejected',
            admin_note = ?,
            updated_at = CURRENT_TIMESTAMP,
            processed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `).run(note || null, id).changes;
    });

    if (reject.immediate() !== 1) {
      return res.status(409).json({
        error: "Demande introuvable ou déjà traitée."
      });
    }

    res.json({
      ok: true,
      message: "Demande rejetée ; le montant réservé est libéré."
    });
  } catch (error) {
    console.error("[admin-withdrawals] Rejet :", error.message);
    res.status(500).json({ error: "Erreur lors du traitement." });
  }
});

module.exports = router;
