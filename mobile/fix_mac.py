from pathlib import Path

p = Path("src/api/client.js")
s = p.read_text()

marker = "async function blockMac(rawMac) {"
helper = """function normalizeMac(rawMac) {
  const value = String(rawMac || "").trim().replace(/-/g, ":");
  if (!/^(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(value)) {
    throw new Error("Adresse MAC invalide : format attendu AA:BB:CC:DD:EE:FF.");
  }
  return value.toUpperCase();
}

"""

if s.count(marker) != 1:
    raise SystemExit("ARRÊT : emplacement introuvable ou ambigu.")

if "function normalizeMac(rawMac)" in s:
    raise SystemExit("ARRÊT : normalizeMac existe déjà.")

p.write_text(s.replace(marker, helper + marker, 1))
print("OK : fonction de normalisation ajoutée.")
