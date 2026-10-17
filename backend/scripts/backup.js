// Sauvegarde de la base SQLite (cohérente, même serveur en marche).
// Usage : node scripts/backup.js
// Variables facultatives : DB_PATH, BACKUP_DIR (défaut ~/rsecure-backups),
// BACKUP_COPY_DIR (2e copie, ex. ~/storage/downloads), BACKUP_KEEP (défaut 14).
require("dotenv").config();
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = process.env.DB_PATH || "./data/rtlconnect.db";
const outDir = process.env.BACKUP_DIR || path.join(os.homedir(), "rsecure-backups");
const copyDir = process.env.BACKUP_COPY_DIR || "";
const keep = Math.max(1, parseInt(process.env.BACKUP_KEEP, 10) || 14);

function purge(dir) {
  const files = fs.readdirSync(dir).filter((f) => /^rtlconnect-.*\.db$/.test(f)).sort();
  for (const f of files.slice(0, Math.max(0, files.length - keep))) fs.unlinkSync(path.join(dir, f));
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const dest = path.join(outDir, `rtlconnect-${stamp}.db`);

  const src = new Database(dbPath, { fileMustExist: true });
  try {
    await src.backup(dest);
  } finally {
    src.close();
  }
  purge(outDir);
  console.log("Sauvegarde OK :", dest);

  if (copyDir) {
    fs.mkdirSync(copyDir, { recursive: true });
    fs.copyFileSync(dest, path.join(copyDir, path.basename(dest)));
    purge(copyDir);
    console.log("2e copie OK :", copyDir);
  }
})().catch((e) => {
  console.error("Échec de la sauvegarde :", e.message);
  process.exit(1);
});
