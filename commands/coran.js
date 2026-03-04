// commands/coran.js
const axios = require("axios");
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

function onlyNum(x) {
  const n = parseInt(String(x || "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

// ✅ Sourate complète (MP3) — Abdullah Matroud
function buildMatroudSurahMp3Url(surahNumber) {
  // Pattern direct QuranicAudio
  return `https://download.quranicaudio.com/quran/abdullah_matroud/${pad3(surahNumber)}.mp3`;
}

async function fetchBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
    }
  });
  return Buffer.from(res.data);
}

module.exports = {
  name: "coran",
  category: "Islam",
  description: "Envoyer l'audio MP3 d'une sourate. Ex: .coran 1",

  async execute(sock, m, args) {
    const from = m.key.remoteJid;

    const surah = onlyNum(args[0]);
    if (!surah || surah < 1 || surah > 114) {
      return sock.sendMessage(
        from,
        { text: `Utilisation : ${config.PREFIX || "."}coran 1-114`, contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    try {
      const mp3Url = buildMatroudSurahMp3Url(surah);

      await sock.sendMessage(
        from,
        {
          text: `🎧 *Coran Audio*\n📖 Sourate : *${surah}*\n👳‍♂️ Réciteur : *Abdullah Matroud*`,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );

      // ✅ Télécharge en buffer puis envoie
      const audioBuffer = await fetchBuffer(mp3Url);

      return sock.sendMessage(
        from,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          ptt: false,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    } catch (e) {
      console.error("CORAN CMD ERROR:", e?.message || e);
      return sock.sendMessage(
        from,
        { text: "❌ Impossible d'envoyer l'audio maintenant (lien bloqué ou fichier trop lourd). Réessaie.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }
  }
};