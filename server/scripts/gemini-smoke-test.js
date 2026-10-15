const { generateWithFallback } = require("../services/llmclient");

async function main() {
  const { text, model } = await generateWithFallback("Say hello in one short sentence.");
  console.log(`[${model}] ${text}`);
}

main().catch(console.error);