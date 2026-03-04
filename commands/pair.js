// ==================== commands/pair.js (FIXED) ====================
// ✅ CommonJS | ✅ code VALIDE | ✅ garde le socket vivant | ✅ timeout | ✅ compatible NOVA XMD V1

const fs = require("fs");
const path = require("path");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  delay,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");

const config = require("../config");

function onlyDigits(s) {
  return String(s || "").replace(/[^0-9]/g, "");
}

// Anti spam / anti double
global.__pairLocks = global.__pairLocks || new Map(); // num -> timestamp
global.__pairRunning = global.__pairRunning || new Set(); // num in progress

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = {
  name: "pair",
  category: "Owner",
  description: "Générer un code de pairing WhatsApp (le bot doit être déjà connecté)",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;
    const prefix = extra.prefix || config.PREFIX || ".";

    const num = onlyDigits(args[0]);

    if (!num || num.length < 8) {
      return sock.sendMessage(
        from,
        { text: `Utilisation : ${prefix}pair 225XXXXXXXXXX (sans +, sans espace)` },
        { quoted: m }
      );
    }

    // ✅ Cooldown 25s
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
        { text: "⏳ Pair déjà en cours pour ce numéro..." },
        { quoted: m }
      );
    }

    global.__pairRunning.add(num);
    global.__pairLocks.set(num, now);

    await sock.sendMessage(
      from,
      { text: "⏳ Génération du code en cours... Ne ferme pas WhatsApp." },
      { quoted: m }
    );

    // ✅ on enregistre la session ici (IMPORTANT)
    const accountsRoot = path.join(__dirname, "..", "accounts");
    ensureDir(accountsRoot);

    const sessionDir = path.join(accountsRoot, num);
    ensureDir(sessionDir);

    let tmpSock;

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version } = await fetchLatestBaileysVersion();

      // IMPORTANT: mode pairing -> registered=false
      state.creds.registered = false;

      tmpSock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["NOVA XMD V1", "Chrome", "1.0.0"],
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
      });

      tmpSock.ev.on("creds.update", saveCreds);

      let isOpen = false;

      // On attend que la personne entre le code (sinon le code devient “incorrect”)
      const waitOpen = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("PAIR_TIMEOUT")), 120000); // 2 minutes

        tmpSock.ev.on("connection.update", (u) => {
          if (u.connection === "open") {
            isOpen = true;
            clearTimeout(timeout);
            resolve(true);
          }

          if (u.connection === "close") {
            const reason = new Boom(u.lastDisconnect?.error)?.output?.statusCode;
            // loggedOut / bad session etc.
            if (!isOpen) {
              clearTimeout(timeout);
              reject(new Error(`PAIR_CLOSE_${reason || "UNKNOWN"}`));
            }
          }
        });
      });

      // ✅ mini délai : laisse WA init la connexion avant requestPairingCode
      await delay(1500);

      const code = await tmpSock.requestPairingCode(num);
      if (!code) throw new Error("NO_CODE_RETURNED");

      // ✅ on garde tmpSock en vie (très important)
      const text =
`╭──────────────〔 NOVA XMD V1 〕──────────────╮
│ ✅ PAIRING CODE
│ 👤 Numéro : ${num}
│ 🔑 Code : ${code}
│ 🏷️ DEVNOVAS
╰────────────────────────────────────────────╯

📌 Sur le téléphone (${num}) :
WhatsApp → Appareils connectés → Lier un appareil
→ “Connecter avec un numéro” → Entrer le code

⏳ Expire vite (≈ 1 min), entre le code maintenant.`;

      await sock.sendMessage(from, { text }, { quoted: m });

      // ✅ attendre que la personne entre le code et que la session s’ouvre
      await waitOpen;

      // ✅ succès
      await sock.sendMessage(
        from,
        { text: `✅ Pairing réussi pour ${num} ! Session enregistrée dans /accounts/${num}` },
        { quoted: m }
      );

      try { tmpSock.end(); } catch {}
      global.__pairRunning.delete(num);
      return;

    } catch (e) {
      try { tmpSock?.end(); } catch {}
      global.__pairRunning.delete(num);

      const msg = String(e?.message || e);

      if (msg.includes("PAIR_TIMEOUT")) {
        return sock.sendMessage(
          from,
          { text: "❌ Temps écoulé. Le code a expiré (2 min). Relance la commande et entre le code rapidement." },
          { quoted: m }
        );
      }

      return sock.sendMessage(
        from,
        { text: "❌ Pairing échoué. Vérifie le numéro (sans +, sans espace) et réessaie." },
        { quoted: m }
      );
    }
  },
};