module.exports = {
  name: "mode",
  category: "Owner",
  description: "Changer le mode du bot (public / private)",

  async execute(sock, m, args, extra = {}) {

    const from = m.key.remoteJid;

    const {
      prefix = ".",
      isOwner,
      setMode,
      mode
    } = extra;

    if (!isOwner) {
      return sock.sendMessage(
        from,
        { text: "🚫 Commande réservée au propriétaire." },
        { quoted: m }
      );
    }

    const arg = (args[0] || "").toLowerCase();

    if (["public", "on", "1"].includes(arg)) {

      setMode("public");

      return sock.sendMessage(
        from,
        {
          text:
`🔓 *Mode PUBLIC activé*

Tout le monde peut utiliser le bot.`
        },
        { quoted: m }
      );
    }

    if (["private", "prive", "off", "0"].includes(arg)) {

      setMode("private");

      return sock.sendMessage(
        from,
        {
          text:
`🔒 *Mode PRIVATE activé*

Seul le propriétaire peut utiliser le bot.`
        },
        { quoted: m }
      );
    }

    // Affiche le mode actuel
    return sock.sendMessage(
      from,
      {
        text:
`📌 Mode actuel : *${mode || "public"}*

Utilisation :
${prefix}mode public
${prefix}mode private`
      },
      { quoted: m }
    );
  }
};