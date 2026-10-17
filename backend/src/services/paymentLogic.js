function walk(obj, fn) {
  const stack = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (cur && typeof cur === "object") {
      for (const [k, v] of Object.entries(cur)) {
        fn(k, v);
        if (v && typeof v === "object") stack.push(v);
      }
    }
  }
}
const scalar = (v) => v !== null && typeof v !== "object";

function collect(data, keys) {
  const wanted = keys.map((k) => k.toLowerCase());
  const out = [];
  walk(data, (k, v) => { if (wanted.includes(k.toLowerCase()) && scalar(v)) out.push(v); });
  return out;
}
const findKey = (data, keys) => { const a = collect(data, keys); return a.length ? a[0] : null; };

function findLink(data) {
  if (typeof data === "string" && /^https?:\/\//.test(data)) return data;
  const byKey = collect(data, ["link", "url", "lien", "payment_url", "paymentUrl", "redirect_url", "redirectUrl", "checkout_url"])
    .find((v) => typeof v === "string" && /^https?:\/\//.test(v));
  if (byKey) return byKey;
  let any = null;
  walk(data, (k, v) => { if (!any && typeof v === "string" && /^https?:\/\//.test(v)) any = v; });
  return any;
}

function findReference(data) {
  return collect(data, ["reference", "ref", "merchant_reference", "transaction_reference"])
    .find((v) => typeof v === "string" && /^RTL[0-9A-F]+$/i.test(v)) || null;
}

const OK = new Set(["success", "succes", "succès", "successful", "succeeded", "paid", "completed", "complete", "approved"]);
const STRICT = new Set(["paid", "completed", "successful", "succeeded"]);
function isPaid(data, expectedAmount, reference) {
  if (typeof data === "string" || data == null) return false;
  const refs = collect(data, ["reference"]).filter((v) => typeof v === "string");
  if (reference && refs.length && !refs.includes(reference)) return false;
  const amt = Number(findKey(data, ["amount", "montant"]));
  if (Number.isFinite(amt) && amt > 0 && amt < expectedAmount) return false;
  const results = collect(data, ["result"]).filter((v) => typeof v === "string");
  if (results.length) return results.some((v) => OK.has(v.trim().toLowerCase()));
  const states = collect(data, ["status", "state", "statut", "payment_status"]).filter((v) => typeof v === "string");
  return states.some((v) => STRICT.has(v.trim().toLowerCase()));
}

module.exports = { findLink, findReference, isPaid };
