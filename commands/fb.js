// commands/fb.js
const axios = require("axios");
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

function isFacebookUrl(u = "") {
  u = String(u || "").toLowerCase();
  return (
    u.includes("facebook.com") ||
    u.includes("fb.watch") ||
    u.includes("m.facebook.com") ||
    u.includes("web.facebook.com")
  );
}

module.exports = {
  name: "fb",
  alias: ["facebook", "fbdl"],
  category: "Download",
  description: "Télécharger vidéo Facebook",
  usage: ".fb lien_facebook",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;
    const prefix = extra.prefix || config.PREFIX || ".";

    const url = (args[0] || "").trim();
    if (!url) {
      return sock.sendMessage(
        from,
        { text: `📥 Utilisation : ${prefix}fb lien_facebook`, contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    if (!isFacebookUrl(url)) {
      return sock.sendMessage(
        from,
        { text: "❌ Lien Facebook invalide.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    try {
      await sock.sendMessage(
        from,
        { text: "⏳ Téléchargement Facebook en cours...", contextInfo: newsletterCtx() },
        { quoted: m }
      );

      // ✅ API (peut changer selon disponibilité)
      // Si tu veux je te fais un système multi-api fallback après.
      const apiUrl = `https://api.vreden.my.id/api/fbdl?url=${encodeURIComponent(url)}`;
      const { data } = await axios.get(apiUrl, { timeout: 30000 });

      // essaie plusieurs chemins possibles
      const result = data?.result || data?.data || data;
      const videoUrl =
        result?.url ||
        result?.hd ||
        result?.sd ||
        result?.[0]?.url ||
        result?.urls?.hd ||
        result?.urls?.sd ||
        null;

      if (!videoUrl) {
        return sock.sendMessage(
          from,
          { text: "❌ Impossible de récupérer la vidéo (API vide/bloquée).", contextInfo: newsletterCtx() },
          { quoted: m }
        );
      }

      // ✅ envoi vidéo
      return sock.sendMessage(
        from,
        {
          video: { url: videoUrl },
          mimetype: "video/mp4",
          caption: "📥 Téléchargé depuis Facebook",
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    } catch (e) {
      console.log("FB ERROR:", e?.response?.data || e?.message || e);

      return sock.sendMessage(
        from,
        { text: "⚠️ Erreur pendant le téléchargement Facebook.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }
  }
};