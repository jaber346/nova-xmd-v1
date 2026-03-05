// ==================== case.js (NOVA XMD V1) ====================
// ✅ CommonJS | ✅ Loader commands | ✅ AntiLink hook | ✅ AutoStatus hook
// ✅ Mode public/self
// ✅ setprefix PAR NUMÉRO via global.setPrefixFor (data/prefix.json géré par index.js)
// ❌ ne modifie PLUS config.PREFIX

const fs = require("fs");
const path = require("path");
const config = require("./config");

// ✅ ANTILINK MODULE (commande + hook)
let antiLinkModule = null;
try { antiLinkModule = require("./commands/antilink"); } catch {}

// ✅ AUTOSTATUS HOOK
let autostatusHandler = async () => {};
try { autostatusHandler = require("./data/autostatus.js"); } catch {}

// ================= COMMAND LOADER =================
const commands = new Map();
const commandsDir = path.join(__dirname, "commands");

function loadAllCommands() {
  commands.clear();
  if (!fs.existsSync(commandsDir)) return;

  for (const file of fs.readdirSync(commandsDir)) {
    if (!file.endsWith(".js")) continue;

    try {
      const full = path.join(commandsDir, file);
      delete require.cache[require.resolve(full)];
      const cmd = require(full);

      const name = String(cmd?.name || "").toLowerCase();
      const exec = cmd?.execute || cmd?.run;

      if (name && typeof exec === "function") {
        commands.set(name, { ...cmd, _exec: exec });
      }

      // aliases
      const alias = cmd?.alias || cmd?.aliases;
      if (Array.isArray(alias)) {
        for (const a of alias) {
          const an = String(a || "").toLowerCase();
          if (an) commands.set(an, { ...cmd, _exec: exec });
        }
      }
    } catch (err) {
      console.log("CMD LOAD ERROR:", file, err?.message || err);
    }
  }
}
loadAllCommands();

// ================= HELPERS =================
function normJid(jid = "") {
  jid = String(jid || "");
  if (!jid) return jid;
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function getSender(m) {
  return normJid(m.key?.participant || m.participant || m.key?.remoteJid || "");
}

function unwrapMessage(msg) {
  if (!msg) return null;
  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);
  return msg;
}

