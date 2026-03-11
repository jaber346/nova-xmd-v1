// ==================== commands/img.js ====================
// Google Images HD (sans API) + fallback thumbnails

const axios = require("axios");

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniq(arr) {
  return [...new Set(arr)];
}

function onlyHttp(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function safeDecode(x) {
  try { return decodeURIComponent(x); } catch { return x; }
}

async function fetchGoogleHtml(query) {
  const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}&hl=fr`;

  const res = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
    },
    timeout: 25000
  });

  return String(res.data || "");
}

/**
 * HD URLs: on parse les liens /imgres?imgurl=... (souvent l'original)
 */
function parseHdUrls(html) {
  const out = [];
  const re = /\/imgres\?imgurl=([^&]+)&imgrefurl=/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = safeDecode(m[1] || "");
    if (!raw) continue;

    // google parfois met des urls encodées (https%3A%2F%2F...)
    const u = safeDecode(raw);

    if (!onlyHttp(u)) continue;
    // filtre thumbnails gstatic
    if (u.includes("encrypted-tbn0.gstatic.com")) continue;

    out.push(u);
  }
  return uniq(out);
}

/**
 * Thumbnails fallback
 */
function parseThumbUrls(html) {
  const matches = html.match(
    /https:\/\/encrypted-tbn0\.gstatic\.com\/images\?q=tbn:[^"&]+/g
  );
  return uniq(matches || []);
}

async function downloadToBuffer(url) {
  const r = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
    },
    maxContentLength: 15 * 1024 * 1024, // 15MB
    maxBodyLength: 15 * 1024 * 1024
  });
  return Buffer.from(r.data);
}

module.exports = {
  name: "img",
  category: "Recherche",
  description: "Recherche image Google en HD (sans API) : .img chat / .img chat 3",

  async execute(sock, m, args) {
    const from = m.key.remoteJid;

    try {
      if (!args || !args.length) {
        return sock.sendMessage(
          from,
          { text: "❌ Utilisation : *.img mot_clé*\nEx: *.img lion*\nOption: *.img lion 3*" },
          { quoted: m }
        );
      }

      // Support: .img chat 3 (dernier chiffre = index optionnel)
      let idx = null;
      const last = args[args.length - 1];
      if (/^\d+$/.test(last)) {
        idx = parseInt(last, 10);
        args = args.slice(0, -1);
      }

      const query = args.join(" ").trim();
      if (!query) {
        return sock.sendMessage(from, { text: "❌ Donne un mot clé." }, { quoted: m });
      }

      await sock.sendMessage(from, { text: `🔎 Recherche HD: *${query}* ...` }, { quoted: m });

      const html = await fetchGoogleHtml(query);

      const hd = parseHdUrls(html);
      const thumbs = parseThumbUrls(html);

      if (!hd.length && !thumbs.length) {
        return sock.sendMessage(from, { text: "❌ Aucune image trouvée." }, { quoted: m });
      }

      // choisir HD si possible
      const source = hd.length ? hd : thumbs;
      let chosen;

      if (idx !== null) {
        const i = Math.max(1, Math.min(idx, source.length)) - 1;
        chosen = source[i];
      } else {
        chosen = pick(source);
      }

      // 1) Essayer d'envoyer par URL (rapide)
      try {
        await sock.sendMessage(
          from,
          {
            image: { url: chosen },
            caption: `🖼️ *NOVA XMD V1*\n🔎 *${query}*\n✨ Mode: ${hd.length ? "HD ✅" : "THUMB ✅"}${idx ? `\n📌 Image #${idx}` : ""}`
          },
          { quoted: m }
        );
        return;
      } catch (e1) {
        // 2) Si hotlink bloque -> télécharger puis envoyer buffer
      }

      // 2) download buffer (contourne certains hotlink)
      try {
        const buf = await downloadToBuffer(chosen);
        await sock.sendMessage(
          from,
          {
            image: buf,
            caption: `🖼️ *NOVA XMD V1*\n🔎 *${query}*\n✨ Mode: ${hd.length ? "HD (Buffer) ✅" : "THUMB (Buffer) ✅"}${idx ? `\n📌 Image #${idx}` : ""}`
          },
          { quoted: m }
        );
        return;
      } catch (e2) {
        // 3) fallback thumb si on était en HD
        if (hd.length && thumbs.length) {
          const fallback = idx !== null
            ? thumbs[Math.max(1, Math.min(idx, thumbs.length)) - 1]
            : pick(thumbs);

          await sock.sendMessage(
            from,
            {
              image: { url: fallback },
              caption: `🖼️ *NOVA XMD V1*\n🔎 *${query}*\n⚠️ HD bloqué → Fallback thumbnail ✅`
            },
            { quoted: m }
          );
          return;
        }

        // dernier recours : lien texte
        return sock.sendMessage(
          from,
          { text: `❌ Impossible d'envoyer l'image.\nLien: ${chosen}` },
          { quoted: m }
        );
      }
    } catch (e) {
      const msgErr =
        String(e?.message || "").includes("429")
          ? "❌ Trop de requêtes (Google). Attends un peu."
          : "❌ Erreur recherche image.";

      return sock.sendMessage(from, { text: msgErr }, { quoted: m });
    }
  }
};