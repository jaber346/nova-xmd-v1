// ==================== index.js (NOVA XMD V1) ====================
// Stable | Anti reconnect loop | Anti double socket | Anti spam welcome | Prefix par numéro

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = require("./config");

// handlers (safe load)
let newsletterHandler = async () => {};
let antideleteHandler = async () => {};
let welcomeHandler = async () => {};
let antibotHandler = async () => {};

try { newsletterHandler = require("./data/newsletter.js"); } catch {}
try { antideleteHandler = require("./data/antidelete.js"); } catch {}
try { welcomeHandler = require("./data/welcome.js"); } catch {}
try { antibotHandler = require("./data/antibot.js"); } catch {}

const app = express();
const port = process.env.PORT || 3000;

const sessionsDir = path.join(__dirname, "accounts");
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

let tempSocks = {};

global.msgStore = global.msgStore || {};
global.owner = String(config.OWNER_NUMBER || "").replace(/[^0-9]/g, "");
global.botStartTime = global.botStartTime || Date.now();

// protections
global.__locks = global.__locks || new Set();
global.__retries = global.__retries || new Map();
global.__welcomeSent = global.__welcomeSent || new Set();

// ================= AUTO STATUS =================
global.autoStatus = global.autoStatus ?? false;
try {
  const autoFile = path.join(__dirname, "data", "autostatus.json");
  if (fs.existsSync(autoFile)) {
    const j = JSON.parse(fs.readFileSync(autoFile, "utf8"));
    global.autoStatus = !!j.enabled;
  }
} catch {}

// ================== PREFIX DB (par numéro) ==================
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const prefixFile = path.join(dataDir, "prefix.json");
global.prefixDB = global.prefixDB || {};

try {
  if (fs.existsSync(prefixFile)) {
    global.prefixDB = JSON.parse(fs.readFileSync(prefixFile, "utf8")) || {};
  }
} catch {
  global.prefixDB = {};
}

function getPrefixFor(num) {
  const n = String(num || "").replace(/[^0-9]/g, "");
  return global.prefixDB[n] || config.PREFIX || ".";
}

function setPrefixFor(num, newPrefix) {
  const n = String(num || "").replace(/[^0-9]/g, "");
  const p = String(newPrefix || "").trim();
  if (!n || !p) return false;

  global.prefixDB[n] = p;
  try {
    fs.writeFileSync(prefixFile, JSON.stringify(global.prefixDB, null, 2));
    return true;
  } catch {
    return false;
  }
}

// rendre accessible aux commandes
global.getPrefixFor = getPrefixFor;
global.setPrefixFor = setPrefixFor;
// ================== END PREFIX DB ==================

app.use(express.static(__dirname));

