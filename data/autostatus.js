// ==================== data/autostatus.js ====================
const fs = require("fs");
const path = require("path");

const dbPath = path.join(process.cwd(), "data", "autostatus.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ enabled: true }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    const def = { enabled: false };
    fs.writeFileSync(dbPath, JSON.stringify(def, null, 2));
    return def;
  }
}

module.exports = async (sock, m) => {
  try {
    const jid = m?.key?.remoteJid;

    // ✅ uniquement les status
    if (jid !== "status@broadcast") return;

    const db = readDb();
    if (!db.enabled) return;

    // ✅ marquer status comme vu
    await sock.readMessages([m.key]);

  } catch (e) {
    console.log("AUTOSTATUS ERROR:", e?.message || e);
  }
};