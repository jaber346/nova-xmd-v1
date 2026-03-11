// ==================== data/novaAI.js ====================
const { GoogleGenAI } = require("@google/genai");
const config = require("../config");

const SYSTEM_PROMPT = `
Tu es NOVA, une intelligence artificielle créée par DEV NOVA.
Tu es intelligent, charismatique, sûr de toi, respectueux.
Tu parles naturellement comme ChatGPT.
Tu réponds de manière claire et utile.
`;

async function askNova(message, username = "Utilisateur") {
  try {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY manquante");

    const ai = new GoogleGenAI({ apiKey });
    const model = ai.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const prompt = `${SYSTEM_PROMPT}\n\n${username}: ${message}`;

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || "";

    return text || "⚠️ NOVA n'a pas pu répondre.";
  } catch (err) {
    console.log("NOVA AI ERROR:", err?.message || err);
    return "⚠️ NOVA rencontre un problème technique.";
  }
}

module.exports = { askNova };