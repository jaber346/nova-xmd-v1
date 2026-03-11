// commands/goodbye.js
const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "../data", "goodbye.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ goodbye: false }, null, 2));
  }
}
function readDb() {
  ensureDb();
  try {
    const j = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    return { goodbye: !!j.goodbye };
  } catch {
    return { goodbye: false };
  }
}
function writeDb(obj) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify({ goodbye: !!obj.goodbye }, null, 2));
}

function newsletterCtx() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363423249667073@newsletter",
      newsletterName: config.BOT_NAME || "NOVA XMD V1",
      serverMessageId: 1,
    },
  };
}

module.exports = {
  name: "goodbye",
  category: "Group",
  description: "goodbye on/off",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;
    const { isGroup, prefix = config.PREFIX || "." } = extra;

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Groupe uniquement." }, { quoted: m });
    }

    const sub = (args[0] || "").toLowerCase();
    const db = readDb();

    if (sub === "on") {
      db.goodbye = true;
      writeDb(db);
      return sock.sendMessage(from, { text: "✅ Goodbye : *ON*", contextInfo: newsletterCtx() }, { quoted: m });
    }

    if (sub === "off") {
      db.goodbye = false;
      writeDb(db);
      return sock.sendMessage(from, { text: "❌ Goodbye : *OFF*", contextInfo: newsletterCtx() }, { quoted: m });
    }

    return sock.sendMessage(
      from,
      { text: `Utilisation :\n${prefix}goodbye on\n${prefix}goodbye off`, contextInfo: newsletterCtx() },
      { quoted: m }
    );
  },
};