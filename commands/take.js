// commands/take.js

const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { Sticker, StickerTypes } = require("wa-sticker-formatter");

const TYPE = StickerTypes?.FULL || StickerTypes?.DEFAULT || "full";

async function toBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// 🔥 récupère contextInfo peu importe le type de message
function getContextInfo(m) {
  const msg = m?.message || {};
  const type = Object.keys(msg)[0];
  if (!type) return null;

  // wrappers
  if (type === "ephemeralMessage") return getContextInfo({ message: msg.ephemeralMessage?.message });
  if (type === "viewOnceMessageV2" || type === "viewOnceMessage")
    return getContextInfo({ message: msg[type]?.message });

  // classiques
  return (
    msg.extendedTextMessage?.contextInfo ||
    msg.imageMessage?.contextInfo ||
    msg.videoMessage?.contextInfo ||
    msg.documentMessage?.contextInfo ||
    msg.buttonsResponseMessage?.contextInfo ||
    msg.templateButtonReplyMessage?.contextInfo ||
    msg.listResponseMessage?.contextInfo ||
    msg.interactiveResponseMessage?.contextInfo ||
    null
  );
}

function getQuotedMessage(m) {
  const ctx = getContextInfo(m);
  return ctx?.quotedMessage || null;
}

function pickQuotedSticker(quoted) {
  if (!quoted) return null;

  // direct sticker
  if (quoted.stickerMessage) return quoted.stickerMessage;

  // wrappers
  if (quoted.ephemeralMessage?.message) return pickQuotedSticker(quoted.ephemeralMessage.message);
  if (quoted.viewOnceMessageV2?.message) return pickQuotedSticker(quoted.viewOnceMessageV2.message);
  if (quoted.viewOnceMessage?.message) return pickQuotedSticker(quoted.viewOnceMessage.message);

  return null;
}

module.exports = {
  name: "take",
  alias: ["steal", "wm"],
  description: "Change le nom (packname) du sticker",
  category: "Sticker",
  usage: ".take (en répondant à un sticker) OU .take MonNom",

  async execute(sock, m, args) {
    const jid = m.chat || m.key?.remoteJid || m.from;

    try {
      // sticker cité (reply)
      const quoted = getQuotedMessage(m);
      const stickerMsg = pickQuotedSticker(quoted);

      if (!stickerMsg) {
        return sock.sendMessage(
          jid,
          { text: "❌ Réponds à un *sticker* avec `.take`" },
          { quoted: m }
        );
      }

      // Nom à mettre: soit args, soit pseudo WhatsApp
      const packname = args.join(" ").trim() || m.pushName || "";
      const author = "";

      // Télécharger le sticker
      const stream = await downloadContentFromMessage(stickerMsg, "sticker");
      const stickerBuffer = await toBuffer(stream);

      // Re-créer le sticker avec nouveaux metadata
      const sticker = new Sticker(stickerBuffer, {
        pack: packname,
        author,
        type: TYPE,
        quality: 70,
      });

      const out = await sticker.toBuffer();

      await sock.sendMessage(
        jid,
        { sticker: out },
        { quoted: m }
      );
    } catch (e) {
      console.log("take error:", e?.message || e);
      await sock.sendMessage(
        jid,
        { text: "❌ Erreur pendant la modification du sticker." },
        { quoted: m }
      );
    }
  },
};