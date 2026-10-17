const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { normalize } = require("../services/licenses");
const { settlePayment } = require("../services/settle");



const router = express.Router();
const DATA = path.join(__dirname, "../../data");
fs.mkdirSync(DATA, { recursive: true });
const APK = process.env.APK_PATH || path.join(DATA, "app.apk");

function log(obj) {
  try {
    fs.appendFileSync(path.join(DATA, "payments-debug.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...obj }) + "\n");
  } catch (e) {}
}

const page = (title, body) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;line-height:1.5}.code{font-size:28px;font-weight:700;letter-spacing:2px;background:#eef;padding:14px;border-radius:10px;text-align:center;user-select:all}a.btn{display:block;text-align:center;background:#0B1620;color:#fff;padding:14px;border-radius:10px;text-decoration:none;margin:12px 0}</style></head><body><h2>${title}</h2>${body}</body></html>`;

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 600000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 10;
}

const cleanRef = (v) => String(v || "").replace(/[^A-Za-z0-9]/g, "");

function startPayment(referralCode, phone) {
  const amount = parseInt(process.env.APP_PRICE, 10);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("APP_PRICE absent ou invalide");
  }

  const reference =
    "RTL" + Date.now() +
    crypto.randomBytes(8).toString("hex").toUpperCase();

  db.prepare(
    "INSERT INTO payments (reference, amount, phone, referral_code, provider) VALUES (?, ?, ?, ?, ?)"
  ).run(reference, amount, phone, referralCode || null, "airtel_money_manual");

  return { reference, amount };
}

async function confirm(reference) {
  const p = db.prepare(
    "SELECT * FROM payments WHERE reference = ?"
  ).get(reference);

  if (!p) return { state: "unknown" };
  if (p.status !== "paid") return { state: "pending" };

  const lic = db.prepare(
    "SELECT code FROM licenses WHERE id = ?"
  ).get(p.license_id);

  if (!lic) return { state: "pending" };
  return { state: "paid", code: lic.code };
}


router.get("/buy", (req, res) => {
  const referralCode = req.query.ref
    ? cleanRef(normalize(req.query.ref)).slice(0, 32)
    : "";

  const body =
    '<form method="post" action="/payments/request">' +
    '<label for="phone">Numéro Airtel Money utilisé pour le versement</label>' +
    '<input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" ' +
    'required maxlength="20" placeholder="Ex. 077XXXXXX" ' +
    'style="width:100%;padding:12px;box-sizing:border-box;font-size:16px">' +
    '<input type="hidden" name="ref" value="' + referralCode + '">' +
    '<button class="btn" type="submit">Créer ma demande</button>' +
    '</form>' +
    '<p>Après la création, versez le montant indiqué au numéro Airtel Money communiqué par votre vendeur. ' +
    'La demande sera validée uniquement après vérification effective de la réception.</p>';

  return res.send(page("Demande de paiement Airtel Money", body));
});

router.post("/request", express.urlencoded({ extended: false }), (req, res) => {
  if (limited(req.ip)) {
    return res.status(429).send(
      page("Trop de tentatives", "<p>Réessayez dans quelques minutes.</p>")
    );
  }

  const phone = String(req.body.phone || "").trim().replace(/[\s().-]/g, "");
  const digits = phone.replace(/\D/g, "");

  if (!/^\+?[0-9]{8,15}$/.test(phone) || digits.length < 8 || digits.length > 15) {
    return res.status(400).send(
      page("Numéro invalide", '<p>Vérifiez le numéro de téléphone puis réessayez.</p><a class="btn" href="/payments/buy">Retour</a>')
    );
  }

  const referralCode = req.body.ref
    ? cleanRef(normalize(req.body.ref)).slice(0, 32)
    : null;

  try {
    const { reference, amount } = startPayment(referralCode, digits);
    const amountText = amount.toLocaleString("fr-FR");

    const body =
      "<p>Montant à verser : <strong>" + amountText + " FCFA</strong></p>" +
      "<p>Numéro du payeur enregistré : <strong>" + digits + "</strong></p>" +
      "<p>Effectuez le versement auprès de votre vendeur et conservez cette référence :</p>" +
      '<div class="code">' + reference + "</div>" +
      "<p>Le code d’activation sera disponible après vérification effective du paiement et validation par l’administrateur.</p>" +
      '<a class="btn" href="/payments/success?ref=' + reference + '">Vérifier ma demande</a>';

    return res.send(page("Demande créée", body));
  } catch (e) {
    console.error("[payment request]", e.message);
    return res.status(500).send(
      page("Erreur", "<p>Impossible de créer la demande. Réessayez plus tard.</p>")
    );
  }
});

router.get("/success", async (req, res) => {
  const ref = cleanRef(req.query.ref);
  const r = await confirm(ref);
  if (r.state === "paid") {
    const apk = fs.existsSync(APK) ? `<a class="btn" href="/payments/apk?ref=${ref}">Télécharger l'application</a>` : "";
    return res.send(page("Paiement confirmé ✅", `<p>Votre code d'activation :</p><div class="code">${r.code}</div><p>Notez-le. Il ne fonctionne que sur un seul téléphone.</p>${apk}<p>Ouvrez l'application, entrez ce code, puis créez votre compte.</p>`));
  }
  if (r.state === "unknown") return res.status(404).send(page("Référence inconnue", "<p>Vérifiez votre lien de paiement.</p>"));
  res.send(page("Vérification en cours…", `<p>Nous vérifions votre paiement. Cette page se met à jour toute seule.</p><p>Référence : ${ref}</p><p>Sans changement après 10 minutes, contactez votre vendeur avec cette référence.</p><script>setTimeout(function(){location.reload()},6000)</script>`));
});

router.get("/error", (req, res) => {
  res.send(page("Paiement non abouti", `<p>Le paiement n'a pas été confirmé.</p><a class="btn" href="/payments/buy">Réessayer</a>`));
});

router.get("/apk", async (req, res) => {
  const r = await confirm(cleanRef(req.query.ref));
  if (r.state !== "paid" || !fs.existsSync(APK)) return res.status(403).send("Accès refusé");
  res.download(APK, "application.apk");
});

// SingPay appelle cette adresse. On ne se fie jamais au message :
// il sert seulement de déclencheur, le statut est revérifié auprès de SingPay.
router.post("/webhook/singpay", express.urlencoded({ extended: true }), (req, res) => {
  log({ type: "webhook-ignored-manual-mode" });
  return res.status(200).json({ received: true, mode: "manual" });
});

module.exports = router;
