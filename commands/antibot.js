const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "../data/antibot.json");

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

function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function isEnabled(groupJid) {
  return readDb().includes(groupJid);
}

async function isSenderAdmin(sock, from, sender) {
  try {
    const meta = await sock.groupMetadata(from);
    const s = normJid(sender);
    const p = (meta.participants || []).find((x) => normJid(x.id) === s);
    return Boolean(p?.admin);
  } catch {
    return false;
  }
}

module.exports = {
  name: "antibot",
  category: "Security",
  description: "Anti-bot on/off/status (groupe)",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;
    const {
      isGroup,
      prefix = config.PREFIX || ".",
      isOwner,
      sender,
      isAdminOrOwner
    } = extra;

    if (!isGroup) {
      return sock.sendMessage(
        from,
        { text: "❌ Cette commande fonctionne uniquement en groupe." },
        { quoted: m }
      );
    }

    let allowed = Boolean(isAdminOrOwner || isOwner);

    if (!allowed) {
      const senderIsAdmin = await isSenderAdmin(sock, from, sender);
      allowed = senderIsAdmin;
    }

    if (!allowed) {
      return sock.sendMessage(
        from,
        { text: "🚫 Seuls les admins ou le owner peuvent utiliser cette commande." },
        { quoted: m }
      );
    }

    const sub = (args[0] || "").toLowerCase().trim();
    let db = readDb();

    if (sub === "on") {
      if (!db.includes(from)) db.push(from);
      writeDb(db);

      return sock.sendMessage(
        from,
        { text: "✅ AntiBot activé pour ce groupe." },
        { quoted: m }
      );
    }

    if (sub === "off") {
      db = db.filter((g) => g !== from);
      writeDb(db);

      return sock.sendMessage(
        from,
        { text: "❌ AntiBot désactivé pour ce groupe." },
        { quoted: m }
      );
    }

    if (sub === "status") {
      return sock.sendMessage(
        from,
        { text: `📌 AntiBot : *${isEnabled(from) ? "ON ✅" : "OFF ❌"}*` },
        { quoted: m }
      );
    }

    return sock.sendMessage(
      from,
      {
        text: `Utilisation :
${prefix}antibot on
${prefix}antibot off
${prefix}antibot status`
      },
      { quoted: m }
    );
  }
};