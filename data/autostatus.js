// ==================== data/autostatus.js ====================
const fs = require("fs");
const path = require("path");

const dbPath = path.join(process.cwd(), "data", "autostatus.json");

function ensureDb() {
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ enabled: true }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    return typeof data === "object" && data ? data : { enabled: true };
  } catch {
    const def = { enabled: true };
    fs.writeFileSync(dbPath, JSON.stringify(def, null, 2));
    return def;
  }
}

module.exports = async (sock, m) => {
  try {
    const jid = m?.key?.remoteJid;

    if (jid !== "status@broadcast") return;
    if (!m?.key) return;

    const db = readDb();
    if (!db.enabled) return;

    await sock.readMessages([m.key]);
  } catch (e) {
    console.log("AUTOSTATUS ERROR:", e?.message || e);
  }
};