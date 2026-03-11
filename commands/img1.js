// commands/img1.js
// ✅ DuckDuckGo Images scraper (sans API) -> renvoie des URL d'images (souvent HD)
// Usage: .img1 sasuke  -> envoie 5 images différentes

const axios = require("axios");
const config = require("../config");

function uniq(arr) {
  return [...new Set(arr)];
}

function pickFirstN(arr, n) {
  return arr.slice(0, Math.max(0, n));
}

async function getVqd(query) {
  // DuckDuckGo retourne un token "vqd" dans le HTML
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
  const { data } = await axios.get(url, {
    timeout: 20000,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
  });

  const html = String(data || "");
  // vqd='...' ou vqd="..."
  const m = html.match(/vqd=['"]([^'"]+)['"]/i);
  return m?.[1] || null;
}

async function ddgImageSearch(query, limit = 5) {
  const vqd = await getVqd(query);
  if (!vqd) throw new Error("VQD_NOT_FOUND");

  // i.js endpoint (JSON)
  // f = filtres: size:Large pour privilégier HD
  const api = "https://duckduckgo.com/i.js";

  const { data } = await axios.get(api, {
    timeout: 25000,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
      referer: "https://duckduckgo.com/",
    },
    params: {
      l: "fr-fr",
      o: "json",
      q: query,
      vqd,
      f: ",, , ,size:Large", // size large (HD)
      p: "1",
      s: "0",
    },
  });

  const results = Array.isArray(data?.results) ? data.results : [];
  // image URL direct = result.image
  const urls = results
    .map((r) => r?.image)
    .filter((u) => typeof u === "string" && u.startsWith("http"));

  // unique + limit
  return pickFirstN(uniq(urls), limit);
}

module.exports = {
  name: "img1",
  category: "Recherche",
  description: "Envoie 5 images HD différentes (sans API). Exemple: .img1 sasuke",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;
    const prefix = extra.prefix || config.PREFIX || ".";

    const q = (args || []).join(" ").trim();
    if (!q) {
      return sock.sendMessage(
        from,
        { text: `❌ Utilisation : ${prefix}img1 mot_clé\nEx: ${prefix}img1 sasuke` },
        { quoted: m }
      );
    }

    await sock.sendMessage(
      from,
      { text: `🔎 Recherche images HD : *${q}* ...` },
      { quoted: m }
    );

    let urls = [];
    try {
      urls = await ddgImageSearch(q, 5);
    } catch (e) {
      const msg =
        String(e?.message || "").includes("status code 202")
          ? "❌ NOVA XMD V1 bloque temporairement. Réessaie dans 1-2 minutes."
          : "❌ Erreur recherche image (réseau / blocage).";
      return sock.sendMessage(from, { text: msg }, { quoted: m });
    }

    // Envoie 5 images
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      try {
        await sock.sendMessage(
          from,
          {
            image: { url },
            caption: `🖼️ *IMG1 HD*\n🔎 *${q}*\n✅ Image ${i + 1}/${urls.length}`
          },
          { quoted: i === 0 ? m : undefined }
        );
      } catch {
        // si une URL fail, on continue
      }
    }
  }
};