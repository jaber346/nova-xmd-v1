// commands/ytmp4.js
const fs = require("fs");
const path = require("path");
const ytdl = require("@distube/ytdl-core");
const config = require("../config");

const TMP_DIR = path.join(__dirname, "../temp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function safeName(name = "video") {
  return String(name).replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

function normalizeYT(url = "") {
  url = String(url).trim();

  const m1 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m1) return `https://www.youtube.com/watch?v=${m1[1]}`;

  const m2 = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (m2) return `https://www.youtube.com/watch?v=${m2[1]}`;

  return url;
}

function pickBestMuxedMp4(formats = []) {
  const muxed = formats
    .filter((f) => f.container === "mp4" && f.hasVideo && f.hasAudio)
    .sort((a, b) => (b.contentLength || 0) - (a.contentLength || 0));

  return muxed[0] || null;
}

module.exports = {
  name: "ytmp4",
  category: "Download",
  description: "Télécharger vidéo YouTube en MP4",

  async execute(sock, m, args, extra = {}) {
    const from = extra.from || m.key?.remoteJid;
    const prefix = extra.prefix || config.PREFIX || ".";
    const reply =
      extra.reply ||
      ((t) => sock.sendMessage(from, { text: t }, { quoted: m }));

    if (!args?.length) {
      return reply(`📥 Utilisation : ${prefix}ytmp4 lien_youtube`);
    }

    const raw = args[0];
    const url = normalizeYT(raw);

    if (!ytdl.validateURL(url)) {
      return reply("❌ Lien YouTube invalide.");
    }

    let filePath = "";
    let timeoutId = null;

    try {
      await reply("⏳ Téléchargement de la vidéo...");

      const agent = ytdl.createAgent();
      const info = await ytdl.getInfo(url, { agent });

      const title = info.videoDetails?.title || "video";
      const lengthSec = Number(info.videoDetails?.lengthSeconds || 0);

      if (lengthSec > 10 * 60) {
        return reply("❌ Vidéo trop longue (max 10 minutes).");
      }

      const format = pickBestMuxedMp4(info.formats);
      if (!format?.itag) {
        return reply("❌ Aucun format MP4 audio+vidéo compatible trouvé.");
      }

      const name = safeName(title);
      filePath = path.join(TMP_DIR, `${name}_${Date.now()}.mp4`);

      await new Promise((resolve, reject) => {
        const stream = ytdl(url, {
          format: format.itag,
          agent,
          highWaterMark: 1 << 24
        });

        const write = fs.createWriteStream(filePath);

        timeoutId = setTimeout(() => {
          stream.destroy(new Error("timeout"));
          write.destroy(new Error("timeout"));
        }, 1000 * 60 * 3);

        stream.on("error", reject);
        write.on("error", reject);
        write.on("finish", resolve);

        stream.pipe(write);
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!fs.existsSync(filePath)) {
        return reply("❌ Échec du téléchargement.");
      }

      const stat = fs.statSync(filePath);
      const sizeMB = stat.size / (1024 * 1024);

      if (sizeMB > 90) {
        try { fs.unlinkSync(filePath); } catch {}
        return reply(`❌ Fichier trop gros (${sizeMB.toFixed(1)} MB).`);
      }

      await sock.sendMessage(
        from,
        {
          video: fs.createReadStream(filePath),
          mimetype: "video/mp4",
          fileName: `${name}.mp4`,
          caption: `🎬 ${title}`
        },
        { quoted: m }
      );

      return reply("✅ Vidéo envoyée.");
    } catch (e) {
      console.log("YTMP4 ERROR:", e?.message || e);

      return reply(
        "⚠️ Erreur pendant le téléchargement.\nYouTube bloque parfois certaines IP serveur. Sur Render ça échoue souvent. VPS recommandé."
      );
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
  }
};