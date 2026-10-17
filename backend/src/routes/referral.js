const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getOrCreateReferralCode } = require("../services/licenses");

const router = express.Router();

router.get("/me", requireAuth, (req, res) => {
  const clientId = req.client.id;
  const code = getOrCreateReferralCode(clientId);

  const referrals = db.prepare(`
    SELECT c.name, l.activated_at,
           l.commission_amount, l.commission_paid
    FROM licenses l
    LEFT JOIN clients c ON c.id = l.client_id
    WHERE l.referrer_client_id = ? AND l.status != 'revoked'
    ORDER BY l.id DESC
  `).all(clientId);

  const earned = referrals.reduce(
    (sum, row) => sum + Number(row.commission_amount || 0), 0
  );

  const legacyPaid = referrals.reduce(
    (sum, row) => sum + Number(row.commission_paid || 0), 0
  );

  const withdrawals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS reserved
    FROM withdrawal_requests
    WHERE client_id = ?
  `).get(clientId);

  const paid = legacyPaid + Number(withdrawals.paid || 0);
  const reserved = Number(withdrawals.reserved || 0);
  const balance = earned - paid - reserved;

  res.json({ code, referrals, earned, paid, reserved, balance });
});

module.exports = router;
