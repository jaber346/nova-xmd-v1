const axios = require("axios");

module.exports = {
  name: "tiktok",
  category: "Download",
  description: "Télécharger une vidéo TikTok sans watermark",

  async execute(sock, m, args, context) {
    const { from, reply } = context;

    if (!args.length) {
      return reply("📥 Utilisation : .tiktok lien_video");
    }

    const url = args[0];

    if (!url.includes("tiktok.com")) {
      return reply("❌ Lien TikTok invalide.");
    }

    try {
      await reply("⏳ Téléchargement en cours...");

      const response = await axios.get(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
      );
      const data = response.data.data;

      const videoUrl = data.play; // sans watermark
      const title = data.title || "TikTok Video";

      await sock.sendMessage(from, {
        video: { url: videoUrl },
        caption: `🎬 ${title}\n\n✅ Téléchargé sans watermark`
      }, { quoted: m });

    } catch (error) {
      console.log("TIKTOK ERROR:", error?.response?.data || error.message);
      reply("⚠️ Erreur pendant le téléchargement.");
    }
  }
};