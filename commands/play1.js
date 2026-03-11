// ==================== commands/play1.js ====================
// ✅ CommonJS | ✅ Audius fallback | ✅ Info avant audio | ✅ Compatible NOVA XMD V1

const axios = require("axios");

// Plusieurs hosts Audius (fallback auto)
const AUDIUS_HOSTS = [
  "https://discoveryprovider.audius.co",
  "https://discoveryprovider2.audius.co",
  "https://audius-discovery-1.cultur3stake.com",
];

async function audiusGet(apiPath, params = {}) {
  let lastErr;
  for (const host of AUDIUS_HOSTS) {
    try {
      const { data } = await axios.get(host + apiPath, {
        params,
        timeout: 20000,
      });
      return { data, host };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Audius API error");
}

async function fetchBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
  });
  return Buffer.from(res.data);
}

function safeFileName(name = "audio") {
  return String(name)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .slice(0, 80) || "audio";
}

module.exports = {
  name: "play1",
  alias: ["plays1"],
  category: "Download",
  description: "Recherche une musique via Audius et envoie l'audio",
  usage: ".play1 phonk",

  async execute(sock, m, args, extra = {}) {
    const jid = m.chat || m.key?.remoteJid || m.from;
    const query = (args || []).join(" ").trim();
    const p = extra.prefix || ".";

    if (!query) {
      return sock.sendMessage(
        jid,
        { text: `Ex: ${p}play1 phonk` },
        { quoted: m }
      );
    }

    try {
      // 🔎 React recherche
      await sock.sendMessage(jid, { react: { text: "🔎", key: m.key } });

      const searchRes = await audiusGet("/v1/tracks/search", {
        query,
        limit: 1,
      });

      const track = searchRes?.data?.data?.[0];

      if (!track) {
        await sock.sendMessage(
          jid,
          { text: "❌ Aucun résultat trouvé." },
          { quoted: m }
        );
        await sock.sendMessage(jid, { react: { text: "❌", key: m.key } });
        return;
      }

      // 📌 Message info AVANT audio
      const infoCaption =
        `🎵 *${track.title || "Sans titre"}*\n` +
        `👤 ${track.user?.name || "Unknown"}\n` +
        `❤️ ${track.favorite_count || 0} likes\n` +
        `⏳ Téléchargement en cours...`;

      if (track.artwork?.["480x480"]) {
        await sock.sendMessage(
          jid,
          {
            image: { url: track.artwork["480x480"] },
            caption: infoCaption,
          },
          { quoted: m }
        );
      } else {
        await sock.sendMessage(
          jid,
          { text: infoCaption },
          { quoted: m }
        );
      }

      // ⏳ React téléchargement
      await sock.sendMessage(jid, { react: { text: "⏳", key: m.key } });

      const streamHost = searchRes.host || AUDIUS_HOSTS[0];
      const streamUrl = `${streamHost}/v1/tracks/${track.id}/stream`;

      const audioBuffer = await fetchBuffer(streamUrl);

      // 📤 Envoyer audio
      await sock.sendMessage(
        jid,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: `${safeFileName(track.title)}.mp3`,
        },
        { quoted: m }
      );

      // ✅ React succès
      await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });

    } catch (e) {
      console.error("play1 audius error:", e?.message || e);

      await sock.sendMessage(
        jid,
        { text: "❌ Erreur .play1 (Audius indisponible / réseau)." },
        { quoted: m }
      );

      await sock.sendMessage(jid, { react: { text: "❌", key: m.key } });
    }
  },
};