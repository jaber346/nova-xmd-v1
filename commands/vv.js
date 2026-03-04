// ==================== commands/vv.js (FIX + PRO) ====================
// ✅ CommonJS | ✅ ViewOnce V1/V2/V2Extension | ✅ Ephemeral support
// ✅ Quoted detector universel (texte, image caption, vidéo caption, doc, boutons)

const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

// ✅ Récupère quotedMessage peu importe le type de message
function getQuoted(m) {
  const msg = m?.message || {};

  const ctx =
    msg?.extendedTextMessage?.contextInfo ||
    msg?.imageMessage?.contextInfo ||
    msg?.videoMessage?.contextInfo ||
    msg?.documentMessage?.contextInfo ||
    msg?.buttonsResponseMessage?.contextInfo ||
    msg?.listResponseMessage?.contextInfo ||
    msg?.templateButtonReplyMessage?.contextInfo ||
    msg?.interactiveResponseMessage?.contextInfo ||
    null;

  return ctx?.quotedMessage || null;
}

// ✅ Déplie les wrappers (ephemeral + viewOnce)
function unwrap(msg) {
  if (!msg) return null;

  // Ephemeral wrapper
  if (msg.ephemeralMessage?.message) return unwrap(msg.ephemeralMessage.message);

  // ViewOnce wrappers
  if (msg.viewOnceMessage?.message) return msg.viewOnceMessage.message;
  if (msg.viewOnceMessageV2?.message) return msg.viewOnceMessageV2.message;
  if (msg.viewOnceMessageV2Extension?.message)
    return msg.viewOnceMessageV2Extension.message;

  return msg;
}

module.exports = {
  name: "vv",
  category: "Tools",
  description: "Voir une image/vidéo view-once",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;

    const quotedRaw = getQuoted(m);
    if (!quotedRaw) {
      return sock.sendMessage(
        from,
        { text: "⚠️ Réponds à une image/vidéo view-once avec *.vv*" },
        { quoted: m }
      );
    }

    try {
      const innerMsg = unwrap(quotedRaw);

      let type = null;
      let media = null;

      if (innerMsg?.imageMessage) {
        type = "image";
        media = innerMsg.imageMessage;
      } else if (innerMsg?.videoMessage) {
        type = "video";
        media = innerMsg.videoMessage;
      } else {
        return sock.sendMessage(
          from,
          { text: "❌ Ce message n'est pas une image/vidéo view-once." },
          { quoted: m }
        );
      }

      const stream = await downloadContentFromMessage(media, type);
      const buffer = await streamToBuffer(stream);

      if (type === "image") {
        return sock.sendMessage(
          from,
          { image: buffer, caption: "👁️ View Once récupérée ✅" },
          { quoted: m }
        );
      } else {
        return sock.sendMessage(
          from,
          { video: buffer, caption: "👁️ View Once récupérée ✅" },
          { quoted: m }
        );
      }
    } catch (e) {
      console.log("VV ERROR:", e);
      return sock.sendMessage(
        from,
        { text: "❌ Erreur récupération view-once." },
        { quoted: m }
      );
    }
  },
};