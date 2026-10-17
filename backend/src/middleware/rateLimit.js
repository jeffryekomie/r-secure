// Limitation de tentatives en mémoire (sans dépendance). Fenêtre glissante par clé.
// La mémoire repart à zéro au redémarrage du serveur, ce qui est acceptable pour freiner la force brute.

function createLimiter({ windowMs, max, now = Date.now }) {
  const hits = new Map(); // clé -> horodatages (ms), du plus ancien au plus récent

  function recent(key) {
    const t = now();
    const arr = (hits.get(key) || []).filter((ts) => t - ts < windowMs);
    if (arr.length) hits.set(key, arr);
    else hits.delete(key);
    return arr;
  }

  return {
    // Indique si la clé est bloquée, sans rien compter.
    status(key) {
      const arr = recent(key);
      if (arr.length >= max) {
        const retryAfter = Math.max(1, Math.ceil((arr[arr.length - max] + windowMs - now()) / 1000));
        return { blocked: true, retryAfter };
      }
      return { blocked: false, retryAfter: 0 };
    },
    hit(key) {
      const arr = recent(key);
      arr.push(now());
      hits.set(key, arr);
    },
    reset(key) {
      hits.delete(key);
    },
    sweep() {
      for (const key of [...hits.keys()]) recent(key);
    },
    size: () => hits.size,
  };
}

const MIN = 60 * 1000;

const limits = {
  loginIp: createLimiter({ windowMs: 15 * MIN, max: 10 }), // échecs de connexion par adresse IP
  loginPhone: createLimiter({ windowMs: 15 * MIN, max: 5 }), // échecs de connexion par numéro
  registerIp: createLimiter({ windowMs: 60 * MIN, max: 10 }), // tentatives d'inscription par IP
  licenseFail: createLimiter({ windowMs: 60 * MIN, max: 10 }), // codes d'activation invalides par IP
  adminFail: createLimiter({ windowMs: 15 * MIN, max: 10 }), // clés admin fausses par IP
};

// Nettoyage périodique pour que la mémoire ne grossisse pas.
const sweeper = setInterval(() => Object.values(limits).forEach((l) => l.sweep()), 5 * MIN);
if (sweeper.unref) sweeper.unref();

function clientIp(req) {
  return String(req.ip || (req.socket && req.socket.remoteAddress) || "inconnu");
}

function tooMany(res, retryAfter) {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  res.set("Retry-After", String(retryAfter));
  return res.status(429).json({
    error: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
    code: "RATE_LIMITED",
    retryAfter,
  });
}

module.exports = { createLimiter, limits, clientIp, tooMany };
