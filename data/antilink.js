// data/antilink.js
const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "./antilink.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
}

function readDb() {
  ensureDb();
  try {
    const j = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function newsletterCtx() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363423249667073@newsletter",
      newsletterName: config.BOT_NAME || "NOVA XMD V1",
      serverMessageId: 1
    }
  };
}

function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function isLink(text = "") {
  const t = String(text || "");
  const patterns = [
    /https?:\/\/\S+/i,
    /www\.\S+/i,
    /\b[\w-]+\.(com|net|org|io|app|xyz|me|gg|co|tv|info|biz|site|store|online|link|live)\b/i,
    /wa\.me\/\S+/i,
    /chat\.whatsapp\.com\/\S+/i
  ];
  return patterns.some((r) => r.test(t));
}

module.exports = async (sock, m, from, body) => {
  try {
    if (!m?.message) return;
    if (!from || !from.endsWith("@g.us")) return; // groupe seulement
    if (m.key.fromMe) return;

    const enabledGroups = readDb();
    if (!enabledGroups.includes(from)) return;

    if (!body || !isLink(body)) return;

    // sender
    const sender = normJid(m.key.participant || m.participant || "");
    if (!sender) return;

    // ✅ DELETE message (fonctionne même si groupe autorise liens)
    await sock.sendMessage(from, {
      delete: {
        remoteJid: from,
        fromMe: false,
        id: m.key.id,
        participant: sender
      }
    });

    // petite alerte (optionnel)
    await sock.sendMessage(from, {
      text: `🚫 *ANTI-LINK*\nMessage supprimé.`,
      contextInfo: newsletterCtx()
    }, { quoted: m });

  } catch (e) {
    console.log("ANTILINK ERROR:", e?.message || e);
  }
};