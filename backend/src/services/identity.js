// Normalisation des numéros de téléphone : un même numéro tapé de plusieurs façons
// (077…, +241 077…, 00241077…, 241077…) donne UN seul compte.
//
// Forme enregistrée :
//  - numéro du pays par défaut (Gabon, indicatif 241) : chiffres « locaux » sans l'indicatif ;
//  - numéro d'un autre pays : "+" suivi de l'indicatif et du numéro.
// Aucune hypothèse n'est faite sur le « 0 » initial : il est conservé tel que saisi.

const DEFAULT_CC = () => String(process.env.DEFAULT_COUNTRY_CODE || "241");

function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || !/^[+\d\s().-]+$/.test(s)) return null;

  const cc = DEFAULT_CC();
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;

  let international = s.startsWith("+");
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }
  // Indicatif tapé sans « + » (ex. 241077123456) : seulement si le numéro est assez long pour le contenir.
  if (!international && digits.startsWith(cc) && digits.length >= cc.length + 8) {
    international = true;
  }

  if (international) {
    if (digits.startsWith(cc)) {
      const national = digits.slice(cc.length);
      return national.length >= 7 && national.length <= 10 ? national : null;
    }
    return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;
  }

  return digits.length >= 7 && digits.length <= 10 ? digits : null;
}

// Met les numéros déjà enregistrés au format normalisé (une seule fois au démarrage).
// Un numéro qui entrerait en collision avec un autre compte n'est pas modifié.
function migrateClientPhones(db, log = console) {
  const rows = db.prepare("SELECT id, phone FROM clients").all();
  const taken = new Set(rows.map((r) => r.phone));
  const update = db.prepare("UPDATE clients SET phone = ? WHERE id = ?");
  let changed = 0;
  let skipped = 0;

  db.exec("BEGIN");
  try {
    for (const r of rows) {
      const canon = normalizePhone(r.phone);
      if (!canon || canon === r.phone) continue;
      if (taken.has(canon)) {
        skipped++;
        log.warn(`[identité] Compte ${r.id} : le numéro normalisé existe déjà, laissé tel quel.`);
        continue;
      }
      update.run(canon, r.id);
      taken.delete(r.phone);
      taken.add(canon);
      changed++;
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  if (changed || skipped) log.log(`[identité] Numéros normalisés : ${changed}, conflits ignorés : ${skipped}.`);
  return { changed, skipped };
}

module.exports = { normalizePhone, migrateClientPhones };
