// commands/antimention.js
const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "../data/antimention.json");

// ===================== DB =====================
function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
  }
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

  // Ephemeral wrapper
  if (type === "ephemeralMessage") {
    const inner = msg.ephemeralMessage?.message || {};
    return getText({ message: inner, key: m.key });
  }

  // ViewOnce wrapper
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

  // Buttons / List replies
  if (type === "buttonsResponseMessage") {
    return (
      msg.buttonsResponseMessage?.selectedButtonId ||
      msg.buttonsResponseMessage?.selectedDisplayText ||
      ""
    );
  }
  if (type === "listResponseMessage") {
    return (
      msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
      msg.listResponseMessage?.title ||
      ""
    );
  }
  if (type === "templateButtonReplyMessage") {
    return (
      msg.templateButtonReplyMessage?.selectedId ||
      msg.templateButtonReplyMessage?.selectedDisplayText ||
      ""
    );
  }

  return "";
}

function getMentionedJids(m) {
  const ctx =
    m.message?.extendedTextMessage?.contextInfo ||
    m.message?.imageMessage?.contextInfo ||
    m.message?.videoMessage?.contextInfo ||
    m.message?.documentMessage?.contextInfo ||
    {};

  const arr = ctx?.mentionedJid || [];
  return Array.isArray(arr) ? arr : [];
}

// delete correct
async function deleteMessage(sock, m) {
  const key = {
    remoteJid: m.key.remoteJid,
    fromMe: false,
    id: m.key.id,
    participant: m.key.participant
  };
  return sock.sendMessage(m.key.remoteJid, { delete: key }).catch(() => {});
}

// anti double-run
global.__antiMentionSeen = global.__antiMentionSeen || new Set();

// ===================== HOOK =====================
// A appeler dans index.js : antimention.handleAntiMention(sock, m, extra)
async function handleAntiMention(sock, m, extra = {}) {
  try {
    const from = m.key.remoteJid;
    const { isGroup, isBotAdmin } = extra;

    if (!isGroup) return false;
    if (!isEnabled(from)) return false;

    // ignore bot messages
    if (m.key.fromMe) return false;

    const body = (getText(m) || "").trim();
    const mentioned = getMentionedJids(m);

    // 🔴 Détection mention status
    const hasStatusText = /\B@status\b/i.test(body);
    const hasStatusJid = mentioned.includes("status@broadcast");

    // mention all/everyone
    const hasAll = /\B@all\b|\B@everyone\b/i.test(body);

    // trop de mentions (ex: 7+)
    const tooMany = mentioned.length >= 7;

    // si rien à bloquer => stop
    if (!hasAll && !tooMany && !hasStatusText && !hasStatusJid) return false;

    // anti double run
    const uniq = `${from}:${m.key.id}`;
    if (global.__antiMentionSeen.has(uniq)) return false;
    global.__antiMentionSeen.add(uniq);
    setTimeout(() => global.__antiMentionSeen.delete(uniq), 15000);

    // supprimer
    await deleteMessage(sock, m);

    // raison
    let reason = "";
    if (hasStatusText || hasStatusJid) {
      reason = "Mention de @status interdite";
    } else if (hasAll) {
      reason = "@all/@everyone interdit";
    } else {
      reason = `Trop de mentions (${mentioned.length})`;
    }

    const sender = m.key.participant || "";
    await sock.sendMessage(from, {
      text: `🚫 *Message supprimé*\n📌 Raison : ${reason}\n👤 @${String(sender).split("@")[0]}`,
      mentions: sender ? [sender] : []
    });

    return true;
  } catch (e) {
    console.error("ANTIMENTION HOOK ERROR:", e?.message || e);
    return false;
  }
}

// ===================== COMMAND =====================
async function execute(sock, m, args, extra = {}) {
  const from = m.key.remoteJid;
  const { isGroup, isAdminOrOwner, prefix = config.PREFIX || "." } = extra;

  if (!isGroup) {
    return sock.sendMessage(from, { text: "❌ Groupe uniquement." }, { quoted: m });
  }

  const sub = (args[0] || "").toLowerCase();
  let db = readDb();

  if (sub === "on") {
    if (!db.includes(from)) db.push(from);
    writeDb(db);
    return sock.sendMessage(from, { text: "✅ AntiMention activé (delete)." }, { quoted: m });
  }

  if (sub === "off") {
    db = db.filter((x) => x !== from);
    writeDb(db);
    return sock.sendMessage(from, { text: "❌ AntiMention désactivé." }, { quoted: m });
  }

  if (sub === "status") {
    return sock.sendMessage(
      from,
      { text: `📌 AntiMention: *${isEnabled(from) ? "ON ✅" : "OFF ❌"}*` },
      { quoted: m }
    );
  }

  return sock.sendMessage(
    from,
    { text: `Utilisation :\n${prefix}antimention on\n${prefix}antimention off\n${prefix}antimention status` },
    { quoted: m }
  );
}

module.exports = {
  name: "antimention",
  category: "Security",
  description: "Anti @all/@everyone + anti spam mentions + anti @status",
  execute,
  handleAntiMention
};