function getBody(m) {
  const msg = unwrapMessage(m.message || {});
  const type = msg ? Object.keys(msg)[0] : null;
  if (!type) return "";

  if (type === "conversation") return msg.conversation || "";
  if (type === "extendedTextMessage") return msg.extendedTextMessage?.text || "";
  if (type === "imageMessage") return msg.imageMessage?.caption || "";
  if (type === "videoMessage") return msg.videoMessage?.caption || "";
  if (type === "documentMessage") return msg.documentMessage?.caption || "";

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

async function buildGroupContext(sock, from, sender) {
  try {
    const metadata = await sock.groupMetadata(from);
    const participants = metadata?.participants || [];
    const senderN = normJid(sender);

    const admins = participants.filter((p) => p.admin).map((p) => normJid(p.id));
    const botJid = normJid(sock.user?.id || "");

    return {
      metadata,
      participants,
      admins,
      isBotAdmin: admins.includes(botJid),
      isAdmin: admins.includes(senderN),
    };
  } catch {
    return {
      metadata: null,
      participants: [],
      admins: [],
      isBotAdmin: false,
      isAdmin: false,
    };
  }
}

// ================= MAIN HANDLER =================
module.exports = async (sock, m, prefix, setMode, currentMode) => {
  try {
    if (!m || !m.message) return;

    const from = m.key.remoteJid;
    const isGroup = from.endsWith("@g.us");
    const sender = getSender(m);

    const botJid = normJid(sock.user?.id || "");
    const ownerJid =
      String(config.OWNER_NUMBER || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    const isOwner =
      m.key.fromMe === true ||
      normJid(sender) === normJid(ownerJid) ||
      normJid(sender) === normJid(botJid);

    const usedPrefix = prefix || config.PREFIX || ".";
    const body = String(getBody(m) || "").trim();
    if (!body) return;

    const reply = (text) => sock.sendMessage(from, { text }, { quoted: m });

    // ✅ AUTOSTATUS hook
    try { await autostatusHandler(sock, m); } catch {}

    // ✅ AntiLink hook (premier passage)
    try {
      if (antiLinkModule?.handleAntiLink) {
        await antiLinkModule.handleAntiLink(sock, m, { isGroup, isOwner });
      }
    } catch {}

    // ✅ boutons wall4k sans prefix
    try {
      if (body.startsWith("wall4k_next|")) {
        const wall4k = require("./commands/wall4k.js");
        const info = wall4k.parseBtnId(body);
        if (info) return wall4k.sendWall4K(sock, from, m, info);
      }
    } catch {}

    const isCmd = body.startsWith(usedPrefix);
    if (!isCmd) return;

    // mode self
    if (String(currentMode).toLowerCase() === "self" && !isOwner) return;

    const parts = body.slice(usedPrefix.length).trim().split(/\s+/);
    const command = String(parts.shift() || "").toLowerCase();
    const args = parts;

    // ✅ reload
    if (command === "reload" && isOwner) {
      loadAllCommands();
      try { delete require.cache[require.resolve("./commands/antilink")]; antiLinkModule = require("./commands/antilink"); } catch {}
      try { delete require.cache[require.resolve("./data/autostatus.js")]; autostatusHandler = require("./data/autostatus.js"); } catch {}
      return reply("✅ Commands rechargées.");
    }

    // ✅ mode
    if (command === "mode") {
      if (!isOwner) return reply("🚫 Commande réservée au propriétaire.");
      const mode = String(args[0] || "").toLowerCase();

      if (mode === "public") {
        setMode("public");
        return reply("🔓 Mode PUBLIC activé.");
      }
      if (mode === "private" || mode === "prive" || mode === "self") {
        setMode("self");
        return reply("🔒 Mode PRIVÉ (SELF) activé.");
      }
      return reply(`Utilisation :\n${usedPrefix}mode public\n${usedPrefix}mode private`);
    }

    // ✅ setprefix PAR NUMÉRO (session)
    if (command === "setprefix") {
      if (!isOwner) return reply("🚫 Commande réservée au propriétaire.");

      const newP = String(args[0] || "").trim();
      if (!newP) return reply(`Utilisation : ${usedPrefix}setprefix .`);

      const botNum = String(sock.user?.id || "")
        .split(":")[0]
        .split("@")[0]
        .replace(/\D/g, "");

      if (typeof global.setPrefixFor !== "function") {
        return reply("❌ Prefix DB non chargé. Mets à jour index.js (global.setPrefixFor).");
      }

      const ok = global.setPrefixFor(botNum, newP);
      if (!ok) return reply("❌ Impossible de sauvegarder le prefix (data/prefix.json).");

      return reply(`✅ Prefix changé pour *${botNum}* : *${newP}*`);
    }

    // group context
    let groupCtx = {};
    if (isGroup) groupCtx = await buildGroupContext(sock, from, sender);

    // ✅ AntiLink hook (second passage avec admin infos)
    try {
      if (isGroup && antiLinkModule?.handleAntiLink) {
        await antiLinkModule.handleAntiLink(sock, m, {
          isGroup,
          isOwner,
          isSudo: false,
          isAdmin: !!groupCtx.isAdmin,
          isBotAdmin: !!groupCtx.isBotAdmin,
        });
      }
    } catch {}

    // run command
    const cmd = commands.get(command);
    if (cmd) {
      return await cmd._exec(sock, m, args, {
        prefix: usedPrefix,
        currentMode,
        setMode,
        isOwner,
        isGroup,
        sender,
        from,
        reply,
        ...groupCtx,
        isAdminOrOwner: !!groupCtx.isAdmin || isOwner,
      });
    }

    // unknown command => ignore
  } catch (err) {
    console.log("CASE ERROR:", err?.message || err);
  }
};
