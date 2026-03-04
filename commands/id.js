// commands/id.js (reply -> récupère newsletter du poste)
const config = require("../config");

function getCtx(m) {
  return m.message?.extendedTextMessage?.contextInfo || {};
}

// essaie de récupérer forwardedNewsletterMessageInfo depuis:
// - message actuel
// - quotedMessage (message auquel tu réponds)
function extractNewsletterInfo(m) {
  const ctx = getCtx(m);

  // 1) info direct sur le message
  if (ctx?.forwardedNewsletterMessageInfo?.newsletterJid) {
    return ctx.forwardedNewsletterMessageInfo;
  }

  // 2) info sur le message cité
  const q = ctx?.quotedMessage;
  if (q) {
    // quoted extended text
    const qCtx = q?.extendedTextMessage?.contextInfo;
    if (qCtx?.forwardedNewsletterMessageInfo?.newsletterJid) {
      return qCtx.forwardedNewsletterMessageInfo;
    }

    // parfois directement au niveau quoted (selon clients)
    if (q?.contextInfo?.forwardedNewsletterMessageInfo?.newsletterJid) {
      return q.contextInfo.forwardedNewsletterMessageInfo;
    }
  }

  return null;
}

module.exports = {
  name: "id",
  category: "Tools",
  description: "Donne l'ID (et si reply à un poste de chaîne -> newsletter du poste)",

  async execute(sock, m) {
    const from = m.key.remoteJid;

    // ✅ 1) Newsletter d’un POST (reply / forward)
    const nfo = extractNewsletterInfo(m);
    if (nfo?.newsletterJid) {
      const jid = nfo.newsletterJid;
      const name = nfo.newsletterName || "Unknown";

      return sock.sendMessage(
        from,
        {
          text:
`*ID:* ${jid}
*Name:* ${name}
*Total Followers:* ${nfo.subscriberCount || "Unknown"}
*Status:* ACTIVE
*Verified:* ${nfo.verification === "VERIFIED" ? "Yes" : "Tidak"}`
        },
        { quoted: m }
      );
    }

    // ✅ 2) Groupe
    if (from.endsWith("@g.us")) {
      const meta = await sock.groupMetadata(from).catch(() => null);
      return sock.sendMessage(
        from,
        {
          text:
`╭━━〔 🆔 NOVA XMD V1 〕━━╮
┃ 👥 Group : ${meta?.subject || "Groupe"}
┃ 💬 ID    : ${from}
┃ 👤 Membres : ${meta?.participants?.length || "?"}
╰━━━━━━━━━━━━━━━━━━━━━━╯`
        },
        { quoted: m }
      );
    }

    // ✅ 3) Privé
    return sock.sendMessage(
      from,
      {
        text:
`╭━━〔 🆔 NOVA XMD V1 〕━━╮
┃ 👤 User : ${from.split("@")[0]}
┃ 💬 Chat : ${from}
┃ 👥 Type : Privé
╰━━━━━━━━━━━━━━━━━━━━━━╯`
      },
      { quoted: m }
    );
  }
};