const express = require("express");
const db = require("../db");

const router = express.Router();

// Publique (pas d'auth) : un client doit pouvoir trouver ce numéro même s'il n'arrive plus à se connecter
router.get("/", (req, res) => {
  const contacts = db.prepare("SELECT label, value, description FROM support_contacts ORDER BY sort_order").all();
  res.json(contacts);
});

module.exports = router;
