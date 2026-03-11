const { FANCY_STYLES, fancyListPreview } = require("../data/fancyStyles");
const config = require("../config");

module.exports = {
  name: "fancylist",
  alias: ["fonts", "styles", "fstyles"],
  category: "Tools",
  description: "Affiche la liste des styles fancy",
  usage: ".fancylist",

  async execute(sock, m, args, extra = {}) {
    const jid = m.key.remoteJid;
    const prefix = extra.prefix || config.PREFIX || ".";

    const header =
      `📌 *FANCYLIST — ${FANCY_STYLES.length} STYLES*\n` +
      `📝 Exemple: *DEV NOVA TECH*\n\n`;

    const list = fancyListPreview("DEV NOVA TECH");

    const text =
      header +
      list +
      `\n\nUtilise: *${prefix}fancy <num> <texte>*\nEx: *${prefix}fancy 2 DEV NOVA TECH*`;

    return sock.sendMessage(jid, { text }, { quoted: m });
  }
};