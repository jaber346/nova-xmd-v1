// commands/ch-sticker.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execFile } = require("child_process");
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

const TMP_DIR = path.join(__dirname, "..", "tmp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

async function downloadToFile(url, outPath) {
  const r = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 60000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
    }
  });
  fs.writeFileSync(outPath, r.data);
  return outPath;
}

/**
 * Convertit GIF/MP4 -> WEBP animé (sticker WhatsApp)
 * - 512px max
 * - loop 0
 * - fps 15
 * - limite 8s (important)
 */
async function toAnimatedWebp(inputPath, outputPath) {
  const args = [
    "-y",
    "-t", "8",
    "-i", inputPath,
    "-vf", "scale=512:-1:flags=lanczos,fps=15",
    "-loop", "0",
    "-an",
    "-vsync", "0",
    "-preset", "default",
    "-q:v", "50",
    outputPath
  ];
  await run("ffmpeg", args);
  return outputPath;
}

function uniq(arr) {
  return [...new Set(arr)];
}

function cleanUrl(u) {
  return String(u || "").replace(/&amp;/g, "&");
}

/**
 * ✅ Tenor Scraper (SANS API)
 * Retourne mp4/gif media.tenor.com
 * + fallback sur plusieurs pages (fr + normal)
 */
async function tenorScrape(query, limit = 4) {
  const slug = encodeURIComponent(String(query).trim().replace(/\s+/g, " "));
  const pages = [
    `https://tenor.com/search/${slug}-gifs`,
    `https://tenor.com/fr/search/${slug}-gifs`,
    `https://tenor.com/search/${slug}-gifs?sort=relevance`,
    `https://tenor.com/fr/search/${slug}-gifs?sort=relevance`
  ];

  let body = "";
  for (const pageUrl of pages) {
    try {
      const { data: html } = await axios.get(pageUrl, {
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
        }
      });
      body = String(html || "");
      if (body.includes("media.tenor.com")) break;
    } catch {}
  }

  if (!body) return [];

  const mp4s = body.match(/https:\/\/media\.tenor\.com\/[^"']+\.mp4[^"']*/g) || [];
  const gifs = body.match(/https:\/\/media\.tenor\.com\/[^"']+\.gif[^"']*/g) || [];

  // priorité mp4 puis gif
  const results = uniq([...mp4s.map(cleanUrl), ...gifs.map(cleanUrl)])
    .filter(Boolean)
    .slice(0, limit);

  return results;
}

module.exports = {
  name: "ch-sticker",
  category: "Sticker",
  description: "Recherche 4 stickers animés par mot-clé (sans API) : .ch-sticker limul tempest",

  async execute(sock, m, args, { prefix } = {}) {
    const from = m.key.remoteJid;

    const q = (args || []).join(" ").trim();
    if (!q) {
      return sock.sendMessage(
        from,
        { text: `Utilisation : ${prefix || config.PREFIX || "."}ch-sticker limul tempest`, contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    await sock.sendMessage(
      from,
      { text: `🔎 Recherche stickers: *${q}* ...`, contextInfo: newsletterCtx() },
      { quoted: m }
    );

    let urls;
    try {
      urls = await tenorScrape(q, 4);
    } catch (e) {
      console.error("TENOR SCRAPE ERROR:", e?.message || e);
      return sock.sendMessage(
        from,
        { text: "❌ Erreur recherche Tenor (bloqué/captcha). Réessaie.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    if (!urls.length) {
      return sock.sendMessage(
        from,
        { text: "❌ Aucun résultat trouvé.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    for (let i = 0; i < Math.min(4, urls.length); i++) {
      const url = urls[i];
      const isMp4 = url.toLowerCase().includes(".mp4");
      const inExt = isMp4 ? "mp4" : "gif";

      const stamp = Date.now() + "_" + i;
      const inFile = path.join(TMP_DIR, `chstk_${stamp}.${inExt}`);
      const outFile = path.join(TMP_DIR, `chstk_${stamp}.webp`);

      try {
        await downloadToFile(url, inFile);
        await toAnimatedWebp(inFile, outFile);

        const webp = fs.readFileSync(outFile);

        await sock.sendMessage(
          from,
          { sticker: webp, contextInfo: newsletterCtx() },
          { quoted: m }
        );
      } catch (e) {
        console.error("STICKER CONVERT ERROR:", e?.message || e);
        await sock.sendMessage(
          from,
          { text: "❌ Erreur conversion sticker (ffmpeg manquant ?).", contextInfo: newsletterCtx() },
          { quoted: m }
        );
      } finally {
        try { if (fs.existsSync(inFile)) fs.unlinkSync(inFile); } catch {}
        try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
      }
    }
  }
};