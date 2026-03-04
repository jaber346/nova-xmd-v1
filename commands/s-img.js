// commands/s-img.js
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const config = require("../config");

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

function getQuotedSticker(m) {
  const ctx = m.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (!quoted) return null;

  if (quoted.stickerMessage) return quoted.stickerMessage;

  const vo = quoted.viewOnceMessageV2 || quoted.viewOnceMessage;
  const inner = vo?.message || {};
  if (inner.stickerMessage) return inner.stickerMessage;

  return null;
}

async function stickerToBuffer(stickerMsg) {
  const stream = await downloadContentFromMessage(stickerMsg, "sticker");
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

module.exports = {
  name: "s-img",
  alias: ["stickerimg", "toimg"],
  category: "Sticker",
  description: "Convertir sticker en image (si animé -> renvoie webp)",

  async execute(sock, m) {
    const from = m.key.remoteJid;

    const stickerMsg = getQuotedSticker(m);
    if (!stickerMsg) {
      return sock.sendMessage(
        from,
        { text: "⚠️ Réponds à un sticker avec .s-img", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    try {
      await sock.sendMessage(from, { text: "⏳ Traitement..." }, { quoted: m });

      const buffer = await stickerToBuffer(stickerMsg);

      // ✅ Sticker animé ?
      const isAnimated = !!stickerMsg.isAnimated;

      // 1) Non animé -> image OK
      if (!isAnimated) {
        return sock.sendMessage(
          from,
          {
            image: buffer,
            caption: "🖼️ Sticker converti en image.",
            contextInfo: newsletterCtx()
          },
          { quoted: m }
        );
      }

      // 2) Animé -> on renvoie en document webp (safe)
      // (car convertir en mp4/gif nécessite ffmpeg)
      return sock.sendMessage(
        from,
        {
          document: buffer,
          mimetype: "image/webp",
          fileName: "sticker.webp",
          caption: `🎞️ Sticker animé détecté.\n✅ Je te l’envoie en *.webp*.\n📌 Si tu veux en vidéo: utilise *.s-mp4* (à ajouter).`,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );

    } catch (e) {
      return sock.sendMessage(
        from,
        { text: "❌ Erreur conversion sticker → image.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }
  }
};