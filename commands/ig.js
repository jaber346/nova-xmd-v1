// commands/ig.js
const axios = require("axios");
const config = require("../config");

function newsletterCtx() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363423249667073@newsletter",
      newsletterName: config.BOT_NAME || "NOVA XMD V1",
      serverMessageId: 1,
    },
  };
}

module.exports = {
  name: "ig",
  alias: ["instagram", "igdl"],
  category: "Download",
  description: "Télécharger vidéo Instagram",
  usage: ".ig lien_instagram",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;
    const prefix = extra.prefix || config.PREFIX || ".";

    if (!args.length) {
      return sock.sendMessage(
        from,
        { text: `📥 Utilisation : ${prefix}ig lien_instagram`, contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    const url = String(args[0] || "").trim();

    if (!url.includes("instagram.com")) {
      return sock.sendMessage(
        from,
        { text: "❌ Lien Instagram invalide.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    try {
      await sock.sendMessage(
        from,
        { text: "⏳ Téléchargement en cours...", contextInfo: newsletterCtx() },
        { quoted: m }
      );

      const response = await axios.get(
        `https://api.vreden.my.id/api/igdl?url=${encodeURIComponent(url)}`,
        { timeout: 30000 }
      );

      const videoUrl = response?.data?.result?.[0]?.url;

      if (!videoUrl) {
        return sock.sendMessage(
          from,
          { text: "❌ Impossible de récupérer la vidéo.", contextInfo: newsletterCtx() },
          { quoted: m }
        );
      }

      return sock.sendMessage(
        from,
        {
          video: { url: videoUrl },
          caption: "📥 Téléchargé depuis Instagram",
          contextInfo: newsletterCtx(),
        },
        { quoted: m }
      );
    } catch (error) {
      console.log("IG ERROR:", error?.response?.data || error.message);
      return sock.sendMessage(
        from,
        { text: "⚠️ Erreur pendant le téléchargement.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }
  },
};