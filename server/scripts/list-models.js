require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  const pager = await ai.models.list();
  for await (const model of pager) {
    // Only show models that can generate text
    if (model.supportedActions && model.supportedActions.includes("generateContent")) {
      console.log(model.name);
    }
  }
}

main().catch(console.error);