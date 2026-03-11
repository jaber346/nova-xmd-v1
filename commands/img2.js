// ==================== commands/img2.js ====================
// Pinterest Image Scraper (sans API)
// Usage: .img2 sasuke -> 5 images
//        .img2 sasuke 10 -> 10 images

const axios = require("axios");
const config = require("../config");

function uniq(arr) {
  return [...new Set(arr)];
}

function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

async function pinterestSearch(query, limit = 5) {
  const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;

  const { data } = await axios.get(url, {
    timeout: 25000,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
  });

  const html = String(data || "");

  // URLs d'images Pinterest
  const matches = html.match(/https:\/\/i\.pinimg\.com\/[^"]+/g) || [];

  const cleaned = matches
    .map((u) => u.replace(/\\u002F/g, "/"))
    .filter((u) => u.includes("originals") || u.includes("736x"));

  return uniq(cleaned).slice(0, limit);
}

module.exports = {
  name: "img2",
  category: "Recherche",
  description: "Envoie des images Pinterest HD. Exemple: .img2 sasuke 10",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;
    const prefix = extra.prefix || config.PREFIX || ".";

    if (!args || !args.length) {
      return sock.sendMessage(
        from,
        { text: `❌ Utilisation : ${prefix}img2 mot_clé [nombre]\nEx: ${prefix}img2 sasuke 10` },
        { quoted: m }
      );
    }

    // Si le dernier argument est un nombre => count
    let count = 5;
    const last = args[args.length - 1];
    if (/^\d+$/.test(last)) {
      count = clamp(parseInt(last, 10), 1, 15); // max 15 pour éviter blocage
      args = args.slice(0, -1);
    }

    const q = (args || []).join(" ").trim();
    if (!q) {
      return sock.sendMessage(
        from,
        { text: `❌ Utilisation : ${prefix}img2 mot_clé [nombre]\nEx: ${prefix}img2 sasuke 10` },
        { quoted: m }
      );
    }

    await sock.sendMessage(
      from,
      { text: `📌 Recherche Pinterest : *${q}*\n🖼️ Nombre : *${count}* ...` },
      { quoted: m }
    );

    let urls = [];
    try {
      urls = await pinterestSearch(q, count);
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: "❌ Erreur Pinterest (blocage réseau ou limite). Réessaie." },
        { quoted: m }
      );
    }

    // Envoie les images
    for (let i = 0; i < urls.length; i++) {
      try {
        await sock.sendMessage(
          from,
          {
            image: { url: urls[i] },
            caption: `📌 *Pinterest HD*\n🔎 *${q}*\n✅ Image ${i + 1}/${urls.length}`
          },
          { quoted: i === 0 ? m : undefined }
        );
      } catch {
        // ignore
      }
    }
  }
};