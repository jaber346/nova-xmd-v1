// data/welcome.js
const fs = require("fs");
const path = require("path");
const config = require("../config");

const welcomeDb = path.join(__dirname, "welcome.json");
const goodbyeDb = path.join(__dirname, "goodbye.json");

function ensure(file, obj) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}
function read(file, fallback) {
  ensure(file, fallback);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function newsletterCtx() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363423249667073@newsletter",
      newsletterName: config.BOT_NAME || "NOVA XMD V1",
      serverMessageId: 1,
    },
  };
}

async function getPp(sock, jid) {
  try {
    return await sock.profilePictureUrl(jid, "image");
  } catch {
    return "https://files.catbox.moe/wgpnnv.jpg"; // fallback
  }
}

function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

module.exports = async (sock, upd) => {
  try {
    if (!upd?.id || !upd?.participants?.length) return;
    const groupJid = upd.id;

    // actions: "add" | "remove" | ...
    const action = upd.action;

    const w = read(welcomeDb, { welcome: false });
    const g = read(goodbyeDb, { goodbye: false });

    // charger metadata (info groupe)
    let meta = null;
    try {
      meta = await sock.groupMetadata(groupJid);
    } catch {}

    const subject = meta?.subject || "Groupe";
    const size = meta?.participants?.length || 0;
    const admins = (meta?.participants || []).filter((p) => p.admin).length;

    // ✅ Description du groupe (anti crash)
    const groupdescription = meta?.desc || "Aucune description définie.";

    // ✅ date / heure
    const now = new Date();
    const date = now.toLocaleDateString("fr-FR");
    const time = now.toLocaleTimeString("fr-FR");

    for (const raw of upd.participants) {
      const userJid = normJid(raw);
      const ppUrl = await getPp(sock, userJid);

      // ✅ WELCOME
      if (action === "add" && w.welcome) {
        const caption =
`╭━━〔 👋 *BIENVENUE* 〕━━╮
┃ 👤 Membre : @${userJid.split("@")[0]}
┃ 🆔 ID : ${userJid.split("@")[0]}
┣━━━━━━━━━━━━━━━━━━
┃ 🏆 Tu es le *${memberNumber}ème* membre
┣━━━━━━━━━━━━━━━━━━
┃ 👥 Groupe : ${subject}
┃ 👤 Membres : ${size}
┃ 👑 Admins : ${admins}
┣━━━━━━━━━━━━━━━━━━
┃ 📅 Date : ${date}
┃ ⏰ Heure : ${time}
┣━━━━━━━━━━━━━━━━━━
┃ 📜 Description :
┃ ${groupdescription}
╰━━━━━━━━━━━━━━━━━━╯

🤖 ${config.BOT_NAME || "NOVA XMD V1"} • Système Automatique`;

        await sock.sendMessage(groupJid, {
          image: { url: ppUrl },
          caption,
          mentions: [userJid],
          contextInfo: newsletterCtx(),
        });
      }

      // ✅ GOODBYE
      if (action === "remove" && g.goodbye) {
        const caption =
`╭━━〔 👋 *AU REVOIR* 〕━━╮
┃ 👤 Membre : @${userJid.split("@")[0]}
┃ 🆔 ID : ${userJid.split("@")[0]}
┣━━━━━━━━━━━━━━━━━━
┃ 👥 Groupe : ${subject}
┃ 👤 Membres : ${size}
┣━━━━━━━━━━━━━━━━━━
┃ 📅 Date : ${date}
┃ ⏰ Heure : ${time}
┣━━━━━━━━━━━━━━━━━━
┃ 📜 Description :
┃ ${groupdescription}
╰━━━━━━━━━━━━━━━━━━╯

🤖 ${config.BOT_NAME || "NOVA XMD V1"} • Système Automatique`;

        await sock.sendMessage(groupJid, {
          image: { url: ppUrl },
          caption,
          mentions: [userJid],
          contextInfo: newsletterCtx(),
        });
      }
    }
  } catch (e) {
    console.log("WELCOME HANDLER ERROR:", e?.message || e);
  }
};