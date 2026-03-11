const { FANCY_STYLES, fancyApply } = require("../data/fancyStyles");
const config = require("../config");

module.exports = {
  name: "fancy",
  alias: ["font", "style"],
  category: "Tools",
  description: "Convertit un texte en fancy",
  usage: ".fancy <num> <texte>",

  async execute(sock, m, args, extra = {}) {
    const jid = m.key.remoteJid;
    const prefix = extra.prefix || config.PREFIX || ".";

    const num = args[0];
    const text = args.slice(1).join(" ").trim();

    if (!num || !text) {
      return sock.sendMessage(
        jid,
        { text: `Usage:\n• ${prefix}fancylist\n• ${prefix}fancy <num> <texte>\nEx: ${prefix}fancy 2 NOVA XMD V1` },
        { quoted: m }
      );
    }

    const out = fancyApply(num, text);
    if (!out) {
      return sock.sendMessage(
        jid,
        { text: `❌ Numéro invalide. Choisis entre 1 et ${FANCY_STYLES.length} (voir ${prefix}fancylist).` },
        { quoted: m }
      );
    }

    return sock.sendMessage(jid, { text: out }, { quoted: m });
  }
};