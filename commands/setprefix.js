// ==================== commands/setprefix.js ====================
// ✅ Prefix par numéro/session (multi-compte)
// ✅ CommonJS | ✅ compatible case.js / index.js (global.setPrefixFor)

module.exports = {
  name: "setprefix",
  category: "Owner",
  description: "Changer le préfixe (par numéro/session)",
  usage: ".setprefix !",

  async execute(sock, m, args, extra = {}) {
    const from = extra.from || m.key?.remoteJid;
    const reply = extra.reply || ((t) => sock.sendMessage(from, { text: t }, { quoted: m }));

    try {
      const isOwner = !!extra.isOwner;

      if (!isOwner) return reply("❌ Owner only.");

      const newPrefix = String(args?.[0] || "").trim();
      if (!newPrefix) return reply(`❌ Utilisation : ${extra.prefix || "."}setprefix !`);

      // Numéro du compte connecté sur CE sock
      const botNum = String(sock.user?.id || "")
        .split(":")[0]
        .split("@")[0]
        .replace(/[^0-9]/g, "");

      if (!botNum) return reply("❌ Impossible de détecter le numéro du bot.");

      // ✅ Sauvegarde prefix pour CE numéro seulement
      let ok = false;

      if (typeof global.setPrefixFor === "function") {
        ok = global.setPrefixFor(botNum, newPrefix);
      } else {
        // fallback (au cas où index.js n'a pas chargé le prefix DB)
        global.prefixDB = global.prefixDB || {};
        global.prefixDB[botNum] = newPrefix;
        ok = true;
      }

      if (!ok) return reply("❌ Erreur: impossible de sauvegarder le prefix.");

      return reply(`✅ Prefix changé pour *${botNum}* → *${newPrefix}*`);
    } catch (e) {
      return reply("❌ Erreur setprefix: " + (e?.message || e));
    }
  },
};
