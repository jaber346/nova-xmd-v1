// commands/gc-setpp.js
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

function getQuotedImage(m) {
  const ctx =
    m.message?.extendedTextMessage?.contextInfo ||
    m.message?.imageMessage?.contextInfo ||
    m.message?.videoMessage?.contextInfo ||
    m.message?.documentMessage?.contextInfo;

  const quoted = ctx?.quotedMessage;
  if (!quoted) return null;

  if (quoted.imageMessage) return quoted.imageMessage;

  // support viewOnce
  const vo = quoted.viewOnceMessageV2 || quoted.viewOnceMessage;
  if (vo?.message?.imageMessage) return vo.message.imageMessage;

  // support ephemeral
  const eph = quoted.ephemeralMessage?.message;
  if (eph?.imageMessage) return eph.imageMessage;

  return null;
}

async function imageToBuffer(imgMsg) {
  const stream = await downloadContentFromMessage(imgMsg, "image");
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

module.exports = {
  name: "gc-setpp",
  category: "Group",
  description: "Changer la photo du groupe (reply à une image)",

  async execute(sock, m, args, extra = {}) {
    const from = extra.from || m.key.remoteJid;
    const { isGroup, isAdminOrOwner, isBotAdmin } = extra;

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Commande uniquement en groupe." }, { quoted: m });
    }

    if (!isAdminOrOwner) {
      return sock.sendMessage(from, { text: "❌ Admin/Owner uniquement." }, { quoted: m });
    }
    
    const imgMsg = getQuotedImage(m);
    if (!imgMsg) {
      return sock.sendMessage(from, { text: "⚠️ Réponds à une image avec *.gc-setpp*" }, { quoted: m });
    }

    try {
      const buffer = await imageToBuffer(imgMsg);
      await sock.updateProfilePicture(from, buffer);
      return sock.sendMessage(from, { text: "✅ Photo du groupe mise à jour." }, { quoted: m });
    } catch (e) {
      console.log("GC-SETPP ERROR:", e?.message || e);
      return sock.sendMessage(from, { text: "❌ Impossible de changer la photo (format ou droits)." }, { quoted: m });
    }
  },
};