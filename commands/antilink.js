// commands/antilink.js
const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "../data/antilink.json");

// ===================== DB =====================
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
function writeDb(arr) {
  fs.writeFileSync(dbPath, JSON.stringify(arr, null, 2));
}
function isEnabled(groupJid) {
  const db = readDb();
  return db.includes(groupJid);
}

// ===================== TEXT =====================
function getText(m) {
  const msg = m.message || {};
  const type = Object.keys(msg)[0];
  if (!type) return "";

  // ephemeral
  if (type === "ephemeralMessage") {
    const inner = msg.ephemeralMessage?.message || {};
    return getText({ message: inner, key: m.key });
  }

  // view once
  if (type === "viewOnceMessageV2" || type === "viewOnceMessage") {
    const inner = msg[type]?.message || {};
    const it = Object.keys(inner)[0];
    if (!it) return "";
    if (it === "imageMessage") return inner.imageMessage?.caption || "";
    if (it === "videoMessage") return inner.videoMessage?.caption || "";
    return "";
  }

  if (type === "conversation") return msg.conversation || "";
  if (type === "extendedTextMessage") return msg.extendedTextMessage?.text || "";
  if (type === "imageMessage") return msg.imageMessage?.caption || "";
  if (type === "videoMessage") return msg.videoMessage?.caption || "";
  if (type === "documentMessage") return msg.documentMessage?.caption || "";

  return "";
}

// ✅ Détection SAFE (pas de .com trop large)
function hasLink(text = "") {
  const t = String(text || "").toLowerCase();
  return (
    /https?:\/\/\S+/i.test(t) ||
    /\bwww\.\S+/i.test(t) ||
    /\bchat\.whatsapp\.com\/\S+/i.test(t) ||
    /\bwa\.me\/\S+/i.test(t)
  );
}

// ✅ delete correct
async function deleteMessage(sock, m) {
  const key = {
    remoteJid: m.key.remoteJid,
    fromMe: false,
    id: m.key.id,
    participant: m.key.participant
  };
  return sock.sendMessage(m.key.remoteJid, { delete: key }).catch(() => {});
}

// anti double-run sur même msg
global.__antilinkSeen = global.__antilinkSeen || new Set();

// ===================== HOOK (à appeler dans index.js après cmdHandler) =====================
async function handleAntiLink(sock, m, extra = {}) {
  try {
    const from = m.key.remoteJid;
    const { isGroup, isBotAdmin, prefix } = extra;

    if (!isGroup) return false;
    if (!isEnabled(from)) return false;

    // ✅ ignore messages du bot
    if (m.key.fromMe) return false;

    const body = (getText(m) || "").trim();
    if (!body) return false;

    // ✅ ignore commandes (stop la boucle sur .antilink on/off)
    const usedPrefix = prefix || config.PREFIX || ".";
    if (body.startsWith(usedPrefix)) return false;

    // ✅ anti double-run
    const uniq = `${from}:${m.key.id}`;
    if (global.__antilinkSeen.has(uniq)) return false;
    global.__antilinkSeen.add(uniq);
    setTimeout(() => global.__antilinkSeen.delete(uniq), 15000);

    if (!hasLink(body)) return false;

    await deleteMessage(sock, m);

    const sender = m.key.participant || "";
    await sock.sendMessage(from, {
      text: `🚫 *Lien détecté* — supprimé.\n👤 @${String(sender).split("@")[0]}`,
      mentions: sender ? [sender] : []
    });

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

  // ✅ IMPORTANT: ici on utilise isAdminOrOwner (plus fiable que isAdmin seul)
  if (!isAdminOrOwner) {
    return sock.sendMessage(from, { text: "❌ Admin/Owner uniquement." }, { quoted: m });
  }

  const sub = (args[0] || "").toLowerCase();
  let db = readDb();

  if (sub === "on") {
    if (!db.includes(from)) db.push(from);
    writeDb(db);
    return sock.sendMessage(from, { text: "✅ Antilink activé (DELETE)." }, { quoted: m });
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