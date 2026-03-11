// ==================== commands/sticker.js ====================
// ✅ CommonJS | ✅ même logique | ✅ compatible handler NOVA XMD V1
// ✅ support viewOnce + ephemeral | ✅ ffmpeg path auto (Render/VPS)

const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const webp = require("node-webpmux");

// ✅ auto ffmpeg path si package installé
try {
  const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
  if (ffmpegInstaller?.path) ffmpeg.setFfmpegPath(ffmpegInstaller.path);
} catch {}

const PACKNAME = "NOVA XMD V1";
const AUTHOR = "dev nova tech";

function ensureTemp() {
  const dir = path.join(__dirname, "../temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function streamToFile(stream, outPath) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  fs.writeFileSync(outPath, Buffer.concat(chunks));
}

// ===== EXIF (sans emojis) =====
async function addExif(webpPath, packname, author) {
  const img = new webp.Image();
  await img.load(webpPath);

  const json = {
    "sticker-pack-id": "nova-xmd",
    "sticker-pack-name": packname,
    "sticker-pack-publisher": author,
  };

  const exifAttr = Buffer.from([
    0x49,0x49,0x2a,0x00,0x08,0x00,0x00,0x00,
    0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,
    0x00,0x00,0x16,0x00,0x00,0x00,
  ]);

  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
  const exif = Buffer.concat([exifAttr, jsonBuff]);
  exif.writeUIntLE(jsonBuff.length, 14, 4);

  img.exif = exif;
  await img.save(webpPath);
}

// ===== IMAGE -> WEBP =====
function imageToWebp(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([
        "-vf",
        "scale=512:512:force_original_aspect_ratio=decrease," +
          "pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
        "-vcodec", "libwebp",
        "-q:v", "70",
      ])
      .on("end", resolve)
      .on("error", reject)
      .save(output);
  });
}

// ===== VIDEO -> WEBP animé (<=10s) =====
function videoToWebp(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .inputOptions(["-t 10"])
      .outputOptions([
        "-vf",
        "scale=512:512:force_original_aspect_ratio=decrease," +
          "fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
        "-vcodec", "libwebp",
        "-q:v", "70",
        "-loop", "0",
        "-an",
      ])
      .on("end", resolve)
      .on("error", reject)
      .save(output);
  });
}

// ✅ unwrap wrappers (ephemeral/viewOnce)
function unwrapMessage(msg) {
  if (!msg) return null;

  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);

  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);

  return msg;
}

// ===== récupère le quoted proprement =====
function getQuotedMessage(m) {
  const msg = m?.message || {};
  const ci =
    msg?.extendedTextMessage?.contextInfo ||
    msg?.imageMessage?.contextInfo ||
    msg?.videoMessage?.contextInfo ||
    msg?.documentMessage?.contextInfo ||
    null;

  return unwrapMessage(ci?.quotedMessage || null);
}

module.exports = {
  name: "sticker",
  alias: ["s", "stiker", "stick"],
  description: "Sticker image + sticker animé (vidéo ≤ 10s) — NOVA XMD",
  category: "Sticker",
  usage: "Réponds à une image/vidéo avec .s ou envoie avec légende .s / .sticker",

  async execute(sock, m, args, extra = {}) {
    const jid = m.chat || m.key?.remoteJid; // ✅ handler compatible
    const tempDir = ensureTemp();
    const id = Date.now();

    try {
      const msg = unwrapMessage(m.message);
      const quoted = getQuotedMessage(m);

      const image = msg?.imageMessage || quoted?.imageMessage || null;
      const video = msg?.videoMessage || quoted?.videoMessage || null;

      if (!image && !video) {
        return sock.sendMessage(
          jid,
          { text: "❌ Envoie ou réponds à une *image* ou *vidéo (≤10s)* avec *.s* / *.sticker*." },
          { quoted: m }
        );
      }

      // ===== VIDEO =====
      if (video) {
        if ((video.seconds || 0) > 10) {
          return sock.sendMessage(jid, { text: "❌ Vidéo trop longue (max 10s)." }, { quoted: m });
        }

        const stream = await downloadContentFromMessage(video, "video");
        const input = path.join(tempDir, `in_${id}.mp4`);
        const output = path.join(tempDir, `out_${id}.webp`);

        await streamToFile(stream, input);
        await videoToWebp(input, output);
        await addExif(output, PACKNAME, AUTHOR);

        await sock.sendMessage(jid, { sticker: fs.readFileSync(output) }, { quoted: m });

        try { fs.existsSync(input) && fs.unlinkSync(input); } catch {}
        try { fs.existsSync(output) && fs.unlinkSync(output); } catch {}
        return;
      }

      // ===== IMAGE =====
      if (image) {
        const stream = await downloadContentFromMessage(image, "image");
        const input = path.join(tempDir, `in_${id}.jpg`);
        const output = path.join(tempDir, `out_${id}.webp`);

        await streamToFile(stream, input);
        await imageToWebp(input, output);
        await addExif(output, PACKNAME, AUTHOR);

        await sock.sendMessage(jid, { sticker: fs.readFileSync(output) }, { quoted: m });

        try { fs.existsSync(input) && fs.unlinkSync(input); } catch {}
        try { fs.existsSync(output) && fs.unlinkSync(output); } catch {}
        return;
      }
    } catch (e) {
      console.error("Sticker error:", e?.message || e);
      return sock.sendMessage(
        jid,
        { text: "❌ Erreur lors de la création du sticker. (ffmpeg manquant ?)" },
        { quoted: m }
      );
    }
  },
};