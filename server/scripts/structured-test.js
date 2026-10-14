const { generateStructured } = require("../services/llmclient");
const {
  recommendationResultSchema,
  getResponseJsonSchema,
} = require("../schemas/recommendationSchema");

async function main() {
  const prompt = `
Traveler quiz answers:
${JSON.stringify({ travelAlterEgo: "Foodie", dailyBudget: "$$", minNights: 4, maxNights: 7 })}

Candidate destinations (recommend ONLY from this list, using the exact id):
${JSON.stringify([
  { id: "lisbon-pt", name: "Lisbon", type: "city", country: "Portugal" },
  { id: "kyoto-jp", name: "Kyoto", type: "city", country: "Japan" },
])}
`;

  const { data, model } = await generateStructured({
    prompt,
    systemPrompt: "You are a travel recommendation engine. Rank the destinations for this traveler.",
    jsonSchema: getResponseJsonSchema(),
    zodSchema: recommendationResultSchema,
  });

  console.log(`[${model}]`);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err.message);
});