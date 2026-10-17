const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function getBalance(clientId) {
  const earned = db.prepare(`
    SELECT COALESCE(SUM(commission_amount), 0) AS total
    FROM licenses
    WHERE referrer_client_id = ? AND status != 'revoked'
  `).get(clientId).total;

  const legacyPaid = db.prepare(`
    SELECT COALESCE(SUM(commission_paid), 0) AS total
    FROM licenses
    WHERE referrer_client_id = ? AND status != 'revoked'
  `).get(clientId).total;

  const withdrawals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS reserved,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid
    FROM withdrawal_requests
    WHERE client_id = ?
  `).get(clientId);

  return {
    earned,
    legacyPaid,
    withdrawalPaid: withdrawals.paid,
    reserved: withdrawals.reserved,
    availableBalance:
      earned - legacyPaid - withdrawals.paid - withdrawals.reserved
  };
}

router.get("/", requireAuth, (req, res) => {
  const balance = getBalance(req.client.id);

  const withdrawals = db.prepare(`
    SELECT id, amount, method, recipient_phone, account_name,
           status, transfer_reference, admin_note, created_at,
           updated_at, processed_at
    FROM withdrawal_requests
    WHERE client_id = ?
    ORDER BY id DESC
    LIMIT 100
  `).all(req.client.id);

  res.json({ ...balance, minimumWithdrawal: 2000, withdrawals });
});

router.post("/", requireAuth, (req, res) => {
  const amount = req.body?.amount;
  const method = req.body?.method;
  const phone = String(req.body?.recipient_phone || "").trim();
  const accountName = String(req.body?.account_name || "").trim();

  if (!Number.isSafeInteger(amount) || amount < 2000) {
    return res.status(400).json({
      error: "Le retrait minimum est de 2 000 FCFA."
    });
  }

  if (!["airtel_money", "moov_money"].includes(method)) {
    return res.status(400).json({
      error: "Choisissez Airtel Money ou Moov Money."
    });
  }

  if (!/^\+?[0-9]{8,15}$/.test(phone)) {
    return res.status(400).json({
      error: "Numéro de téléphone invalide."
    });
  }

  if (accountName.length < 2 || accountName.length > 100) {
    return res.status(400).json({
      error: "Le nom du titulaire doit contenir entre 2 et 100 caractères."
    });
  }

  try {
    const createRequest = db.transaction(() => {
      const balance = getBalance(req.client.id);

      if (balance.availableBalance < 0 ||
          amount > balance.availableBalance) {
        const error = new Error("Solde disponible insuffisant.");
        error.status = 409;
        throw error;
      }

      const result = db.prepare(`
        INSERT INTO withdrawal_requests
          (client_id, amount, method, recipient_phone, account_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.client.id, amount, method, phone, accountName);

      return {
        id: Number(result.lastInsertRowid),
        ...getBalance(req.client.id)
      };
    });

    const result = createRequest.immediate();
    return res.status(201).json({
      ok: true,
      message: "Demande enregistrée et montant réservé.",
      ...result
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[withdrawals] Création impossible :", error.message);
    return res.status(500).json({
      error: "Impossible d'enregistrer la demande."
    });
  }
});

module.exports = router;