// ================= HELPERS =================
function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function newsletterContext() {
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

function channelCardContext() {
  return {
    ...newsletterContext(),
    externalAdReply: {
      title: config.BOT_NAME || "NOVA XMD V1",
      body: "Voir Channel • Updates & News",
      thumbnailUrl: "https://files.catbox.moe/wgpnnv.jpg",
      sourceUrl: "https://whatsapp.com/channel/0029VbBrAUYAojYjf3Ndw70d",
      mediaType: 1,
      renderLargerThumbnail: true,
      showAdAttribution: false
    }
  };
}

// ================= START BOT =================
async function startUserBot(phoneNumber, isPairing = false) {

  const cleanNumber = String(phoneNumber || "").replace(/[^0-9]/g, "");
  const sessionName = `session_${cleanNumber}`;
  const sessionPath = path.join(sessionsDir, sessionName);

  if (global.__locks.has(sessionName)) {
    console.log("Start déjà en cours:", cleanNumber);
    return tempSocks[sessionName];
  }

  global.__locks.add(sessionName);

  try {

    if (isPairing) {
      if (tempSocks[sessionName]) {
        try { tempSocks[sessionName].end(); } catch {}
        delete tempSocks[sessionName];
      }

      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    let currentMode = (config.MODE || "public").toLowerCase();

    const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
      }
    });

    tempSocks[sessionName] = sock;

    // ===== CONNECTION UPDATE =====
    sock.ev.on("connection.update", async (update) => {

      const { connection, lastDisconnect } = update;

      if (connection === "close") {

        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

        try { sock.end?.(); } catch {}

        delete tempSocks[sessionName];

        if (reason === DisconnectReason.loggedOut) {
          console.log("Session logout:", cleanNumber);
          global.__welcomeSent.delete(sessionName);
          return;
        }

        const prev = global.__retries.get(sessionName) || 0;
        const next = Math.min(prev + 1, 5);
        global.__retries.set(sessionName, next);

        const wait = Math.min(2000 * next, 10000);

        console.log("Reconnexion:", cleanNumber, "dans", wait);

        setTimeout(() => startUserBot(cleanNumber), wait);
      }

      if (connection === "open") {

        console.log("Session connectée:", cleanNumber);

        global.__retries.set(sessionName, 0);

        if (global.__welcomeSent.has(sessionName)) return;
        global.__welcomeSent.add(sessionName);

        try {

          const userJid = normJid(sock.user?.id);
          const modeTxt = String(currentMode || "public").toUpperCase();

          await sock.sendMessage(userJid, {
            text:
`╭━━〔 🤖 ${config.BOT_NAME || "NOVA XMD V1"} 〕━━╮
┃ ✅ CONNECTÉ AVEC SUCCÈS
┃ 👨‍💻 Developer : ${config.OWNER_NAME || "DEV NOVA"}
┃ 🌐 Mode : ${modeTxt}
┣━━━━━━━━━━━━━━━━━━
┃ 📢 Rejoins la chaîne officielle
┃ 🔔 Updates • News • Support
╰━━━━━━━━━━━━━━━━━━╯`,
            contextInfo: channelCardContext()
          });

        } catch (e) {
          console.log("WELCOME ERROR:", e);
        }
      }

    });

    sock.ev.on("creds.update", saveCreds);

    // ===== MESSAGES =====
    sock.ev.on("messages.upsert", async (chatUpdate) => {

      const m = chatUpdate.messages?.[0];
      if (!m || !m.message) return;

      const jid = m.key.remoteJid;

      if (jid === "status@broadcast") {
        if (global.autoStatus && !m.key.fromMe) {
          try { await sock.readMessages([m.key]); } catch {}
        }
        return;
      }

      global.msgStore[m.key.id] = m;

      setTimeout(() => {
        delete global.msgStore[m.key.id];
      }, 7200000);

      try { await antibotHandler(sock, m); } catch {}
      try { await newsletterHandler(sock, m); } catch {}

      const cmdHandler = require("./case.js");

      // ✅ prefix par session (par numéro)
      const usedPrefix = getPrefixFor(cleanNumber);

      await cmdHandler(
        sock,
        m,
        usedPrefix,
        (newMode) => { currentMode = String(newMode || "public").toLowerCase(); },
        currentMode
      );

    });

    sock.ev.on("messages.update", async (updates) => {
      for (const upd of updates) {
        try { await antideleteHandler(sock, upd); } catch {}
      }
    });

    sock.ev.on("group-participants.update", async (upd) => {
      try { await welcomeHandler(sock, upd); } catch {}
    });

    return sock;

  } catch (e) {

    console.log("BOT START ERROR:", e);

  } finally {

    global.__locks.delete(sessionName);

  }
}

// ================= RESTORE =================
async function restoreSessions() {

  if (!fs.existsSync(sessionsDir)) return;

  const folders = fs.readdirSync(sessionsDir);

  for (const folder of folders) {

    if (folder.startsWith("session_")) {

      const phoneNumber = folder.replace("session_", "");

      console.log("Restore:", phoneNumber);

      await startUserBot(phoneNumber);

      await delay(4000);
    }
  }
}

// ================= ROUTES =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/pair", async (req, res) => {

  try {

    const num = String(req.query.number || "").replace(/[^0-9]/g, "");

    if (!num || num.length < 8) {
      return res.status(400).json({ error: "Numéro invalide" });
    }

    const sock = await startUserBot(num, true);

    await delay(2500);

    const code = await sock.requestPairingCode(num);

    return res.json({ code });

  } catch (e) {

    console.log("PAIR ERROR:", e);

    return res.status(500).json({ error: "Impossible de générer le code" });
  }

});

// ================= SERVER =================
app.listen(port, async () => {

  console.log("Serveur prêt:", port);

  global.botStartTime = Date.now();

  await restoreSessions();

});
