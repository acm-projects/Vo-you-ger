const destinations = require("../data/destinations.json");
const { buildPrompt } = require("../services/promptBuilder");

// 1. Data sanity: unique ids and required fields
const ids = new Set();
for (const d of destinations) {
  for (const field of ["id", "name", "type", "country", "tags", "budget", "description"]) {
    if (!d[field]) console.log(`MISSING ${field} on`, d.id || d.name);
  }
  if (ids.has(d.id)) console.log("DUPLICATE id:", d.id);
  ids.add(d.id);
}
console.log(`destinations: ${destinations.length}, unique ids: ${ids.size}`);

// 2. Prompt building with a cheap, low-risk quiz
const { prompt, candidateIds } = buildPrompt({
  quiz: { budgetLevel: "$", highRiskDestWillingness: false, travelAlterEgo: "Foodie", minNights: 4, maxNights: 7 },
  nationalities: ["United States"],
  destinations,
});
console.log(`candidates after filtering: ${candidateIds.length}`);
console.log(prompt.slice(0, 600) + "\n...");