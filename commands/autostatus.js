// commands/autostatus.js
const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "../data/autostatus.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify({ enabled: false }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const j = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    return { enabled: !!j.enabled };
  } catch {
    return { enabled: false };
  }
}

function writeDb(obj) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify({ enabled: !!obj.enabled }, null, 2));
}

// ✅ sync DB -> global
function syncGlobalFromDb() {
  const db = readDb();
  global.autoStatus = !!db.enabled;
  return db;
}

module.exports = {
  name: "autostatus",
  category: "Owner",
  description: "Auto view status (on/off/status)",

  async execute(sock, m, args, { isOwner, prefix } = {}) {
    const from = m.key.remoteJid;
    const p = prefix || config.PREFIX || ".";

    if (!isOwner) {
      return sock.sendMessage(from, { text: "🚫 Commande réservée au propriétaire." }, { quoted: m });
    }

    const sub = String(args[0] || "").toLowerCase();

    // always sync first (au cas où reboot)
    const db = syncGlobalFromDb();

    if (["on", "1", "enable"].includes(sub)) {
      db.enabled = true;
      writeDb(db);
      global.autoStatus = true; // ✅ IMPORTANT
      return sock.sendMessage(from, { text: "✅ AutoStatus activé." }, { quoted: m });
    }

    if (["off", "0", "disable"].includes(sub)) {
      db.enabled = false;
      writeDb(db);
      global.autoStatus = false; // ✅ IMPORTANT
      return sock.sendMessage(from, { text: "❌ AutoStatus désactivé." }, { quoted: m });
    }

    if (sub === "status") {
      return sock.sendMessage(
        from,
        { text: `📌 AutoStatus: *${global.autoStatus ? "ON ✅" : "OFF ❌"}*` },
        { quoted: m }
      );
    }

    return sock.sendMessage(
      from,
      { text: `Utilisation:\n${p}autostatus on\n${p}autostatus off\n${p}autostatus status` },
      { quoted: m }
    );
  }
};