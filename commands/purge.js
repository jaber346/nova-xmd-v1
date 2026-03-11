const config = require("../config");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// store global des jobs
global.purgeJobs = global.purgeJobs || new Map();

function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

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

module.exports = {
  name: "purge",
  category: "Group",
  description: "Supprime tous les membres non-admins (3s avant, stop possible)",

  async execute(sock, m, args, { isGroup, isOwner, prefix } = {}) {
    const from = m.key.remoteJid;
    const usedPrefix = prefix || config.PREFIX || ".";

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Cette commande fonctionne uniquement en groupe." }, { quoted: m });
    }

    // ✅ on garde owner only (fiable)
    if (!isOwner) {
      return sock.sendMessage(from, { text: "🚫 Commande réservée au propriétaire." , contextInfo: newsletterCtx() }, { quoted: m });
    }

    // déjà en cours ?
    if (global.purgeJobs.has(from)) {
      return sock.sendMessage(from, {
        text: `⚠️ Purge déjà en cours.\nEnvoie *${usedPrefix}stop* pour arrêter.`,
        contextInfo: newsletterCtx()
      }, { quoted: m });
    }

    // metadata
    let meta;
    try {
      meta = await sock.groupMetadata(from);
    } catch {
      return sock.sendMessage(from, { text: "❌ Impossible de lire les infos du groupe." }, { quoted: m });
    }

    const participants = meta.participants || [];

    // bot admin ?
    const botJid = normJid(sock.user?.id || "");
    const botIsAdmin = participants.some(p => normJid(p.id) === botJid && !!p.admin);

    // targets = tous non-admins (on ignore admins + bot)
    const admins = participants.filter(p => p.admin).map(p => normJid(p.id));
    const targets = participants
      .map(p => normJid(p.id))
      .filter(jid => !admins.includes(jid) && jid !== botJid);

    if (!targets.length) {
      return sock.sendMessage(from, {
        text: "✅ Rien à purger : seulement des admins dans ce groupe.",
        contextInfo: newsletterCtx()
      }, { quoted: m });
    }

    // créer job
    const job = { stop: false, startedBy: normJid(m.key.participant || m.sender || "") };
    global.purgeJobs.set(from, job);

    // countdown 3s
    await sock.sendMessage(from, {
      text:
`╭━━〔 🧨 PURGE 〕━━╮
┃ Groupe : ${meta.subject || "Groupe"}
┃ Membres ciblés : ${targets.length}
┃ Début dans : 3 secondes…
╰━━━━━━━━━━━━━━━━━━━━━━╯`,
      contextInfo: newsletterCtx()
    }, { quoted: m });

    for (let i = 0; i < 3; i++) {
      if (job.stop) {
        global.purgeJobs.delete(from);
        return sock.sendMessage(from, {
          text: "🛑 Purge annulée.",
          contextInfo: newsletterCtx()
        }, { quoted: m });
      }
      await delay(1000);
    }

    if (job.stop) {
      global.purgeJobs.delete(from);
      return sock.sendMessage(from, {
        text: "🛑 Purge annulée.",
        contextInfo: newsletterCtx()
      }, { quoted: m });
    }

    await sock.sendMessage(from, {
      text: "🧨 Purge lancée… (suppression rapide par lots)",
      contextInfo: newsletterCtx()
    }, { quoted: m });

    // ✅ “en un coup” => on supprime par lots (chunk) sans grosse attente
    const CHUNK = 25; // tu peux monter à 50 si WhatsApp accepte, 25 est plus stable
    let removed = 0;

    for (let i = 0; i < targets.length; i += CHUNK) {
      if (job.stop) break;

      const batch = targets.slice(i, i + CHUNK);
      try {
        await sock.groupParticipantsUpdate(from, batch, "remove");
        removed += batch.length;
      } catch {
        // fallback: si remove batch échoue, on tente un par un vite fait
        for (const u of batch) {
          if (job.stop) break;
          try {
            await sock.groupParticipantsUpdate(from, [u], "remove");
            removed++;
          } catch {}
        }
      }

      // petite pause anti rate-limit (très courte)
      await delay(600);
    }

    global.purgeJobs.delete(from);

    if (job.stop) {
      return sock.sendMessage(from, {
        text: `🛑 Purge stoppée.\n✅ Supprimés : ${removed}/${targets.length}`,
        contextInfo: newsletterCtx()
      }, { quoted: m });
    }

    return sock.sendMessage(from, {
      text:
`✅ *PURGE TERMINÉE*
👥 Groupe : ${meta.subject || "Groupe"}
🧨 Membres supprimés : ${removed}
🛡️ Admins ignorés : ${admins.length}`,
      contextInfo: newsletterCtx()
    }, { quoted: m });
  }
};