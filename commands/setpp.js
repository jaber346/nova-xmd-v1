// commands/setpp.js

const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

try {
  const ff = require("@ffmpeg-installer/ffmpeg");
  if (ff?.path) ffmpeg.setFfmpegPath(ff.path);
} catch {}

const TMP = path.join(__dirname, "../temp");
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

function norm(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

async function toBuffer(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

function unwrap(msg) {
  if (!msg) return null;
  if (msg.ephemeralMessage?.message) return unwrap(msg.ephemeralMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrap(msg.viewOnceMessageV2.message);
  if (msg.viewOnceMessage?.message) return unwrap(msg.viewOnceMessage.message);
  return msg;
}

function getCtx(m) {
  const msg = unwrap(m.message);
  if (!msg) return null;

  return (
    msg.extendedTextMessage?.contextInfo ||
    msg.imageMessage?.contextInfo ||
    null
  );
}

function getQuoted(m) {
  const ctx = getCtx(m);
  return { ctx, quoted: unwrap(ctx?.quotedMessage) };
}

function pickImage(q) {
  if (!q) return null;
  if (q.imageMessage) return q.imageMessage;
  if (q.viewOnceMessageV2?.message?.imageMessage)
    return q.viewOnceMessageV2.message.imageMessage;
  return null;
}

async function squareConvert(input, output) {
  return new Promise((res, rej) => {
    ffmpeg(input)
      .outputOptions([
        "-vf",
        "scale=640:640:force_original_aspect_ratio=increase,crop=640:640",
        "-q:v",
        "3",
      ])
      .on("end", res)
      .on("error", rej)
      .save(output);
  });
}

module.exports = {
  name: "setpp",
  category: "Tools",
  description: "Reply personne => PP | Reply image => change PP groupe | Privé => PP",

  async execute(sock, m) {
    const from = norm(m.key.remoteJid);
    const isGroup = from.endsWith("@g.us");
    const botJid = norm(sock.user?.id);

    const { ctx, quoted } = getQuoted(m);

    // ===============================
    // GROUPE
    // ===============================
    if (isGroup) {
      const img = pickImage(quoted);

      // ---- Reply IMAGE => change group PP ----
      if (img) {
        const stamp = Date.now();
        const inFile = path.join(TMP, `in_${stamp}.bin`);
        const outFile = path.join(TMP, `out_${stamp}.jpg`);

        try {
          await sock.sendMessage(from, { text: "🖼️ Conversion automatique..." }, { quoted: m });

          const stream = await downloadContentFromMessage(img, "image");
          const buffer = await toBuffer(stream);
          fs.writeFileSync(inFile, buffer);

          await squareConvert(inFile, outFile);

          const finalBuffer = fs.readFileSync(outFile);
          await sock.updateProfilePicture(from, finalBuffer);

          await sock.sendMessage(from, { text: "✅ Photo du groupe mise à jour." }, { quoted: m });

        } catch (e) {
          await sock.sendMessage(
            from,
            { text: "❌ Impossible (droits ou image invalide)." },
            { quoted: m }
          );
        } finally {
          try { fs.existsSync(inFile) && fs.unlinkSync(inFile); } catch {}
          try { fs.existsSync(outFile) && fs.unlinkSync(outFile); } catch {}
        }

        return;
      }

      // ---- Reply PERSON => send PP ----
      const target = norm(ctx?.participant || "");
      if (target) {
        try {
          const url = await sock.profilePictureUrl(target, "image");
          return sock.sendMessage(
            from,
            {
              image: { url },
              caption: `🖼️ Photo de profil de @${target.split("@")[0]}`,
              mentions: [target],
            },
            { quoted: m }
          );
        } catch {
          return sock.sendMessage(
            from,
            { text: "❌ Photo invisible (privacy)." },
            { quoted: m }
          );
        }
      }

      return sock.sendMessage(
        from,
        { text: "Reply une personne ou une image avec .setpp" },
        { quoted: m }
      );
    }

    // ===============================
    // PRIVÉ
    // ===============================
    if (from.endsWith("@s.whatsapp.net") && from !== botJid) {
      try {
        const url = await sock.profilePictureUrl(from, "image");
        return sock.sendMessage(
          from,
          { image: { url }, caption: "🖼️ Voici la photo de profil." },
          { quoted: m }
        );
      } catch {
        return sock.sendMessage(
          from,
          { text: "❌ Photo de profil invisible." },
          { quoted: m }
        );
      }
    }
  },
};