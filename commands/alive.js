// commands/alive.js
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

// Carte style “Voir Channel”
function channelCardContext() {
  return {
    ...newsletterCtx(),
    externalAdReply: {
      title: config.BOT_NAME || "NOVA XMD V1",
      body: "Voir Channel • Updates & News",
      thumbnailUrl: "https://files.catbox.moe/wgpnnv.jpg",
      sourceUrl: "https://whatsapp.com/channel/0029VbBrAUYAojYjf3Ndw70d",
      mediaType: 1,
      renderLargerThumbnail: true,
      showAdAttribution: false
    }
  };
}

function formatUptime(ms) {
  ms = Math.max(0, Number(ms) || 0);
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${r}s`);
  return parts.join(" ");
}

module.exports = {
  name: "alive",
  alias: ["on", "online", "bot", "status"],
  category: "Tools",
  description: "Vérifie si le bot est en ligne (alive)",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;

    // ping réel: mesure le temps d’un petit envoi
    const t0 = Date.now();

    // uptime réel
    const started = global.botStartTime || Date.now();
    const up = formatUptime(Date.now() - started);

    // infos
    const modeTxt = String(extra.currentMode || "public").toUpperCase();
    const prefix = extra.prefix || config.PREFIX || ".";
    const owner = config.OWNER_NAME || "DEV NOVA";
    const ver = config.VERSION || "1.0.0";

    // envoi "image + caption"
    // (ping final calc après l'envoi)
    const caption =
`╭━━〔 ✅ *${config.BOT_NAME || "NOVA XMD V1"}* 〕━━╮
┃ 🤖 Status : *ONLINE*
┃ ⚡ Ping   : *... ms*
┃ ⏳ Uptime : *${up}*
┣━━━━━━━━━━━━━━━━━━
┃ 🌐 Mode   : *${modeTxt}*
┃ 🔧 Prefix : *${prefix}*
┃ 👨‍💻 Dev    : *${owner}*
┃ 🧩 Version: *${ver}*
╰━━━━━━━━━━━━━━━━━━╯

📢 Rejoins la chaîne officielle (updates & support)`;

    const sent = await sock.sendMessage(
      from,
      {
        image: { url: config.IMAGE_PATH || "https://files.catbox.moe/wgpnnv.jpg" },
        caption,
        contextInfo: channelCardContext()
      },
      { quoted: m }
    );

    // ping final
    const ping = Date.now() - t0;

    // si possible, on édite pas (WhatsApp n'edit pas). Donc on renvoie petite ligne ping.
    await sock.sendMessage(
      from,
      { text: `⚡ Ping: *${ping} ms*`, contextInfo: newsletterCtx() },
      { quoted: sent || m }
    );
  }
};