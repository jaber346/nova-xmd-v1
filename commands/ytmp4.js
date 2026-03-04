// commands/ytmp4.js
const fs = require("fs");
const path = require("path");
const ytdl = require("@distube/ytdl-core");

const TMP_DIR = path.join(__dirname, "../temp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function safeName(name = "video") {
  return String(name).replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

// Normalise Shorts / youtu.be -> youtube.com/watch?v=
function normalizeYT(url = "") {
  url = String(url).trim();

  // youtu.be/ID
  const m1 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m1) return `https://www.youtube.com/watch?v=${m1[1]}`;

  // youtube.com/shorts/ID
  const m2 = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (m2) return `https://www.youtube.com/watch?v=${m2[1]}`;

  return url;
}

module.exports = {
  name: "ytmp4",
  category: "Download",
  description: "Télécharger vidéo YouTube en MP4",

  async execute(sock, m, args, extra = {}) {
    const from = extra.from || m.key?.remoteJid;
    const reply = extra.reply || ((t) => sock.sendMessage(from, { text: t }, { quoted: m }));

    if (!args?.length) return reply("📥 Utilisation : .ytmp4 lien_youtube");

    const raw = args[0];
    const url = normalizeYT(raw);

    if (!ytdl.validateURL(url)) return reply("❌ Lien YouTube invalide.");

    let filePath = "";
    try {
      await reply("⏳ Téléchargement de la vidéo...");

      // ⚠️ headers (parfois aide un peu)
      const agent = ytdl.createAgent();

      const info = await ytdl.getInfo(url, { agent });
      const title = info.videoDetails?.title || "video";
      const lengthSec = Number(info.videoDetails?.lengthSeconds || 0);

      if (lengthSec > 10 * 60) return reply("❌ Vidéo trop longue (max 10 minutes).");

      // MP4 avec audio+video
      const format = ytdl.chooseFormat(info.formats, {
        filter: (f) => f.container === "mp4" && f.hasVideo && f.hasAudio,
        quality: "highest",
      });

      if (!format?.itag) return reply("❌ Aucun format MP4 compatible trouvé.");

      const name = safeName(title);
      filePath = path.join(TMP_DIR, `${name}_${Date.now()}.mp4`);

      await new Promise((resolve, reject) => {
        const stream = ytdl(url, {
          format,
          agent,
          highWaterMark: 1 << 25,
        });

        const write = fs.createWriteStream(filePath);
        stream.pipe(write);

        stream.on("error", reject);
        write.on("finish", resolve);
        write.on("error", reject);
      });

      const stat = fs.statSync(filePath);
      const sizeMB = stat.size / (1024 * 1024);
      if (sizeMB > 90) {
        try { fs.unlinkSync(filePath); } catch {}
        return reply(`❌ Fichier trop gros (${sizeMB.toFixed(1)}MB).`);
      }

      await sock.sendMessage(
        from,
        {
          document: fs.readFileSync(filePath),
          mimetype: "video/mp4",
          fileName: `${name}.mp4`,
          caption: `🎬 ${title}`,
        },
        { quoted: m }
      );

      return reply("✅ Vidéo envoyée.");
    } catch (e) {
      console.log("YTMP4 ERROR:", e?.message || e);

      // Message clair : c’est souvent blocage IP
      return reply("⚠️ Erreur pendant le téléchargement.\n(YouTube bloque souvent les serveurs Render. Solution: API externe ou VPS).");
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
  },
};