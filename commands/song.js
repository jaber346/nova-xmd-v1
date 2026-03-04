//==================== commands/play.js ====================
// ✅ CommonJS | ✅ même logique | ✅ compatible avec ton handler (require)

const yts = require("yt-search");
const axios = require("axios");

module.exports = {
  name: "play",
  description: "Download song from YouTube",
  category: "Download",

  async execute(Nova, m, args) {
    try {
      const jid = m.chat || m.key?.remoteJid || m.from;

      // -------------------- Check query --------------------
      if (!args || !args.length) {
        await Nova.sendMessage(
          jid,
          { text: `❌ Usage: \`.play <song name>\`` },
          { quoted: m }
        );
        await Nova.sendMessage(jid, { react: { text: "❌", key: m.key } });
        return;
      }

      const query = args.join(" ").trim();

      // 🔎 React searching
      await Nova.sendMessage(jid, { react: { text: "🔎", key: m.key } });

      // -------------------- Search YouTube --------------------
      let video;
      if (query.includes("youtube.com") || query.includes("youtu.be")) {
        const search = await yts(query);
        if (search?.videos?.length) {
          video = search.videos[0];
        } else {
          video = { url: query, title: query, thumbnail: null, timestamp: "N/A" };
        }
      } else {
        const search = await yts(query);
        if (!search.videos || !search.videos.length) {
          await Nova.sendMessage(
            jid,
            { text: `❌ No results found for your query!` },
            { quoted: m }
          );
          await Nova.sendMessage(jid, { react: { text: "⚠️", key: m.key } });
          return;
        }
        video = search.videos[0];
      }

      // -------------------- Info message --------------------
      if (video.thumbnail) {
        await Nova.sendMessage(
          jid,
          {
            image: { url: video.thumbnail },
            caption: `🎵 *${video.title}*\n⏱ ${video.timestamp || "N/A"}\n\n⏳ Downloading...`,
          },
          { quoted: m }
        );
      } else {
        await Nova.sendMessage(
          jid,
          { text: `🎵 *${video.title}*\n⏱ ${video.timestamp || "N/A"}\n\n⏳ veiller patienté...` },
          { quoted: m }
        );
      }

      // ⏳ React downloading
      await Nova.sendMessage(jid, { react: { text: "⏳", key: m.key } });

      // -------------------- Call the API --------------------
      const apiUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(video.url)}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });
      const data = response.data;

      if (!data?.status || !data.audio) {
        await Nova.sendMessage(
          jid,
          { text: "❌ Impossible de récupérer les données. Veuillez réessayer plus tard." },
          { quoted: m }
        );
        await Nova.sendMessage(jid, { react: { text: "❌", key: m.key } });
        return;
      }

      const audioUrl = data.audio;
      const title = data.title || video.title;

      // -------------------- Send audio --------------------
      await Nova.sendMessage(
        jid,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          fileName: `${String(title).replace(/[^a-zA-Z0-9-_\.]/g, "_")}.mp3`,
          caption: `🎵 *${title}*`,
        },
        { quoted: m }
      );

      // ✅ React success
      await Nova.sendMessage(jid, { react: { text: "✅", key: m.key } });

    } catch (error) {
      console.error("❌ SONG ERROR:", error);

      let errorMessage = "❌ Le téléchargement a échoué. Veuillez réessayer plus tard.";
      if (error?.code === "ENOTFOUND" || error?.code === "ETIMEDOUT" || error?.code === "ECONNRESET")
        errorMessage = "❌ Network error. Check your internet connection.";
      else if (error?.response?.status === 404)
        errorMessage = "❌ Chanson introuvable ou indisponible.";
      else if (error?.response?.status === 429)
        errorMessage = "❌ Trop de requêtes. Veuillez patienter un instant.";

      const jid = m.chat || m.key?.remoteJid || m.from;
      await Nova.sendMessage(jid, { text: errorMessage }, { quoted: m });
      await Nova.sendMessage(jid, { react: { text: "❌", key: m.key } });
    }
  },
};