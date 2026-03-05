// ==================== commands/setprefix.js ====================
module.exports = {
  name: "setprefix",
  category: "Owner",
  description: "Changer le préfixe (par numéro/session)",

  async execute(sock, m, args, extra = {}) {
    try {
      const { isOwner, sender } = extra;

      if (!isOwner) {
        return sock.sendMessage(m.chat, { text: "❌ Owner only." }, { quoted: m });
      }

      const newPrefix = (args[0] || "").trim();
      if (!newPrefix) {
        return sock.sendMessage(
          m.chat,
          { text: "❌ Utilisation : .setprefix !" },
          { quoted: m }
        );
      }

      // Numéro du bot/session (celui qui est connecté)
      const botNum = String(sock.user?.id || "").split(":")[0].split("@")[0];

      // Sauvegarde prefix pour CE numéro seulement
      const ok = global.setPrefixFor
        ? global.setPrefixFor(botNum, newPrefix)
        : (global.prefixDB && (global.prefixDB[botNum] = newPrefix), true);

      if (!ok) {
        return sock.sendMessage(
          m.chat,
          { text: "❌ Erreur: impossible de sauvegarder le prefix." },
          { quoted: m }
        );
      }

      return sock.sendMessage(
        m.chat,
        { text: `✅ Prefix changé pour *${botNum}* → *${newPrefix}*` },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        m.chat,
        { text: "❌ Erreur setprefix: " + (e?.message || e) },
        { quoted: m }
      );
    }
  },
};
