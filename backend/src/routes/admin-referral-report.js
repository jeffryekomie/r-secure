const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

const { requireAdmin } = require("../middleware/admin");

router.use(requireAdmin);

// Bilan financier de chaque parrain, sans modifier les données.
router.get("/summary", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        c.id AS client_id,
        c.name,
        c.phone,
        rc.code AS referral_code,
        (
          SELECT COUNT(*)
          FROM licenses l
          WHERE l.referrer_client_id = c.id
            AND l.status != 'revoked'
        ) AS sales_count,
        (
          SELECT COALESCE(SUM(l.commission_amount), 0)
          FROM licenses l
          WHERE l.referrer_client_id = c.id
            AND l.status != 'revoked'
        ) AS earned,
        (
          SELECT COALESCE(SUM(l.commission_paid), 0)
          FROM licenses l
          WHERE l.referrer_client_id = c.id
            AND l.status != 'revoked'
        ) AS legacy_paid,
        (
          SELECT COALESCE(SUM(w.amount), 0)
          FROM withdrawal_requests w
          WHERE w.client_id = c.id AND w.status = 'paid'
        ) AS withdrawal_paid,
        (
          SELECT COALESCE(SUM(w.amount), 0)
          FROM withdrawal_requests w
          WHERE w.client_id = c.id AND w.status = 'pending'
        ) AS reserved
      FROM clients c
      JOIN referral_codes rc ON rc.client_id = c.id
      ORDER BY c.name COLLATE NOCASE
    `).all();

    const result = rows.map(row => {
      const paid = Number(row.legacy_paid || 0)
        + Number(row.withdrawal_paid || 0);
      const reserved = Number(row.reserved || 0);
      const earned = Number(row.earned || 0);

      return {
        client_id: row.client_id,
        name: row.name,
        phone: row.phone,
        referral_code: row.referral_code,
        sales_count: Number(row.sales_count || 0),
        earned,
        paid,
        reserved,
        balance: earned - paid - reserved
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Erreur bilan des commissions :", error);
    res.status(500).json({ error: "Impossible de charger le bilan des commissions" });
  }
});

// Historique des licences et de leur attribution.
router.get("/sales", (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;

    const rows = db.prepare(`
      SELECT
        l.id AS license_id,
        l.code AS license_code,
        l.status AS license_status,
        l.created_at AS license_created_at,
        l.activated_at,
        l.commission_amount,
        l.commission_paid,
        c.name AS client_name,
        c.phone AS client_phone,
        p.reference AS payment_reference,
        p.amount AS payment_amount,
        p.currency AS payment_currency,
        p.status AS payment_status,
        p.referral_code AS used_referral_code,
        r.name AS referrer_name,
        r.phone AS referrer_phone
      FROM licenses l
      LEFT JOIN clients c ON c.id = l.client_id
      LEFT JOIN clients r ON r.id = l.referrer_client_id
      LEFT JOIN payments p ON p.id = (
        SELECT p2.id
        FROM payments p2
        WHERE p2.license_id = l.id
        ORDER BY p2.id DESC
        LIMIT 1
      )
      WHERE (
        @q = ''
        OR l.code LIKE @like
        OR c.name LIKE @like
        OR c.phone LIKE @like
        OR r.name LIKE @like
        OR r.phone LIKE @like
        OR p.reference LIKE @like
        OR p.referral_code LIKE @like
      )
      ORDER BY l.id DESC
      LIMIT 200
    `).all({ q, like });

    res.json(rows.map(row => {
      let attribution = "Sans code de parrainage";
      if (row.used_referral_code) {
        attribution = row.referrer_name
          ? "Parrain attribué"
          : "Code utilisé, parrain non attribué";
      }

      return {
        ...row,
        attribution,
        commission_amount: Number(row.commission_amount || 0),
        commission_paid: Number(row.commission_paid || 0),
        commission_due: Math.max(
          0,
          Number(row.commission_amount || 0)
            - Number(row.commission_paid || 0)
        )
      };
    }));
  } catch (error) {
    console.error("Erreur historique des ventes :", error);
    res.status(500).json({ error: "Impossible de charger l'historique des ventes" });
  }
});

module.exports = router;
