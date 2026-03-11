// ==================== commands/pair.js ====================
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");

const config = require("../config");

function onlyDigits(s) {
  return String(s || "").replace(/[^0-9]/g, "");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeCloseSock(sock) {
  try { sock?.end?.(); } catch {}
  try { sock?.ws?.close?.(); } catch {}
}

global.__pairLocks = global.__pairLocks || new Map();
global.__pairRunning = global.__pairRunning || new Set();

module.exports = {
  name: "pair",
  category: "Owner",
  description: "Générer un code de pairing WhatsApp",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;
    const prefix = extra.prefix || config.PREFIX || ".";

    if (!extra.isOwner) {
      return sock.sendMessage(
        from,
        { text: "❌ Commande réservée au owner." },
        { quoted: m }
      );
    }

    const num = onlyDigits(args[0]);

    if (!num || num.length < 8) {
      return sock.sendMessage(
        from,
        { text: `Utilisation : ${prefix}pair 225XXXXXXXX (sans +, sans espace)` },
        { quoted: m }
      );
    }

    const now = Date.now();
    const last = global.__pairLocks.get(num) || 0;

    if (now - last < 25000) {
      const wait = Math.ceil((25000 - (now - last)) / 1000);
      return sock.sendMessage(
        from,
        { text: `⏳ Attends ${wait}s puis réessaie.` },
        { quoted: m }
      );
    }

    if (global.__pairRunning.has(num)) {
      return sock.sendMessage(
        from,
        { text: "⏳ Un pairing est déjà en cours pour ce numéro." },
        { quoted: m }
      );
    }

    global.__pairRunning.add(num);
    global.__pairLocks.set(num, now);

    const accountsRoot = path.join(__dirname, "..", "accounts");
    ensureDir(accountsRoot);

    const sessionDir = path.join(accountsRoot, num);
    ensureDir(sessionDir);

    let tmpSock = null;

    try {
      await sock.sendMessage(
        from,
        { text: "⏳ Génération du code en cours..." },
        { quoted: m }
      );

      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version } = await fetchLatestBaileysVersion();

      state.creds.registered = false;

      tmpSock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: [config.BOT_NAME || "NOVA XMD V1", "Chrome", "1.0.0"],
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });

      tmpSock.ev.on("creds.update", saveCreds);

      let opened = false;

      const waitOpen = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("PAIR_TIMEOUT"));
        }, 120000);

        tmpSock.ev.on("connection.update", (u) => {
          const { connection, lastDisconnect } = u;

          if (connection === "open") {
            opened = true;
            clearTimeout(timeout);
            resolve(true);
          }

          if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (!opened) {
              clearTimeout(timeout);
              reject(new Error(`PAIR_CLOSE_${reason || "UNKNOWN"}`));
            }
          }
        });
      });

      await delay(1500);

      const code = await tmpSock.requestPairingCode(num);
      if (!code) throw new Error("NO_CODE_RETURNED");

      await sock.sendMessage(
        from,
        {
          text:
`╭────────────〔 NOVA XMD V1 〕────────────╮
│ ✅ PAIRING CODE
│ 👤 Numéro : ${num}
│ 🔑 Code : ${code}
╰───────────────────────────────────────╯

📌 Étapes :
WhatsApp → Appareils connectés → Lier un appareil
→ Connecter avec un numéro
→ Entre ce code maintenant

⏳ Le code expire vite.`
        },
        { quoted: m }
      );

      await waitOpen;

      await sock.sendMessage(
        from,
        { text: `✅ Pairing réussi pour ${num}.\n📁 Session enregistrée : /accounts/${num}` },
        { quoted: m }
      );

      safeCloseSock(tmpSock);
      return;
    } catch (e) {
      const msg = String(e?.message || e || "");

      safeCloseSock(tmpSock);

      if (msg.includes("PAIR_TIMEOUT")) {
        return sock.sendMessage(
          from,
          { text: "❌ Temps écoulé. Relance la commande puis entre le code rapidement." },
          { quoted: m }
        );
      }

      if (msg.includes("NO_CODE_RETURNED")) {
        return sock.sendMessage(
          from,
          { text: "❌ Impossible de générer le code pour ce numéro." },
          { quoted: m }
        );
      }

      if (msg.includes("PAIR_CLOSE_401")) {
        return sock.sendMessage(
          from,
          { text: "❌ Session rejetée ou invalide. Réessaie avec un numéro correct." },
          { quoted: m }
        );
      }

      return sock.sendMessage(
        from,
        { text: "❌ Pairing échoué. Vérifie le numéro et réessaie." },
        { quoted: m }
      );
    } finally {
      global.__pairRunning.delete(num);
    }
  },
};