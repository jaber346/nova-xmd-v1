const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "../data/antilink.json");

// ===================== DB =====================
function ensureDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

function writeDb(arr) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(arr, null, 2));
}

function isEnabled(groupJid) {
  return readDb().includes(groupJid);
}

// ===================== TEXT =====================
function getText(m) {
  const msg = m.message || {};
  const type = Object.keys(msg)[0];
  if (!type) return "";

  if (type === "ephemeralMessage") {
    return getText({
      ...m,
      message: msg.ephemeralMessage?.message || {}
    });
  }

  if (type === "viewOnceMessage" || type === "viewOnceMessageV2") {
    return getText({
      ...m,
      message: msg[type]?.message || {}
    });
  }

  if (type === "conversation") return msg.conversation || "";
  if (type === "extendedTextMessage") return msg.extendedTextMessage?.text || "";
  if (type === "imageMessage") return msg.imageMessage?.caption || "";
  if (type === "videoMessage") return msg.videoMessage?.caption || "";
  if (type === "documentMessage") return msg.documentMessage?.caption || "";
  if (type === "buttonsResponseMessage") return msg.buttonsResponseMessage?.selectedButtonId || "";
  if (type === "listResponseMessage") return msg.listResponseMessage?.singleSelectReply?.selectedRowId || "";

  return "";
}

// ===================== LINK DETECTION =====================
function extractLinks(text = "") {
  const t = String(text || "");

  const regex =
    /(?:https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/[^\s]+)/gi;

  return t.match(regex) || [];
}

function hasLink(text = "") {
  return extractLinks(text).length > 0;
}

// ===================== DELETE =====================
async function deleteMessage(sock, m) {
  try {
    const key = {
      remoteJid: m.key.remoteJid,
      fromMe: false,
      id: m.key.id,
      participant: m.key.participant
    };

    await sock.sendMessage(m.key.remoteJid, { delete: key });
    return true;
  } catch {
    return false;
  }
}

// anti doublon seulement sur LE MÊME message exact
global.__antilinkSeen = global.__antilinkSeen || new Set();

// anti spam de réponse
global.__antilinkWarnCd = global.__antilinkWarnCd || new Map();

// ===================== HOOK =====================
async function handleAntiLink(sock, m, extra = {}) {
  try {
    const from = m.key?.remoteJid;
    const sender = m.key?.participant || m.key?.remoteJid || "";
    const { isGroup, isBotAdmin, prefix } = extra;

    if (!from || !isGroup) return false;
    if (!isEnabled(from)) return false;
    if (!isBotAdmin) return false;

    if (m.key?.fromMe) return false;

    const body = (getText(m) || "").trim();
    if (!body) return false;

    const usedPrefix = prefix || config.PREFIX || ".";
    if (body.startsWith(usedPrefix)) return false;

    const msgId = m.key?.id;
    if (!msgId) return false;

    const uniq = `${from}:${msgId}`;
    if (global.__antilinkSeen.has(uniq)) return false;

    global.__antilinkSeen.add(uniq);
    setTimeout(() => global.__antilinkSeen.delete(uniq), 10000);

    const links = extractLinks(body);
    if (!links.length) return false;

    const deleted = await deleteMessage(sock, m);
    if (!deleted) return false;

    // cooldown seulement pour le message d’avertissement
    const warnKey = `${from}:${sender}`;
    const now = Date.now();
    const lastWarn = global.__antilinkWarnCd.get(warnKey) || 0;

    if (now - lastWarn > 5000) {
      global.__antilinkWarnCd.set(warnKey, now);

      await sock.sendMessage(from, {
        text: `🚫 *Lien détecté et supprimé.*\n👤 @${String(sender).split("@")[0]}\n🔗 Liens trouvés: ${links.length}`,
        mentions: sender ? [sender] : []
      }).catch(() => {});
    }

    return true;
  } catch (e) {
    console.error("ANTILINK HOOK ERROR:", e?.message || e);
    return false;
  }
}

// ===================== COMMAND =====================
async function execute(sock, m, args, extra = {}) {
  const from = m.key.remoteJid;
  const { isGroup, isAdminOrOwner, prefix = "." } = extra;

  if (!isGroup) {
    return sock.sendMessage(from, { text: "❌ Groupe uniquement." }, { quoted: m });
  }

  if (!isAdminOrOwner) {
    return sock.sendMessage(from, { text: "❌ Admin/Owner uniquement." }, { quoted: m });
  }

  const sub = (args[0] || "").toLowerCase();
  let db = readDb();

  if (sub === "on") {
    if (!db.includes(from)) db.push(from);
    writeDb(db);
    return sock.sendMessage(from, { text: "✅ Antilink activé." }, { quoted: m });
  }

  if (sub === "off") {
    db = db.filter((x) => x !== from);
    writeDb(db);
    return sock.sendMessage(from, { text: "❌ Antilink désactivé." }, { quoted: m });
  }

  if (sub === "status") {
    return sock.sendMessage(
      from,
      { text: `📌 Antilink: *${isEnabled(from) ? "ON ✅" : "OFF ❌"}*` },
      { quoted: m }
    );
  }

  return sock.sendMessage(
    from,
    { text: `Utilisation : ${prefix}antilink on/off/status` },
    { quoted: m }
  );
}

module.exports = {
  name: "antilink",
  category: "Security",
  description: "Antilink on/off + suppression auto des liens",
  execute,
  handleAntiLink
};