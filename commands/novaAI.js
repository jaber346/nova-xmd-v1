// ==================== commands/nova.js ====================
const { askNova } = require("../data/novaAI");
const config = require("../config");

module.exports = {
  name: "nova",
  category: "Tools",
  description: "Chat avec NOVA (Gemini). Ex: .nova bonjour",

  async execute(sock, m, args, extra = {}) {
    try {
      const from = m.key.remoteJid;
      const prefix = extra.prefix || config.PREFIX || ".";
      const text = (args || []).join(" ").trim();

      if (!text) {
        return sock.sendMessage(
          from,
          { text: `Utilisation : ${prefix}nova bonjour` },
          { quoted: m }
        );
      }

      const username = m.pushName || "Utilisateur";
      const reply = await askNova(text, username);

      return sock.sendMessage(
        from,
        { text: reply || "❌ Aucune réponse reçue." },
        { quoted: m }
      );
    } catch (e) {
      console.log("NOVA ERROR:", e?.message || e);
      return sock.sendMessage(
        m.key.remoteJid,
        { text: "⚠️ Erreur avec NOVA AI." },
        { quoted: m }
      );
    }
  }
};