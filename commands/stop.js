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

module.exports = {
  name: "stop",
  category: "Owner",
  description: "Arrêter une action en cours (kickall / purge / etc)",

  async execute(sock, m, args, { isOwner } = {}) {
    const from = m.key.remoteJid;

    if (!isOwner) {
      return sock.sendMessage(
        from,
        { text: "🚫 Commande réservée au propriétaire.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    let stopped = false;

    // ✅ stop kickall
    if (global.kickallJobs && global.kickallJobs.has(from)) {
      const job = global.kickallJobs.get(from);
      if (job) job.stop = true;
      stopped = true;
    }

    // ✅ stop purge
    if (global.purgeJobs && global.purgeJobs.has(from)) {
      const job = global.purgeJobs.get(from);
      if (job) job.stop = true;
      stopped = true;
    }

    // ✅ (optionnel) stop d'autres jobs plus tard
    // ex: global.someJobs?.get(from).stop = true;

    if (!stopped) {
      return sock.sendMessage(
        from,
        { text: "ℹ️ Aucune action en cours.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    return sock.sendMessage(
      from,
      { text: "🛑 Stop reçu. Arrêt en cours…", contextInfo: newsletterCtx() },
      { quoted: m }
    );
  }
};