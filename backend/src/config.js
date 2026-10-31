// Réglages critiques : on refuse de démarrer plutôt que de s'ouvrir par erreur.

// Le verrou de licence est ACTIF par défaut. Seule la valeur exacte "false"
// le désactive (pour du développement local uniquement).
const licenseRequired = () => process.env.LICENSE_REQUIRED !== "false";

// Changements de téléphone autorisés sans l'administrateur : DEVICE_REBIND_MAX par fenêtre de
// DEVICE_REBIND_DAYS jours (défaut 2 par 30 jours). 0 = jamais : seul l'administrateur peut lier un nouveau téléphone.
function deviceRebindPolicy(env = process.env) {
  const max = parseInt(env.DEVICE_REBIND_MAX, 10);
  const days = parseInt(env.DEVICE_REBIND_DAYS, 10);
  return {
    max: Number.isInteger(max) && max >= 0 ? max : 2,
    days: Number.isInteger(days) && days > 0 ? days : 30,
  };
}

function validateEnv(env = process.env, log = console, exit = process.exit) {
  const missing = ["JWT_SECRET", "ADMIN_KEY", "APP_PRICE"].filter(
    (k) => !String(env[k] || "").trim()
  );
  if (missing.length) {
    log.error("[config] Variables manquantes dans .env : " + missing.join(", ") + ". Démarrage annulé.");
    exit(1);
    return false;
  }

  const price = parseInt(env.APP_PRICE, 10);
  if (!Number.isSafeInteger(price) || price <= 0) {
    log.error("[config] APP_PRICE doit être un entier positif (ex. 910). Démarrage annulé.");
    exit(1);
    return false;
  }

  if (String(env.JWT_SECRET).length < 16) {
    log.warn("[config] JWT_SECRET est court : utilisez au moins 32 caractères aléatoires.");
  }
  if (!String(env.COMMISSION_PERCENT || "").trim()) {
    log.warn("[config] COMMISSION_PERCENT absent : aucune commission de parrainage ne sera créditée.");
  }
  if (env.LICENSE_REQUIRED === "false") {
    log.warn("[config] LICENSE_REQUIRED=false : l'inscription est LIBRE, sans code. Ne jamais l'utiliser en production.");
  }
  return true;
}

module.exports = { licenseRequired, deviceRebindPolicy, validateEnv };
