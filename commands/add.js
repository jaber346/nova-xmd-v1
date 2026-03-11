// commands/add.js
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

function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function onlyDigits(s) {
  return String(s || "").replace(/[^0-9]/g, "");
}

function getContextInfo(m) {
  return (
    m.message?.extendedTextMessage?.contextInfo ||
    m.message?.imageMessage?.contextInfo ||
    m.message?.videoMessage?.contextInfo ||
    m.message?.documentMessage?.contextInfo ||
    {}
  );
}

function getTargetFromMentionOrReply(m) {
  const ctx = getContextInfo(m);

  // @mention
  const mentioned = ctx.mentionedJid?.[0];
  if (mentioned) return normJid(mentioned);

  // reply -> participant du message cité
  const participant = ctx.participant;
  if (participant) return normJid(participant);

  return null;
}

function extractNumberArg(args = []) {
  const raw = String(args[0] || "").trim();
  if (!raw) return null;

  const digits = onlyDigits(raw);
  if (!digits || digits.length < 8) return null;

  return digits;
}

function statusToText(code) {
  // codes fréquents
  if (code === 200) return "✅ Ajout réussi.";
  if (code === 409) return "ℹ️ Déjà dans le groupe.";
  if (code === 403) return "❌ Refusé (privacy / invitation nécessaire).";
  if (code === 408) return "❌ Trop de tentatives (réessaie plus tard).";
  return `❌ Échec (status: ${code || "?"}).`;
}

module.exports = {
  name: "add",
  category: "Group",
  description: "Ajouter un membre au groupe (numéro / mention / reply)",

  async execute(sock, m, args, extra = {}) {
    const from = normJid(m.key?.remoteJid || "");
    const { isGroup, isAdminOrOwner, isBotAdmin } = extra;

    if (!isGroup || !from.endsWith("@g.us")) {
      return sock.sendMessage(
        from,
        { text: "❌ Cette commande fonctionne uniquement en groupe.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    // 1) mention/reply
    let targetJid = getTargetFromMentionOrReply(m);

    // 2) numéro en argument
    if (!targetJid) {
      const num = extractNumberArg(args);
      if (num) targetJid = num + "@s.whatsapp.net";
    }

    if (!targetJid) {
      return sock.sendMessage(
        from,
        {
          text:
`Utilisation :
- ${config.PREFIX || "."}add 226XXXXXXXX
- ${config.PREFIX || "."}add +225XXXXXXX
- Mentionne quelqu’un puis ${config.PREFIX || "."}add
- Reply un message puis ${config.PREFIX || "."}add`,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    }

    targetJid = normJid(targetJid);

    try {
      const res = await sock.groupParticipantsUpdate(from, [targetJid], "add");

      // Baileys renvoie selon versions: tableau ou objet
      let status = null;

      if (Array.isArray(res) && res[0]) status = res[0].status;
      else if (res && res[targetJid]) status = res[targetJid].status;

      // messages
      if (status === 200) {
        return sock.sendMessage(
          from,
          {
            text: `✅ Membre ajouté : @${targetJid.split("@")[0]}`,
            mentions: [targetJid],
            contextInfo: newsletterCtx()
          },
          { quoted: m }
        );
      }

      if (status === 409) {
        return sock.sendMessage(
          from,
          {
            text: `ℹ️ @${targetJid.split("@")[0]} est déjà dans le groupe.`,
            mentions: [targetJid],
            contextInfo: newsletterCtx()
          },
          { quoted: m }
        );
      }

      return sock.sendMessage(
        from,
        {
          text:
`${statusToText(status)}
👤 Cible: @${targetJid.split("@")[0]}

💡 Astuce: si privacy bloque, utilise un lien d’invitation.`,
          mentions: [targetJid],
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    } catch (e) {
      const err = String(e?.message || e || "unknown").slice(0, 160);

      return sock.sendMessage(
        from,
        {
          text:
`❌ Échec d’ajout.
Raison possible: je ne sais pas envoie lui le lien d’invitation c’est pas sorcié

Détail: ${err}`,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    }
  }
};